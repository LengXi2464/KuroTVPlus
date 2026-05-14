import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { API_CONFIG, getAvailableApiSites } from '@/lib/config';
import { SearchResult } from '@/lib/types';

export const runtime = 'nodejs';

interface CmsVideoItem {
  vod_id: string | number;
  vod_name: string;
  vod_pic: string;
  vod_remarks?: string;
  vod_year?: string;
  vod_play_from?: string;
  vod_play_url?: string;
}

interface CmsVideoResponse {
  list?: CmsVideoItem[];
  total?: number;
  page?: number;
  pagecount?: number;
}

/**
 * 在指定视频源中搜索视�? */
export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sourceKey = searchParams.get('source');
  const keyword = searchParams.get('keyword');
  const page = searchParams.get('page') || '1';

  if (!sourceKey) {
    return NextResponse.json(
      { error: '缺少参数: source' },
      { status: 400 }
    );
  }

  if (!keyword || keyword.trim() === '') {
    return NextResponse.json(
      { error: '缺少参数: keyword' },
      { status: 400 }
    );
  }

  try {
    const apiSites = await getAvailableApiSites(authInfo.username);
    const targetSite = apiSites.find((site) => site.key === sourceKey);

    if (!targetSite) {
      return NextResponse.json(
        { error: `未找到指定的视频�? ${sourceKey}` },
        { status: 404 }
      );
    }

    // 请求搜索结果
    const searchUrl = `${targetSite.api}?ac=videolist&wd=${encodeURIComponent(keyword)}&pg=${page}`;
    const searchResponse = await fetch(searchUrl, {
      headers: API_CONFIG.search.headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!searchResponse.ok) {
      throw new Error('搜索失败');
    }

    const searchData: CmsVideoResponse = await searchResponse.json();

    if (!searchData.list || !Array.isArray(searchData.list)) {
      return NextResponse.json({
        results: [],
        total: 0,
        page: parseInt(page),
        pageCount: 0,
      });
    }

    // 转换�?SearchResult 格式
    const results: SearchResult[] = searchData.list.map((item) => {
      const episodes: string[] = [];
      const episodes_titles: string[] = [];

      // 解析播放信息
      if (item.vod_play_url && item.vod_play_from) {
        const playUrls = item.vod_play_url.split('#');
        playUrls.forEach((episodeStr) => {
          if (episodeStr.trim()) {
            const [name, url] = episodeStr.split('$');
            if (name && url) {
              episodes.push(url.trim());
              episodes_titles.push(name.trim());
            }
          }
        });
      }

      return {
        id: item.vod_id.toString(),
        title: item.vod_name,
        poster: item.vod_pic || '',
        year: item.vod_year || 'unknown',
        episodes,
        episodes_titles,
        source: targetSite.key,
        source_name: targetSite.name,
      };
    });

    return NextResponse.json({
      results,
      total: searchData.total || 0,
      page: parseInt(page),
      pageCount: searchData.pagecount || 0,
    });
  } catch (error) {
    console.error('Failed to search videos:', error);
    return NextResponse.json({ error: '搜索失败' }, { status: 500 });
  }
}
