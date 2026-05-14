/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { AnimeSubscription } from '@/types/anime-subscription';

export const runtime = 'nodejs';

/**
 * GET /api/admin/anime-subscription
 * 获取订阅列表和配�? */
export async function GET(req: NextRequest) {
  try {
    // 权限检�?    const authInfo = getAuthInfoFromCookie(req);
    if (!authInfo || (authInfo.role !== 'admin' && authInfo.role !== 'owner')) {
      return NextResponse.json({ error: '无权限访�? }, { status: 403 });
    }

    const config = await getConfig();
    const animeConfig = config.AnimeSubscriptionConfig || {
      Enabled: false,
      Subscriptions: [],
    };

    return NextResponse.json(animeConfig);
  } catch (error: any) {
    console.error('获取追番订阅配置失败:', error);
    return NextResponse.json(
      { error: error.message || '获取配置失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/anime-subscription
 * 创建新订�? */
export async function POST(req: NextRequest) {
  try {
    // 权限检�?    const authInfo = getAuthInfoFromCookie(req);
    if (!authInfo || (authInfo.role !== 'admin' && authInfo.role !== 'owner')) {
      return NextResponse.json({ error: '无权限访�? }, { status: 403 });
    }

    const { title, filterText, source, enabled, lastEpisode } =
      await req.json();

    // 验证必填字段
    if (!title || !filterText || !source) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    // 验证 source
    if (!['acgrip', 'mikan', 'dmhy'].includes(source)) {
      return NextResponse.json({ error: '无效的搜索源' }, { status: 400 });
    }

    const config = await getConfig();
    if (!config.AnimeSubscriptionConfig) {
      config.AnimeSubscriptionConfig = { Enabled: false, Subscriptions: [] };
    }

    // 验证集数
    let episodeNum = 0;
    if (lastEpisode !== undefined) {
      episodeNum = parseInt(String(lastEpisode), 10);
      if (isNaN(episodeNum) || episodeNum < 0) {
        return NextResponse.json(
          { error: '集数必须是非负整�? },
          { status: 400 }
        );
      }
    }

    // 创建新订�?    const newSubscription: AnimeSubscription = {
      id: crypto.randomUUID(),
      title: title.trim(),
      filterText: filterText.trim(),
      source,
      enabled: enabled ?? true,
      lastCheckTime: 0,
      lastEpisode: episodeNum,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: authInfo.username || 'unknown',
    };

    config.AnimeSubscriptionConfig.Subscriptions.push(newSubscription);
    await db.saveAdminConfig(config);

    return NextResponse.json(newSubscription);
  } catch (error: any) {
    console.error('创建追番订阅失败:', error);
    return NextResponse.json(
      { error: error.message || '创建订阅失败' },
      { status: 500 }
    );
  }
}
