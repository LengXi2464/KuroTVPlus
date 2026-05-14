// @ts-nocheck

import { request } from './http';

export async function checkQuark(link) {
  const { resId, pwd, error: parseError } = extractParamsQuark(link);
  if (parseError) {
    return { valid: false, reason: '链接格式无效: ' + parseError };
  }

  try {
    const tokenURL = 'https://drive-h.quark.cn/1/clouddrive/share/sharepage/token';
    const { statusCode: status1, body: body1 } = await request(tokenURL, {
      method: 'POST',
      body: {
        pwd_id: resId,
        passcode: pwd,
        support_visit_limit_private_share: true,
      },
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://pan.quark.cn',
        Referer: 'https://pan.quark.cn/',
      },
    });

    if (status1 !== 200) {
      return { valid: false, reason: `Token API返回错误状态码: ${status1}` };
    }

    const tokenResp = JSON.parse(body1);
    if (tokenResp.status !== 200 || tokenResp.code !== 0) {
      return { valid: false, reason: '分享链接失效或不存在' };
    }
    if (!tokenResp.data?.stoken) {
      return { valid: false, reason: '分享链接无效：未获取到访问令�? };
    }

    const detailURL = `https://drive-pc.quark.cn/1/clouddrive/share/sharepage/detail?pwd_id=${encodeURIComponent(resId)}&stoken=${encodeURIComponent(tokenResp.data.stoken)}&ver=2&pr=ucpro`;
    const { statusCode: status2, body: body2 } = await request(detailURL, {
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Cache-Control': 'no-cache',
        Origin: 'https://pan.quark.cn',
        Referer: 'https://pan.quark.cn/',
        Pragma: 'no-cache',
      },
    });

    if (status2 !== 200) {
      return { valid: false, reason: `Detail API返回错误状态码: ${status2}` };
    }

    const detailResp = JSON.parse(body2);
    if (!detailResp.data?.list || detailResp.data.list.length === 0) {
      return { valid: false, reason: '分享链接无效：文件列表为�? };
    }

    return { valid: true, reason: '' };
  } catch (err) {
    if (err.message === '请求超时') return { valid: false, reason: '请求超时' };
    return { valid: false, reason: `检测失�? ${err.message}` };
  }
}

export function extractParamsQuark(rawURL) {
  const urlRegex = /^https:\/\/(?:pan\.quark\.cn|pan\.qoark\.cn)\/s\/[a-zA-Z0-9]+(?:\?[^#]*)?(?:#.*)?$/;
  if (!urlRegex.test(rawURL)) {
    return { resId: '', pwd: '', error: '无效的URL格式' };
  }

  try {
    const u = new URL(rawURL);
    if (!u.pathname.startsWith('/s/')) {
      return { resId: '', pwd: '', error: '无效的路径格�? };
    }

    const pathPart = u.pathname.replace('/s/', '');
    const resId = pathPart.split('/')[0].trim();
    if (!resId) {
      return { resId: '', pwd: '', error: '无法从URL路径中提取有效的pwd_id' };
    }

    const pwd = (u.searchParams.get('pwd') || '').trim();
    return { resId, pwd, error: null };
  } catch (e) {
    return { resId: '', pwd: '', error: e.message };
  }
}
