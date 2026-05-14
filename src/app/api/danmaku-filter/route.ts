/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';
import { DanmakuFilterConfig } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未登�? }, { status: 401 });
    }

    if (authInfo.username !== process.env.USERNAME) {
      // 非站长，检查用户存在或被封�?      const userInfoV2 = await db.getUserInfoV2(authInfo.username);
      if (!userInfoV2) {
        return NextResponse.json({ error: '用户不存�? }, { status: 401 });
      }
      if (userInfoV2.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401 });
      }
    }

    // 获取弹幕过滤配置
    const filterConfig = await db.getDanmakuFilterConfig(authInfo.username);

    // 如果没有配置，返回默认�?    if (!filterConfig) {
      return NextResponse.json({ rules: [] });
    }

    return NextResponse.json(filterConfig);
  } catch (error) {
    console.error('获取弹幕过滤配置失败:', error);
    return NextResponse.json(
      { error: '获取弹幕过滤配置失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未登�? }, { status: 401 });
    }

    if (authInfo.username !== process.env.USERNAME) {
      // 非站长，检查用户存在或被封�?      const userInfoV2 = await db.getUserInfoV2(authInfo.username);
      if (!userInfoV2) {
        return NextResponse.json({ error: '用户不存�? }, { status: 401 });
      }
      if (userInfoV2.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401 });
      }
    }

    const body = await request.json();
    const config: DanmakuFilterConfig = body;

    if (!config || !Array.isArray(config.rules)) {
      return NextResponse.json({ error: '配置格式错误' }, { status: 400 });
    }

    // 验证每个规则的格�?    const validatedRules = config.rules.map((rule) => ({
      keyword: String(rule.keyword || ''),
      type: (rule.type === 'regex' || rule.type === 'normal') ? rule.type : 'normal',
      enabled: Boolean(rule.enabled),
      id: rule.id || undefined,
    }));

    const validatedConfig: DanmakuFilterConfig = {
      rules: validatedRules,
    };

    await db.setDanmakuFilterConfig(authInfo.username, validatedConfig);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('保存弹幕过滤配置失败:', error);
    return NextResponse.json(
      { error: '保存弹幕过滤配置失败' },
      { status: 500 }
    );
  }
}
