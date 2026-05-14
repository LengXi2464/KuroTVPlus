import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { getTianyiSharePlayUrl } from '@/lib/netdisk/tianyi.client';
import { listTianyiShareVideos } from '@/lib/netdisk/tianyi.client';
import { createTianyiNetdiskSession, getTianyiNetdiskSession, parseTianyiNetdiskId, refreshTianyiNetdiskSession } from '@/lib/netdisk/tianyi-session-cache';

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
    const tianyiConfig = config.NetDiskConfig?.Tianyi;
    if (!tianyiConfig?.Enabled || !tianyiConfig.Account || !tianyiConfig.Password) {
      return NextResponse.json({ error: '天翼云盘未配置或未启�? }, { status: 400 });
    }

    let session = refreshTianyiNetdiskSession(sessionId) || getTianyiNetdiskSession(sessionId);
    if (!session) {
      const payload = parseTianyiNetdiskId(sessionId);
      const result = await listTianyiShareVideos(
        payload.shareUrl,
        tianyiConfig.Account,
        tianyiConfig.Password,
        payload.passcode || ''
      );
      session = createTianyiNetdiskSession({
        title: result.title,
        shareUrl: payload.shareUrl,
        passcode: payload.passcode,
        shareId: result.shareId,
        shareMode: result.shareMode,
        isFolder: result.isFolder,
        accessCode: result.accessCode,
        files: result.files,
      });
    }

    const file = session.files[episodeIndex];
    if (!file) {
      return NextResponse.json({ error: '播放文件不存�? }, { status: 404 });
    }

    const url = await getTianyiSharePlayUrl(
      file.fileId,
      file.shareId,
      tianyiConfig.Account,
      tianyiConfig.Password
    );
    refreshTianyiNetdiskSession(sessionId);

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
