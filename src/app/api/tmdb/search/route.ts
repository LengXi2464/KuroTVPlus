/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { searchTMDBMulti } from '@/lib/tmdb.client';

export const runtime = 'nodejs';

/**
 * GET /api/tmdb/search?query=xxx
 * 搜索TMDB，返回多个结果供用户选择
 */
export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未授�? }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query) {
      return NextResponse.json({ error: '缺少查询参数' }, { status: 400 });
    }

    const config = await getConfig();
    const tmdbApiKey = config.SiteConfig.TMDBApiKey;
    const tmdbProxy = config.SiteConfig.TMDBProxy;
    const tmdbReverseProxy = config.SiteConfig.TMDBReverseProxy;

    if (!tmdbApiKey) {
      return NextResponse.json(
        { error: 'TMDB API Key 未配�? },
        { status: 400 }
      );
    }

    const response = await searchTMDBMulti(
      tmdbApiKey,
      query,
      tmdbProxy,
      tmdbReverseProxy
    );

    if (response.code !== 200) {
      return NextResponse.json(
        { error: 'TMDB 搜索失败', code: response.code },
        { status: response.code }
      );
    }

    // 过滤出电影和电视�?    const validResults = response.results.filter(
      (item: any) => item.media_type === 'movie' || item.media_type === 'tv'
    );

    return NextResponse.json({
      success: true,
      results: validResults,
      total: validResults.length,
    });
  } catch (error) {
    console.error('TMDB搜索失败:', error);
    return NextResponse.json(
      { error: '搜索失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}
