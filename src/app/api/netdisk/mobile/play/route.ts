import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import {
  getMobileShareDownloadUrl,
  getMobileSharePlayUrl,
  listMobileShareVideos,
} from '@/lib/netdisk/mobile.client';
import {
  createMobileNetdiskSession,
  getMobileNetdiskSession,
  parseMobileNetdiskId,
  refreshMobileNetdiskSession,
} from '@/lib/netdisk/mobile-session-cache';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo?.username) {
      return NextResponse.json({ error: '未授�? }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id') || searchParams.get('session');
    const episodeIndexRaw = searchParams.get('episodeIndex');
    const format = searchParams.get('format');

    if (!sessionId || episodeIndexRaw == null) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    const episodeIndex = Number.parseInt(episodeIndexRaw, 10);
    if (!Number.isInteger(episodeIndex) || episodeIndex < 0) {
      return NextResponse.json({ error: '无效�?episodeIndex' }, { status: 400 });
    }

    const config = await getConfig();
    const mobileConfig = config.NetDiskConfig?.Mobile;
    if (!mobileConfig?.Enabled || !mobileConfig.Authorization) {
      return NextResponse.json({ error: '移动云盘未配置或未启�? }, { status: 400 });
    }

    let session = refreshMobileNetdiskSession(sessionId) || getMobileNetdiskSession(sessionId);
    if (!session) {
      const payload = parseMobileNetdiskId(sessionId);
      const result = await listMobileShareVideos(payload.shareUrl, mobileConfig.Authorization);
      session = createMobileNetdiskSession({
        title: result.title,
        shareUrl: payload.shareUrl,
        passcode: payload.passcode,
        files: result.files,
      });
    }

    const file = session.files[episodeIndex];
    if (!file) {
      return NextResponse.json({ error: '播放文件不存�? }, { status: 404 });
    }

    let url = '';
    try {
      url = await getMobileSharePlayUrl(
        file.contentId,
        file.linkID,
        mobileConfig.Authorization
      );
    } catch {
      url = await getMobileShareDownloadUrl(
        file.contentId,
        file.linkID,
        mobileConfig.Authorization
      );
    }
    refreshMobileNetdiskSession(sessionId);

    if (format === 'json') {
      return NextResponse.json({ url, headers: {} });
    }

    return NextResponse.redirect(url);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取播放地址失败' },
      { status: 500 }
    );
  }
}
