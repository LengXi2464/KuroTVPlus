import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { NETDISK_TIANYI_SOURCE } from '@/lib/netdisk/source';
import { listTianyiShareVideos } from '@/lib/netdisk/tianyi.client';
import { createTianyiNetdiskSession } from '@/lib/netdisk/tianyi-session-cache';
import { hasFeaturePermission } from '@/lib/permissions';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo?.username) {
      return NextResponse.json({ error: '未登�? }, { status: 401 });
    }
    if (!(await hasFeaturePermission(authInfo.username, 'netdisk_temp_play'))) {
      return NextResponse.json({ error: '无权限使用临时播�? }, { status: 403 });
    }

    const { shareUrl, passcode, title } = await request.json();
    if (!shareUrl) {
      return NextResponse.json({ error: '分享链接不能为空' }, { status: 400 });
    }

    const config = await getConfig();
    const tianyiConfig = config.NetDiskConfig?.Tianyi;
    if (!tianyiConfig?.Enabled || !tianyiConfig.Account || !tianyiConfig.Password) {
      return NextResponse.json({ error: '天翼云盘未配置或未启�? }, { status: 400 });
    }

    const result = await listTianyiShareVideos(
      shareUrl,
      tianyiConfig.Account,
      tianyiConfig.Password,
      passcode || ''
    );
    const session = createTianyiNetdiskSession({
      title: title || result.title,
      shareUrl,
      passcode,
      shareId: result.shareId,
      shareMode: result.shareMode,
      isFolder: result.isFolder,
      accessCode: result.accessCode,
      files: result.files,
    });

    return NextResponse.json({
      success: true,
      source: NETDISK_TIANYI_SOURCE,
      id: session.id,
      title: title || result.title,
      totalFiles: result.files.length,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '立即播放失败' },
      { status: 500 }
    );
  }
}
