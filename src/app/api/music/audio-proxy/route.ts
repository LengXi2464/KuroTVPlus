/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { requireFeaturePermission } from '@/lib/permissions';
import { OpenListClient } from '@/lib/openlist.client';

export const runtime = 'nodejs';

// 获取 OpenList 客户�?async function getOpenListClient(): Promise<OpenListClient | null> {
  const config = await getConfig();
  const musicConfig = config?.MusicConfig;

  if (!musicConfig?.OpenListCacheEnabled) {
    return null;
  }

  const url = musicConfig.OpenListCacheURL;
  const username = musicConfig.OpenListCacheUsername;
  const password = musicConfig.OpenListCachePassword;

  if (!url || !username || !password) {
    return null;
  }

  return new OpenListClient(url, username, password);
}

// 代理OpenList缓存的音频文�?export async function GET(request: NextRequest) {
  try {
    const authResult = await requireFeaturePermission(request, 'music', '无权限访问音乐功�?);
    if (authResult instanceof NextResponse) return authResult;
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const id = searchParams.get('id');
    const quality = searchParams.get('quality');

    if (!platform || !id || !quality) {
      return NextResponse.json(
        { error: '缺少必要参数: platform, id, quality' },
        { status: 400 }
      );
    }

    // 获取OpenList客户�?    const openListClient = await getOpenListClient();
    if (!openListClient) {
      return NextResponse.json(
        { error: 'OpenList未配置或未启�? },
        { status: 503 }
      );
    }

    // 获取配置
    const config = await getConfig();
    const cachePath = config?.MusicConfig?.OpenListCachePath || '/music-cache';

    // 构建音频文件路径
    const audioPath = `${cachePath}/${platform}/audio/${id}-${quality}.mp3`;

    // 获取文件信息
    const fileResponse = await openListClient.getFile(audioPath);

    if (fileResponse.code !== 200 || !fileResponse.data?.raw_url) {
      return NextResponse.json(
        { error: '音频文件未找�? },
        { status: 404 }
      );
    }

    // 检查是否有 Range 请求�?    const range = request.headers.get('range');
    const ifNoneMatch = request.headers.get('if-none-match');
    const ifModifiedSince = request.headers.get('if-modified-since');

    // 生成基于文件路径�?ETag
    const generatedETag = `"${Buffer.from(audioPath).toString('base64')}"`;

    // 如果客户端发送了 If-None-Match，检查是否匹�?    if (ifNoneMatch && ifNoneMatch === generatedETag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
          'ETag': generatedETag,
        },
      });
    }

    // 构建上游请求�?    const upstreamHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };

    // 如果�?Range 请求，转发给上游
    if (range) {
      upstreamHeaders['Range'] = range;
    }

    // 转发条件请求头到上游
    if (ifNoneMatch) {
      upstreamHeaders['If-None-Match'] = ifNoneMatch;
    }
    if (ifModifiedSince) {
      upstreamHeaders['If-Modified-Since'] = ifModifiedSince;
    }

    // 从OpenList获取音频�?    const response = await fetch(fileResponse.data.raw_url, {
      headers: upstreamHeaders,
    });

    // 如果上游返回 304 Not Modified，直接返�?304
    if (response.status === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
          'ETag': generatedETag,
        },
      });
    }

    if (!response.ok && response.status !== 206) {
      return NextResponse.json(
        { error: '获取音频失败' },
        { status: response.status }
      );
    }

    // 获取响应�?    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    const contentLength = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range');
    const acceptRanges = response.headers.get('accept-ranges');
    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');

    // 创建响应�?- 设置永久缓存
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable', // 永久缓存�?年）
      'Access-Control-Allow-Origin': '*',
      'Accept-Ranges': acceptRanges || 'bytes',
      'X-Cache-Source': 'openlist-audio-proxy',
    };

    if (contentLength) {
      headers['Content-Length'] = contentLength;
    }

    // 如果上游返回�?Content-Range，转发给客户�?    if (contentRange) {
      headers['Content-Range'] = contentRange;
    }

    // 转发 ETag �?Last-Modified 以支持浏览器缓存验证
    if (etag) {
      headers['ETag'] = etag;
    }
    if (lastModified) {
      headers['Last-Modified'] = lastModified;
    }

    // 如果上游没有提供 ETag，使用生成的 ETag
    if (!etag) {
      headers['ETag'] = generatedETag;
    }

    // 返回音频流，保持原始状态码�?00 �?206�?    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error('代理OpenList音频失败:', error);
    return NextResponse.json(
      {
        error: '代理请求失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
