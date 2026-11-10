import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { entryCaptureFor } from '@/lib/huangguo/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 是否为进站留影目标：后台圈选名单内的登录用户（管理员除外）。 */
export async function GET(req: NextRequest) {
  const auth = getAuthInfoFromCookie(req);
  const capture = await entryCaptureFor(auth?.username, auth?.role);
  return NextResponse.json(
    { capture },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
