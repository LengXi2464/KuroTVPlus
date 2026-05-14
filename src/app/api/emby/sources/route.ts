import { NextRequest, NextResponse } from 'next/server';

import { embyManager } from '@/lib/emby-manager';
import { requireFeaturePermission } from '@/lib/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // 禁用缓存

/**
 * 获取所有启用的Emby源列�? */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireFeaturePermission(request, 'emby', '无权限访�?Emby');
    if (authResult instanceof NextResponse) return authResult;
    const sources = await embyManager.getEnabledSources();

    return NextResponse.json({
      sources: sources.map(s => ({
        key: s.key,
        name: s.name,
      })),
    });
  } catch (error) {
    console.error('[Emby Sources] 获取Emby源列表失�?', error);
    return NextResponse.json(
      { error: '获取Emby源列表失�?, sources: [] },
      { status: 500 }
    );
  }
}
