/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * PUT /api/admin/anime-subscription/toggle
 * 切换追番功能启用状�? */
export async function PUT(req: NextRequest) {
  try {
    // 权限检�?    const authInfo = getAuthInfoFromCookie(req);
    if (!authInfo || (authInfo.role !== 'admin' && authInfo.role !== 'owner')) {
      return NextResponse.json({ error: '无权限访�? }, { status: 403 });
    }

    const { enabled } = await req.json();

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled 必须是布尔�? },
        { status: 400 }
      );
    }

    const config = await getConfig();
    if (!config.AnimeSubscriptionConfig) {
      config.AnimeSubscriptionConfig = { Enabled: false, Subscriptions: [] };
    }

    config.AnimeSubscriptionConfig.Enabled = enabled;
    await db.saveAdminConfig(config);

    return NextResponse.json({ success: true, enabled });
  } catch (error: any) {
    console.error('切换追番功能状态失�?', error);
    return NextResponse.json(
      { error: error.message || '切换状态失�? },
      { status: 500 }
    );
  }
}
