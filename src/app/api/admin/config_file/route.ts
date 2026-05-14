/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig, refineConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员配置',
      },
      { status: 400 }
    );
  }

  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const username = authInfo.username;

  try {
    // 检查用户权�?    let adminConfig = await getConfig();

    // 仅站长可以修改配置文�?    if (username !== process.env.USERNAME) {
      return NextResponse.json(
        { error: '权限不足，只有站长可以修改配置文�? },
        { status: 401 }
      );
    }

    // 获取请求�?    const body = await request.json();
    const { configFile, subscriptionUrl, autoUpdate, lastCheckTime } = body;

    if (!configFile || typeof configFile !== 'string') {
      return NextResponse.json(
        { error: '配置文件内容不能为空' },
        { status: 400 }
      );
    }

    // 验证 JSON 格式
    try {
      JSON.parse(configFile);
    } catch (e) {
      return NextResponse.json(
        { error: '配置文件格式错误，请检�?JSON 语法' },
        { status: 400 }
      );
    }

    adminConfig.ConfigFile = configFile;
    if (!adminConfig.ConfigSubscribtion) {
      adminConfig.ConfigSubscribtion = {
        URL: '',
        AutoUpdate: false,
        LastCheck: '',
      };
    }

    // 更新订阅配置
    if (subscriptionUrl !== undefined) {
      adminConfig.ConfigSubscribtion.URL = subscriptionUrl;
    }
    if (autoUpdate !== undefined) {
      adminConfig.ConfigSubscribtion.AutoUpdate = autoUpdate;
    }
    adminConfig.ConfigSubscribtion.LastCheck = lastCheckTime || '';

    adminConfig = refineConfig(adminConfig);
    // 更新配置文件
    await db.saveAdminConfig(adminConfig);

    // 清除短剧视频源缓存（因为配置文件可能包含新的视频源）
    try {
      await db.deleteGlobalValue('duanju');
      console.log('已清除短剧视频源缓存');
    } catch (error) {
      console.error('清除短剧视频源缓存失�?', error);
      // 不影响主流程，继续执�?    }

    return NextResponse.json({
      success: true,
      message: '配置文件更新成功',
    });
  } catch (error) {
    console.error('更新配置文件失败:', error);
    return NextResponse.json(
      {
        error: '更新配置文件失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
