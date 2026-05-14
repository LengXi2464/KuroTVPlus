/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import {
  getCachedMetaInfo,
  MetaInfo,
  setCachedMetaInfo,
} from '@/lib/openlist-cache';
import { getTMDBImageUrl } from '@/lib/tmdb.search';
import { yellowWords } from '@/lib/yellow';

export const runtime = 'nodejs';

/**
 * CMS 采集站代理接�? * 用于代理 CMS API 请求，并自动将播放链接替换为带去广告的代理链�? * GET /api/cms-proxy?api=<CMS API地址>&参数1=�?&参数2=�?...
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiUrl = searchParams.get('api');
    const yellowFilter = searchParams.get('yellowFilter') === 'true';

    if (!apiUrl) {
      return NextResponse.json(
        { error: '缺少必要参数: api' },
        { status: 400 }
      );
    }

    // 特殊处理 openlist
    if (apiUrl === 'openlist') {
      return handleOpenListProxy(request);
    }

    // 构建完整�?API 请求 URL，包含所有查询参�?    const targetUrl = new URL(apiUrl);

    // 将所有查询参数（除了 api）转发到目标 API
    searchParams.forEach((value, key) => {
      if (key !== 'api') {
        targetUrl.searchParams.append(key, value);
      }
    });

    // 请求原始 CMS API
    console.log('CMS 代理请求:', targetUrl.toString());

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超�?
    try {
      const response = await fetch(targetUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('CMS API 请求失败:', response.status, response.statusText);
        return NextResponse.json(
          { error: '请求 CMS API 失败' },
          { status: response.status }
        );
      }

      const data = await response.json();
      console.log('CMS API 返回数据:', {
        code: data.code,
        msg: data.msg,
        page: data.page,
        pagecount: data.pagecount,
        limit: data.limit,
        total: data.total,
        listCount: data.list?.length || 0,
      });

      // 获取当前请求�?origin
      // 优先级：SITE_BASE 环境变量 > 从请求头构建
      let origin = process.env.SITE_BASE;

      if (!origin) {
        // 从请求头中获�?Host 和协�?        const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
        const proto = request.headers.get('x-forwarded-proto') ||
                      (host?.includes('localhost') || host?.includes('127.0.0.1') ? 'http' : 'https');
        origin = `${proto}://${host}`;
      }

      console.log('CMS 代理 origin:', origin);

      // 处理返回数据，替换播放链接为代理链接
      const processedData = processCmsResponse(data, origin, yellowFilter);

      return NextResponse.json(processedData, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        console.error('CMS API 请求超时:', targetUrl.toString());
        return NextResponse.json(
          { error: '请求超时' },
          { status: 504 }
        );
      }

      throw fetchError;
    }

  } catch (error) {
    console.error('CMS 代理失败:', error);
    return NextResponse.json(
      { error: '代理失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * 处理 CMS API 返回数据，将播放链接替换为代理链�? */
function processCmsResponse(data: any, proxyOrigin: string, yellowFilter: boolean): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  // 深拷贝数据，避免修改原始对象
  const processedData = JSON.parse(JSON.stringify(data));

  if (yellowFilter) {
    if (processedData.class && Array.isArray(processedData.class)) {
      processedData.class = processedData.class.filter((item: any) => !matchesYellowContent(item?.type_name));
    }

    if (processedData.list && Array.isArray(processedData.list)) {
      processedData.list = processedData.list.filter((item: any) => !matchesYellowContent(
        item?.vod_name,
        item?.type_name,
        item?.vod_remarks,
        item?.vod_content,
      ));

      if (typeof processedData.total === 'number') {
        processedData.total = processedData.list.length;
      }
      if (typeof processedData.limit === 'number') {
        processedData.limit = processedData.list.length;
      }
    }
  }

  // 获取 M3U8 代理 token
  const proxyToken = process.env.NEXT_PUBLIC_PROXY_M3U8_TOKEN || '';
  const tokenParam = proxyToken ? `&token=${encodeURIComponent(proxyToken)}` : '';

  // 处理列表数据
  if (processedData.list && Array.isArray(processedData.list)) {
    processedData.list = processedData.list.map((item: any, index: number) => {
      // 只处理有播放地址的项�?      if (item.vod_play_url && typeof item.vod_play_url === 'string') {
        try {
          const originalUrl = item.vod_play_url;
          item.vod_play_url = processPlayUrlString(item.vod_play_url, item.vod_play_from || '', proxyOrigin, tokenParam);

          // 只为第一个视频输出详细日�?          if (index === 0) {
            console.log('播放地址处理:', {
              vod_name: item.vod_name,
              vod_play_from: item.vod_play_from,
              original_length: originalUrl.length,
              processed_length: item.vod_play_url.length,
              original_preview: originalUrl.substring(0, 100),
              processed_preview: item.vod_play_url.substring(0, 150),
            });
          }
        } catch (error) {
          // 如果处理失败，保持原�?          console.error('处理播放地址失败:', error, item.vod_name);
        }
      }
      return item;
    });
  }

  return processedData;
}

