/* eslint-disable no-console*/

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserDevices, revokeRefreshToken } from '@/lib/refresh-token';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  // 不支�?localstorage 模式
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储模式修改密�?,
      },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { newPassword } = body;

    // 获取认证信息
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 验证新密�?    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json({ error: '新密码不得为�? }, { status: 400 });
    }

    const username = authInfo.username;

    // 不允许站长修改密码（站长用户名等�?process.env.USERNAME�?    if (username === process.env.USERNAME) {
      return NextResponse.json(
        { error: '站长不能通过此接口修改密�? },
        { status: 403 }
      );
    }

    // 修改密码（只更新V2存储�?    await db.changePasswordV2(username, newPassword);

    // 撤销除当前设备外的所�?Refresh Token
    try {
      const currentTokenId = authInfo.tokenId;
      const devices = await getUserDevices(username);

      // 撤销所有非当前设备�?token
      for (const device of devices) {
        if (device.tokenId !== currentTokenId) {
          await revokeRefreshToken(username, device.tokenId);
          console.log(`Revoked token ${device.tokenId} for ${username} after password change`);
        }
      }

      console.log(`Password changed for ${username}, revoked ${devices.length - 1} other devices`);
    } catch (error) {
      console.error('Failed to revoke other devices after password change:', error);
      // 不影响密码修改的成功，只记录错误
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('修改密码失败:', error);
    return NextResponse.json(
      {
        error: '修改密码失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
