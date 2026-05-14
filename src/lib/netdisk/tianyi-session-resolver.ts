import { getConfig } from '@/lib/config';

import { listTianyiShareVideos } from './tianyi.client';
import {
  createTianyiNetdiskSession,
  getTianyiNetdiskSession,
  parseTianyiNetdiskId,
  refreshTianyiNetdiskSession,
} from './tianyi-session-cache';

export async function resolveTianyiSession(id: string) {
  const config = await getConfig();
  const tianyiConfig = config.NetDiskConfig?.Tianyi;
  if (!tianyiConfig?.Enabled || !tianyiConfig.Account || !tianyiConfig.Password) {
    throw new Error('天翼云盘未配置或未启�?);
  }

  let session = refreshTianyiNetdiskSession(id) || getTianyiNetdiskSession(id);
  if (!session) {
    const payload = parseTianyiNetdiskId(id);
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

  if (!session) {
    throw new Error('天翼云盘播放信息恢复失败');
  }

  return {
    session,
    account: tianyiConfig.Account,
    password: tianyiConfig.Password,
  };
}
