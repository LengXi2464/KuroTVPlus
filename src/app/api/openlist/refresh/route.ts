/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { requireFeaturePermission } from '@/lib/permissions';
import { startOpenListRefresh } from '@/lib/openlist-refresh';

export const runtime = 'nodejs';

/**
 * POST /api/openlist/refresh
 * 刷新私人影库元数据（后台任务模式�? */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireFeaturePermission(request, 'private_library', '无权限访问私人影�?);
    if (authResult instanceof NextResponse) return authResult;
    // 权限检�?    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未授�? }, { status: 401 });
    }

    // 检�?TMDB API Key 是否配置
    const config = await getConfig();
    if (!config.SiteConfig.TMDBApiKey || config.SiteConfig.TMDBApiKey.trim() === '') {
      return NextResponse.json(
        { error: '请先在站点配置中配置 TMDB API Key' },
        { status: 400 }
      );
    }

    // 获取请求参数
    const body = await request.json().catch(() => ({}));
    const clearMetaInfo = body.clearMetaInfo === true;

    // 启动扫描任务
    const { taskId } = await startOpenListRefresh(clearMetaInfo);

    return NextResponse.json({
      success: true,
      taskId,
      message: '扫描任务已启�?,
    });
  } catch (error) {
    console.error('启动刷新任务失败:', error);
    return NextResponse.json(
      { error: '启动失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}
