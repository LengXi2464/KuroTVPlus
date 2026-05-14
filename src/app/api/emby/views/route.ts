/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { getCachedEmbyViews, setCachedEmbyViews } from '@/lib/emby-cache';
import { embyManager } from '@/lib/emby-manager';
import { requireFeaturePermission } from '@/lib/permissions';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireFeaturePermission(request, 'emby', '无权限访�?Emby');
    if (authResult instanceof NextResponse) return authResult;
    const { searchParams } = new URL(request.url);
    const embyKey = searchParams.get('embyKey') || undefined;

    // 检查缓存（按embyKey缓存�?    const cacheKey = embyKey || 'default';
    const cached = getCachedEmbyViews(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // 获取Emby客户�?    const client = await embyManager.getClient(embyKey);

    // 获取媒体库列�?    const views = await client.getUserViews();

    // 过滤出电影和电视剧媒体库
    const filteredViews = views.filter(
      (view) => view.CollectionType === 'movies' || view.CollectionType === 'tvshows'
    );

    const response = {
      success: true,
      views: filteredViews.map((view) => ({
        id: view.Id,
        name: view.Name,
        type: view.CollectionType,
      })),
    };

    // 缓存结果
    setCachedEmbyViews(cacheKey, response);

    return NextResponse.json(response);
  } catch (error) {
    console.error('获取 Emby 媒体库列表失�?', error);
    return NextResponse.json({
      error: '获取 Emby 媒体库列表失�? ' + (error as Error).message,
      views: [],
    });
  }
}
