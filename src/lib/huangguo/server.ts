/* 黄果 (huangguoai) 上游代理：所有请求走 {base}/api/edge/request 信封。 */

import type { NextRequest } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';

import { accessToken, getHuangguoAccess } from './access';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export function huangguoBase(): string {
  return (process.env.HUANGGUO_BASE || 'https://huangguoai.com').replace(/\/+$/, '');
}

export const HUANGGUO_CATEGORIES = [
  { cate: 'ai-duanju', name: 'AI成人短剧' },
  { cate: 'ai-manju', name: 'AI成人漫剧' },
  { cate: 'ai-huanlian', name: 'AI换脸' },
  { cate: 'ai-mogai', name: 'AI魔改' },
];

const toBase64 = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};

async function postEnvelope(path: string, payload: unknown, token?: string): Promise<Response> {
  const base = huangguoBase();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Referer: `${base}/`,
    Origin: base,
    'User-Agent': UA,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${base}/api/edge/request`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      method: 'POST',
      path,
      body: toBase64(JSON.stringify(payload)),
      content_type: 'application/json',
    }),
    cache: 'no-store',
  });
}

let authCache: { token: string; at: number } | null = null;
const AUTH_TTL = 30 * 60 * 1000;

/** 可选账号登录：配置 HUANGGUO_USERNAME / HUANGGUO_PASSWORD 后才能取到播放直链。 */
export async function huangguoToken(force = false): Promise<string> {
  const username = process.env.HUANGGUO_USERNAME;
  const password = process.env.HUANGGUO_PASSWORD;
  if (!username || !password) return '';
  if (!force && authCache && Date.now() - authCache.at < AUTH_TTL) return authCache.token;
  const res = await postEnvelope('/api/account/loginByPassword', { username, password });
  if (!res.ok) throw new Error(`登录失败 ${res.status}`);
  const json = (await res.json()) as { status: number; data?: { token?: string }; msg?: string };
  const token = json.status === 1 ? json.data?.token || '' : '';
  if (!token) throw new Error(json.msg || '登录失败');
  authCache = { token, at: Date.now() };
  return token;
}

export async function huangguoApi<T = unknown>(path: string): Promise<T> {
  const base = huangguoBase();
  const send = async (token: string) => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Referer: `${base}/`,
      Origin: base,
      'User-Agent': UA,
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${base}/api/edge/request`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ method: 'GET', path, body: '', content_type: '' }),
      cache: 'no-store',
    });
  };
  let token = await huangguoToken();
  let res = await send(token);
  if (res.status === 401 && token) {
    token = await huangguoToken(true);
    res = await send(token);
  }
  if (!res.ok) throw new Error(`上游错误 ${res.status}`);
  const json = (await res.json()) as { status: number; data: T; msg?: string };
  if (json.status !== 1) throw new Error(json.msg || '上游返回失败');
  return json.data;
}

const COVER_KEY = 'f5d965df75336270';
const COVER_IV = '97b60394abc2fbe1';

type PlaybackData = {
  cdn?: { authKey?: string; authValue?: string };
  streams?: { main?: string; hevc?: string; preview?: string };
};

/** 取播放流：上游需 POST 到 /episodes/{ep}/playback，返回 m3u8 与 CDN 鉴权头。 */
export async function huangguoPlayback(id: number, ep: number): Promise<{ url: string; hevc?: string; auth?: string }> {
  const token = await huangguoToken();
  const res = await postEnvelope(`/api/videos/${id}/episodes/${ep}/playback`, {}, token || undefined);
  if (!res.ok) throw new Error(`上游错误 ${res.status}`);
  const json = (await res.json()) as { status: number; data?: PlaybackData; msg?: string };
  if (json.status !== 1 || !json.data) throw new Error(json.msg || '取播放地址失败');
  const url = json.data.streams?.main || json.data.streams?.preview || '';
  if (!url) throw new Error('上游未返回播放地址');
  return { url, hevc: json.data.streams?.hevc, auth: json.data.cdn?.authValue };
}

function sniffImage(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57) return 'image/webp';
  return null;
}

export async function fetchCover(url: string): Promise<{ body: Uint8Array; type: string }> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: `${huangguoBase()}/` } });
  if (!res.ok) throw new Error(`封面获取失败 ${res.status}`);
  const raw = new Uint8Array(await res.arrayBuffer());
  const t = sniffImage(raw);
  if (t) return { body: raw, type: t };
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(COVER_KEY), 'AES-CBC', false, ['decrypt']);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-CBC', iv: enc.encode(COVER_IV) }, key, raw)
  );
  return { body: plain, type: sniffImage(plain) || 'image/jpeg' };
}

export function absUrl(u: string): string {
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('//')) return `https:${u}`;
  return `${huangguoBase()}${u.startsWith('/') ? '' : '/'}${u}`;
}

