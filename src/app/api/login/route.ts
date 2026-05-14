/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { parseAuthInfo } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import {
  generateRefreshToken,
  generateTokenId,
  storeRefreshToken,
  TOKEN_CONFIG,
} from '@/lib/refresh-token';

export const runtime = 'nodejs';

// 读取存储类型环境变量，默�?localstorage
const STORAGE_TYPE =
  (process.env.NEXT_PUBLIC_STORAGE_TYPE as
    | 'localstorage'
    | 'redis'
    | 'upstash'
    | 'kvrocks'
    | undefined) || 'localstorage';

function buildLoginResponse(authToken?: string | null) {
  const body: Record<string, unknown> = { ok: true };

  if (authToken) {
    body.token = authToken;
    const authInfo = parseAuthInfo(authToken);
    if (authInfo) {
      const { password, ...rest } = authInfo;
      body.auth = rest;
    }
  }

  return NextResponse.json(body);
}

// 生成签名
async function generateSignature(
  data: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  // 导入密钥
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // 生成签名
  const signature = await crypto.subtle.sign('HMAC', key, messageData);

  // 转换为十六进制字符串
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// 生成认证Cookie（带签名�?Refresh Token�?async function generateAuthCookie(
  username?: string,
  password?: string,
  role?: 'owner' | 'admin' | 'user',
  includePassword = false,
  deviceInfo?: string
): Promise<string> {
  const now = Date.now();
  const authData: any = { role: role || 'user' };

  // 只在需要时包含 password
  if (includePassword && password) {
    authData.password = password;
  }

  if (username && process.env.PASSWORD) {
    authData.username = username;
    authData.timestamp = now; // Access Token 时间�?
    // 生成 Refresh Token（仅数据库模式）
    if (!includePassword && STORAGE_TYPE !== 'localstorage') {
      const tokenId = generateTokenId();
      const refreshToken = generateRefreshToken();
      const refreshExpires = now + TOKEN_CONFIG.REFRESH_TOKEN_AGE;

      authData.tokenId = tokenId;
      authData.refreshToken = refreshToken;
      authData.refreshExpires = refreshExpires;

      // 存储�?Redis Hash
      try {
        await storeRefreshToken(username, tokenId, {
          token: refreshToken,
          deviceInfo: deviceInfo || 'Unknown Device',
          createdAt: now,
          expiresAt: refreshExpires,
          lastUsed: now,
        });
      } catch (error) {
        console.error('Failed to store refresh token:', error);
      }
    }

    // 签名所有关键字段（username, role, timestamp）防止篡�?    const dataToSign = JSON.stringify({
      username: authData.username,
      role: authData.role,
      timestamp: authData.timestamp
    });
    const signature = await generateSignature(dataToSign, process.env.PASSWORD);
    authData.signature = signature;
  }

  return encodeURIComponent(JSON.stringify(authData));
}

// 验证Cloudflare Turnstile Token
async function verifyTurnstileToken(token: string, secretKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
      }),
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Turnstile验证失败:', error);
    return false;
  }
}

// 获取设备信息
function getDeviceInfo(request: NextRequest): string {
  const userAgent = request.headers.get('user-agent') || 'Unknown';

  // 检查是否为 KuroTVPlus APP
  if (userAgent.toLowerCase().includes('KuroTVPlus')) {
    return 'KuroTVPlus APP';
  }

  // 检查是否为 OrionTV
  if (userAgent.toLowerCase().includes('oriontv')) {
    return 'OrionTV';
  }

  // 简单解�?User-Agent
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';

  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iOS')) os = 'iOS';

  return `${browser} on ${os}`;
}

