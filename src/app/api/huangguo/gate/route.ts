import { NextRequest, NextResponse } from 'next/server';

import {
  GATE_COOKIE,
  gateRequired,
  gateTokenFor,
  gateUnlockedRequest,
  isOwnerRequest,
  recordVisit,
} from '@/lib/huangguo/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const owner = isOwnerRequest(req);
  const unlocked = owner || (await gateUnlockedRequest(req));
  return NextResponse.json(
    { required: await gateRequired(), unlocked, admin: owner },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  if (!(await gateRequired())) return NextResponse.json({ ok: true });
  let password = '';
  try {
    const body = (await req.json()) as { password?: string };
    password = body.password || '';
  } catch {
    password = '';
  }
  const token = await gateTokenFor(password);
  if (!token) {
    return NextResponse.json({ ok: false, message: '密码错误' }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true });
  recordVisit(req, false);
  res.cookies.set(GATE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
