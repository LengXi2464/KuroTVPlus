/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { requireFeaturePermission } from '@/lib/permissions';
import { OpenListClient } from '@/lib/openlist.client';
import { invalidateVideoInfoCache } from '@/lib/openlist-cache';

export const runtime = 'nodejs';

/**
 * POST /api/openlist/refresh-video
 * 刷新单个视频�?videoinfo.json
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireFeaturePermission(request, 'private_library', '无权限访问私人影�?);
    if (authResult instanceof NextResponse) return authResult;
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未授�? }, { status: 401 });
    }

    const body = await request.json();
    const { folder } = body;

    if (!folder) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    const config = await getConfig();
    const openListConfig = config.OpenListConfig;

    if (
      !openListConfig ||
      !openListConfig.Enabled ||
      !openListConfig.URL ||
      !openListConfig.Username ||
      !openListConfig.Password
    ) {
      return NextResponse.json({ error: 'OpenList 未配置或未启�? }, { status: 400 });
    }

    // folder 已经是完整路径，直接使用
    const folderPath = folder;
    const client = new OpenListClient(
      openListConfig.URL,
      openListConfig.Username,
      openListConfig.Password
    );

    // 清除缓存
    invalidateVideoInfoCache(folderPath);

    return NextResponse.json({
      success: true,
      message: '刷新成功',
    });
  } catch (error) {
    console.error('刷新视频失败:', error);
    return NextResponse.json(
      { error: '刷新失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}
