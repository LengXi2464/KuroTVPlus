'use strict';
/**
 * 基于 fetch 的 HTTP 客户端（Workers / Node 18+ 通用）。
 *
 * 关键行为：
 *  - 默认跟随重定向（手动处理，保持与原实现一致的语义）
 *  - 默认不主动发 accept-encoding
 *  - 超时抛异常而非静默返回
 *
 * 早期版本用 node:http/https，但 Cloudflare Workers 等 runtime 通过 unenv
 * 垫片时没有该实现（报 "[unenv] https.request is not implemented yet"），
 * 故统一改走全局 fetch。
 */

/** 响应结果。 */
class Resp {
  constructor(status, body, headers) {
    this.status = status;
    this.body = body || Buffer.alloc(0);
    this.headers = headers || {};
  }

  text() { return this.body.toString(); }

  header(name) {
    const v = this.headers[String(name).toLowerCase()];
    if (v === undefined || v === null) return null;
    return Array.isArray(v) ? (v.length ? v[0] : null) : String(v);
  }

  ok() { return this.status >= 200 && this.status < 300; }
}

/** 把 fetch 的 Headers 展开成普通对象（键统一小写）。 */
function flattenHeaders(h) {
  const out = {};
  if (!h) return out;
  h.forEach((v, k) => { out[k.toLowerCase()] = v; });
  return out;
}

/**
 * 发起请求。
 * @param {object} req { method, url, headers, body, timeoutMs, followRedirect }
 * @returns {Promise<Resp>}
 */
function send(req) {
  const follow = req.followRedirect !== false;
  return sendOnce(req, follow ? 5 : 0);
}

async function sendOnce(req, redirectsLeft) {
  let u;
  try {
    u = new URL(req.url);
  } catch (e) {
    throw new Error('非法 URL: ' + req.url);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('仅支持 http/https，当前协议不支持：' + req.url);
  }

  const method = req.method || 'GET';
  const headers = Object.assign({}, req.headers || {});
  const body = req.body || null;

  // fetch 会自行计算 content-length；手工指定在部分 runtime 会报错。
  for (const k of Object.keys(headers)) {
    const kl = k.toLowerCase();
    if (kl === 'content-length' || kl === 'accept-encoding') delete headers[k];
  }

  const timeoutMs = req.timeoutMs || 30000;
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  if (ac) {
    timer = setTimeout(() => ac.abort(), timeoutMs);
  }

  let res;
  try {
    res = await fetch(u.toString(), {
      method,
      headers,
      body: body === null ? undefined : body,
      redirect: 'manual',
      signal: ac ? ac.signal : undefined,
    });
  } catch (e) {
    if (e && (e.name === 'AbortError' || String(e.message || '').includes('abort')) ) {
      throw new Error('请求超时');
    }
    throw e;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }

  const status = res.status;
  const loc = res.headers ? res.headers.get('location') : null;

  if (redirectsLeft > 0 && status >= 300 && status < 400 && loc) {
    let m = method;
    if (status === 303 || m === 'POST') m = 'GET';
    let nextUrl;
    try {
      nextUrl = new URL(loc, u).toString();
    } catch (e) {
      nextUrl = loc;
    }
    const nh = Object.assign({}, headers);
    let nb = body;
    if (m === 'GET') {
      nb = null;
      for (const k of Object.keys(nh)) {
        const kl = k.toLowerCase();
        if (kl === 'content-length' || kl === 'content-type') delete nh[k];
      }
    }
    // 重定向后重新计时
    return sendOnce({ ...req, method: m, url: nextUrl, body: nb, headers: nh, timeoutMs },
      redirectsLeft - 1);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return new Resp(status, buf, flattenHeaders(res.headers));
}

/** 解码查询片段；非法百分号转义时原样返回（Node 内置 decodeURIComponent 会抛错）。 */
function urldecode(s) {
  try {
    return decodeURIComponent(String(s).replace(/\+/g, ' '));
  } catch (e) {
    return String(s);
  }
}

/**
 * 解析查询串为对象。
 * 用 URLSearchParams 完成解码，再按出现顺序覆盖写入，
 * 从而保持「重复键取最后一个」的既有语义。
 */
function parseQuery(qs) {
  const out = {};
  if (qs === null || qs === undefined || qs === '') return out;
  for (const [k, v] of new URLSearchParams(String(qs))) out[k] = v;
  return out;
}

/** 把多行文本按逗号切分成去空白列表；null/空返回 null。 */
function splitCsv(v) {
  if (v === null || v === undefined || v === '') return null;
  const out = [];
  for (const s of String(v).split(',')) {
    const t = s.trim();
    if (t !== '') out.push(t);
  }
  return out;
}

module.exports = { Resp, send, urldecode, parseQuery, splitCsv };
