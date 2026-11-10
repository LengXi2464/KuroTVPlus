/* 黄果 (huangguoai) 上游代理：所有请求走 {base}/api/edge/request 信封。 */

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

const proxied = (abs: string) => `/api/huangguo/hls?u=${encodeURIComponent(abs)}`;

export function rewriteM3u8(text: string, baseUrl: string): string {
  return text
    .split(/\r?\n/)
    .filter((l) => !l.startsWith('#EXT-X-CONTENT-STEERING'))
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_, u) => `URI="${proxied(new URL(u, baseUrl).toString())}"`);
      }
      return proxied(new URL(t, baseUrl).toString());
    })
    .join('\n');
}

export async function fetchUpstream(url: string): Promise<Response> {
  return fetch(url, { headers: { 'User-Agent': UA, Referer: `${huangguoBase()}/` } });
}
