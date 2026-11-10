import { NextRequest, NextResponse } from 'next/server';

import { absUrl, fetchCover } from '@/lib/huangguo/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const u = absUrl(req.nextUrl.searchParams.get('u') || '');
  if (!/^https:\/\//i.test(u)) return new NextResponse('bad url', { status: 400 });
  try {
    const { body, type } = await fetchCover(u);
    return new NextResponse(body, {
      headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {
    return new NextResponse('cover error', { status: 502 });
  }
}
