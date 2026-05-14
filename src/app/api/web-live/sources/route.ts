import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { requireFeaturePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic'; // 禁用缓存

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireFeaturePermission(request, 'web_live', '无权限访问网络直�?);
    if (authResult instanceof NextResponse) return authResult;
    const config = await getConfig();
    if (!config?.WebLiveConfig) {
      return NextResponse.json([]);
    }

    const sources = config.WebLiveConfig.filter(s => !s.disabled);
    return NextResponse.json(sources);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    );
  }
}
