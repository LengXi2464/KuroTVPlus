/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';
import { SkipConfig } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未登�? }, { status: 401 });
    }

    if (authInfo.username !== process.env.USERNAME) {
      // 非站长，检查用户存在或被封�?      const userInfoV2 = await db.getUserInfoV2(authInfo.username);
      if (!userInfoV2) {
        return NextResponse.json({ error: '用户不存�? }, { status: 401 });
      }
      if (userInfoV2.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401 });
      }

      // 检查是否需要迁移跳过配�?      if (!userInfoV2.skip_migrated) {
        await db.migrateSkipConfigs(authInfo.username);
      }
    } else {
      // 站长也需要检查迁�?      const userInfoV2 = await db.getUserInfoV2(authInfo.username);
      if (!userInfoV2?.skip_migrated) {
        await db.migrateSkipConfigs(authInfo.username);
      }
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const id = searchParams.get('id');

    if (source && id) {
      // 获取单个配置
      const config = await db.getSkipConfig(authInfo.username, source, id);
      return NextResponse.json(config);
    } else {
      // 获取所有配�?      const configs = await db.getAllSkipConfigs(authInfo.username);
      return NextResponse.json(configs);
    }
  } catch (error) {
    console.error('获取跳过片头片尾配置失败:', error);
    return NextResponse.json(
      { error: '获取跳过片头片尾配置失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未登�? }, { status: 401 });
    }

    if (authInfo.username !== process.env.USERNAME) {
      // 非站长，检查用户存在或被封�?      const userInfoV2 = await db.getUserInfoV2(authInfo.username);
      if (!userInfoV2) {
        return NextResponse.json({ error: '用户不存�? }, { status: 401 });
      }
      if (userInfoV2.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401 });
      }
    }

    const body = await request.json();
    const { key, config } = body;

    if (!key || !config) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 解析key为source和id
    const [source, id] = key.split('+');
    if (!source || !id) {
      return NextResponse.json({ error: '无效的key格式' }, { status: 400 });
    }

    // 验证配置格式
    const skipConfig: SkipConfig = {
      enable: Boolean(config.enable),
      intro_time: Number(config.intro_time) || 0,
      outro_time: Number(config.outro_time) || 0,
    };

    await db.setSkipConfig(authInfo.username, source, id, skipConfig);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('保存跳过片头片尾配置失败:', error);
    return NextResponse.json(
      { error: '保存跳过片头片尾配置失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未登�? }, { status: 401 });
    }

    if (authInfo.username !== process.env.USERNAME) {
      // 非站长，检查用户存在或被封�?      const userInfoV2 = await db.getUserInfoV2(authInfo.username);
      if (!userInfoV2) {
        return NextResponse.json({ error: '用户不存�? }, { status: 401 });
      }
      if (userInfoV2.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 解析key为source和id
    const [source, id] = key.split('+');
    if (!source || !id) {
      return NextResponse.json({ error: '无效的key格式' }, { status: 400 });
    }

    await db.deleteSkipConfig(authInfo.username, source, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除跳过片头片尾配置失败:', error);
    return NextResponse.json(
      { error: '删除跳过片头片尾配置失败' },
      { status: 500 }
    );
  }
}
