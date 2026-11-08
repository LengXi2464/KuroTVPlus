import { NextRequest, NextResponse } from 'next/server';

import { hongguoDetail } from '@/lib/hongguo/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const seriesId = (req.nextUrl.searchParams.get('series_id') || '').trim();
  if (!/^\d{1,30}$/.test(seriesId)) {
    return NextResponse.json({ ok: false, message: '缺少有效的 series_id' }, { status: 400 });
  }
  try {
    const { episodes } = await hongguoDetail(seriesId);
    return NextResponse.json(
      { ok: true, items: episodes },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800' } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: (err as Error).message || '集数加载失败' },
      { status: 502 }
    );
  }
}
