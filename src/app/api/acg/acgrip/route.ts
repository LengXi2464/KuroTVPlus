/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { parseStringPromise } from 'xml2js';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { getMagnetBaseUrl, universalMagnetFetch } from '@/lib/magnet.client';
import { hasFeaturePermission } from '@/lib/permissions';

export const runtime = 'nodejs';

/**
 * POST /api/acg/acgrip
 * 搜索 ACG.RIP 磁力资源（仅管理员和站长可用，支持分页）
 */
export async function POST(req: NextRequest) {
  try {
    // 检查权�?    const authInfo = getAuthInfoFromCookie(req);
    if (!authInfo?.username || !(await hasFeaturePermission(authInfo.username, 'magnet_search'))) {
      return NextResponse.json(
        { error: '无权限访�? },
        { status: 403 }
      );
    }

    const { keyword, page = 1 } = await req.json();

    if (!keyword || typeof keyword !== 'string') {
      return NextResponse.json(
        { error: '搜索关键词不能为�? },
        { status: 400 }
      );
    }

    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) {
      return NextResponse.json(
        { error: '搜索关键词不能为�? },
        { status: 400 }
      );
    }

    // 验证页码
    const pageNum = parseInt(String(page), 10);
    if (isNaN(pageNum) || pageNum < 1) {
      return NextResponse.json(
        { error: '页码必须是大�?的整�? },
        { status: 400 }
      );
    }

    // 请求 acg.rip RSS
    const config = await getConfig();
    const searchBaseUrl = getMagnetBaseUrl(
      'https://acg.rip',
      config.SiteConfig.MagnetAcgripReverseProxy
    );
    const searchUrl = `${searchBaseUrl}/page/${pageNum}.xml?term=${encodeURIComponent(trimmedKeyword)}`;

    const response = await universalMagnetFetch(searchUrl, config.SiteConfig.MagnetProxy, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`ACG.RIP API 请求失败: ${response.status}`);
    }

    const xmlData = await response.text();

    // 解析 XML
    const parsed = await parseStringPromise(xmlData);

    if (!parsed?.rss?.channel?.[0]?.item) {
      return NextResponse.json({
        keyword: trimmedKeyword,
        page: pageNum,
        total: 0,
        items: [],
      });
    }

    const items = parsed.rss.channel[0].item;

    // 转换为标准格�?    const results = items.map((item: any) => {
      const description = item.description?.[0] || '';

      // 提取描述中的图片（如果有�?      let images: string[] = [];
      if (description) {
        const imgMatches = description.match(/src="([^"]+)"/g);
        if (imgMatches) {
          images = imgMatches.map((match: string) => {
            const urlMatch = match.match(/src="([^"]+)"/);
            return urlMatch ? urlMatch[1] : '';
          }).filter(Boolean);
        }
      }

      const title = item.title?.[0] || '';
      const link = item.link?.[0] || '';
      const guid = item.guid?.[0] || link || `${title}-${item.pubDate?.[0] || ''}`;
      const pubDate = item.pubDate?.[0] || '';
      const torrentUrl = item.enclosure?.[0]?.$?.url || '';

      return {
        title,
        link,
        guid,
        pubDate,
        torrentUrl,
        description,
        images,
      };
    });

    return NextResponse.json({
      keyword: trimmedKeyword,
      page: pageNum,
      total: results.length,
      items: results,
    });
  } catch (error: any) {
    console.error('ACG.RIP 搜索失败:', error);
    return NextResponse.json(
      { error: error.message || '搜索失败' },
      { status: 500 }
    );
  }
}
