import { getConfig } from '@/lib/config';

export type HuangguoAccessState = {
  required: boolean;
  password: string;
  mode: 'off' | 'custom' | 'auto' | 'env';
  nextRotateAt?: number;
};

const digestHex = async (text: string): Promise<string> => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/** 由种子 + 时间片推导当前密码，不需要定时任务即可自动更换。 */
async function passwordFromSeed(
  seed: string,
  rotateHours: number
): Promise<{ password: string; nextRotateAt: number }> {
  const hours = Math.max(1, Math.round(rotateHours || 24));
  const period = hours * 3600_000;
  const index = Math.floor(Date.now() / period);
  const hex = await digestHex(`huangguo:${seed}:${index}`);
  return {
    password: hex.slice(0, 8).toUpperCase(),
    nextRotateAt: (index + 1) * period,
  };
}

export async function getHuangguoAccess(): Promise<HuangguoAccessState> {
  let cfg: Awaited<ReturnType<typeof getConfig>>['HuangguoAccessConfig'];
  try {
    cfg = (await getConfig()).HuangguoAccessConfig;
  } catch {
    cfg = undefined;
  }
  const envPassword = process.env.HUANGGUO_ACCESS_PASSWORD || '';
  const envFallback: HuangguoAccessState = envPassword
    ? { required: true, password: envPassword, mode: 'env' }
    : { required: false, password: '', mode: 'off' };

  // 后台从未保存过配置：沿用环境变量（向后兼容）
  if (!cfg || !cfg.UpdatedAt) return envFallback;
  // 后台一旦保存过，后台配置即为唯一依据
  if (!cfg.Enabled) return { required: false, password: '', mode: 'off' };
  if (cfg.CustomPassword) {
    return { required: true, password: cfg.CustomPassword, mode: 'custom' };
  }
  if (cfg.AutoRotate) {
    const { password, nextRotateAt } = await passwordFromSeed(
      cfg.Seed || 'huangguo',
      cfg.RotateHours || 24
    );
    return { required: true, password, mode: 'auto', nextRotateAt };
  }
  return envFallback;
}

/** cookie 中保存的令牌（密码变化后令牌自动失效）。 */
export async function accessToken(password: string): Promise<string> {
  return digestHex(`huangguo-gate-v1:${password}`);
}
