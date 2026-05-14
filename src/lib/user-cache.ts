/* eslint-disable @typescript-eslint/no-explicit-any */

// 用户信息缓存
interface CachedUserInfo {
  role: 'owner' | 'admin' | 'user';
  banned: boolean;
  tags?: string[];
  oidcSub?: string;
  enabledApis?: string[];
  created_at: number;
  playrecord_migrated?: boolean;
  cachedAt: number;
}

class UserInfoCache {
  private cache: Map<string, CachedUserInfo> = new Map();
  private readonly TTL = 6 * 60 * 60 * 1000; // 6小时过期

  get(username: string): CachedUserInfo | null {
    const cached = this.cache.get(username);
    if (!cached) return null;

    // 检查是否过�?    if (Date.now() - cached.cachedAt > this.TTL) {
      this.cache.delete(username);
      return null;
    }

    return cached;
  }

  set(username: string, userInfo: Omit<CachedUserInfo, 'cachedAt'>): void {
    this.cache.set(username, {
      ...userInfo,
      cachedAt: Date.now(),
    });
  }

  delete(username: string): void {
    this.cache.delete(username);
  }

  clear(): void {
    this.cache.clear();
  }

  // 清理过期的缓�?  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [username, cached] of entries) {
      if (now - cached.cachedAt > this.TTL) {
        this.cache.delete(username);
      }
    }
  }
}

// 站长存在状态缓�?class OwnerExistenceCache {
  private cache: Map<string, { exists: boolean; cachedAt: number }> = new Map();
  private readonly TTL = 10 * 60 * 1000; // 10分钟过期

  get(ownerUsername: string): boolean | null {
    const cached = this.cache.get(ownerUsername);
    if (!cached) return null;

    // 检查是否过�?    if (Date.now() - cached.cachedAt > this.TTL) {
      this.cache.delete(ownerUsername);
      return null;
    }

    return cached.exists;
  }

  set(ownerUsername: string, exists: boolean): void {
    this.cache.set(ownerUsername, {
      exists,
      cachedAt: Date.now(),
    });
  }

  delete(ownerUsername: string): void {
    this.cache.delete(ownerUsername);
  }

  clear(): void {
    this.cache.clear();
  }

  // 清理过期的缓�?  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [username, cached] of entries) {
      if (now - cached.cachedAt > this.TTL) {
        this.cache.delete(username);
      }
    }
  }
}

// 全局单例
const globalKey = Symbol.for('__MOONTV_USER_INFO_CACHE__');
let _userInfoCache: UserInfoCache | undefined = (global as any)[globalKey];

if (!_userInfoCache) {
  _userInfoCache = new UserInfoCache();
  (global as any)[globalKey] = _userInfoCache;

  // 每分钟清理一次过期缓�?  setInterval(() => {
    _userInfoCache?.cleanup();
  }, 60 * 1000);
}

export const userInfoCache = _userInfoCache as UserInfoCache;

const ownerExistenceGlobalKey = Symbol.for('__MOONTV_OWNER_EXISTENCE_CACHE__');
let _ownerExistenceCache: OwnerExistenceCache | undefined = (global as any)[ownerExistenceGlobalKey];

if (!_ownerExistenceCache) {
  _ownerExistenceCache = new OwnerExistenceCache();
  (global as any)[ownerExistenceGlobalKey] = _ownerExistenceCache;

  // 每分钟清理一次过期缓�?  setInterval(() => {
    _ownerExistenceCache?.cleanup();
  }, 60 * 1000);
}

export const ownerExistenceCache = _ownerExistenceCache as OwnerExistenceCache;
