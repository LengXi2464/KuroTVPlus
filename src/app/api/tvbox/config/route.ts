import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * 获取TVBOX订阅配置
 */
export async function GET(request: NextRequest) {
  // 验证用户登录
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // 检查是否开启订阅功�?  const enableSubscribe = process.env.ENABLE_TVBOX_SUBSCRIBE === 'true';
  const subscribeToken = process.env.TVBOX_SUBSCRIBE_TOKEN;

  if (!enableSubscribe || !subscribeToken) {
    return NextResponse.json(
      {
        enabled: false,
        url: '',
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  // 构建订阅链接
  // 优先使用 SITE_BASE 环境变量，如果没有则使用前端传来�?origin
  const siteBase = process.env.SITE_BASE;
  const searchParams = request.nextUrl.searchParams;
  const clientOrigin = searchParams.get('origin');
  const adFilter = searchParams.get('adFilter') === 'true'; // 获取去广告参�?
  const baseUrl = siteBase || clientOrigin || request.nextUrl.origin;

  // 构建订阅链接，包�?adFilter 参数
  const subscribeUrl = `${baseUrl}/api/tvbox/subscribe?token=${encodeURIComponent(subscribeToken)}&adFilter=${adFilter}`;

  return NextResponse.json(
    {
      enabled: true,
      url: subscribeUrl,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
