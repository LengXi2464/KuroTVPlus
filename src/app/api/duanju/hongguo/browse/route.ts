import { NextRequest, NextResponse } from 'next/server';

import { hongguoBrowse } from '@/lib/hongguo/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GENRES = new Set(['short_play', 'comic_series', 'ai_series']);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const genreRaw = (sp.get('genre') || 'short_play').trim();
  const genre = GENRES.has(genreRaw) ? genreRaw : 'short_play';
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 60, 1), 120);
  const skip = Math.max(Number(sp.get('skip')) || 0, 0);
  const pick = (k: string) => {
    const v = sp.get(k);
    return v && v.trim() !== '' ? v.trim() : undefined;
  };
  try {
    const page = await hongguoBrowse(genre, {
      theme: pick('theme'),
      setting: pick('setting'),
      background: pick('background'),
      sort: pick('sort'),
      gender: pick('gender'),
      status: pick('status'),
      days: pick('days'),
      limit,
      skip,
    });
    return NextResponse.json(
      { ok: true, items: page.items, hasMore: page.hasMore, nextSkip: page.nextSkip },
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: (err as Error).message || '加载失败' },
      { status: 502 }
    );
  }
}
