import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig, setCachedConfig } from '@/lib/config';
import { getHuangguoAccess } from '@/lib/huangguo/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest): Promise<string | null> {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) return null;
  if (authInfo.username === process.env.USERNAME) return authInfo.username;
  const { db } = await import('@/lib/db');
  const info = await db.getUserInfoV2(authInfo.username);
  if (info && (info.role === 'admin' || info.role === 'owner') && !info.banned) {
    return authInfo.username;
  }
  return null;
}

const noStore = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  if ((process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage') === 'localstorage') {
    return NextResponse.json({ error: '本地存储模式不支持后台配置' }, { status: 400 });
  }
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: '权限不足' }, { status: 401 });
  }
  const config = await getConfig();
  const cfg = config.HuangguoAccessConfig;
  const access = await getHuangguoAccess();
  return NextResponse.json(
    {
      enabled: !!cfg?.Enabled,
      autoRotate: !!cfg?.AutoRotate,
      rotateHours: cfg?.RotateHours || 24,
      customPassword: cfg?.CustomPassword || '',
      required: access.required,
      mode: access.mode,
      currentPassword: access.password,
      nextRotateAt: access.nextRotateAt || null,
    },
    { headers: noStore }
  );
}

export async function POST(request: NextRequest) {
  if ((process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage') === 'localstorage') {
    return NextResponse.json({ error: '本地存储模式不支持后台配置' }, { status: 400 });
  }
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: '权限不足' }, { status: 401 });
  }

  let body: {
    enabled?: boolean;
    autoRotate?: boolean;
    rotateHours?: number;
    customPassword?: string;
    rotateNow?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const enabled = !!body.enabled;
  const autoRotate = enabled && !!body.autoRotate;
  const customPassword = autoRotate ? '' : (body.customPassword || '').trim();
  const rotateHours = Math.min(720, Math.max(1, Math.round(Number(body.rotateHours) || 24)));

  if (enabled && (!autoRotate && !customPassword)) {
    return NextResponse.json({ error: '请填写自定义密码，或开启自动更换' }, { status: 400 });
  }

  try {
    const config = await getConfig();
    const prev = config.HuangguoAccessConfig;
    config.HuangguoAccessConfig = {
      Enabled: enabled,
      CustomPassword: customPassword,
      AutoRotate: autoRotate,
      RotateHours: rotateHours,
      Seed: body.rotateNow || !prev?.Seed ? crypto.randomUUID() : prev.Seed,
      UpdatedAt: Date.now(),
    };

    const { db } = await import('@/lib/db');
    await db.saveAdminConfig(config);
    await setCachedConfig(config);

    const access = await getHuangguoAccess();
    return NextResponse.json(
      {
        success: true,
        enabled,
        autoRotate,
        rotateHours,
        customPassword,
        required: access.required,
        mode: access.mode,
        currentPassword: access.password,
        nextRotateAt: access.nextRotateAt || null,
      },
      { headers: noStore }
    );
  } catch (error) {
    return NextResponse.json(
      { error: '保存失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
