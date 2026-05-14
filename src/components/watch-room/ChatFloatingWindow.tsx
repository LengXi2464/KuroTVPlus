// 全局聊天悬浮窗和房间信息按钮
'use client';

import { AlertCircle,Info, LogOut, Maximize2, MessageCircle, Mic, MicOff, Minimize2, Send, Smile, Users, Volume2, VolumeX, X, XCircle } from 'lucide-react';
import { useEffect, useRef,useState } from 'react';

import { useVoiceChat } from '@/hooks/useVoiceChat';

import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

const EMOJI_LIST = ['😀', '😂', '😍', '🥰', '😎', '🤔', '👍', '👏', '🎉', '❤️', '🔥', '�?];

export default function ChatFloatingWindow() {
  const watchRoom = useWatchRoomContextSafe();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);
  const isOpenRef = useRef(isOpen);
  const isMinimizedRef = useRef(isMinimized);
  const currentRoomIdRef = useRef<string | null>(null);

  // 语音聊天状�?  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // 使用语音聊天hook
  const voiceChat = useVoiceChat({
    socket: watchRoom?.socket || null,
    roomId: watchRoom?.currentRoom?.id || null,
    isMicEnabled,
    isSpeakerEnabled,
    members: watchRoom?.members || [],
  });

  // 当房间变化时重置状�?  useEffect(() => {
    const roomId = watchRoom?.currentRoom?.id || null;
    if (roomId !== currentRoomIdRef.current) {
      currentRoomIdRef.current = roomId;
      lastMessageCountRef.current = 0;
      setUnreadCount(0);
      setIsOpen(false);
      setIsMinimized(false);
    }
  }, [watchRoom?.currentRoom?.id]);

  // 同步窗口状态到 ref
  useEffect(() => {
    isOpenRef.current = isOpen;
    isMinimizedRef.current = isMinimized;
  }, [isOpen, isMinimized]);

  // 自动滚动到底�?  useEffect(() => {
    if (messagesEndRef.current && watchRoom?.currentRoom) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [watchRoom?.chatMessages, watchRoom?.currentRoom]);

  // 跟踪未读消息数量
  useEffect(() => {
    if (!watchRoom?.chatMessages) {
      lastMessageCountRef.current = 0;
      return;
    }

    const currentCount = watchRoom.chatMessages.length;

    // 如果消息数量减少了（比如切换房间），重置计数器和未读�?    if (currentCount < lastMessageCountRef.current) {
      lastMessageCountRef.current = currentCount;
      setUnreadCount(0);
      return;
    }

    if (currentCount > lastMessageCountRef.current) {
      // 有新消息
      const newMessageCount = currentCount - lastMessageCountRef.current;

      if (!isOpenRef.current && !isMinimizedRef.current) {
        // 只有在聊天窗口完全关闭时才增加未读计�?        setUnreadCount(prev => prev + newMessageCount);
      }
    }
    lastMessageCountRef.current = currentCount;
  }, [watchRoom?.chatMessages]);

  // 打开聊天窗口时清空未读计�?  useEffect(() => {
    if (isOpen || isMinimized) {
      setUnreadCount(0);
    }
  }, [isOpen, isMinimized]);

  // 处理手动重连
  const handleReconnect = async () => {
    if (!watchRoom?.manualReconnect) return;

    setIsReconnecting(true);
    try {
      await watchRoom.manualReconnect();
    } catch (error) {
      console.error('[ChatFloatingWindow] Reconnect failed:', error);
    } finally {
      setIsReconnecting(false);
    }
  };

  // 如果没有加入房间，只显示重连按钮（如果需要）
  if (!watchRoom?.currentRoom) {
    // 重连失败时显示重连按�?    if (watchRoom?.reconnectFailed) {
      return (
        <div className="fixed bottom-20 right-4 z-[700] flex flex-col gap-3 md:bottom-4">
          <button
            onClick={handleReconnect}
            disabled={isReconnecting}
            className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-2xl transition-all hover:scale-110 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed animate-pulse"
            aria-label="连接失败，点击重�?
            title="连接失败，点击重�?
          >
            <AlertCircle className="h-6 w-6" />
            {isReconnecting && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
              </div>
            )}
          </button>
        </div>
      );
    }
    return null;
  }

  const { chatMessages, sendChatMessage, members, isOwner, currentRoom, leaveRoom } = watchRoom;

  const handleSendMessage = () => {
    if (!message.trim()) return;

    sendChatMessage(message.trim(), 'text');
    setMessage('');
    setShowEmojiPicker(false);
  };

  const handleSendEmoji = (emoji: string) => {
    sendChatMessage(emoji, 'emoji');
    setShowEmojiPicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleLeaveRoom = () => {
    if (confirm(isOwner ? '确定要解散房间吗？所有成员将被踢出房间�? : '确定要退出房间吗�?)) {
      leaveRoom();
      setShowRoomInfo(false);
    }
  };

  // 悬浮按钮�?  if (!isOpen && !showRoomInfo) {
    return (
      <div className="fixed bottom-20 right-4 z-[700] flex flex-col gap-3 md:bottom-4">
        {/* 重连失败提示气泡 */}
        {watchRoom?.reconnectFailed && (
          <button
            onClick={handleReconnect}
            disabled={isReconnecting}
            className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-2xl transition-all hover:scale-110 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed animate-pulse"
            aria-label="连接失败，点击重�?
            title="连接失败，点击重�?
          >
            <AlertCircle className="h-6 w-6" />
            {isReconnecting && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
              </div>
            )}
          </button>
        )}

        {/* 房间信息按钮 */}
        <button
          onClick={() => setShowRoomInfo(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-white shadow-2xl transition-all hover:scale-110 hover:bg-blue-600"
          aria-label="房间信息"
        >
          <Info className="h-6 w-6" />
        </button>

        {/* 聊天按钮 */}
        <button
          onClick={() => setIsOpen(true)}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-2xl transition-all hover:scale-110 hover:bg-green-600"
          aria-label="打开聊天"
        >
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  // 房间信息模态框
  if (showRoomInfo) {
    return (
      <>
        {/* 背景遮罩 */}
        <div
          className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]'
          onClick={() => setShowRoomInfo(false)}
          onTouchMove={(e) => {
            e.preventDefault();
          }}
          onWheel={(e) => {
            e.preventDefault();
          }}
          style={{
            touchAction: 'none',
          }}
        />

        {/* 房间信息面板 */}
        <div className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-xl z-[1001] overflow-hidden'>
          <div
            className='h-full p-6'
            data-panel-content
            onTouchMove={(e) => {
              e.stopPropagation();
            }}
            style={{
              touchAction: 'auto',
            }}
          >
            {/* 标题�?*/}
            <div className='flex items-center justify-between mb-6'>
              <div className='flex items-center gap-3'>
                <Info className='h-6 w-6 text-blue-500 dark:text-blue-400' />
                <h3 className='text-xl font-bold text-gray-800 dark:text-gray-200'>房间信息</h3>
              </div>
              <button
                onClick={() => setShowRoomInfo(false)}
                className='rounded-full p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
                aria-label='关闭'
              >
                <X className='h-5 w-5' />
              </button>
            </div>

            {/* 内容 */}
            <div className='space-y-4'>
              {/* 房间基本信息 */}
              <div className='space-y-3'>
                <div className='flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700'>
                  <span className='text-sm font-medium text-gray-600 dark:text-gray-400'>房间名称</span>
                  <span className='text-sm font-semibold text-gray-900 dark:text-gray-100'>{currentRoom.name}</span>
                </div>

                <div className='flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700'>
                  <span className='text-sm font-medium text-gray-600 dark:text-gray-400'>房间�?/span>
                  <span className='text-lg font-mono font-bold text-gray-900 dark:text-gray-100'>{currentRoom.id}</span>
                </div>

                {currentRoom.description && (
                  <div className='rounded-lg bg-gray-50 dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700'>
                    <span className='text-sm font-medium text-gray-600 dark:text-gray-400 block mb-2'>房间描述</span>
                    <p className='text-sm text-gray-700 dark:text-gray-300'>{currentRoom.description}</p>
                  </div>
                )}

                <div className='flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700'>
                  <span className='text-sm font-medium text-gray-600 dark:text-gray-400'>房主</span>
                  <span className='text-sm font-semibold text-gray-900 dark:text-gray-100'>{currentRoom.ownerName}</span>
                </div>
              </div>

              {/* 成员列表 */}
              <div className='rounded-lg bg-gray-50 dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700'>
                <div className='flex items-center gap-2 mb-3'>
                  <Users className='h-4 w-4 text-gray-600 dark:text-gray-400' />
                  <span className='text-sm font-medium text-gray-600 dark:text-gray-400'>成员列表 ({members.length})</span>
                </div>
                <div className='space-y-2 max-h-40 overflow-y-auto'>
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className='flex items-center justify-between bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600'
                    >
                      <div className='flex items-center gap-3'>
                        <div className='w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm'>
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <span className='text-sm font-medium text-gray-900 dark:text-gray-100'>{member.name}</span>
                      </div>
                      {member.isOwner && (
                        <span className='text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded-full font-bold'>
                          房主
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 操作按钮 */}
              <button
                onClick={handleLeaveRoom}
                className={`w-full flex items-center justify-center gap-2 rounded-lg py-3 font-medium transition-colors ${
                  isOwner
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white'
                }`}
              >
                {isOwner ? (
                  <>
                    <XCircle className='h-5 w-5' />
                    解散房间
                  </>
                ) : (
                  <>
                    <LogOut className='h-5 w-5' />
                    退出房�?                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // 最小化状�?  if (isMinimized) {
    return (
      <>
        {/* 重连失败提示气泡 */}
        {watchRoom?.reconnectFailed && (
          <button
            onClick={handleReconnect}
            disabled={isReconnecting}
            className="fixed bottom-[13.5rem] right-4 z-[700] group relative flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-2xl transition-all hover:scale-110 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed animate-pulse md:bottom-[11rem]"
            aria-label="连接失败，点击重�?
            title="连接失败，点击重�?
          >
            <AlertCircle className="h-5 w-5" />
            {isReconnecting && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
              </div>
            )}
          </button>
        )}

        {/* 房间信息按钮 */}
        <button
          onClick={() => setShowRoomInfo(true)}
          className="fixed bottom-36 right-4 z-[700] flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 text-white shadow-2xl transition-all hover:scale-110 hover:bg-blue-600 md:bottom-20"
          aria-label="房间信息"
        >
          <Info className="h-5 w-5" />
        </button>

        {/* 最小化的聊天窗�?*/}
        <div className="fixed bottom-20 right-4 z-[700] flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 shadow-2xl md:bottom-4">
          <MessageCircle className="h-5 w-5 text-white" />
          <span className="text-sm text-white">聊天�?/span>
          <button
            onClick={() => setIsMinimized(false)}
            className="ml-2 rounded p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
            aria-label="展开"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </>
    );
  }

  // 完整聊天窗口
  return (
    <>
      {/* 重连失败提示气泡 */}
      {watchRoom?.reconnectFailed && (
        <button
          onClick={handleReconnect}
          disabled={isReconnecting}
          className="fixed bottom-[32.5rem] right-4 z-[700] group relative flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-2xl transition-all hover:scale-110 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed animate-pulse md:bottom-[30rem]"
          aria-label="连接失败，点击重�?
          title="连接失败，点击重�?
        >
          <AlertCircle className="h-5 w-5" />
          {isReconnecting && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
            </div>
          )}
        </button>
      )}

      {/* 房间信息按钮 */}
      <button
        onClick={() => setShowRoomInfo(true)}
        className="fixed bottom-[30rem] right-4 z-[700] flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 text-white shadow-2xl transition-all hover:scale-110 hover:bg-blue-600 md:bottom-[28rem]"
        aria-label="房间信息"
      >
        <Info className="h-5 w-5" />
      </button>

      {/* 聊天窗口 */}
      <div className="fixed bottom-20 right-4 z-[700] flex w-80 flex-col rounded-2xl bg-gray-800 shadow-2xl md:bottom-4 md:w-96">
      {/* 头部 */}
      <div className="rounded-t-2xl bg-green-500">
        {/* 第一�? 标题和窗口控�?*/}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-white" />
            <div>
              <h3 className="text-sm font-bold text-white">聊天�?/h3>
              <p className="text-xs text-white/80">{members.length} 人在�?/p>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="rounded p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              aria-label="最小化"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 第二�? 语音控制按钮 */}
        <div className="border-t border-white/10 px-4 py-2">
          <div className="flex items-center justify-center gap-3 mb-1">
            {/* 麦克风按�?*/}
            <button
              onClick={() => setIsMicEnabled(!isMicEnabled)}
              disabled={voiceChat.isConnecting}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                isMicEnabled
                  ? 'bg-white text-green-600 hover:bg-white/90'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={isMicEnabled ? '关闭麦克�? : '开启麦克风'}
            >
              {isMicEnabled ? (
                <Mic className="h-4 w-4" />
              ) : (
                <MicOff className="h-4 w-4" />
              )}
              <span>{isMicEnabled ? '麦克风开' : '麦克风关'}</span>
            </button>

            {/* 喇叭按钮 */}
            <button
              onClick={() => setIsSpeakerEnabled(!isSpeakerEnabled)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                isSpeakerEnabled
                  ? 'bg-white text-green-600 hover:bg-white/90'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
              aria-label={isSpeakerEnabled ? '关闭喇叭' : '开启喇�?}
            >
              {isSpeakerEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
              <span>{isSpeakerEnabled ? '喇叭开' : '喇叭�?}</span>
            </button>
          </div>

          {/* 状态指�?*/}
          <div className="text-center text-xs text-white/60">
            {voiceChat.isConnecting && '正在连接...'}
            {voiceChat.error && (
              <span className="text-red-300">{voiceChat.error}</span>
            )}
            {!voiceChat.isConnecting && !voiceChat.error && isMicEnabled && (
              <span>
                {voiceChat.strategy === 'webrtc-fallback' ? 'WebRTC模式' : '服务器中转模�?}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: '400px' }}>
        {chatMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <MessageCircle className="mx-auto mb-2 h-12 w-12 text-gray-600" />
              <p className="text-sm text-gray-400">还没有消�?/p>
              <p className="text-xs text-gray-500">发送第一条消息吧</p>
            </div>
          </div>
        ) : (
          <>
            {chatMessages.map((msg) => (
              <div key={msg.id} className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-green-400">{msg.userName}</span>
                  <span className="text-xs text-gray-500">{formatTime(msg.timestamp)}</span>
                </div>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    msg.type === 'emoji'
                      ? 'text-3xl'
                      : 'bg-gray-700 text-white'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 输入区域 */}
      <div className="border-t border-gray-700 p-3">
        {/* 表情选择�?*/}
        {showEmojiPicker && (
          <div className="mb-2 grid grid-cols-6 gap-2 rounded-lg bg-gray-700 p-2">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleSendEmoji(emoji)}
                className="rounded p-1 text-2xl transition-colors hover:bg-gray-600"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="rounded-lg bg-gray-700 p-2 text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
            aria-label="表情"
          >
            <Smile className="h-5 w-5" />
          </button>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            className="flex-1 rounded-lg bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            maxLength={200}
          />
          <button
            onClick={handleSendMessage}
            disabled={!message.trim()}
            className="rounded-lg bg-green-500 p-2 text-white transition-colors hover:bg-green-600 disabled:opacity-50"
            aria-label="发�?
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 房间信息提示 */}
      <div className="rounded-b-2xl bg-gray-900/50 px-4 py-2 text-center text-xs text-gray-400">
        {isOwner ? (
          <span className="text-yellow-400">👑 您是房主</span>
        ) : (
          <span>房间: {watchRoom.currentRoom.name}</span>
        )}
      </div>
    </div>
    </>
  );
}
