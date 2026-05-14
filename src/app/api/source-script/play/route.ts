import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import {
  parseScriptPlayUrlValue,
  resolveSavedScriptPlayUrl,
} from '@/lib/source-script';

export const runtime = 'nodejs';

/**
 * GET /api/source-script/play?key=xxx&sourceId=xxx&episodeIndex=0&playUrl=base64url&format=json
 * format=json: 返回 JSON 格式（用�?play 页面�? * 默认: 返回重定向（用于播放器或外部调用�? */
export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未授�? }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const sourceId = searchParams.get('sourceId');
    const episodeIndexRaw = searchParams.get('episodeIndex');
    const playUrlEncoded = searchParams.get('playUrl');
    const format = searchParams.get('format');

    if (!key || !sourceId || !episodeIndexRaw || !playUrlEncoded) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    const episodeIndex = Number.parseInt(episodeIndexRaw, 10);
    if (!Number.isInteger(episodeIndex) || episodeIndex < 0) {
      return NextResponse.json({ error: '无效�?episodeIndex' }, { status: 400 });
    }

    const playUrl = parseScriptPlayUrlValue(playUrlEncoded);
    if (!playUrl) {
      return NextResponse.json({ error: '无效的播放地址' }, { status: 400 });
    }

    const result = await resolveSavedScriptPlayUrl({
      key,
      sourceId,
      episodeIndex,
      playUrl,
    });

    if (!result.url || result.url.trim() === '') {
      throw new Error('获取到的播放链接为空');
    }

    if (format === 'json') {
      return NextResponse.json(result);
    }

    return NextResponse.redirect(result.url);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
