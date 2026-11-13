import { getConfig, setCachedConfig } from '@/lib/config';

/** 解析留影推送的 Telegram chat id：环境变量 > 后台已存 > getUpdates 自动识别（识别后永久保存）。
    getUpdates 只保留 24 小时内的消息，所以识别成功一次就必须落盘，否则过期后又发不出去。 */
export async function resolveEntryChatId(token: string): Promise<string> {
  const env = process.env.TG_ENTRY_CHAT_ID || '';
  if (env) return env;
  try {
    const cfg = (await getConfig()).EntryCaptureConfig;
    if (cfg?.TgChatId) return cfg.TgChatId;
  } catch {
    /* ignore */
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=5`);
    const j = (await res.json()) as {
      result?: { message?: { chat?: { id?: number } } }[];
    };
    const list = j.result || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const id = list[i]?.message?.chat?.id;
      if (id) {
        const chat = String(id);
        try {
          const config = await getConfig();
          config.EntryCaptureConfig = {
            Enabled: config.EntryCaptureConfig?.Enabled ?? false,
            Users: config.EntryCaptureConfig?.Users || [],
            TgChatId: chat,
          };
          const { db } = await import('@/lib/db');
          await db.saveAdminConfig(config);
          await setCachedConfig(config);
        } catch {
          /* 存不了也先用本次识别结果 */
        }
        return chat;
      }
    }
  } catch {
    /* ignore */
  }
  return '';
}
