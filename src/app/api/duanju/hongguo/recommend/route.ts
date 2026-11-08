import { NextRequest, NextResponse } from 'next/server';

import { hongguoRecommend } from '@/lib/hongguo/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 60, 1), 120);
  const skip = Math.max(Number(sp.get('skip')) || 0, 0);
  try {
    const page = await hongguoRecommend(limit, skip);
    return NextResponse.json(
      { ok: true, items: page.items, hasMore: page.hasMore, nextSkip: page.nextSkip },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: (err as Error).message || '推荐加载失败' },
      { status: 502 }
    );
  }
}
