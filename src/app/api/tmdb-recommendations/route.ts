import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import {
  getTMDBImageUrl,
  getTMDBMovieRecommendations,
  getTMDBTVRecommendations,
  searchTMDBMulti,
} from '@/lib/tmdb.client';

// 服务器端缓存�?天）
const searchCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 1�?
// 移除季度信息的辅助函�?function removeSeasonInfo(title: string): string {
  // 移除 "第一�?�?�?�?�?第一�?）季" 等格�?  return title
    .replace(/第[一二三四五六七八九十\d]+[�?]\d+[�?][季部]/g, '')
    .replace(/第[一二三四五六七八九十\d]+[季部]/g, '')
    .replace(/[�?]\d+[�?]/g, '')
    .replace(/\s+season\s+\d+/gi, '')
    .replace(/\s+S\d+/gi, '')
    .trim();
}

// 精确匹配标题
function findExactMatch(results: any[], originalTitle: string): any | null {
  if (!results || results.length === 0) return null;

  // 如果只有一个结果，直接返回
  if (results.length === 1) return results[0];

  const cleanedTitle = removeSeasonInfo(originalTitle).toLowerCase();

  // 寻找完全匹配的结�?  for (const result of results) {
    const resultTitle = (result.title || result.name || '').toLowerCase();
    const resultOriginalTitle = (result.original_title || result.original_name || '').toLowerCase();

    if (resultTitle === cleanedTitle || resultOriginalTitle === cleanedTitle) {
      return result;
    }
  }

  // 如果没有完全匹配，返回第一�?  return results[0];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const title = searchParams.get('title');
    const cachedId = searchParams.get('cachedId'); // 浏览器缓存的ID

    if (!title && !cachedId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const config = await getConfig();
    const tmdbApiKey = config.SiteConfig.TMDBApiKey;
    const tmdbProxy = config.SiteConfig.TMDBProxy;
    const tmdbReverseProxy = config.SiteConfig.TMDBReverseProxy;

    if (!tmdbApiKey) {
      return NextResponse.json(
        { error: 'TMDB API Key 未配�? },
        { status: 500 }
      );
    }

    let tmdbId: number;
    let mediaType: 'movie' | 'tv';

    // 如果有缓存的ID，直接使�?    if (cachedId) {
      const [type, id] = cachedId.split(':');
      mediaType = type as 'movie' | 'tv';
      tmdbId = parseInt(id);
    } else {
      // 否则搜索
      const cleanedTitle = removeSeasonInfo(title!);
      const cacheKey = `search:${cleanedTitle}`;

      // 检查服务器缓存
      const cached = searchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        tmdbId = cached.data.tmdbId;
        mediaType = cached.data.mediaType;
      } else {
        // 搜索TMDB
        const searchResult = await searchTMDBMulti(tmdbApiKey, cleanedTitle, tmdbProxy, tmdbReverseProxy);

        if (searchResult.code !== 200 || !searchResult.results.length) {
          return NextResponse.json(
            { recommendations: [], tmdbId: null, mediaType: null },
            {
              status: 200,
              headers: {
                'Cache-Control': 'public, max-age=86400', // 浏览器缓�?�?              },
            }
          );
        }

        // 过滤出电影和电视�?        const validResults = searchResult.results.filter(
          (r: any) => r.media_type === 'movie' || r.media_type === 'tv'
        );

        // 精确匹配
        const matched = findExactMatch(validResults, title!);

        if (!matched) {
          return NextResponse.json(
            { recommendations: [], tmdbId: null, mediaType: null },
            {
              status: 200,
              headers: {
                'Cache-Control': 'public, max-age=86400',
              },
            }
          );
        }

        tmdbId = matched.id;
        mediaType = matched.media_type;

        // 保存到服务器缓存
        searchCache.set(cacheKey, {
          data: { tmdbId, mediaType },
          timestamp: Date.now(),
        });

        // 清理过期缓存
        Array.from(searchCache.entries()).forEach(([key, value]) => {
          if (Date.now() - value.timestamp > CACHE_TTL) {
            searchCache.delete(key);
          }
        });
      }
    }

    // 获取推荐
    const recommendationsResult =
      mediaType === 'movie'
        ? await getTMDBMovieRecommendations(tmdbApiKey, tmdbId, tmdbProxy, tmdbReverseProxy)
        : await getTMDBTVRecommendations(tmdbApiKey, tmdbId, tmdbProxy, tmdbReverseProxy);

    if (recommendationsResult.code !== 200) {
      return NextResponse.json(
        { recommendations: [], tmdbId: `${mediaType}:${tmdbId}`, mediaType },
        {
          status: 200,
          headers: {
            'Cache-Control': 'public, max-age=86400',
          },
        }
      );
    }

    // 转换为统一格式
    const recommendations = (recommendationsResult.results as any[])
      .filter((r: any) => r.poster_path) // 只保留有海报�?      .slice(0, 20) // 最�?0�?      .map((r: any) => ({
        tmdbId: r.id,
        title: r.title || r.name,
        poster: getTMDBImageUrl(r.poster_path, 'w342'),
        rating: r.vote_average ? r.vote_average.toFixed(1) : '',
        mediaType,
      }));

    return NextResponse.json(
      {
        recommendations,
        tmdbId: `${mediaType}:${tmdbId}`, // 返回给浏览器用于缓存
        mediaType,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=86400', // 浏览器缓�?�?        },
      }
    );
  } catch (error) {
    console.error('获取 TMDB 推荐失败:', error);
    return NextResponse.json(
      { error: '获取推荐失败' },
      { status: 500 }
    );
  }
}
