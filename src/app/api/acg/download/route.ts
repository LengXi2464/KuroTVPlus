/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { OpenListClient } from '@/lib/openlist.client';
import { hasFeaturePermission } from '@/lib/permissions';

export const runtime = 'nodejs';

/**
 * POST /api/acg/download
 * 添加 ACG 资源�?OpenList 离线下载（仅管理员和站长可用�? */
export async function POST(req: NextRequest) {
  try {
    // 检查权�?    const authInfo = getAuthInfoFromCookie(req);
    if (!authInfo?.username || !(await hasFeaturePermission(authInfo.username, 'magnet_save_private_library'))) {
      return NextResponse.json(
        { error: '无权限访�? },
        { status: 403 }
      );
    }

    const { url, name } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: '下载链接不能为空' },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: '资源名称不能为空' },
        { status: 400 }
      );
    }

    // 获取 OpenList 配置
    const config = await getConfig();
    const openlistConfig = config.OpenListConfig;

    if (!openlistConfig?.Enabled) {
      return NextResponse.json(
        { error: '私人影库功能未启�? },
        { status: 400 }
      );
    }

    if (!openlistConfig.URL || !openlistConfig.Username || !openlistConfig.Password) {
      return NextResponse.json(
        { error: 'OpenList 配置不完�? },
        { status: 400 }
      );
    }

    // 构建下载路径（使用离线下载目录）
    const offlineDownloadPath = openlistConfig.OfflineDownloadPath || '/';
    const downloadPath = `${offlineDownloadPath.replace(/\/$/, '')}/${name}`;

    // 使用 OpenListClient 添加离线下载任务
    const client = new OpenListClient(
      openlistConfig.URL,
      openlistConfig.Username,
      openlistConfig.Password
    );

    // 获取 Token 并调�?API
    const token = await (client as any).getToken();
    const openlistUrl = `${openlistConfig.URL.replace(/\/$/, '')}/api/fs/add_offline_download`;

    const response = await fetch(openlistUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
      body: JSON.stringify({
        path: downloadPath,
        urls: [url],
        tool: 'aria2',
      }),
    });

    const data = await response.json();

    // 检查响应状�?    if (!response.ok || data.code !== 200) {
      throw new Error(data.message || '添加离线下载任务失败');
    }

    return NextResponse.json({
      success: true,
      message: '已添加到离线下载队列',
      path: downloadPath,
    });

  } catch (error: any) {
    console.error('添加离线下载任务失败:', error);
    return NextResponse.json(
      { error: error.message || '添加离线下载任务失败' },
      { status: 500 }
    );
  }
}
