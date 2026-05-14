// 获取剧集列表 API 路由
import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { getDanmakuApiBaseUrl } from '@/lib/danmaku/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const animeId = searchParams.get('animeId');

    if (!animeId) {
      return NextResponse.json(
        {
          errorCode: -1,
          success: false,
          errorMessage: '缺少动漫ID参数',
          bangumi: {
            bangumiId: '',
            animeTitle: '',
            episodes: [],
          },
        },
        { status: 400 }
      );
    }

    // 从数据库读取弹幕配置
    const config = await getConfig();
    const baseUrl = getDanmakuApiBaseUrl(config.SiteConfig);

    const apiUrl = `${baseUrl}/api/v2/bangumi/${animeId}`;

    // 添加超时控制和重试机�?    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 10秒超�?
    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        // 添加 keepalive 避免连接被重�?        keepalive: true,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return NextResponse.json(data);
    } catch (fetchError) {
      clearTimeout(timeoutId);

      // 如果是超时错误，返回更友好的错误信息
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('弹幕服务器请求超时，请稍后重�?);
      }

      throw fetchError;
    }
  } catch (error) {
    console.error('获取剧集列表代理错误:', error);
    return NextResponse.json(
      {
        errorCode: -1,
        success: false,
        errorMessage:
          error instanceof Error ? error.message : '获取剧集列表失败',
        bangumi: {
          bangumiId: '',
          animeTitle: '',
          episodes: [],
        },
      },
      { status: 500 }
    );
  }
}
