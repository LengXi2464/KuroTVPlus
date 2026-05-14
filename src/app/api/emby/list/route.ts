/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { getCachedEmbyList, setCachedEmbyList } from '@/lib/emby-cache';
import { embyManager } from '@/lib/emby-manager';
import { getProxyToken } from '@/lib/emby-token';
import { requireFeaturePermission } from '@/lib/permissions';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const parentId = searchParams.get('parentId') || undefined;
  const embyKey = searchParams.get('embyKey') || undefined;
  const sortBy = searchParams.get('sortBy') || 'SortName';
  const sortOrder = searchParams.get('sortOrder') || 'Ascending';

  try {
    const authResult = await requireFeaturePermission(request, 'emby', '无权限访�?Emby');
    if (authResult instanceof NextResponse) return authResult;
    // 判断是否是默认排序（只有默认排序才使用缓存）
    const isDefaultSort = sortBy === 'SortName' && sortOrder === 'Ascending';

    // 只有默认排序才检查缓�?    if (isDefaultSort) {
      const cached = getCachedEmbyList(page, pageSize, parentId, embyKey);
      if (cached) {
        return NextResponse.json(cached);
      }
    }

    // 获取Emby客户�?    const client = await embyManager.getClient(embyKey);

    // 获取代理 token（如果启用了代理�?    const proxyToken = client.isProxyEnabled() ? await getProxyToken(request) : null;

    // 获取媒体列表
    const result = await client.getItems({
      ParentId: parentId,
      IncludeItemTypes: 'Movie,Series',
      Recursive: true,
      Fields: 'Overview,ProductionYear',
      SortBy: sortBy,
      SortOrder: sortOrder,
      StartIndex: (page - 1) * pageSize,
      Limit: pageSize,
    });

    const list = result.Items.map((item) => ({
      id: item.Id,
      title: item.Name,
      poster: client.getImageUrl(item.Id, 'Primary', undefined, proxyToken || undefined),
      year: item.ProductionYear?.toString() || '',
      rating: item.CommunityRating || 0,
      mediaType: item.Type === 'Movie' ? 'movie' : 'tv',
    }));

    const totalPages = Math.ceil(result.TotalRecordCount / pageSize);

    const response = {
      success: true,
      list,
      totalPages,
      currentPage: page,
      total: result.TotalRecordCount,
    };

    // 只有默认排序才缓存结�?    if (isDefaultSort) {
      setCachedEmbyList(page, pageSize, response, parentId, embyKey);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('获取 Emby 列表失败:', error);
    return NextResponse.json({
      error: '获取 Emby 列表失败: ' + (error as Error).message,
      list: [],
      totalPages: 0,
      currentPage: page,
      total: 0,
    });
  }
}
