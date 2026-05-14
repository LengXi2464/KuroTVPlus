// Socket.IO 客户端管�?import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  WatchRoomConfig,
} from '@/types/watch-room';

export type WatchRoomSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

class WatchRoomSocketManager {
  private socket: WatchRoomSocket | null = null;
  private config: WatchRoomConfig | null = null;
  private connectionPromise: Promise<WatchRoomSocket> | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatTimeoutCheck: NodeJS.Timeout | null = null;
  private lastHeartbeatResponse: number = Date.now();
  private visibilityChangeHandler: (() => void) | null = null;
  private reconnectFailedCallback: (() => void) | null = null;
  private reconnectSuccessCallback: (() => void) | null = null;

  async connect(config: WatchRoomConfig): Promise<WatchRoomSocket> {
    if (this.socket?.connected) {
      return this.socket;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.socket) {
      this.connectionPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.connectionPromise = null;
          reject(new Error('Socket connection timeout'));
        }, 10000);

        this.socket!.once('connect', () => {
          clearTimeout(timeout);
          this.connectionPromise = null;
          resolve(this.socket!);
        });

        this.socket!.once('connect_error', (error) => {
          clearTimeout(timeout);
          this.connectionPromise = null;
          reject(error);
        });

        if (!this.socket!.connected) {
          this.socket!.connect();
        }
      });

      return this.connectionPromise;
    }

    this.config = config;

    const socketOptions = {
      transports: ['websocket', 'polling'] as ('websocket' | 'polling')[],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    };

    if (config.serverType === 'internal') {
      // 内部服务�?- 连接到同一个域名的Socket.IO服务�?      this.socket = io({
        ...socketOptions,
        path: '/socket.io', // 使用服务器配置的path
      });
    } else {
      // 外部服务�?      if (!config.externalServerUrl) {
        throw new Error('External server URL is required');
      }

      this.socket = io(config.externalServerUrl, {
        ...socketOptions,
        auth: {
          token: config.externalServerAuth,
        },
        extraHeaders: config.externalServerAuth
          ? {
              Authorization: `Bearer ${config.externalServerAuth}`,
            }
          : undefined,
      });
    }

    // 设置事件监听（包�?heartbeat:pong�?    this.setupEventListeners();

    // 开始心�?    this.startHeartbeat();

    // 启动心跳超时检�?    this.startHeartbeatTimeoutCheck();

    // 设置浏览器可见性监�?    this.setupVisibilityListener();

    this.connectionPromise = new Promise((resolve, reject) => {
      if (!this.socket) {
        this.connectionPromise = null;
        reject(new Error('Socket not initialized'));
        return;
      }

      // 使用 once 而不�?on，避免重复注�?      this.socket.once('connect', () => {
        // eslint-disable-next-line no-console
        console.log('[WatchRoom] Connected to server');
        this.connectionPromise = null;
        if (this.socket) {
          resolve(this.socket);
        }
      });

      this.socket.once('connect_error', (error) => {
        // eslint-disable-next-line no-console
        console.error('[WatchRoom] Connection error:', error);
        this.connectionPromise = null;
        reject(error);
      });
    });

    return this.connectionPromise;
  }

  disconnect() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.heartbeatTimeoutCheck) {
      clearInterval(this.heartbeatTimeoutCheck);
      this.heartbeatTimeoutCheck = null;
    }

    // 移除浏览器可见性监�?    this.removeVisibilityListener();

    if (this.socket) {
      // 移除所有事件监听器
      this.socket.off('connect');
      this.socket.off('disconnect');
      this.socket.off('error');
      this.socket.off('heartbeat:pong');
      this.socket.io.off('reconnect_attempt');
      this.socket.io.off('reconnect');
      this.socket.io.off('reconnect_failed');

      this.socket.disconnect();
      this.socket = null;
    }

    this.connectionPromise = null;
  }

  getSocket(): WatchRoomSocket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      // eslint-disable-next-line no-console
      console.log('[WatchRoom] Socket connected');
      // 重置心跳响应时间
      this.lastHeartbeatResponse = Date.now();
    });

    this.socket.on('disconnect', (reason) => {
      // eslint-disable-next-line no-console
      console.log('[WatchRoom] Socket disconnected:', reason);
    });

    this.socket.on('error', (error) => {
      // eslint-disable-next-line no-console
      console.error('[WatchRoom] Socket error:', error);
    });

    // 监听心跳响应
    this.socket.on('heartbeat:pong', (_data: { timestamp: number }) => {
      this.lastHeartbeatResponse = Date.now();
    });

    // 监听重连尝试
    this.socket.io.on('reconnect_attempt', (attemptNumber) => {
      // eslint-disable-next-line no-console
      console.log('[WatchRoom] Reconnect attempt:', attemptNumber);
    });

    // 监听重连成功
    this.socket.io.on('reconnect', (attemptNumber) => {
      // eslint-disable-next-line no-console
      console.log('[WatchRoom] Reconnected after', attemptNumber, 'attempts');
      // 重置心跳响应时间
      this.lastHeartbeatResponse = Date.now();
      this.reconnectSuccessCallback?.();
    });

    // 监听重连失败
    this.socket.io.on('reconnect_failed', () => {
      // eslint-disable-next-line no-console
      console.error('[WatchRoom] Reconnect failed after all attempts');
      this.reconnectFailedCallback?.();
    });
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('heartbeat');
      }
    }, 5000); // �?秒发送一次心�?  }

  // 启动心跳超时检�?  private startHeartbeatTimeoutCheck() {
    if (this.heartbeatTimeoutCheck) {
      clearInterval(this.heartbeatTimeoutCheck);
    }

    // �?秒检查一次心跳超�?    this.heartbeatTimeoutCheck = setInterval(() => {
      if (!this.socket?.connected) {
        return;
      }

      const now = Date.now();
      const timeSinceLastResponse = now - this.lastHeartbeatResponse;

      // 如果超过15秒没有收到心跳响应，认为连接可能有问�?      if (timeSinceLastResponse > 15000) {
        // eslint-disable-next-line no-console
        console.warn('[WatchRoom] Heartbeat timeout detected, last response was', timeSinceLastResponse, 'ms ago');

        // 不要强制断开连接，让 Socket.IO 的自动重连机制处�?        // Socket.IO 会自动检测连接问题并尝试重连
        // 只记录警告，不主动断开
        // eslint-disable-next-line no-console
        console.warn('[WatchRoom] Waiting for Socket.IO auto-reconnect mechanism');

        // 重置心跳响应时间，避免重复触发警�?        this.lastHeartbeatResponse = Date.now();
      }
    }, 3000);
  }

  // 设置浏览器可见性监�?  private setupVisibilityListener() {
    if (typeof document === 'undefined') return;

    this.visibilityChangeHandler = () => {
      if (document.visibilityState === 'visible') {
        // eslint-disable-next-line no-console
        console.log('[WatchRoom] Page became visible, checking connection...');

        // 页面可见时检查连接状�?        if (this.socket && !this.socket.connected) {
          // eslint-disable-next-line no-console
          console.log('[WatchRoom] Socket disconnected, attempting to reconnect...');
          this.socket.connect();
        }
      }
    };

    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  // 移除浏览器可见性监�?  private removeVisibilityListener() {
    if (typeof document === 'undefined' || !this.visibilityChangeHandler) return;

    document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    this.visibilityChangeHandler = null;
  }

  // 设置重连失败回调
  setReconnectFailedCallback(callback: () => void) {
    this.reconnectFailedCallback = callback;
  }

  // 设置重连成功回调
  setReconnectSuccessCallback(callback: () => void) {
    this.reconnectSuccessCallback = callback;
  }

  // 手动重连
  async reconnect(): Promise<boolean> {
    if (!this.config) {
      console.error('[WatchRoom] No config available for reconnection');
      return false;
    }

    try {
      // eslint-disable-next-line no-console
      console.log('[WatchRoom] Manual reconnection initiated...');

      // 如果socket存在且未连接，尝试重新连�?      if (this.socket && !this.socket.connected) {
        this.socket.connect();

        // 等待连接结果
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve(false);
          }, 5000); // 5秒超�?
          this.socket!.once('connect', () => {
            clearTimeout(timeout);
            resolve(true);
          });

          this.socket!.once('connect_error', () => {
            clearTimeout(timeout);
            resolve(false);
          });
        });
      }

      // 如果socket不存在，重新创建连接
      await this.connect(this.config);
      return true;
    } catch (error) {
      console.error('[WatchRoom] Manual reconnection failed:', error);
      return false;
    }
  }
}

// 单例实例
export const watchRoomSocketManager = new WatchRoomSocketManager();
