// React Hook for Web Live Page Synchronization
'use client';

import { useCallback, useEffect, useRef } from 'react';

import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import type { LiveState } from '@/types/watch-room';

interface UseWebLiveSyncOptions {
  currentSourceKey: string;
  currentSourceName: string;
  currentSourcePlatform: string;
  currentSourceRoomId: string;
  onSourceChange?: (sourceKey: string, platform: string, roomId: string) => void;
}

export function useWebLiveSync({
  currentSourceKey,
  currentSourceName,
  currentSourcePlatform,
  currentSourceRoomId,
  onSourceChange,
}: UseWebLiveSyncOptions) {
  const watchRoom = useWatchRoomContextSafe();
  const syncingRef = useRef(false); // 防止循环同步

  // 检查是否在房间�?  const isInRoom = !!(watchRoom && watchRoom.currentRoom);
  const isOwner = watchRoom?.isOwner || false;
  const currentRoom = watchRoom?.currentRoom;
  const socket = watchRoom?.socket;

  // 房主：广播直播源切换
  const broadcastSourceChange = useCallback(() => {
    if (!isOwner || !socket || syncingRef.current || !watchRoom) return;

    if (!currentSourceKey || !currentSourceName || !currentSourcePlatform || !currentSourceRoomId) return;

    // 使用 channelId 存储 sourceKey，channelUrl 存储 platform:roomId
    const state: LiveState = {
      type: 'live',
      channelId: currentSourceKey,
      channelName: currentSourceName,
      channelUrl: `${currentSourcePlatform}:${currentSourceRoomId}`,
    };

    console.log('[WebLiveSync] Broadcasting source change:', state);
    watchRoom.changeLiveChannel(state);
  }, [isOwner, socket, currentSourceKey, currentSourceName, currentSourcePlatform, currentSourceRoomId, watchRoom]);

  // 房员：接收并同步房主的直播源切换
  useEffect(() => {
    if (!socket || !currentRoom || isOwner || !isInRoom) return;

    const handleLiveChange = (state: LiveState) => {
      if (syncingRef.current) return;

      console.log('[WebLiveSync] Received source change:', state);
      syncingRef.current = true;

      try {
        // 解析 channelUrl 获取 platform �?roomId
        const [platform, roomId] = state.channelUrl.split(':');

        // 调用回调函数来切换直播源
        if (onSourceChange && platform && roomId) {
          onSourceChange(state.channelId, platform, roomId);
        }
      } finally {
        setTimeout(() => {
          syncingRef.current = false;
        }, 1000);
      }
    };

    socket.on('live:change', handleLiveChange);

    return () => {
      socket.off('live:change', handleLiveChange);
    };
  }, [socket, currentRoom, isOwner, onSourceChange, isInRoom]);

  // 房主：当直播源改变时自动广播
  useEffect(() => {
    if (!isOwner || !currentSourceKey || !isInRoom) return;

    // 防止初始化时广播
    if (syncingRef.current) return;

    const timer = setTimeout(() => {
      broadcastSourceChange();
    }, 500); // 延迟广播，避免频繁触�?
    return () => clearTimeout(timer);
  }, [isOwner, currentSourceKey, currentSourcePlatform, currentSourceRoomId, broadcastSourceChange, isInRoom]);

  return {
    isInRoom,
    isOwner,
    shouldDisableControls: isInRoom && !isOwner, // 房员禁用直播源切�?    broadcastSourceChange, // 导出供手动调�?  };
}
