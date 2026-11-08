import { NextRequest, NextResponse } from 'next/server';

import { hongguoFilters } from '@/lib/hongguo/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GENRES = new Set(['short_play', 'comic_series', 'ai_series']);

export async function GET(req: NextRequest) {
  const genreRaw = (req.nextUrl.searchParams.get('genre') || 'short_play').trim();
  const genre = GENRES.has(genreRaw) ? genreRaw : 'short_play';
  try {
    const rows = await hongguoFilters(genre);
    return NextResponse.json(
      { ok: true, rows },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: (err as Error).message || '筛选条件加载失败' },
      { status: 502 }
    );
  }
}
