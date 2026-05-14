// @ts-nocheck

import { request } from './http';

export async function checkUC(link) {
  const { shareID, error: parseError } = extractShareIDFromURL(link);
  if (parseError) {
    return { valid: false, reason: '链接格式无效: ' + parseError };
  }

  try {
    const url = `https://drive.uc.cn/s/${shareID}`;
    const { statusCode, body } = await request(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Mobile Safari/537.36',
      },
    });

    if (statusCode !== 200) {
      return { valid: false, reason: `HTTP状态码: ${statusCode}` };
    }

    const pageText = body.toLowerCase();
    for (const keyword of ['失效', '不存�?, '违规', '删除', '已过�?, '被取�?]) {
      if (pageText.includes(keyword)) return { valid: false, reason: '链接已失�? };
    }
    for (const keyword of ['文件', '分享']) {
      if (pageText.includes(keyword)) return { valid: true, reason: '' };
    }

    return { valid: false, reason: '无法判断链接有效�? };
  } catch (err) {
    if (err.message === '请求超时') return { valid: true, reason: '' };
    return { valid: true, reason: '' };
  }
}

export function extractShareIDFromURL(urlStr) {
  const match = urlStr.match(/https?:\/\/drive\.uc\.cn\/s\/([a-zA-Z0-9]+)/);
  if (match && match[1]) {
    return { shareID: match[1], error: null };
  }
  return { shareID: '', error: '无法从URL中提取share_id' };
}
