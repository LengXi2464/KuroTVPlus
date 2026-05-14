import { NextRequest, NextResponse } from 'next/server';

import { isMusicSource, lxGetJson, LxServerSong, normalizeLxSong } from '@/lib/music-v2';
import { badRequest, internalError } from '@/lib/music-v2-api';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';
    const source = searchParams.get('source') || 'kw';
    const page = Number(searchParams.get('page') || '1');
    const limit = Number(searchParams.get('limit') || '20');

    if (!q) return badRequest('缺少搜索关键�?);
    if (!isMusicSource(source)) return badRequest('不支持的音源');

    const list = await lxGetJson<LxServerSong[]>(`/api/music/search?name=${encodeURIComponent(q)}&source=${source}&page=${page}&limit=${limit}`, 'none');

    return NextResponse.json({
      success: true,
      data: {
        list: list.map(normalizeLxSong),
        page,
        limit,
        hasMore: Array.isArray(list) && list.length >= limit,
      },
    });
  } catch (error) {
    return internalError('搜索歌曲失败', (error as Error).message);
  }
}
