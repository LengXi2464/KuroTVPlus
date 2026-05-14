/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';
import { requireFeaturePermission } from '@/lib/permissions';

export const runtime = 'nodejs';

// GET - 获取歌单中的所有歌�?export async function GET(request: NextRequest) {
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
      return NextResponse.json({ error: '无权限访问此歌单' }, { status: 403 });
    }

    const songs = await db.getPlaylistSongs(playlistId);

    return NextResponse.json({ songs });
  } catch (error) {
    console.error('GET /api/music/playlists/songs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - 添加歌曲到歌�?export async function POST(request: NextRequest) {
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
    const { playlistId, song } = body;

    if (!playlistId) {
      return NextResponse.json(
        { error: '歌单ID不能为空' },
        { status: 400 }
      );
    }

    if (!song || !song.platform || !song.id || !song.name || !song.artist) {
      return NextResponse.json(
        { error: '歌曲信息不完�? },
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

    // 检查歌曲是否已在歌单中
    const exists = await db.isSongInPlaylist(playlistId, song.platform, song.id);
    if (exists) {
      return NextResponse.json(
        { error: '歌曲已在歌单�? },
        { status: 400 }
      );
    }

    await db.addSongToPlaylist(playlistId, {
      platform: song.platform,
      id: song.id,
      name: song.name,
      artist: song.artist,
      album: song.album,
      pic: song.pic,
      duration: song.duration || 0,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/music/playlists/songs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - 从歌单中移除歌曲
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
    const platform = searchParams.get('platform');
    const songId = searchParams.get('songId');

    if (!playlistId || !platform || !songId) {
      return NextResponse.json(
        { error: '参数不完�? },
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

    await db.removeSongFromPlaylist(playlistId, platform, songId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/music/playlists/songs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
