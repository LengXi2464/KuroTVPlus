import { NextRequest, NextResponse } from 'next/server';

import { hongguoDetail } from '@/lib/hongguo/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get('id') || '').trim();
  if (!/^\d{1,30}$/.test(id)) {
    return NextResponse.json({ ok: false, message: '缺少有效的剧集 id' }, { status: 400 });
  }
  try {
    const { series } = await hongguoDetail(id);
    return NextResponse.json(
      { ok: true, series },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800' } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: (err as Error).message || '短剧详情加载失败' },
      { status: 502 }
    );
  }
}