const proxied = (abs: string, auth?: string) =>
  `/api/huangguo/hls?u=${encodeURIComponent(abs)}${auth ? `&h=${encodeURIComponent(auth)}` : ''}`;

export function rewriteM3u8(text: string, baseUrl: string, auth?: string): string {
  return text
    .split(/\r?\n/)
    .filter((l) => !l.startsWith('#EXT-X-CONTENT-STEERING'))
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_, u) => `URI="${proxied(new URL(u, baseUrl).toString(), auth)}"`);
      }
      return proxied(new URL(t, baseUrl).toString(), auth);
    })
    .join('\n');
}

export async function fetchUpstream(url: string, auth?: string): Promise<Response> {
  const headers: Record<string, string> = { 'User-Agent': UA, Referer: `${huangguoBase()}/` };
  if (auth) headers['x-cdn-auth'] = auth;
  return fetch(url, { headers, cache: 'no-store' });
}

/* ---- 访问密码（后台 HuangguoAccessConfig，未配置时回退 HUANGGUO_ACCESS_PASSWORD） ---- */

export const GATE_COOKIE = 'hg_gate';

export async function gateRequired(): Promise<boolean> {
  return (await getHuangguoAccess()).required;
}

/** 校验通过时返回应写入 cookie 的令牌。 */
export async function gateTokenFor(password: string): Promise<string> {
  const access = await getHuangguoAccess();
  if (!access.required || password !== access.password) return '';
  return accessToken(access.password);
}

export async function gateUnlocked(cookie?: string): Promise<boolean> {
  const access = await getHuangguoAccess();
  if (!access.required) return true;
  if (!cookie) return false;
  return cookie === (await accessToken(access.password));
}

/** 站点所有者（管理员）免密。 */
export function isOwnerRequest(req: NextRequest): boolean {
  const owner = process.env.USERNAME;
  if (!owner) return false;
  const auth = getAuthInfoFromCookie(req);
  return !!auth?.username && auth.username === owner;
}

const visitMap = new Map<string, HuangguoVisit>();
const VISIT_ONLINE_MS = 5 * 60 * 1000;
const VISIT_KEEP_MS = 30 * 60 * 1000;

export type HuangguoVisit = {
  ip: string;
  device: string;
  model: string;
  loc: string;
  user: string;
  lastSeen: number;
  admin: boolean;
};

const deviceOf = (ua: string): string => {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return '其他';
};

/** 记录一次成功访问（内存级，仅当前实例，用于后台查看在线情况）。IP 保留完整值。 */
export function recordVisit(req: NextRequest, admin: boolean): void {
  const ip =
    req.headers.get('cf-connecting-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    '';
  const ua = req.headers.get('user-agent') || '';
  const now = Date.now();
  const key = `${ip}|${deviceOf(ua)}`;
  const prev = visitMap.get(key);
  visitMap.set(key, {
    ip: ip || '未知',
    device: deviceOf(ua),
    model: prev?.model || '',
    loc: prev?.loc || '',
    user: prev?.user || '',
    lastSeen: now,
    admin,
  });
  if (visitMap.size > 200) {
    visitMap.forEach((v, k) => {
      if (now - v.lastSeen > VISIT_KEEP_MS) visitMap.delete(k);
    });
  }
}

/** 进站上报时补充完整位置与设备型号。 */
export function recordEntry(
  req: NextRequest,
  info: { ip: string; loc: string; model: string; user?: string }
): void {
  const ua = req.headers.get('user-agent') || '';
  const key = `${info.ip}|${deviceOf(ua)}`;
  const prev = visitMap.get(key);
  visitMap.set(key, {
    ip: info.ip,
    device: deviceOf(ua),
    model: info.model,
    loc: info.loc,
    user: info.user || prev?.user || '',
    lastSeen: Date.now(),
    admin: prev?.admin ?? false,
  });
}

export function getVisitStats(): { online: number; visitors: HuangguoVisit[] } {
  const now = Date.now();
  const list: HuangguoVisit[] = [];
  visitMap.forEach((v) => {
    if (now - v.lastSeen <= VISIT_KEEP_MS) list.push(v);
  });
  list.sort((a, b) => b.lastSeen - a.lastSeen);
  return {
    online: list.filter((v) => now - v.lastSeen <= VISIT_ONLINE_MS).length,
    visitors: list.slice(0, 10),
  };
}

/** 路由入口统一校验：管理员免密，其余校验 hg_gate。 */
export async function gateUnlockedRequest(req: NextRequest): Promise<boolean> {
  if (isOwnerRequest(req)) {
    recordVisit(req, true);
    return true;
  }
  const ok = await gateUnlocked(req.cookies.get(GATE_COOKIE)?.value);
  if (ok) recordVisit(req, false);
  return ok;
}
