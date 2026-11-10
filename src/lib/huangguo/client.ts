/** 黄果前端访问密码相关的公共工具。 */

export const NEED_PASSWORD_EVENT = 'huangguo:need-password';
export const UNLOCKED_FLAG = 'huangguo:unlocked';

/** 统一 fetch：遇到 401（密码被更换或过期）时通知 Gate 重新要密码。 */
export async function huangguoFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(NEED_PASSWORD_EVENT));
    }
    throw new Error('访问密码已更换，请输入新密码');
  }
  return res;
}
