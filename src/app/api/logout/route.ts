import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { revokeRefreshToken } from '@/lib/refresh-token';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);

  // 撤销当前设备�?Refresh Token
  if (authInfo && authInfo.username && authInfo.tokenId) {
    try {
      await revokeRefreshToken(authInfo.username, authInfo.tokenId);
    } catch (error) {
      console.error('Failed to revoke refresh token:', error);
    }
  }

  const response = NextResponse.json({ ok: true });

  // 清除认证cookie
  response.cookies.set('auth', '', {
    path: '/',
    expires: new Date(0),
    sameSite: 'lax',
    httpOnly: false,
    secure: false,
  });

  return response;
}
