import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig, setCachedConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest): Promise<boolean> {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) return false;
  if (authInfo.username === process.env.USERNAME) return true;
  const { db } = await import('@/lib/db');
  const info = await db.getUserInfoV2(authInfo.username);
  return !!info && (info.role === 'admin' || info.role === 'owner') && !info.banned;
}

const noStore = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: '权限不足' }, { status: 401 });
  }
  const config = await getConfig();
  const cfg = config.EntryCaptureConfig;
  return NextResponse.json(
    { enabled: !!cfg?.Enabled, users: cfg?.Users || [] },
    { headers: noStore }
  );
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: '权限不足' }, { status: 401 });
  }
  let body: { enabled?: boolean; users?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
  const enabled = !!body.enabled;
  const users = Array.isArray(body.users)
    ? Array.from(
        new Set(body.users.map((u) => String(u).trim()).filter(Boolean))
      )
    : [];

  try {
    const config = await getConfig();
    config.EntryCaptureConfig = { Enabled: enabled, Users: users };
    const { db } = await import('@/lib/db');
    await db.saveAdminConfig(config);
    await setCachedConfig(config);
    return NextResponse.json(
      { success: true, enabled, users },
      { headers: noStore }
    );
  } catch (error) {
    return NextResponse.json(
      { error: '保存失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
