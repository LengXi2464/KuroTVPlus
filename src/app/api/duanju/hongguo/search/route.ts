import { NextRequest, NextResponse } from 'next/server';

import { hongguoSearch } from '@/lib/hongguo/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 60);
  if (!q) {
    return NextResponse.json({ ok: false, message: '缺少搜索关键词' }, { status: 400 });
  }
  try {
    const items = await hongguoSearch(q, 40);
    return NextResponse.json(
      { ok: true, items },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: (err as Error).message || '搜索失败' },
      { status: 502 }
    );
  }
}