function matchesYellowContent(...values: Array<string | undefined>): boolean {
  const normalized = values
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!normalized) {
    return false;
  }

  return yellowWords.some((word) => normalized.includes(word.toLowerCase()));
}

/**
 * 处理播放地址字符�? * 格式: �?1�?url1#�?2�?url2#...
 */
function processPlayUrlString(playUrl: string, playFrom: string, proxyOrigin: string, tokenParam: string): string {
  if (!playUrl) return playUrl;

  // �?$ 分割，分别处理每个播放源
  const playSources = playUrl.split('$$$');

  return playSources.map(source => {
    // 处理每个播放源的剧集列表
    const episodes = source.split('#');

    return episodes.map(episode => {
      // 格式: �?1�?url �?url
      // 使用 indexOf 找到第一�?$ 的位�?      const dollarIndex = episode.indexOf('$');

      if (dollarIndex > 0) {
        // 有标题的格式: �?1�?url �?�?1�?url$其他
        const title = episode.substring(0, dollarIndex);
        const rest = episode.substring(dollarIndex + 1);

        // 检查后面是否还�?$，如果有就保�?        const nextDollarIndex = rest.indexOf('$');
        if (nextDollarIndex > 0) {
          // 格式: �?1�?url$其他
          const url = rest.substring(0, nextDollarIndex);
          const other = rest.substring(nextDollarIndex);
          const processedUrl = processUrl(url.trim(), playFrom, proxyOrigin, tokenParam);
          return `${title}$${processedUrl}${other}`;
        } else {
          // 格式: �?1�?url
          const processedUrl = processUrl(rest.trim(), playFrom, proxyOrigin, tokenParam);
          return `${title}$${processedUrl}`;
        }
      } else if (episode.trim()) {
        // 只有 URL 的格�?        const processedUrl = processUrl(episode.trim(), playFrom, proxyOrigin, tokenParam);
        return processedUrl;
      }

      return episode;
    }).join('#');
  }).join('$$$');
}

/**
 * 处理单个播放地址
 */
function processUrl(url: string, playFrom: string, proxyOrigin: string, tokenParam: string): string {
  if (!url) return url;

  // 只处�?m3u8 链接
  if (url.includes('.m3u8')) {
    // 提取播放源类型（如果有的话）
    const source = playFrom ? `&source=${encodeURIComponent(playFrom)}` : '';

    // �?m3u8 链接替换为代理链�?    return `${proxyOrigin}/api/proxy-m3u8?url=${encodeURIComponent(url)}${source}${tokenParam}`;
  }

  // �?m3u8 链接不处�?  return url;
}

/**
 * 处理 OpenList 代理请求
 */
