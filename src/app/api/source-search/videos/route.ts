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
 * 获取指定视频源的分类视频列表
 */
export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sourceKey = searchParams.get('source');
  const categoryId = searchParams.get('categoryId');
  const page = searchParams.get('page') || '1';

  if (!sourceKey) {
    return NextResponse.json(
      { error: '缺少参数: source' },
      { status: 400 }
    );
  }

  if (!categoryId) {
    return NextResponse.json(
      { error: '缺少参数: categoryId' },
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

    // 请求分类视频列表
    const videoUrl = `${targetSite.api}?ac=videolist&t=${categoryId}&pg=${page}`;
    const videoResponse = await fetch(videoUrl, {
      headers: API_CONFIG.search.headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!videoResponse.ok) {
      throw new Error('获取视频列表失败');
    }

    const videoData: CmsVideoResponse = await videoResponse.json();

    if (!videoData.list || !Array.isArray(videoData.list)) {
      return NextResponse.json({
        results: [],
        total: 0,
        page: parseInt(page),
        pageCount: 0,
      });
    }

    // 转换�?SearchResult 格式
    const results: SearchResult[] = videoData.list.map((item) => {
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
      total: videoData.total || 0,
      page: parseInt(page),
      pageCount: videoData.pagecount || 0,
    });
  } catch (error) {
    console.error('Failed to get videos:', error);
    return NextResponse.json(
      { error: '获取视频列表失败' },
      { status: 500 }
    );
  }
}
