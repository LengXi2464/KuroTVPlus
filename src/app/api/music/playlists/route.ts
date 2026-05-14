/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';
import { requireFeaturePermission } from '@/lib/permissions';

export const runtime = 'nodejs';

// GET - 获取用户的所有歌�?export async function GET(request: NextRequest) {
  try {
    const authResult = await requireFeaturePermission(request, 'music', '无权限访问音乐功�?);
    if (authResult instanceof NextResponse) return authResult;
    // �?cookie 获取用户信息
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查用户状�?    if (authInfo.username !== process.env.USERNAME) {
      const userInfoV2 = await db.getUserInfoV2(authInfo.username);
      if (!userInfoV2) {
        return NextResponse.json({ error: '用户不存�? }, { status: 401 });
      }
      if (userInfoV2.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401 });
      }
    }

    const playlists = await db.getUserMusicPlaylists(authInfo.username);

    return NextResponse.json({ playlists });
  } catch (error) {
    console.error('GET /api/music/playlists error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - 创建新歌�?export async function POST(request: NextRequest) {
  try {
    const authResult = await requireFeaturePermission(request, 'music', '无权限访问音乐功�?);
    if (authResult instanceof NextResponse) return authResult;
    // �?cookie 获取用户信息
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查用户状�?    if (authInfo.username !== process.env.USERNAME) {
      const userInfoV2 = await db.getUserInfoV2(authInfo.username);
      if (!userInfoV2) {
        return NextResponse.json({ error: '用户不存�? }, { status: 401 });
      }
      if (userInfoV2.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401 });
      }
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: '歌单名称不能为空' },
        { status: 400 }
      );
    }

    const playlistId = randomUUID();

    await db.createMusicPlaylist(authInfo.username, {
      id: playlistId,
      name: name.trim(),
      description: description?.trim(),
    });

    const playlist = await db.getMusicPlaylist(playlistId);

    return NextResponse.json({ playlist });
  } catch (error) {
    console.error('POST /api/music/playlists error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - 更新歌单信息
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireFeaturePermission(request, 'music', '无权限访问音乐功�?);
    if (authResult instanceof NextResponse) return authResult;
    // �?cookie 获取用户信息
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查用户状�?    if (authInfo.username !== process.env.USERNAME) {
      const userInfoV2 = await db.getUserInfoV2(authInfo.username);
      if (!userInfoV2) {
        return NextResponse.json({ error: '用户不存�? }, { status: 401 });
      }
      if (userInfoV2.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401 });
      }
    }

    const body = await request.json();
    const { playlistId, name, description, cover } = body;

    if (!playlistId) {
      return NextResponse.json(
        { error: '歌单ID不能为空' },
        { status: 400 }
      );
    }

    // 检查歌单是否存在且属于当前用户
    const playlist = await db.getMusicPlaylist(playlistId);
    if (!playlist) {
      return NextResponse.json({ error: '歌单不存�? }, { status: 404 });
    }
    if (playlist.username !== authInfo.username) {
      return NextResponse.json({ error: '无权限操作此歌单' }, { status: 403 });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim();
    if (cover !== undefined) updates.cover = cover;

    await db.updateMusicPlaylist(playlistId, updates);

    const updatedPlaylist = await db.getMusicPlaylist(playlistId);

    return NextResponse.json({ playlist: updatedPlaylist });
  } catch (error) {
    console.error('PUT /api/music/playlists error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - 删除歌单
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireFeaturePermission(request, 'music', '无权限访问音乐功�?);
    if (authResult instanceof NextResponse) return authResult;
    // �?cookie 获取用户信息
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查用户状�?    if (authInfo.username !== process.env.USERNAME) {
      const userInfoV2 = await db.getUserInfoV2(authInfo.username);
      if (!userInfoV2) {
        return NextResponse.json({ error: '用户不存�? }, { status: 401 });
      }
      if (userInfoV2.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(request.url);
    const playlistId = searchParams.get('playlistId');

    if (!playlistId) {
      return NextResponse.json(
        { error: '歌单ID不能为空' },
        { status: 400 }
      );
    }

    // 检查歌单是否存在且属于当前用户
    const playlist = await db.getMusicPlaylist(playlistId);
    if (!playlist) {
      return NextResponse.json({ error: '歌单不存�? }, { status: 404 });
    }
    if (playlist.username !== authInfo.username) {
      return NextResponse.json({ error: '无权限操作此歌单' }, { status: 403 });
    }

    await db.deleteMusicPlaylist(playlistId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/music/playlists error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
