/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { requireFeaturePermission } from '@/lib/permissions';
import { db } from '@/lib/db';
import {
  invalidateMetaInfoCache,
  MetaInfo,
  setCachedMetaInfo,
} from '@/lib/openlist-cache';

export const runtime = 'nodejs';

/**
 * POST /api/openlist/delete
 * 删除私人影库中的视频记录
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireFeaturePermission(request, 'private_library', '无权限访问私人影�?);
    if (authResult instanceof NextResponse) return authResult;
    // 权限检�?    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未授�? }, { status: 401 });
    }

    // 获取请求参数
    const body = await request.json();
    const { key } = body;

    if (!key) {
      return NextResponse.json({ error: '缺少 key 参数' }, { status: 400 });
    }

    // 获取配置
    const config = await getConfig();
    const openListConfig = config.OpenListConfig;

    if (
      !openListConfig ||
      !openListConfig.Enabled ||
      !openListConfig.URL
    ) {
      return NextResponse.json(
        { error: 'OpenList 未配置或未启�? },
        { status: 400 }
      );
    }

    // 从数据库读取 metainfo
    const metainfoContent = await db.getGlobalValue('video.metainfo');
    if (!metainfoContent) {
      return NextResponse.json(
        { error: '未找到视频元数据' },
        { status: 404 }
      );
    }

    const metaInfo: MetaInfo = JSON.parse(metainfoContent);

    // 检�?key 是否存在
    if (!metaInfo.folders[key]) {
      return NextResponse.json(
        { error: '未找到该视频记录' },
        { status: 404 }
      );
    }

    // 删除记录
    delete metaInfo.folders[key];

    // 保存到数据库
    const updatedMetainfoContent = JSON.stringify(metaInfo);
    await db.setGlobalValue('video.metainfo', updatedMetainfoContent);

    // 更新缓存
    invalidateMetaInfoCache();
    setCachedMetaInfo(metaInfo);

    // 更新配置中的资源数量
    if (config.OpenListConfig) {
      config.OpenListConfig.ResourceCount = Object.keys(metaInfo.folders).length;
      await db.saveAdminConfig(config);
    }

    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('删除视频记录失败:', error);
    return NextResponse.json(
      { error: '删除失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}
