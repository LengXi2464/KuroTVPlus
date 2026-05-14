// 观影室首�?- 选项卡式界面
'use client';

import { List as ListIcon, Lock, RefreshCw,UserPlus, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect,useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import PageLayout from '@/components/PageLayout';
import Toast, { ToastProps } from '@/components/Toast';
import { useWatchRoomContext } from '@/components/WatchRoomProvider';

import type { Room, RoomType } from '@/types/watch-room';

type TabType = 'create' | 'join' | 'list';

function getScreenShareHostSupportError() {
  if (typeof window === 'undefined') return null;

  if (!window.isSecureContext) {
    return '当前环境不是安全上下文（HTTPS/localhost），不支持屏幕共�?;
  }

  if (!navigator.mediaDevices?.getDisplayMedia) {
    return '当前浏览器不支持屏幕共享';
  }

  if (typeof window.RTCPeerConnection === 'undefined') {
    return '当前浏览器不支持实时屏幕传输';
  }

  return null;
}

function getScreenShareViewerSupportError() {
  if (typeof window === 'undefined') return null;

  if (typeof window.RTCPeerConnection === 'undefined') {
    return '当前浏览器不支持实时屏幕传输';
  }

  return null;
}

export default function WatchRoomPage() {
  const router = useRouter();
  const watchRoom = useWatchRoomContext();
  const { getRoomList, isConnected, createRoom, joinRoom, currentRoom, isOwner, members, socket } = watchRoom;
  const [activeTab, setActiveTab] = useState<TabType>('create');

  // 获取当前登录用户（在客户端挂载后读取，避�?hydration 错误�?  const [currentUsername, setCurrentUsername] = useState<string>('游客');

  useEffect(() => {
    const authInfo = getAuthInfoFromBrowserCookie();
    setCurrentUsername(authInfo?.username || '游客');
  }, []);

  // 创建房间表单
  const [createForm, setCreateForm] = useState({
    roomName: '',
    description: '',
    password: '',
    isPublic: true,
    roomType: 'sync' as RoomType,
  });

  // 加入房间表单
  const [joinForm, setJoinForm] = useState({
    roomId: '',
    password: '',
  });

  // 房间列表
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);

  const showToast = (message: string, type: ToastProps['type'] = 'info') => {
    setToast({
      message,
      type,
      duration: 3000,
      onClose: () => setToast(null),
    });
  };

  const getAvatarText = (name?: string) => (name?.trim().charAt(0).toUpperCase() || '�?);

  // 加载房间列表
  const loadRooms = async (showLoading = false) => {
    if (!isConnected) return;

    if (showLoading) {
      setLoading(true);
    }
    try {
      const roomList = await getRoomList();
      setRooms(roomList);
    } catch (error) {
      console.error('[WatchRoom] Failed to load rooms:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // 切换到房间列�?tab 时加载房�?  useEffect(() => {
    if (activeTab === 'list') {
      loadRooms(true);
      // �?秒刷新一�?      const interval = setInterval(() => loadRooms(false), 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, isConnected]);

  // 处理创建房间
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.roomName.trim()) {
      showToast('请输入房间名�?, 'error');
      return;
    }

    if (createForm.roomType === 'screen') {
      const supportError = getScreenShareHostSupportError();
      if (supportError) {
        showToast(`当前设备无法创建屏幕共享房间�?{supportError}`, 'error');
        return;
      }
    }

    setCreateLoading(true);
    try {
      await createRoom({
        name: createForm.roomName.trim(),
        description: createForm.description.trim(),
        password: createForm.password.trim() || undefined,
        isPublic: createForm.isPublic,
        roomType: createForm.roomType,
        userName: currentUsername,
      });

      // 清空表单
      setCreateForm({
        roomName: '',
        description: '',
        password: '',
        isPublic: true,
        roomType: 'sync',
      });
    } catch (error: any) {
      showToast(error.message || '创建房间失败', 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  // 处理加入房间
  const handleJoinRoom = async (e: React.FormEvent, roomId?: string) => {
    e.preventDefault();
    const targetRoomId = roomId || joinForm.roomId.trim().toUpperCase();
    if (!targetRoomId) {
      showToast('请输入房间ID', 'error');
      return;
    }

    const targetRoom = rooms.find((room) => room.id === targetRoomId);
    if (targetRoom?.roomType === 'screen') {
      const supportError = getScreenShareViewerSupportError();
      if (supportError) {
        showToast(`当前设备无法加入屏幕共享房间�?{supportError}`, 'error');
        return;
      }
    }

    setJoinLoading(true);
    try {
      const result = await joinRoom({
        roomId: targetRoomId,
        password: joinForm.password.trim() || undefined,
        userName: currentUsername,
      });

      // 清空表单
      setJoinForm({
        roomId: '',
        password: '',
      });

      // 注意：加入房间后，isOwner 状态会�?useWatchRoom 中更�?      // 跳转逻辑会在 useEffect 中处�?    } catch (error: any) {
      showToast(error.message || '加入房间失败', 'error');
    } finally {
      setJoinLoading(false);
    }
  };

  // 监听房间状态，房员加入后自动跟随房主播�?  useEffect(() => {
    if (!currentRoom || isOwner) return;

    if (currentRoom.roomType === 'screen') {
      router.push('/watch-room/screen');
      return;
    }

    // 房员加入房间后，不立即跳�?    // 而是监听 play:change �?live:change 事件（说明房主正在活跃使用）
    // 这样可以避免房主已经离开play页面但状态未清除的情�?
    // 检查房主的播放状�?- 仅在首次加入且状态是最近更新时才跳�?    // 这里不再自动跳转，而是等待房主的下一次操�?  }, [currentRoom, isOwner]);

  // 监听房主的主动操作（切换视频/频道�?  useEffect(() => {
    if (!currentRoom || isOwner) return;

    if (currentRoom.roomType === 'screen') return;

    const handlePlayChange = (state: any) => {
      if (state.type === 'play') {
        const params = new URLSearchParams({
          id: state.videoId,
          source: state.source,
          episode: String(state.episode || 1),
        });

        if (state.videoName) params.set('title', state.videoName);
        if (state.videoYear) params.set('year', state.videoYear);
        if (state.searchTitle) params.set('stitle', state.searchTitle);

        router.push(`/play?${params.toString()}`);
      }
    };

    const handleLiveChange = (state: any) => {
      if (state.type === 'live') {
        // 判断是否�?weblive 格式（channelUrl 包含 platform:roomId�?        if (state.channelUrl && state.channelUrl.includes(':')) {
          // weblive 格式，导航到 web-live 页面
          // channelId �?sourceKey，channelUrl �?platform:roomId
          const [platform, roomId] = state.channelUrl.split(':');
          router.push(`/web-live?platform=${platform}&roomId=${roomId}`);
        } else {
          // 普�?live 格式，导航到 live 页面
          router.push(`/live?id=${state.channelId}`);
        }
      }
    };

    // 监听房主切换视频/频道的事�?    if (socket) {
      socket.on('play:change', handlePlayChange);
      socket.on('live:change', handleLiveChange);

      return () => {
        socket.off('play:change', handlePlayChange);
        socket.off('live:change', handleLiveChange);
      };
    }
  }, [currentRoom, isOwner, router, socket]);

  // 屏幕共享房间创建/加入后直接进入共享页
  useEffect(() => {
    if (currentRoom?.roomType === 'screen') {
      router.push('/watch-room/screen');
    }
  }, [currentRoom?.id, currentRoom?.roomType, router]);

  // 从房间列表加入房�?  const handleJoinFromList = (room: Room) => {
    if (room.roomType === 'screen') {
      const supportError = getScreenShareViewerSupportError();
      if (supportError) {
        showToast(`当前设备无法加入屏幕共享房间�?{supportError}`, 'error');
        return;
      }
    }

    setJoinForm({
      roomId: room.id,
      password: '',
    });
    setActiveTab('join');
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    return '刚刚';
  };

  const tabs = [
    { id: 'create' as TabType, label: '创建房间', icon: Users },
    { id: 'join' as TabType, label: '加入房间', icon: UserPlus },
    { id: 'list' as TabType, label: '房间列表', icon: ListIcon },
  ];

  return (
    <PageLayout activePath="/watch-room">
      <div className="flex flex-col gap-4 py-4 px-5 lg:px-[3rem] 2xl:px-20">
        {/* 房员等待提示 */}
        {currentRoom && !isOwner && (
          <div className="mb-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between gap-4 text-white">
              <div className="flex items-center gap-4 flex-1">
                <div className="relative">
                  <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold mb-1">
                    {currentRoom.roomType === 'screen'
                      ? currentRoom.currentState?.type === 'screen' ? '房主正在共享屏幕' : '等待房主开始共�?
                      : currentRoom.currentState ? '房主正在播放' : '等待房主开始播�?}
                  </h3>
                  <p className="text-sm text-white/80">
                    房间: {currentRoom.name} | 房主: {currentRoom.ownerName}
                  </p>
                  {currentRoom.currentState && (
                    <p className="text-xs text-white/90 mt-1">
                      {currentRoom.currentState.type === 'play'
                        ? `${currentRoom.currentState.videoName || '未知视频'}`
                        : currentRoom.currentState.type === 'live'
                          ? `${currentRoom.currentState.channelName || '未知频道'}`
                          : '屏幕共享进行�?}
                    </p>
                  )}
                  {!currentRoom.currentState && (
                    <p className="text-xs text-white/70 mt-1">
                      {currentRoom.roomType === 'screen' ? '当房主开始共享时，您将自动进入共享页' : '当房主开始播放时，您将自动跟�?}
                    </p>
                  )}
                </div>
              </div>
              {currentRoom.currentState && (
                <button
                  onClick={() => {
                    const state = currentRoom.currentState!;
                    if (state.type === 'play') {
                      const params = new URLSearchParams({
                        id: state.videoId,
                        source: state.source,
                        episode: String(state.episode || 1),
                      });
                      if (state.videoName) params.set('title', state.videoName);
                      if (state.videoYear) params.set('year', state.videoYear);
                      if (state.searchTitle) params.set('stitle', state.searchTitle);
                      router.push(`/play?${params.toString()}`);
                    } else if (state.type === 'live') {
                      // 判断是否�?weblive 格式（channelUrl 包含 platform:roomId�?                      if (state.channelUrl && state.channelUrl.includes(':')) {
                        // weblive 格式，导航到 web-live 页面
                        const [platform, roomId] = state.channelUrl.split(':');
                        router.push(`/web-live?platform=${platform}&roomId=${roomId}`);
                      } else {
                        // 普�?live 格式，导航到 live 页面
                        router.push(`/live?id=${state.channelId}`);
                      }
                    } else if (state.type === 'screen') {
                      router.push('/watch-room/screen');
                    }
                  }}
                  className="px-6 py-2 bg-white text-blue-600 font-medium rounded-lg hover:bg-white/90 transition-colors whitespace-nowrap"
                >
                  立即加入
                </button>
              )}
            </div>
          </div>
        )}

        {/* 页面标题 */}
        <div className="py-1">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-500" />
            观影�?            {currentRoom && (
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                ({isOwner ? '房主' : '房员'})
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            与好友一起看视频，支持进度同步或屏幕共享
          </p>
        </div>

        {/* 选项�?*/}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors relative
                  ${
                    activeTab === tab.id
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* 选项卡内�?*/}
        <div className="flex-1">
          {/* 创建房间 */}
          {activeTab === 'create' && (
            <div className="max-w-2xl mx-auto py-8">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                  创建新房�?                </h2>

                {/* 如果已在房间内，显示当前房间信息 */}
                {currentRoom ? (
                  <div className="space-y-4">
                    {/* 房间信息卡片 */}
                    <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-2xl font-bold mb-1">{currentRoom.name}</h3>
                          <p className="text-blue-100 text-sm">{currentRoom.description || '暂无描述'}</p>
                        </div>
                        {isOwner && (
                          <span className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold">
                            房主
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                        <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                          <p className="text-blue-100 text-xs mb-1">房间�?/p>
                          <p className="text-xl font-mono font-bold">{currentRoom.id}</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                          <p className="text-blue-100 text-xs mb-1">成员�?/p>
                          <p className="text-xl font-bold">{members.length} �?/p>
                        </div>
                        <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                          <p className="text-blue-100 text-xs mb-1">房间类型</p>
                          <p className="text-base font-bold">{currentRoom.roomType === 'screen' ? '屏幕共享' : '进度同步'}</p>
                        </div>
                      </div>
                    </div>

                    {/* 成员列表 */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">房间成员</h4>
                      <div className="space-y-2">
                        {members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                                {getAvatarText(member.name)}
                              </div>
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {member.name}
                              </span>
                            </div>
                            {member.isOwner && (
                              <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded">
                                房主
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 提示信息 */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        💡 {currentRoom.roomType === 'screen'
                          ? '这是屏幕共享房间，创建后将进入共享页，由房主发起屏幕共享'
                          : '前往播放页面或直播页面开始观影，房间成员将自动同步您的操�?}
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleCreateRoom} className="space-y-4">
                  {/* 显示当前用户 */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>当前用户�?/strong>{currentUsername}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      房间名称 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={createForm.roomName}
                      onChange={(e) => setCreateForm({ ...createForm, roomName: e.target.value })}
                      placeholder="请输入房间名�?
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      maxLength={50}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      房间描述
                    </label>
                    <textarea
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      placeholder="请输入房间描述（可选）"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                      maxLength={200}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      房间密码
                    </label>
                    <input
                      type="password"
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                      placeholder="留空表示无需密码"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      maxLength={20}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="isPublic"
                      checked={createForm.isPublic}
                      onChange={(e) => setCreateForm({ ...createForm, isPublic: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="isPublic" className="text-sm text-gray-700 dark:text-gray-300">
                      在房间列表中公开显示
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      房间类型
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setCreateForm({ ...createForm, roomType: 'sync' })}
                        className={`rounded-lg border p-4 text-left transition-colors ${
                          createForm.roomType === 'sync'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        <div className="font-medium text-gray-900 dark:text-gray-100">进度同步</div>
                        <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">统一播放进度（适合双方网络稳定的情况）</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreateForm({ ...createForm, roomType: 'screen' })}
                        className={`rounded-lg border p-4 text-left transition-colors ${
                          createForm.roomType === 'screen'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        <div className="font-medium text-gray-900 dark:text-gray-100">屏幕共享</div>
                        <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">房员直接观看房主共享的浏览器画面（适合完全实时同步的情况）</div>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={createLoading || !createForm.roomName.trim()}
                    className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-3 rounded-lg transition-colors"
                  >
                    {createLoading ? '创建�?..' : '创建房间'}
                  </button>
                </form>
                )}
              </div>

              {/* 使用说明 - 仅在未在房间内时显示 */}
              {!currentRoom && (
                <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>提示�?/strong>创建房间后，您将成为房主。进度同步房会跟随播放状态，屏幕共享房会进入独立共享页�?                  </p>
                </div>
              )}
            </div>
          )}

          {/* 加入房间 */}
          {activeTab === 'join' && (
            <div className="max-w-2xl mx-auto py-8">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                  加入房间
                </h2>

                {/* 如果已在房间内，显示当前房间信息 */}
                {currentRoom ? (
                  <div className="space-y-4">
                    {/* 房间信息卡片 */}
                    <div className="bg-gradient-to-r from-green-500 to-teal-600 rounded-xl p-6 text-white">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-2xl font-bold mb-1">{currentRoom.name}</h3>
                          <p className="text-green-100 text-sm">{currentRoom.description || '暂无描述'}</p>
                        </div>
                        {isOwner && (
                          <span className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold">
                            房主
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                        <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                          <p className="text-green-100 text-xs mb-1">房间�?/p>
                          <p className="text-xl font-mono font-bold">{currentRoom.id}</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                          <p className="text-green-100 text-xs mb-1">成员�?/p>
                          <p className="text-xl font-bold">{members.length} �?/p>
                        </div>
                        <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                          <p className="text-green-100 text-xs mb-1">房间类型</p>
                          <p className="text-base font-bold">{currentRoom.roomType === 'screen' ? '屏幕共享' : '进度同步'}</p>
                        </div>
                      </div>
                    </div>

                    {/* 成员列表 */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">房间成员</h4>
                      <div className="space-y-2">
                        {members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                                {getAvatarText(member.name)}
                              </div>
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {member.name}
                              </span>
                            </div>
                            {member.isOwner && (
                              <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded">
                                房主
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 提示信息 */}
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                      <p className="text-sm text-green-800 dark:text-green-200">
                        💡 {currentRoom.roomType === 'screen'
                          ? '这是屏幕共享房间，进入后即可观看房主共享画面'
                          : isOwner ? '前往播放页面或直播页面开始观影，房间成员将自动同步您的操�? : '等待房主开始播放，您的播放进度将自动跟随房�?}
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleJoinRoom} className="space-y-4">
                  {/* 显示当前用户 */}
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      <strong>当前用户�?/strong>{currentUsername}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      房间�?<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={joinForm.roomId}
                      onChange={(e) => setJoinForm({ ...joinForm, roomId: e.target.value.toUpperCase() })}
                      placeholder="请输�?位房间号"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-lg tracking-wider focus:outline-none focus:ring-2 focus:ring-green-500"
                      maxLength={6}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      房间密码
                    </label>
                    <input
                      type="password"
                      value={joinForm.password}
                      onChange={(e) => setJoinForm({ ...joinForm, password: e.target.value })}
                      placeholder="如果房间有密码，请输�?
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                      maxLength={20}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={joinLoading || !joinForm.roomId.trim()}
                    className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-medium py-3 rounded-lg transition-colors"
                  >
                    {joinLoading ? '加入�?..' : '加入房间'}
                  </button>
                </form>
                )}
              </div>

              {/* 使用说明 - 仅在未在房间内时显示 */}
              {!currentRoom && (
                <div className="mt-6 bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    <strong>提示�?/strong>加入进度同步房后将跟随播放，加入屏幕共享房后会进入共享页面�?                  </p>
                </div>
              )}
            </div>
          )}

          {/* 房间列表 */}
          {activeTab === 'list' && (
            <div className="py-4">
              {/* 顶部操作�?*/}
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  找到 <span className="font-medium text-gray-900 dark:text-gray-100">{rooms.length}</span> 个公开房间
                </p>
                <button
                  onClick={() => loadRooms(true)}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  刷新
                </button>
              </div>

              {/* 加载�?*/}
              {loading && rooms.length === 0 && (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <RefreshCw className="mx-auto mb-4 h-12 w-12 animate-spin text-gray-400" />
                    <p className="text-gray-500 dark:text-gray-400">加载�?..</p>
                  </div>
                </div>
              )}

              {/* 空状�?*/}
              {!loading && rooms.length === 0 && (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <Users className="mx-auto mb-4 h-16 w-16 text-gray-400" />
                    <p className="mb-2 text-xl text-gray-600 dark:text-gray-400">暂无公开房间</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      创建一个新房间或通过房间号加入私密房�?                    </p>
                  </div>
                </div>
              )}

              {/* 房间卡片列表 */}
              {rooms.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rooms.map((room) => (
                    <div
                      key={room.id}
                      className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                            {room.name}
                          </h3>
                          {room.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                              {room.description}
                            </p>
                          )}
                        </div>
                        {room.password && (
                          <Lock className="w-5 h-5 text-yellow-500 flex-shrink-0 ml-2" />
                        )}
                      </div>

                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 dark:text-gray-400">房间�?/span>
                          <span className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100">
                            {room.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <Users className="w-4 h-4" />
                          <span>{room.memberCount} 人在�?/span>
                        </div>
                        <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                          <span>房主</span>
                          <span className="font-medium">{room.ownerName}</span>
                        </div>
                        <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                          <span>类型</span>
                          <span>{room.roomType === 'screen' ? '屏幕共享' : '进度同步'}</span>
                        </div>
                        <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                          <span>创建时间</span>
                          <span>{formatTime(room.createdAt)}</span>
                        </div>
                        {room.currentState && (
                          <div className="mt-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 px-3 py-2 border border-blue-200 dark:border-blue-800">
                            <p className="text-xs text-blue-700 dark:text-blue-300 truncate">
                              {room.currentState.type === 'play'
                                ? `正在播放: ${room.currentState.videoName}`
                                : room.currentState.type === 'live'
                                  ? `正在观看: ${room.currentState.channelName}`
                                  : '正在共享屏幕'}
                            </p>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleJoinFromList(room)}
                        className="w-full bg-purple-500 hover:bg-purple-600 text-white font-medium py-2.5 rounded-lg transition-colors"
                      >
                        加入房间
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {toast && <Toast {...toast} />}
    </PageLayout>
  );
}
