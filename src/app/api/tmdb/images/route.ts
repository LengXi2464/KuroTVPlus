/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { getTMDBImages } from '@/lib/tmdb.client';

export const runtime = 'nodejs';

/**
 * GET /api/tmdb/images?id=xxx&type=movie|tv&page=1&pageSize=24
 * 获取 TMDB 照片墙数据，并在服务端分�? */
export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未授�? }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type') || 'movie';
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('pageSize');
    const page = pageParam ? Math.max(parseInt(pageParam, 10), 1) : null;
    const pageSize = pageSizeParam ? Math.min(Math.max(parseInt(pageSizeParam, 10), 1), 60) : null;

    if (!id) {
      return NextResponse.json({ error: '缺少ID参数' }, { status: 400 });
    }

    if (type !== 'movie' && type !== 'tv') {
      return NextResponse.json({ error: '类型参数必须是movie或tv' }, { status: 400 });
    }

    const config = await getConfig();
    const tmdbApiKey = config.SiteConfig.TMDBApiKey;
    const tmdbProxy = config.SiteConfig.TMDBProxy;
    const tmdbReverseProxy = config.SiteConfig.TMDBReverseProxy;

    if (!tmdbApiKey) {
      return NextResponse.json({ error: 'TMDB API Key 未配�? }, { status: 400 });
    }

    const response = await getTMDBImages(
      tmdbApiKey,
      parseInt(id, 10),
      type as 'movie' | 'tv',
      tmdbProxy,
      tmdbReverseProxy
    );

    if (response.code !== 200 || !response.images) {
      return NextResponse.json(
        { error: 'TMDB 图片信息获取失败', code: response.code },
        { status: response.code }
      );
    }

    const backdrops = (response.images.backdrops || []).map((item: any) => ({
      ...item,
      imageType: 'backdrop' as const,
    }));
    const posters = (response.images.posters || []).map((item: any) => ({
      ...item,
      imageType: 'poster' as const,
    }));

    const allImages = [...backdrops, ...posters].sort((a, b) => {
      const voteDiff = (b.vote_average || 0) - (a.vote_average || 0);
      if (voteDiff !== 0) return voteDiff;
      return (b.vote_count || 0) - (a.vote_count || 0);
    });

    const total = allImages.length;

    if (!page || !pageSize) {
      return NextResponse.json({
        total,
        list: allImages,
      });
    }

    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const list = allImages.slice(start, start + pageSize);

    return NextResponse.json({
      page: safePage,
      pageSize,
      total,
      totalPages,
      list,
    });
  } catch (error) {
    console.error('TMDB图片信息获取失败:', error);
    return NextResponse.json(
      { error: '获取图片信息失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}