async function handleOpenListProxy(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wd = searchParams.get('wd'); // 搜索关键�?  const ids = searchParams.get('ids'); // 详情ID

  const config = await getConfig();
  const openListConfig = config.OpenListConfig;

  if (!openListConfig || !openListConfig.URL || !openListConfig.Username || !openListConfig.Password) {
    return NextResponse.json(
      { code: 0, msg: 'OpenList 未配�?, list: [] },
      { status: 200 }
    );
  }

  // 读取 metainfo (从数据库或缓�?
  let metaInfo: MetaInfo | null = getCachedMetaInfo();

  if (!metaInfo) {
    try {
      const metainfoJson = await db.getGlobalValue('video.metainfo');
      if (metainfoJson) {
        metaInfo = JSON.parse(metainfoJson) as MetaInfo;
        setCachedMetaInfo(metaInfo);
      }
    } catch (error) {
      return NextResponse.json(
        { code: 0, msg: 'metainfo 不存�?, list: [] },
        { status: 200 }
      );
    }
  }

  if (!metaInfo) {
    return NextResponse.json(
      { code: 0, msg: '无数�?, list: [] },
      { status: 200 }
    );
  }

  // 搜索模式
  if (wd) {
    const results = Object.entries(metaInfo.folders)
      .filter(
        ([_key, info]) =>
          info.folderName.toLowerCase().includes(wd.toLowerCase()) ||
          info.title.toLowerCase().includes(wd.toLowerCase())
      )
      .map(([key, info]) => ({
        vod_id: key,
        vod_name: info.title,
        vod_pic: getTMDBImageUrl(info.poster_path),
        vod_remarks: info.media_type === 'movie' ? '电影' : '剧集',
        vod_year: info.release_date.split('-')[0] || '',
        type_name: info.media_type === 'movie' ? '电影' : '电视�?,
      }));

    return NextResponse.json({
      code: 1,
      msg: '数据列表',
      page: 1,
      pagecount: 1,
      limit: results.length,
      total: results.length,
      list: results,
    });
  }

  // 详情模式
  if (ids) {
    const key = ids;
    const info = metaInfo.folders[key];

    if (!info) {
      return NextResponse.json(
        { code: 0, msg: '视频不存�?, list: [] },
        { status: 200 }
      );
    }

    const folderName = info.folderName;

    // 获取视频详情
    try {
      const detailResponse = await fetch(
        `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}/api/openlist/detail?folder=${encodeURIComponent(folderName)}`
      );

      if (!detailResponse.ok) {
        throw new Error('获取视频详情失败');
      }

      const detailData = await detailResponse.json();

      if (!detailData.success) {
        throw new Error('获取视频详情失败');
      }

      // 构建播放列表
      const playUrls = detailData.episodes
        .map((ep: any) => {
          const title = ep.title || `�?{ep.episode}集`;
          return `${title}$${ep.playUrl}`;
        })
        .join('#');

      return NextResponse.json({
        code: 1,
        msg: '数据列表',
        page: 1,
        pagecount: 1,
        limit: 1,
        total: 1,
        list: [
          {
            vod_id: key,
            vod_name: info.title,
            vod_pic: getTMDBImageUrl(info.poster_path),
            vod_remarks: info.media_type === 'movie' ? '电影' : '剧集',
            vod_year: info.release_date.split('-')[0] || '',
            vod_content: info.overview,
            vod_play_from: 'OpenList',
            vod_play_url: playUrls,
            type_name: info.media_type === 'movie' ? '电影' : '电视�?,
          },
        ],
      });
    } catch (error) {
      console.error('获取 OpenList 视频详情失败:', error);
      return NextResponse.json(
        { code: 0, msg: '获取详情失败', list: [] },
        { status: 200 }
      );
    }
  }

  // 默认返回所有视�?  const results = Object.entries(metaInfo.folders).map(
    ([key, info]) => ({
      vod_id: key,
      vod_name: info.title,
      vod_pic: getTMDBImageUrl(info.poster_path),
      vod_remarks: info.media_type === 'movie' ? '电影' : '剧集',
      vod_year: info.release_date.split('-')[0] || '',
      type_name: info.media_type === 'movie' ? '电影' : '电视�?,
    })
  );

  return NextResponse.json({
    code: 1,
    msg: '数据列表',
    page: 1,
    pagecount: 1,
    limit: results.length,
    total: results.length,
    list: results,
  });
}
