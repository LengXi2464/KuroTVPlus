/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig, setCachedConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { assertBaiduCookieHeaderSafe, normalizeBaiduCookie } from '@/lib/netdisk/baidu.client';
import {
  assertMobileAuthorizationHeaderSafe,
  normalizeMobileAuthorization,
} from '@/lib/netdisk/mobile.client';
import {
  normalizePan123Account,
  normalizePan123Password,
  validatePan123Credentials,
} from '@/lib/netdisk/pan123.client';
import { assertPan115CookieHeaderSafe, normalizePan115Cookie, validatePan115Cookie } from '@/lib/netdisk/pan115.client';
import {
  assertQuarkCookieHeaderSafe,
  normalizeQuarkCookie,
  validateQuarkCookieReadable,
} from '@/lib/netdisk/quark.client';
import { normalizeTianyiAccount, normalizeTianyiPassword, validateTianyiCredentials } from '@/lib/netdisk/tianyi.client';
import {
  assertUCCookieHeaderSafe,
  normalizeUCCookie,
  validateUCCookieReadable,
} from '@/lib/netdisk/uc.client';

export const runtime = 'nodejs';

function requireOwner(username: string | undefined) {
  return username === process.env.USERNAME;
}

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      { error: '不支持本地存储进行管理员配置' },
      { status: 400 }
    );
  }

  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo?.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!requireOwner(authInfo.username)) {
      const userInfo = await db.getUserInfoV2(authInfo.username);
      if (!userInfo || userInfo.role !== 'admin' || userInfo.banned) {
        return NextResponse.json({ error: '权限不足' }, { status: 401 });
      }
    }

    const body = await request.json();
    const { action, Quark, Mobile, Baidu, Tianyi, Pan123, UC, Pan115, provider } = body;
    const adminConfig = await getConfig();

    if (action === 'save') {
      const normalizedCookie = Quark?.Cookie ? assertQuarkCookieHeaderSafe(Quark.Cookie) : '';
      const normalizedMobileAuthorization = Mobile?.Authorization
        ? assertMobileAuthorizationHeaderSafe(Mobile.Authorization)
        : '';
      const normalizedBaiduCookie = Baidu?.Cookie ? assertBaiduCookieHeaderSafe(Baidu.Cookie) : '';
      const normalizedTianyiAccount = Tianyi?.Account ? normalizeTianyiAccount(Tianyi.Account) : '';
      const normalizedTianyiPassword = Tianyi?.Password ? normalizeTianyiPassword(Tianyi.Password) : '';
      const normalizedPan123Account = Pan123?.Account ? normalizePan123Account(Pan123.Account) : '';
      const normalizedPan123Password = Pan123?.Password ? normalizePan123Password(Pan123.Password) : '';
      const normalizedUCCookie = UC?.Cookie ? assertUCCookieHeaderSafe(UC.Cookie) : '';
      const normalizedUCToken = UC?.Token ? String(UC.Token).trim() : '';
      const normalizedPan115Cookie = Pan115?.Cookie ? assertPan115CookieHeaderSafe(Pan115.Cookie) : '';

      adminConfig.NetDiskConfig = adminConfig.NetDiskConfig || {};
      adminConfig.NetDiskConfig.Quark = {
        Enabled: Boolean(Quark?.Enabled),
        Cookie: normalizedCookie,
        SavePath: Quark?.SavePath || '/',
      };
      adminConfig.NetDiskConfig.Mobile = {
        Enabled: Boolean(Mobile?.Enabled),
        Authorization: normalizedMobileAuthorization,
      };
      adminConfig.NetDiskConfig.Baidu = {
        Enabled: Boolean(Baidu?.Enabled),
        Cookie: normalizedBaiduCookie,
      };
      adminConfig.NetDiskConfig.Tianyi = {
        Enabled: Boolean(Tianyi?.Enabled),
        Account: normalizedTianyiAccount,
        Password: normalizedTianyiPassword,
      };
      adminConfig.NetDiskConfig.Pan123 = {
        Enabled: Boolean(Pan123?.Enabled),
        Account: normalizedPan123Account,
        Password: normalizedPan123Password,
      };
      adminConfig.NetDiskConfig.UC = {
        Enabled: Boolean(UC?.Enabled),
        Cookie: normalizedUCCookie,
        Token: normalizedUCToken,
        SavePath: UC?.SavePath || '/',
      };
      adminConfig.NetDiskConfig.Pan115 = {
        Enabled: Boolean(Pan115?.Enabled),
        Cookie: normalizedPan115Cookie,
      };

      await db.saveAdminConfig(adminConfig);
      await setCachedConfig(adminConfig);

      return NextResponse.json({ success: true, message: '保存成功' });
    }

    if (action === 'validate') {
      if (provider === 'mobile') {
        if (!Mobile?.Authorization) {
          return NextResponse.json({ error: '请先填写移动云盘 Authorization' }, { status: 400 });
        }

        normalizeMobileAuthorization(Mobile.Authorization);
        return NextResponse.json({
          success: true,
          message: '移动云盘 Authorization 格式正常',
        });
      }
      if (provider === 'baidu') {
        if (!Baidu?.Cookie) {
          return NextResponse.json({ error: '请先填写百度网盘 Cookie' }, { status: 400 });
        }
        normalizeBaiduCookie(Baidu.Cookie);
        return NextResponse.json({
          success: true,
          message: '百度网盘 Cookie 格式正常',
        });
      }
      if (provider === 'tianyi') {
        if (!Tianyi?.Account || !Tianyi?.Password) {
          return NextResponse.json({ error: '请先填写天翼云盘账号和密�? }, { status: 400 });
        }
        await validateTianyiCredentials(
          normalizeTianyiAccount(Tianyi.Account),
          normalizeTianyiPassword(Tianyi.Password)
        );
        return NextResponse.json({
          success: true,
          message: '天翼云盘账号密码可用',
        });
      }
      if (provider === 'pan123') {
        if (!Pan123?.Account || !Pan123?.Password) {
          return NextResponse.json({ error: '请先填写123网盘账号和密�? }, { status: 400 });
        }
        await validatePan123Credentials(
          normalizePan123Account(Pan123.Account),
          normalizePan123Password(Pan123.Password)
        );
        return NextResponse.json({
          success: true,
          message: '123网盘账号密码可用',
        });
      }
      if (provider === 'uc') {
        if (!UC?.Cookie) {
          return NextResponse.json({ error: '请先填写UC Cookie' }, { status: 400 });
        }
        await validateUCCookieReadable(normalizeUCCookie(UC.Cookie));
        return NextResponse.json({
          success: true,
          message: 'UC Cookie 可读',
        });
      }
      if (provider === 'pan115') {
        if (!Pan115?.Cookie) {
          return NextResponse.json({ error: '请先填写115 Cookie' }, { status: 400 });
        }
        await validatePan115Cookie(normalizePan115Cookie(Pan115.Cookie));
        return NextResponse.json({
          success: true,
          message: '115 Cookie 格式正常',
        });
      }

      if (!Quark?.Cookie) {
        return NextResponse.json({ error: '请先填写夸克 Cookie' }, { status: 400 });
      }
      await validateQuarkCookieReadable(normalizeQuarkCookie(Quark.Cookie));

      return NextResponse.json({
        success: true,
        message: '夸克cookie正常',
      });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error('[Admin NetDisk] 操作失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '操作失败' },
      { status: 500 }
    );
  }
}
