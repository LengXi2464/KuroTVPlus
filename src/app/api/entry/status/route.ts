import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 进站门禁是否需要拍照：管理员（owner/admin）不需要。 */
export async function GET(req: NextRequest) {
  const auth = getAuthInfoFromCookie(req);
  const isAdmin = !!auth && (auth.role === 'owner' || auth.role === 'admin');
  return NextResponse.json(
    { capture: !isAdmin },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
