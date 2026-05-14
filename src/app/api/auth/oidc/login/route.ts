/* eslint-disable no-console */
import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const config = await getConfig();
    const siteConfig = config.SiteConfig;

    // 检查是否启用OIDC登录
    if (!siteConfig.EnableOIDCLogin) {
      return NextResponse.json(
        { error: 'OIDC登录未启�? },
        { status: 403 }
      );
    }

    // 检查OIDC配置
    if (!siteConfig.OIDCAuthorizationEndpoint || !siteConfig.OIDCClientId) {
      return NextResponse.json(
        { error: 'OIDC配置不完整，请配置Authorization Endpoint和Client ID' },
        { status: 500 }
      );
    }

    // 生成state参数用于防止CSRF攻击
    const state = crypto.randomUUID();

    // 使用环境变量SITE_BASE或当前请求的origin
    const origin = process.env.SITE_BASE || request.nextUrl.origin;
    const redirectUri = `${origin}/api/auth/oidc/callback`;

    // 构建授权URL
    const authUrl = new URL(siteConfig.OIDCAuthorizationEndpoint);
    authUrl.searchParams.set('client_id', siteConfig.OIDCClientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('state', state);

    // 将state存储到cookie�?    const response = NextResponse.redirect(authUrl);

    response.cookies.set('oidc_state', state, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 600, // 10分钟
    });

    return response;
  } catch (error) {
    console.error('OIDC登录发起失败:', error);
    return NextResponse.json(
      { error: '服务器错�? },
      { status: 500 }
    );
  }
}
