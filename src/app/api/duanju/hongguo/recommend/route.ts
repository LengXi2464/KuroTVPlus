import { NextRequest, NextResponse } from 'next/server';

import { hongguoRecommend } from '@/lib/hongguo/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')) || 60, 1), 120);
  try {
    const items = await hongguoRecommend(limit);
    return NextResponse.json(
      { ok: true, items },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: (err as Error).message || '推荐加载失败' },
      { status: 502 }
    );
  }
}