export async function POST(req: NextRequest) {
  try {
    // 获取站点配置
    const adminConfig = await getConfig();
    const siteConfig = adminConfig.SiteConfig;

    // 本地 / localStorage 模式——仅校验固定密码
    if (STORAGE_TYPE === 'localstorage') {
      const envPassword = process.env.PASSWORD;

      // 未配�?PASSWORD 时直接放�?      if (!envPassword) {
        const response = buildLoginResponse();

        // 清除可能存在的认证cookie
        response.cookies.set('auth', '', {
          path: '/',
          expires: new Date(0),
          sameSite: 'lax',
          httpOnly: false,
        });

        return response;
      }

      const { password } = await req.json();
      if (typeof password !== 'string') {
        return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
      }

      if (password !== envPassword) {
        return NextResponse.json(
          { ok: false, error: '密码错误' },
          { status: 401 }
        );
      }

      // 验证成功，设置认证cookie
      const username = process.env.USERNAME || 'default';
      const deviceInfo = getDeviceInfo(req);
      const cookieValue = await generateAuthCookie(
        username,
        password,
        'owner',
        true,
        deviceInfo
      ); // localstorage 模式包含 password
      const response = buildLoginResponse(cookieValue);
      const expires = new Date();
      expires.setDate(expires.getDate() + 60); // 60天过期（Refresh Token 有效期）

      response.cookies.set('auth', cookieValue, {
        path: '/',
        expires,
        sameSite: 'lax',
        httpOnly: false, // 允许客户端访�?        secure: false,
      });

      return response;
    }

    // 数据�?/ redis 模式——校验用户名并尝试连接数据库
    const { username, password, turnstileToken } = await req.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: '用户名不能为�? }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
    }

    // 如果开启了Turnstile验证
    if (siteConfig.LoginRequireTurnstile) {
      if (!turnstileToken) {
        return NextResponse.json(
          { error: '请完成人机验�? },
          { status: 400 }
        );
      }

      if (!siteConfig.TurnstileSecretKey) {
        console.error('Turnstile Secret Key未配�?);
        return NextResponse.json(
          { error: '服务器配置错�? },
          { status: 500 }
        );
      }

      // 验证Turnstile Token
      const isValid = await verifyTurnstileToken(turnstileToken, siteConfig.TurnstileSecretKey);
      if (!isValid) {
        return NextResponse.json(
          { error: '人机验证失败，请重试' },
          { status: 400 }
        );
      }
    }

    // 可能是站长，直接读环境变�?    if (
      username === process.env.USERNAME &&
      password === process.env.PASSWORD
    ) {
      // 验证成功，设置认证cookie
      const deviceInfo = getDeviceInfo(req);
      const cookieValue = await generateAuthCookie(
        username,
        password,
        'owner',
        false,
        deviceInfo
      ); // 数据库模式不包含 password
      const response = buildLoginResponse(cookieValue);
      const expires = new Date();
      expires.setDate(expires.getDate() + 60); // 60天过期（Refresh Token 有效期）

      response.cookies.set('auth', cookieValue, {
        path: '/',
        expires,
        sameSite: 'lax',
        httpOnly: false, // 允许客户端访�?        secure: false,
      });

      return response;
    } else if (username === process.env.USERNAME) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    // 使用新版本的用户验证
    let pass = false;
    let userRole: 'owner' | 'admin' | 'user' = 'user';
    let isBanned = false;

    // 验证用户
    const userInfoV2 = await db.getUserInfoV2(username);

    if (userInfoV2) {
      // 使用新版本验�?      pass = await db.verifyUserV2(username, password);
      userRole = userInfoV2.role;
      isBanned = userInfoV2.banned;
    }

    // 检查用户是否被封禁
    if (isBanned) {
      return NextResponse.json({ error: '用户被封�? }, { status: 401 });
    }

    if (!pass) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 验证成功，设置认证cookie
    const deviceInfo = getDeviceInfo(req);
    const cookieValue = await generateAuthCookie(
      username,
      password,
      userRole,
      false,
      deviceInfo
    ); // 数据库模式不包含 password
    const response = buildLoginResponse(cookieValue);
    const expires = new Date();
    expires.setDate(expires.getDate() + 60); // 60天过期（Refresh Token 有效期）

  response.cookies.set('auth', cookieValue, {
    path: '/',
    expires,
    sameSite: 'lax',
    httpOnly: false, // 允许客户端访�?  });

    console.log(`Cookie已设置`);

    return response;
  } catch (error) {
    console.error('登录接口异常', error);
    return NextResponse.json({ error: '服务器错�? }, { status: 500 });
  }
}
