/* eslint-disable no-console, @typescript-eslint/no-explicit-any */

/**
 * Vercel Postgres Storage Implementation
 *
 * 兼容 D1Storage 的接口，使用 Vercel Postgres 作为后端
 *
 * 注意：此模块仅在服务端使用，通过 webpack 配置排除客户端打�? */

import {
  IStorage,
  PlayRecord,
  Favorite,
  SkipConfig,
  DanmakuFilterConfig,
  Notification,
  MovieRequest,
} from './types';
import { AdminConfig } from './admin.types';
import { MangaReadRecord, MangaShelfItem } from './manga.types';
import { BookReadRecord, BookShelfItem } from './book.types';
import { DatabaseAdapter } from './d1-adapter';
import { MusicV2HistoryRecord, MusicV2PlaylistItem, MusicV2PlaylistRecord } from './music-v2';

/**
 * Vercel Postgres 存储实现
 *
 * 特点�? * - 兼容 D1Storage 的所有接�? * - 使用 Vercel Postgres (Neon) 作为数据�? * - 支持 Vercel serverless 部署
 *
 * 使用方式�? * 1. 设置环境变量：NEXT_PUBLIC_STORAGE_TYPE=postgres
 * 2. 配置 POSTGRES_URL 环境变量
 * 3. 运行数据库迁移脚�? */
export class PostgresStorage implements IStorage {
  private db: DatabaseAdapter;
  private schemaReady: Promise<void>;
  public adapter: any; // 用于兼容

  constructor(adapter: DatabaseAdapter) {
    this.db = adapter;
    this.schemaReady = this.ensureMangaShelfColumns();
    // 创建一个简单的适配器用于设备管�?    this.adapter = new PostgresRedisHashAdapter(adapter);
  }

  private async ensureMangaShelfColumns(): Promise<void> {
    const statements = [
      'ALTER TABLE manga_shelf ADD COLUMN IF NOT EXISTS latest_chapter_id TEXT',
      'ALTER TABLE manga_shelf ADD COLUMN IF NOT EXISTS latest_chapter_name TEXT',
      'ALTER TABLE manga_shelf ADD COLUMN IF NOT EXISTS latest_chapter_count INTEGER',
      'ALTER TABLE manga_shelf ADD COLUMN IF NOT EXISTS unread_chapter_count INTEGER',
    ];

    for (const statement of statements) {
      try {
        const result = await this.db.prepare(statement).run();
        if (!result.success && result.error) {
          console.warn('PostgresStorage.ensureMangaShelfColumns warning:', result.error);
        }
      } catch (err) {
        console.warn('PostgresStorage.ensureMangaShelfColumns warning:', err);
      }
    }
  }

  // ==================== 播放记录 ====================

  async getPlayRecord(userName: string, key: string): Promise<PlayRecord | null> {
    try {
      const result = await this.db
        .prepare('SELECT * FROM play_records WHERE username = $1 AND key = $2')
        .bind(userName, key)
        .first();

      if (!result) return null;
      return this.rowToPlayRecord(result);
    } catch (err) {
      console.error('PostgresStorage.getPlayRecord error:', err);
      throw err;
    }
  }

  async setPlayRecord(userName: string, key: string, record: PlayRecord): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO play_records (
            username, key, title, source_name, cover, year,
            episode_index, total_episodes, play_time, total_time,
            save_time, search_title, new_episodes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (username, key) DO UPDATE SET
            title = EXCLUDED.title,
            source_name = EXCLUDED.source_name,
            cover = EXCLUDED.cover,
            year = EXCLUDED.year,
            episode_index = EXCLUDED.episode_index,
            total_episodes = EXCLUDED.total_episodes,
            play_time = EXCLUDED.play_time,
            total_time = EXCLUDED.total_time,
            save_time = EXCLUDED.save_time,
            search_title = EXCLUDED.search_title,
            new_episodes = EXCLUDED.new_episodes
        `)
        .bind(
          userName,
          key,
          record.title,
          record.source_name,
          record.cover || '',
          record.year || '',
          record.index,
          record.total_episodes,
          record.play_time,
          record.total_time,
          record.save_time,
          record.search_title || '',
          record.new_episodes || null
        )
        .run();
    } catch (err) {
      console.error('PostgresStorage.setPlayRecord error:', err);
      throw err;
    }
  }

  async getAllPlayRecords(userName: string): Promise<{ [key: string]: PlayRecord }> {
    try {
      const results = await this.db
        .prepare('SELECT * FROM play_records WHERE username = $1 ORDER BY save_time DESC')
        .bind(userName)
        .all();

      const records: { [key: string]: PlayRecord } = {};
      if (results.results) {
        for (const row of results.results) {
          const record = this.rowToPlayRecord(row);
          records[row.key as string] = record;
        }
      }
      return records;
    } catch (err) {
      console.error('PostgresStorage.getAllPlayRecords error:', err);
      throw err;
    }
  }

  async deletePlayRecord(userName: string, key: string): Promise<void> {
    try {
      await this.db
        .prepare('DELETE FROM play_records WHERE username = $1 AND key = $2')
        .bind(userName, key)
        .run();
    } catch (err) {
      console.error('PostgresStorage.deletePlayRecord error:', err);
      throw err;
    }
  }

  async cleanupOldPlayRecords(userName: string): Promise<void> {
    try {
      const maxRecords = parseInt(process.env.MAX_PLAY_RECORDS_PER_USER || '100', 10);
      const threshold = maxRecords + 10;

      // 检查记录数�?      const countResult = await this.db
        .prepare('SELECT COUNT(*) as count FROM play_records WHERE username = $1')
        .bind(userName)
        .first();

      const count = (countResult?.count as number) || 0;
      if (count <= threshold) return;

      // 删除超出限制的旧记录
      await this.db
        .prepare(`
          DELETE FROM play_records
          WHERE username = $1
          AND key NOT IN (
            SELECT key FROM play_records
            WHERE username = $1
            ORDER BY save_time DESC
            LIMIT $2
          )
        `)
        .bind(userName, maxRecords)
        .run();

      console.log(`PostgresStorage: Cleaned up old play records for user ${userName}`);
    } catch (err) {
      console.error('PostgresStorage.cleanupOldPlayRecords error:', err);
      throw err;
    }
  }

  async migratePlayRecords(userName: string): Promise<void> {
    try {
      await this.db
        .prepare('UPDATE users SET playrecord_migrated = 1 WHERE username = $1')
        .bind(userName)
        .run();
    } catch (err) {
      console.error('PostgresStorage.migratePlayRecords error:', err);
    }
  }

  // ==================== 收藏 ====================

  async getFavorite(userName: string, key: string): Promise<Favorite | null> {
    try {
      const result = await this.db
        .prepare('SELECT * FROM favorites WHERE username = $1 AND key = $2')
        .bind(userName, key)
        .first();

      if (!result) return null;
      return this.rowToFavorite(result);
    } catch (err) {
      console.error('PostgresStorage.getFavorite error:', err);
      throw err;
    }
  }

  async setFavorite(userName: string, key: string, favorite: Favorite): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO favorites (
            username, key, source_name, total_episodes, title,
            year, cover, save_time, search_title, origin,
            is_completed, vod_remarks
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (username, key) DO UPDATE SET
            source_name = EXCLUDED.source_name,
            total_episodes = EXCLUDED.total_episodes,
            title = EXCLUDED.title,
            year = EXCLUDED.year,
            cover = EXCLUDED.cover,
            save_time = EXCLUDED.save_time,
            search_title = EXCLUDED.search_title,
            origin = EXCLUDED.origin,
            is_completed = EXCLUDED.is_completed,
            vod_remarks = EXCLUDED.vod_remarks
        `)
        .bind(
          userName,
          key,
          favorite.source_name,
          favorite.total_episodes,
          favorite.title,
          favorite.year || '',
          favorite.cover || '',
          favorite.save_time,
          favorite.search_title || '',
          favorite.origin || null,
          favorite.is_completed ? 1 : 0,
          favorite.vod_remarks || null
        )
        .run();
    } catch (err) {
      console.error('PostgresStorage.setFavorite error:', err);
      throw err;
    }
  }

  async getAllFavorites(userName: string): Promise<{ [key: string]: Favorite }> {
    try {
      const results = await this.db
        .prepare('SELECT * FROM favorites WHERE username = $1 ORDER BY save_time DESC')
        .bind(userName)
        .all();

      const favorites: { [key: string]: Favorite } = {};
      if (results.results) {
        for (const row of results.results) {
          const favorite = this.rowToFavorite(row);
          favorites[row.key as string] = favorite;
        }
      }
      return favorites;
    } catch (err) {
      console.error('PostgresStorage.getAllFavorites error:', err);
      throw err;
    }
  }

  async deleteFavorite(userName: string, key: string): Promise<void> {
    try {
      await this.db
        .prepare('DELETE FROM favorites WHERE username = $1 AND key = $2')
        .bind(userName, key)
        .run();
    } catch (err) {
      console.error('PostgresStorage.deleteFavorite error:', err);
      throw err;
    }
  }

  async migrateFavorites(userName: string): Promise<void> {
    try {
      await this.db
        .prepare('UPDATE users SET favorite_migrated = 1 WHERE username = $1')
        .bind(userName)
        .run();
    } catch (err) {
      console.error('PostgresStorage.migrateFavorites error:', err);
    }
  }

  // ==================== 辅助方法 ====================

  private rowToPlayRecord(row: any): PlayRecord {
    return {
      title: row.title,
      source_name: row.source_name,
      cover: row.cover || '',
      year: row.year || '',
      index: row.episode_index,
      total_episodes: row.total_episodes,
      play_time: row.play_time,
      total_time: row.total_time,
      save_time: row.save_time,
      search_title: row.search_title || '',
      new_episodes: row.new_episodes || undefined,
    };
  }

  private rowToFavorite(row: any): Favorite {
    return {
      source_name: row.source_name,
      total_episodes: row.total_episodes,
      title: row.title,
      year: row.year || '',
      cover: row.cover || '',
      save_time: row.save_time,
      search_title: row.search_title || '',
      origin: row.origin as 'vod' | 'live' | undefined,
      is_completed: row.is_completed === 1,
      vod_remarks: row.vod_remarks || undefined,
    };
  }

  // ==================== 用户管理 ====================

  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async verifyUser(userName: string, password: string): Promise<boolean> {
    try {
      // 检查是否是环境变量中的管理�?      if (userName === process.env.USERNAME && password === process.env.PASSWORD) {
        return true;
      }

      const user = await this.db
        .prepare('SELECT password_hash FROM users WHERE username = $1 AND banned = 0')
        .bind(userName)
        .first();

      if (!user || !user.password_hash) return false;

      // 使用 SHA-256 验证密码（与 Redis 保持一致）
      const hashedPassword = await this.hashPassword(password);
      return user.password_hash === hashedPassword;
    } catch (err) {
      console.error('PostgresStorage.verifyUser error:', err);
      return false;
    }
  }

  async checkUserExist(userName: string): Promise<boolean> {
    try {
      // 检查环境变�?      if (userName === process.env.USERNAME) {
        return true;
      }

      const result = await this.db
        .prepare('SELECT 1 FROM users WHERE username = $1 LIMIT 1')
        .bind(userName)
        .first();

      return result !== null;
    } catch (err) {
      console.error('PostgresStorage.checkUserExist error:', err);
      return false;
    }
  }

  async changePassword(userName: string, newPassword: string): Promise<void> {
    try {
      const passwordHash = await this.hashPassword(newPassword);

      await this.db
        .prepare('UPDATE users SET password_hash = $1 WHERE username = $2')
        .bind(passwordHash, userName)
        .run();
    } catch (err) {
      console.error('PostgresStorage.changePassword error:', err);
      throw err;
    }
  }

  async deleteUser(userName: string): Promise<void> {
    try {
      // 由于设置�?ON DELETE CASCADE，删除用户会自动删除相关数据
      await this.db
        .prepare('DELETE FROM users WHERE username = $1')
        .bind(userName)
        .run();
    } catch (err) {
      console.error('PostgresStorage.deleteUser error:', err);
      throw err;
    }
  }

  async getAllUsers(): Promise<string[]> {
    try {
      const results = await this.db
        .prepare('SELECT username FROM users ORDER BY created_at DESC')
        .all();

      if (!results.results) return [];
      return results.results.map((row) => row.username as string);
    } catch (err) {
      console.error('PostgresStorage.getAllUsers error:', err);
      return [];
    }
  }

  async getUserInfoV2(userName: string): Promise<any> {
    try {
      // 先尝试从缓存获取用户信息
      const { userInfoCache } = await import('./user-cache');
      const cached = userInfoCache.get(userName);
      if (cached) {
        return cached;
      }

      // 从数据库获取用户信息
      const user = await this.db
        .prepare('SELECT * FROM users WHERE username = $1')
        .bind(userName)
        .first();

      if (user) {
        const userInfo = {
          role: user.role as 'owner' | 'admin' | 'user',
          banned: user.banned === 1,
          tags: user.tags ? JSON.parse(user.tags as string) : undefined,
          oidcSub: user.oidc_sub as string | undefined,
          enabledApis: user.enabled_apis ? JSON.parse(user.enabled_apis as string) : undefined,
          created_at: user.created_at as number,
          playrecord_migrated: user.playrecord_migrated === 1,
          favorite_migrated: user.favorite_migrated === 1,
          skip_migrated: user.skip_migrated === 1,
          last_movie_request_time: user.last_movie_request_time as number | undefined,
          email: user.email as string | undefined,
          emailNotifications: user.email_notifications === 1,
        };

        // 缓存用户信息
        userInfoCache.set(userName, userInfo);

        return userInfo;
      }

      // 如果数据库中没有，检查是否是环境变量中的站长
      if (userName === process.env.USERNAME) {
        const ownerInfo = {
          role: 'owner' as const,
          banned: false,
          created_at: Date.now(),
          playrecord_migrated: true,
          favorite_migrated: true,
          skip_migrated: true,
        };

        // 为站长创建数据库记录
        try {
          await this.db
            .prepare(`
              INSERT INTO users (
                username, password_hash, role, banned, created_at,
                playrecord_migrated, favorite_migrated, skip_migrated
              )
              VALUES ($1, $2, $3, 0, $4, 1, 1, 1)
            `)
            .bind(
              userName,
              '', // 站长不需要密码哈�?              'owner',
              ownerInfo.created_at
            )
            .run();
          console.log(`Created database record for site owner: ${userName}`);
        } catch (insertErr) {
          console.error('Failed to create owner record:', insertErr);
          // 即使插入失败，仍然返回默认信�?        }

        // 缓存站长信息
        userInfoCache.set(userName, ownerInfo);

        return ownerInfo;
      }

      return null;
    } catch (err) {
      console.error('PostgresStorage.getUserInfoV2 error:', err);
      return null;
    }
  }

  async createUserV2(
    userName: string,
    password: string,
    role: 'owner' | 'admin' | 'user',
    tags?: string[],
    oidcSub?: string,
    enabledApis?: string[]
  ): Promise<void> {
    try {
      const passwordHash = await this.hashPassword(password);

      await this.db
        .prepare(`
          INSERT INTO users (
            username, password_hash, role, banned, tags, oidc_sub,
            enabled_apis, created_at, playrecord_migrated,
            favorite_migrated, skip_migrated
          )
          VALUES ($1, $2, $3, 0, $4, $5, $6, $7, 1, 1, 1)
        `)
        .bind(
          userName,
          passwordHash,
          role,
          tags ? JSON.stringify(tags) : null,
          oidcSub || null,
          enabledApis ? JSON.stringify(enabledApis) : null,
          Date.now()
        )
        .run();
    } catch (err) {
      console.error('PostgresStorage.createUserV2 error:', err);
      throw err;
    }
  }

  async getUserListV2(
    offset = 0,
    limit = 20,
    ownerUsername?: string
  ): Promise<{
    users: Array<{
      username: string;
      role: 'owner' | 'admin' | 'user';
      banned: boolean;
      tags?: string[];
      oidcSub?: string;
      enabledApis?: string[];
      created_at: number;
    }>;
    total: number;
  }> {
    try {
      // 获取总数
      const countResult = await this.db
        .prepare('SELECT COUNT(*) as total FROM users')
        .first();
      let total = (countResult?.total as number) || 0;

      // 检查站长是否在数据库中
      let ownerInfo = null;
      let ownerInDatabase = false;
      if (ownerUsername) {
        ownerInfo = await this.getUserInfoV2(ownerUsername);
        ownerInDatabase = !!ownerInfo && ownerInfo.created_at !== 0;

        // 如果站长不在数据库中，总数+1
        if (!ownerInDatabase) {
          total += 1;
        }
      }

      // 调整偏移量和限制
      let actualOffset = offset;
      let actualLimit = limit;

      if (ownerUsername && !ownerInDatabase) {
        if (offset === 0) {
          // 第一页：只获�?limit-1 个用户，为站长留出位�?          actualLimit = limit - 1;
        } else {
          // 其他页：偏移量需要减1，因为站长占据了第一页的一个位�?          actualOffset = offset - 1;
        }
      }

      // 获取用户列表（按创建时间降序�?      const result = await this.db
        .prepare(`
          SELECT username, role, banned, tags, oidc_sub, enabled_apis, created_at
          FROM users
          ORDER BY created_at DESC
          LIMIT $1 OFFSET $2
        `)
        .bind(actualLimit, actualOffset)
        .all();

      const users = [];

      // 如果有站长且在第一页，确保站长始终在第一�?      if (ownerUsername && offset === 0) {
        users.push({
          username: ownerUsername,
          role: 'owner' as const,
          banned: ownerInfo?.banned || false,
          tags: ownerInfo?.tags,
          oidcSub: ownerInfo?.oidcSub,
          enabledApis: ownerInfo?.enabledApis,
          created_at: ownerInfo?.created_at || 0,
        });
      }

      // 添加其他用户
      if (result.results) {
        for (const user of result.results) {
          // 跳过站长（已经添加）
          if (ownerUsername && user.username === ownerUsername) {
            continue;
          }

          users.push({
            username: user.username as string,
            role: user.role as 'owner' | 'admin' | 'user',
            banned: user.banned === 1,
            tags: user.tags ? JSON.parse(user.tags as string) : undefined,
            oidcSub: user.oidc_sub as string | undefined,
            enabledApis: user.enabled_apis ? JSON.parse(user.enabled_apis as string) : undefined,
            created_at: user.created_at as number,
          });
        }
      }

      return { users, total };
    } catch (err) {
      console.error('PostgresStorage.getUserListV2 error:', err);
      return { users: [], total: 0 };
    }
  }

  async verifyUserV2(userName: string, password: string): Promise<boolean> {
    try {
      const user = await this.db
        .prepare('SELECT password_hash FROM users WHERE username = $1')
        .bind(userName)
        .first();

      if (!user) return false;

      const hashedPassword = await this.hashPassword(password);
      return user.password_hash === hashedPassword;
    } catch (err) {
      console.error('PostgresStorage.verifyUserV2 error:', err);
      return false;
    }
  }

  async updateUserInfoV2(
    userName: string,
    updates: {
      role?: 'owner' | 'admin' | 'user';
      banned?: boolean;
      tags?: string[];
      oidcSub?: string;
      enabledApis?: string[];
    }
  ): Promise<void> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.role !== undefined) {
        fields.push(`role = $${paramIndex++}`);
        values.push(updates.role);
      }
      if (updates.banned !== undefined) {
        fields.push(`banned = $${paramIndex++}`);
        values.push(updates.banned ? 1 : 0);
      }
      if (updates.tags !== undefined) {
        fields.push(`tags = $${paramIndex++}`);
        values.push(JSON.stringify(updates.tags));
      }
      if (updates.oidcSub !== undefined) {
        fields.push(`oidc_sub = $${paramIndex++}`);
        values.push(updates.oidcSub);
      }
      if (updates.enabledApis !== undefined) {
        fields.push(`enabled_apis = $${paramIndex++}`);
        values.push(JSON.stringify(updates.enabledApis));
      }

      if (fields.length === 0) return;

      values.push(userName);

      await this.db
        .prepare(`UPDATE users SET ${fields.join(', ')} WHERE username = $${paramIndex}`)
        .bind(...values)
        .run();

      // 清除用户信息缓存
      const { userInfoCache } = await import('./user-cache');
      userInfoCache.delete(userName);
    } catch (err) {
      console.error('PostgresStorage.updateUserInfoV2 error:', err);
      throw err;
    }
  }

  async changePasswordV2(userName: string, newPassword: string): Promise<void> {
    try {
      const passwordHash = await this.hashPassword(newPassword);

      await this.db
        .prepare('UPDATE users SET password_hash = $1 WHERE username = $2')
        .bind(passwordHash, userName)
        .run();
    } catch (err) {
      console.error('PostgresStorage.changePasswordV2 error:', err);
      throw err;
    }
  }

  async checkUserExistV2(userName: string): Promise<boolean> {
    try {
      const user = await this.db
        .prepare('SELECT 1 FROM users WHERE username = $1')
        .bind(userName)
        .first();

      return !!user;
    } catch (err) {
      console.error('PostgresStorage.checkUserExistV2 error:', err);
      return false;
    }
  }

  async getUserByOidcSub(oidcSub: string): Promise<string | null> {
    try {
      const user = await this.db
        .prepare('SELECT username FROM users WHERE oidc_sub = $1')
        .bind(oidcSub)
        .first();

      return user ? (user.username as string) : null;
    } catch (err) {
      console.error('PostgresStorage.getUserByOidcSub error:', err);
      return null;
    }
  }

  async deleteUserV2(userName: string): Promise<void> {
    try {
      // Postgres 的外键约束会自动级联删除相关数据
      await this.db
        .prepare('DELETE FROM users WHERE username = $1')
        .bind(userName)
        .run();

      // 清除用户信息缓存
      const { userInfoCache } = await import('./user-cache');
      userInfoCache.delete(userName);
    } catch (err) {
      console.error('PostgresStorage.deleteUserV2 error:', err);
      throw err;
    }
  }

  async getUsersByTag(tagName: string): Promise<string[]> {
    try {
      // Postgres 支持 JSON 查询
      const result = await this.db
        .prepare(`
          SELECT username FROM users
          WHERE tags::jsonb ? $1
        `)
        .bind(tagName)
        .all();

      if (!result.results) return [];

      return result.results.map((row: any) => row.username as string);
    } catch (err) {
      console.error('PostgresStorage.getUsersByTag error:', err);
      return [];
    }
  }

  async getUserPasswordHash(userName: string): Promise<string | null> {
    try {
      const user = await this.db
        .prepare('SELECT password_hash FROM users WHERE username = $1')
        .bind(userName)
        .first();

      return user ? (user.password_hash as string) : null;
    } catch (err) {
      console.error('PostgresStorage.getUserPasswordHash error:', err);
      return null;
    }
  }

  async setUserPasswordHash(userName: string, passwordHash: string): Promise<void> {
    try {
      await this.db
        .prepare('UPDATE users SET password_hash = $1 WHERE username = $2')
        .bind(passwordHash, userName)
        .run();
    } catch (err) {
      console.error('PostgresStorage.setUserPasswordHash error:', err);
      throw err;
    }
  }

  async createUserWithHashedPassword(
    userName: string,
    passwordHash: string,
    role: 'owner' | 'admin' | 'user',
    createdAt: number,
    tags?: string[],
    oidcSub?: string,
    enabledApis?: string[],
    banned?: boolean
  ): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO users (
            username, password_hash, role, banned, tags, oidc_sub,
            enabled_apis, created_at, playrecord_migrated,
            favorite_migrated, skip_migrated
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, 1, 1)
        `)
        .bind(
          userName,
          passwordHash,
          role,
          banned ? 1 : 0,
          tags ? JSON.stringify(tags) : null,
          oidcSub || null,
          enabledApis ? JSON.stringify(enabledApis) : null,
          createdAt
        )
        .run();
    } catch (err) {
      console.error('PostgresStorage.createUserWithHashedPassword error:', err);
      throw err;
    }
  }

  async getUserEmail(userName: string): Promise<string | null> {
    try {
      const result = await this.db
        .prepare('SELECT email FROM users WHERE username = $1')
        .bind(userName)
        .first();

      return result?.email as string | null;
    } catch (err) {
      console.error('PostgresStorage.getUserEmail error:', err);
      return null;
    }
  }

  async setUserEmail(userName: string, email: string): Promise<void> {
    try {
      await this.db
        .prepare('UPDATE users SET email = $1 WHERE username = $2')
        .bind(email, userName)
        .run();

      // 清除用户信息缓存
      const { userInfoCache } = await import('./user-cache');
      userInfoCache.delete(userName);
    } catch (err) {
      console.error('PostgresStorage.setUserEmail error:', err);
      throw err;
    }
  }

  async getEmailNotificationPreference(userName: string): Promise<boolean> {
    try {
      const result = await this.db
        .prepare('SELECT email_notifications FROM users WHERE username = $1')
        .bind(userName)
        .first();

      return result?.email_notifications === 1;
    } catch (err) {
      console.error('PostgresStorage.getEmailNotificationPreference error:', err);
      return true; // 默认开�?    }
  }

  async setEmailNotificationPreference(userName: string, enabled: boolean): Promise<void> {
    try {
      await this.db
        .prepare('UPDATE users SET email_notifications = $1 WHERE username = $2')
        .bind(enabled ? 1 : 0, userName)
        .run();

      // 清除用户信息缓存
      const { userInfoCache } = await import('./user-cache');
      userInfoCache.delete(userName);
    } catch (err) {
      console.error('PostgresStorage.setEmailNotificationPreference error:', err);
      throw err;
    }
  }

  // ==================== TVBox订阅token ====================

  async getTvboxSubscribeToken(userName: string): Promise<string | null> {
    try {
      const result = await this.db
        .prepare('SELECT tvbox_subscribe_token FROM users_v2 WHERE username = $1')
        .bind(userName)
        .first();

      return result?.tvbox_subscribe_token || null;
    } catch (err) {
      console.error('PostgresStorage.getTvboxSubscribeToken error:', err);
      return null;
    }
  }

  async setTvboxSubscribeToken(userName: string, token: string): Promise<void> {
    try {
      await this.db
        .prepare('UPDATE users_v2 SET tvbox_subscribe_token = $1 WHERE username = $2')
        .bind(token, userName)
        .run();

      // 清除用户信息缓存
      const { userInfoCache } = await import('./user-cache');
      userInfoCache.delete(userName);
    } catch (err) {
      console.error('PostgresStorage.setTvboxSubscribeToken error:', err);
      throw err;
    }
  }

  async getUsernameByTvboxToken(token: string): Promise<string | null> {
    try {
      const result = await this.db
        .prepare('SELECT username FROM users_v2 WHERE tvbox_subscribe_token = $1')
        .bind(token)
        .first();

      return result?.username || null;
    } catch (err) {
      console.error('PostgresStorage.getUsernameByTvboxToken error:', err);
      return null;
    }
  }

  // ==================== 音乐播放记录 ====================

  async getMusicPlayRecord(userName: string, key: string): Promise<any | null> {
    try {
      const result = await this.db
        .prepare('SELECT * FROM music_play_records WHERE username = $1 AND key = $2')
        .bind(userName, key)
        .first();

      if (!result) return null;

      return {
        platform: result.platform,
        id: result.song_id,
        name: result.name,
        artist: result.artist,
        album: result.album || undefined,
        pic: result.pic || undefined,
        play_time: result.play_time,
        duration: result.duration,
        save_time: result.save_time,
      };
    } catch (err) {
      console.error('PostgresStorage.getMusicPlayRecord error:', err);
      return null;
    }
  }

  async setMusicPlayRecord(userName: string, key: string, record: any): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO music_play_records (username, key, platform, song_id, name, artist, album, pic, play_time, duration, save_time)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT(username, key) DO UPDATE SET
            name = EXCLUDED.name,
            artist = EXCLUDED.artist,
            album = EXCLUDED.album,
            pic = EXCLUDED.pic,
            play_time = EXCLUDED.play_time,
            duration = EXCLUDED.duration,
            save_time = EXCLUDED.save_time
        `)
        .bind(
          userName,
          key,
          record.platform,
          record.id,
          record.name,
          record.artist,
          record.album || null,
          record.pic || null,
          record.play_time,
          record.duration,
          record.save_time
        )
        .run();
    } catch (err) {
      console.error('PostgresStorage.setMusicPlayRecord error:', err);
      throw err;
    }
  }

  async batchSetMusicPlayRecords(userName: string, records: { key: string; record: any }[]): Promise<void> {
    if (records.length === 0) return;

    try {
      // 使用批量插入，Postgres 支持 batch 操作
      const statements = records.map(({ key, record }) =>
        this.db
          .prepare(`
            INSERT INTO music_play_records (username, key, platform, song_id, name, artist, album, pic, play_time, duration, save_time)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT(username, key) DO UPDATE SET
              platform = EXCLUDED.platform,
              song_id = EXCLUDED.song_id,
              name = EXCLUDED.name,
              artist = EXCLUDED.artist,
              album = EXCLUDED.album,
              pic = EXCLUDED.pic,
              play_time = EXCLUDED.play_time,
              duration = EXCLUDED.duration,
              save_time = EXCLUDED.save_time
          `)
          .bind(
            userName,
            key,
            record.platform,
            record.id,
            record.name,
            record.artist,
            record.album || null,
            record.pic || null,
            record.play_time,
            record.duration,
            record.save_time
          )
      );

      if (this.db.batch) {
        await this.db.batch(statements);
      }
    } catch (err) {
      console.error('PostgresStorage.batchSetMusicPlayRecords error:', err);
      throw err;
    }
  }

  async getAllMusicPlayRecords(userName: string): Promise<{ [key: string]: any }> {
    try {
      const results = await this.db
        .prepare('SELECT * FROM music_play_records WHERE username = $1 ORDER BY save_time DESC')
        .bind(userName)
        .all();

      const records: { [key: string]: any } = {};
      if (results.results) {
        for (const row of results.results) {
          records[row.key as string] = {
            platform: row.platform,
            id: row.song_id,
            name: row.name,
            artist: row.artist,
            album: row.album || undefined,
            pic: row.pic || undefined,
            play_time: row.play_time,
            duration: row.duration,
            save_time: row.save_time,
          };
        }
      }
      return records;
    } catch (err) {
      console.error('PostgresStorage.getAllMusicPlayRecords error:', err);
      throw err;
    }
  }

  async deleteMusicPlayRecord(userName: string, key: string): Promise<void> {
    try {
      await this.db
        .prepare('DELETE FROM music_play_records WHERE username = $1 AND key = $2')
        .bind(userName, key)
        .run();
    } catch (err) {
      console.error('PostgresStorage.deleteMusicPlayRecord error:', err);
      throw err;
    }
  }

  async clearAllMusicPlayRecords(userName: string): Promise<void> {
    try {
      await this.db
        .prepare('DELETE FROM music_play_records WHERE username = $1')
        .bind(userName)
        .run();
    } catch (err) {
      console.error('PostgresStorage.clearAllMusicPlayRecords error:', err);
      throw err;
    }
  }

  // ==================== 音乐歌单相关 ====================

  async createMusicPlaylist(userName: string, playlist: {
    id: string;
    name: string;
    description?: string;
    cover?: string;
  }): Promise<void> {
    try {
      const now = Date.now();
      await this.db
        .prepare(`
          INSERT INTO music_playlists (id, username, name, description, cover, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `)
        .bind(
          playlist.id,
          userName,
          playlist.name,
          playlist.description || null,
          playlist.cover || null,
          now,
          now
        )
        .run();
    } catch (err) {
      console.error('PostgresStorage.createMusicPlaylist error:', err);
      throw err;
    }
  }

  async getMusicPlaylist(playlistId: string): Promise<any | null> {
    try {
      const result = await this.db
        .prepare('SELECT * FROM music_playlists WHERE id = $1')
        .bind(playlistId)
        .first();

      if (!result) return null;

      return {
        id: result.id,
        username: result.username,
        name: result.name,
        description: result.description || undefined,
        cover: result.cover || undefined,
        created_at: result.created_at,
        updated_at: result.updated_at,
      };
    } catch (err) {
      console.error('PostgresStorage.getMusicPlaylist error:', err);
      return null;
    }
  }

  async getUserMusicPlaylists(userName: string): Promise<any[]> {
    try {
      const results = await this.db
        .prepare('SELECT * FROM music_playlists WHERE username = $1 ORDER BY created_at DESC')
        .bind(userName)
        .all();

      if (!results.results) return [];

      return results.results.map((row) => ({
        id: row.id,
        username: row.username,
        name: row.name,
        description: row.description || undefined,
        cover: row.cover || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    } catch (err) {
      console.error('PostgresStorage.getUserMusicPlaylists error:', err);
      return [];
    }
  }

  async updateMusicPlaylist(playlistId: string, updates: {
    name?: string;
    description?: string;
    cover?: string;
  }): Promise<void> {
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        setClauses.push(`name = $${paramIndex++}`);
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }
      if (updates.cover !== undefined) {
        setClauses.push(`cover = $${paramIndex++}`);
        values.push(updates.cover);
      }

      if (setClauses.length === 0) return;

      setClauses.push(`updated_at = $${paramIndex++}`);
      values.push(Date.now());

      values.push(playlistId);

      await this.db
        .prepare(`UPDATE music_playlists SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`)
        .bind(...values)
        .run();
    } catch (err) {
      console.error('PostgresStorage.updateMusicPlaylist error:', err);
      throw err;
    }
  }

  async deleteMusicPlaylist(playlistId: string): Promise<void> {
    try {
      await this.db
        .prepare('DELETE FROM music_playlists WHERE id = $1')
        .bind(playlistId)
        .run();
    } catch (err) {
      console.error('PostgresStorage.deleteMusicPlaylist error:', err);
      throw err;
    }
  }

  async addSongToPlaylist(playlistId: string, song: {
    platform: string;
    id: string;
    name: string;
    artist: string;
    album?: string;
    pic?: string;
    duration: number;
  }): Promise<void> {
    try {
      const now = Date.now();

      // 获取当前最大的 sort_order
      const maxSortResult = await this.db
        .prepare('SELECT MAX(sort_order) as max_sort FROM music_playlist_songs WHERE playlist_id = $1')
        .bind(playlistId)
        .first();

      const nextSortOrder = (maxSortResult?.max_sort as number || 0) + 1;

      await this.db
        .prepare(`
          INSERT INTO music_playlist_songs (playlist_id, platform, song_id, name, artist, album, pic, duration, added_at, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT(playlist_id, platform, song_id) DO UPDATE SET
            name = EXCLUDED.name,
            artist = EXCLUDED.artist,
            album = EXCLUDED.album,
            pic = EXCLUDED.pic,
            duration = EXCLUDED.duration
        `)
        .bind(
          playlistId,
          song.platform,
          song.id,
          song.name,
          song.artist,
          song.album || null,
          song.pic || null,
          song.duration,
          now,
          nextSortOrder
        )
        .run();

      // 更新歌单�?updated_at
      await this.db
        .prepare('UPDATE music_playlists SET updated_at = $1 WHERE id = $2')
        .bind(now, playlistId)
        .run();
    } catch (err) {
      console.error('PostgresStorage.addSongToPlaylist error:', err);
      throw err;
    }
  }

  async removeSongFromPlaylist(playlistId: string, platform: string, songId: string): Promise<void> {
    try {
      await this.db
        .prepare('DELETE FROM music_playlist_songs WHERE playlist_id = $1 AND platform = $2 AND song_id = $3')
        .bind(playlistId, platform, songId)
        .run();

      // 更新歌单�?updated_at
      await this.db
        .prepare('UPDATE music_playlists SET updated_at = $1 WHERE id = $2')
        .bind(Date.now(), playlistId)
        .run();
    } catch (err) {
      console.error('PostgresStorage.removeSongFromPlaylist error:', err);
      throw err;
    }
  }

  async getPlaylistSongs(playlistId: string): Promise<any[]> {
    try {
      const results = await this.db
        .prepare('SELECT * FROM music_playlist_songs WHERE playlist_id = $1 ORDER BY sort_order ASC')
        .bind(playlistId)
        .all();

      if (!results.results) return [];

      return results.results.map((row) => ({
        platform: row.platform,
        id: row.song_id,
        name: row.name,
        artist: row.artist,
        album: row.album || undefined,
        pic: row.pic || undefined,
        duration: row.duration,
        added_at: row.added_at,
        sort_order: row.sort_order,
      }));
    } catch (err) {
      console.error('PostgresStorage.getPlaylistSongs error:', err);
      return [];
    }
  }

  async updatePlaylistSongOrder(playlistId: string, songOrders: Array<{ platform: string; songId: string; sortOrder: number }>): Promise<void> {
    try {
      const statements = songOrders.map(({ platform, songId, sortOrder }) =>
        this.db
          .prepare('UPDATE music_playlist_songs SET sort_order = $1 WHERE playlist_id = $2 AND platform = $3 AND song_id = $4')
          .bind(sortOrder, playlistId, platform, songId)
      );

      if (this.db.batch) {
        await this.db.batch(statements);
      }

      // 更新歌单�?updated_at
      await this.db
        .prepare('UPDATE music_playlists SET updated_at = $1 WHERE id = $2')
        .bind(Date.now(), playlistId)
        .run();
    } catch (err) {
      console.error('PostgresStorage.updatePlaylistSongOrder error:', err);
      throw err;
    }
  }

  // ==================== Music V2 历史记录相关 ====================

  async listMusicV2History(userName: string): Promise<MusicV2HistoryRecord[]> {
    try {
      const results = await this.db
        // 按队列顺序返回；当前播放项由最�?last_played_at 决定
        .prepare('SELECT * FROM music_v2_history WHERE username = $1 ORDER BY created_at ASC, last_played_at ASC')
        .bind(userName)
        .all();

      if (!results.results) return [];

      return results.results.map((row: any) => ({
        songId: row.song_id,
        source: row.source,
        songmid: row.songmid || undefined,
        name: row.name,
        artist: row.artist,
        album: row.album || undefined,
        cover: row.cover || undefined,
        durationText: row.duration_text || undefined,
        durationSec: row.duration_sec ?? undefined,
        playProgressSec: row.play_progress_sec ?? 0,
        lastPlayedAt: row.last_played_at,
        playCount: row.play_count ?? 0,
        lastQuality: row.last_quality || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (err) {
      console.error('PostgresStorage.listMusicV2History error:', err);
      return [];
    }
  }

  async upsertMusicV2History(userName: string, record: MusicV2HistoryRecord): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO music_v2_history (
            username, song_id, source, songmid, name, artist, album, cover, duration_text, duration_sec,
            play_progress_sec, last_played_at, play_count, last_quality, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT(username, song_id) DO UPDATE SET
            source = EXCLUDED.source,
            songmid = EXCLUDED.songmid,
            name = EXCLUDED.name,
            artist = EXCLUDED.artist,
            album = EXCLUDED.album,
            cover = EXCLUDED.cover,
            duration_text = EXCLUDED.duration_text,
            duration_sec = EXCLUDED.duration_sec,
            play_progress_sec = EXCLUDED.play_progress_sec,
            last_played_at = EXCLUDED.last_played_at,
            play_count = EXCLUDED.play_count,
            last_quality = EXCLUDED.last_quality,
            updated_at = EXCLUDED.updated_at
        `)
        .bind(
          userName,
          record.songId,
          record.source,
          record.songmid || null,
          record.name,
          record.artist,
          record.album || null,
          record.cover || null,
          record.durationText || null,
          record.durationSec ?? null,
          record.playProgressSec,
          record.lastPlayedAt,
          record.playCount,
          record.lastQuality || null,
          record.createdAt,
          record.updatedAt
        )
        .run();
    } catch (err) {
      console.error('PostgresStorage.upsertMusicV2History error:', err);
      throw err;
    }
  }

  async batchUpsertMusicV2History(userName: string, records: MusicV2HistoryRecord[]): Promise<void> {
    for (const record of records) {
      await this.upsertMusicV2History(userName, record);
    }
  }

  async deleteMusicV2History(userName: string, songId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM music_v2_history WHERE username = $1 AND song_id = $2')
      .bind(userName, songId)
      .run();
  }

  async clearMusicV2History(userName: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM music_v2_history WHERE username = $1')
      .bind(userName)
      .run();
  }

  // ==================== Music V2 歌单相关 ====================

  async createMusicV2Playlist(userName: string, playlist: {
    id: string;
    name: string;
    description?: string;
    cover?: string;
  }): Promise<void> {
    const now = Date.now();
    await this.db
      .prepare(`
        INSERT INTO music_v2_playlists (id, username, name, description, cover, song_count, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `)
      .bind(playlist.id, userName, playlist.name, playlist.description || null, playlist.cover || null, 0, now, now)
      .run();
  }

  async getMusicV2Playlist(playlistId: string): Promise<MusicV2PlaylistRecord | null> {
    const row: any = await this.db
      .prepare('SELECT * FROM music_v2_playlists WHERE id = $1')
      .bind(playlistId)
      .first();
    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      name: row.name,
      description: row.description || undefined,
      cover: row.cover || undefined,
      song_count: row.song_count ?? 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async listMusicV2Playlists(userName: string): Promise<MusicV2PlaylistRecord[]> {
    const results = await this.db
      .prepare('SELECT * FROM music_v2_playlists WHERE username = $1 ORDER BY updated_at DESC')
      .bind(userName)
      .all();
    if (!results.results) return [];
    return results.results.map((row: any) => ({
      id: row.id,
      username: row.username,
      name: row.name,
      description: row.description || undefined,
      cover: row.cover || undefined,
      song_count: row.song_count ?? 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async updateMusicV2Playlist(playlistId: string, updates: {
    name?: string;
    description?: string;
    cover?: string;
    song_count?: number;
  }): Promise<void> {
    const clauses: string[] = [];
    const values: any[] = [];
    let index = 1;
    if (updates.name !== undefined) {
      clauses.push(`name = $${index++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      clauses.push(`description = $${index++}`);
      values.push(updates.description || null);
    }
    if (updates.cover !== undefined) {
      clauses.push(`cover = $${index++}`);
      values.push(updates.cover || null);
    }
    if (updates.song_count !== undefined) {
      clauses.push(`song_count = $${index++}`);
      values.push(updates.song_count);
    }
    clauses.push(`updated_at = $${index++}`);
    values.push(Date.now());
    values.push(playlistId);
    await this.db
      .prepare(`UPDATE music_v2_playlists SET ${clauses.join(', ')} WHERE id = $${index}`)
      .bind(...values)
      .run();
  }

  async deleteMusicV2Playlist(playlistId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM music_v2_playlists WHERE id = $1')
      .bind(playlistId)
      .run();
  }

  async addMusicV2PlaylistItem(playlistId: string, item: MusicV2PlaylistItem): Promise<void> {
    const playlist = await this.getMusicV2Playlist(playlistId);
    if (!playlist) {
      throw new Error('歌单不存�?);
    }
    const maxSort: any = await this.db
      .prepare('SELECT MAX(sort_order) as max_sort FROM music_v2_playlist_items WHERE playlist_id = $1')
      .bind(playlistId)
      .first();
    const nextOrder = Math.max(item.sortOrder || 0, (maxSort?.max_sort as number || 0) + 1);
    const now = Date.now();

    await this.db
      .prepare(`
        INSERT INTO music_v2_playlist_items (
          playlist_id, username, song_id, source, songmid, name, artist, album, cover, duration_text, duration_sec, sort_order, added_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT(playlist_id, song_id) DO UPDATE SET
          source = EXCLUDED.source,
          songmid = EXCLUDED.songmid,
          name = EXCLUDED.name,
          artist = EXCLUDED.artist,
          album = EXCLUDED.album,
          cover = EXCLUDED.cover,
          duration_text = EXCLUDED.duration_text,
          duration_sec = EXCLUDED.duration_sec,
          updated_at = EXCLUDED.updated_at
      `)
      .bind(
        playlistId,
        playlist.username,
        item.songId,
        item.source,
        item.songmid || null,
        item.name,
        item.artist,
        item.album || null,
        item.cover || null,
        item.durationText || null,
        item.durationSec ?? null,
        nextOrder,
        item.addedAt || now,
        now
      )
      .run();

    const items = await this.listMusicV2PlaylistItems(playlistId);
    await this.updateMusicV2Playlist(playlistId, {
      song_count: items.length,
      cover: items[0]?.cover || undefined,
    });
  }

  async removeMusicV2PlaylistItem(playlistId: string, songId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM music_v2_playlist_items WHERE playlist_id = $1 AND song_id = $2')
      .bind(playlistId, songId)
      .run();
    const items = await this.listMusicV2PlaylistItems(playlistId);
    await this.updateMusicV2Playlist(playlistId, {
      song_count: items.length,
      cover: items[0]?.cover || undefined,
    });
  }

  async listMusicV2PlaylistItems(playlistId: string): Promise<MusicV2PlaylistItem[]> {
    const results = await this.db
      .prepare('SELECT * FROM music_v2_playlist_items WHERE playlist_id = $1 ORDER BY sort_order ASC, added_at ASC')
      .bind(playlistId)
      .all();
    if (!results.results) return [];
    return results.results.map((row: any) => ({
      playlistId: row.playlist_id,
      songId: row.song_id,
      source: row.source,
      songmid: row.songmid || undefined,
      name: row.name,
      artist: row.artist,
      album: row.album || undefined,
      cover: row.cover || undefined,
      durationText: row.duration_text || undefined,
      durationSec: row.duration_sec ?? undefined,
      sortOrder: row.sort_order,
      addedAt: row.added_at,
      updatedAt: row.updated_at,
    }));
  }

  async hasMusicV2PlaylistItem(playlistId: string, songId: string): Promise<boolean> {
    const row = await this.db
      .prepare('SELECT 1 FROM music_v2_playlist_items WHERE playlist_id = $1 AND song_id = $2 LIMIT 1')
      .bind(playlistId, songId)
      .first();
    return row !== null;
  }

  // ==================== 搜索历史 ====================

  async getSearchHistory(userName: string): Promise<string[]> {
    try {
      const results = await this.db
        .prepare('SELECT keyword FROM search_history WHERE username = $1 ORDER BY timestamp DESC LIMIT 20')
        .bind(userName)
        .all();

      if (!results.results) return [];
      return results.results.map((row) => row.keyword as string);
    } catch (err) {
      console.error('PostgresStorage.getSearchHistory error:', err);
      return [];
    }
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    try {
      const timestamp = Date.now();

      // 插入或更新时间戳
      await this.db
        .prepare(`
          INSERT INTO search_history (username, keyword, timestamp)
          VALUES ($1, $2, $3)
          ON CONFLICT (username, keyword) DO UPDATE SET timestamp = EXCLUDED.timestamp
        `)
        .bind(userName, keyword, timestamp)
        .run();

      // 保持最�?20 条记�?      const countResult = await this.db
        .prepare('SELECT COUNT(*) as count FROM search_history WHERE username = $1')
        .bind(userName)
        .first();

      const count = (countResult?.count as number) || 0;
      if (count > 20) {
        await this.db
          .prepare(`
            DELETE FROM search_history
            WHERE username = $1
            AND id NOT IN (
              SELECT id FROM search_history
              WHERE username = $1
              ORDER BY timestamp DESC
              LIMIT 20
            )
          `)
          .bind(userName)
          .run();
      }
    } catch (err) {
      console.error('PostgresStorage.addSearchHistory error:', err);
      throw err;
    }
  }

  async deleteSearchHistory(userName: string, keyword?: string): Promise<void> {
    try {
      if (keyword) {
        await this.db
          .prepare('DELETE FROM search_history WHERE username = $1 AND keyword = $2')
          .bind(userName, keyword)
          .run();
      } else {
        await this.db
          .prepare('DELETE FROM search_history WHERE username = $1')
          .bind(userName)
          .run();
      }
    } catch (err) {
      console.error('PostgresStorage.deleteSearchHistory error:', err);
      throw err;
    }
  }

  // ==================== 漫画书架 ====================

  async getMangaShelf(userName: string, key: string): Promise<MangaShelfItem | null> {
    try {
      await this.schemaReady;
      const result = await this.db
        .prepare('SELECT * FROM manga_shelf WHERE username = $1 AND key = $2')
        .bind(userName, key)
        .first();

      if (!result) return null;
      return {
        title: result.title as string,
        cover: (result.cover as string) || '',
        sourceId: result.source_id as string,
        sourceName: result.source_name as string,
        mangaId: result.manga_id as string,
        saveTime: Number(result.save_time || 0),
        description: (result.description as string) || undefined,
        author: (result.author as string) || undefined,
        status: (result.status as string) || undefined,
        lastChapterId: (result.last_chapter_id as string) || undefined,
        lastChapterName: (result.last_chapter_name as string) || undefined,
        latestChapterId: (result.latest_chapter_id as string) || undefined,
        latestChapterName: (result.latest_chapter_name as string) || undefined,
        latestChapterCount:
          result.latest_chapter_count === null || result.latest_chapter_count === undefined
            ? undefined
            : Number(result.latest_chapter_count),
        unreadChapterCount:
          result.unread_chapter_count === null || result.unread_chapter_count === undefined
            ? undefined
            : Number(result.unread_chapter_count),
      };
    } catch (err) {
      console.error('PostgresStorage.getMangaShelf error:', err);
      throw err;
    }
  }

  async setMangaShelf(userName: string, key: string, item: MangaShelfItem): Promise<void> {
    try {
      await this.schemaReady;
      await this.db
        .prepare(`
          INSERT INTO manga_shelf (
            username, key, source_id, source_name, manga_id, title, cover, save_time,
            description, author, status, last_chapter_id, last_chapter_name,
            latest_chapter_id, latest_chapter_name, latest_chapter_count, unread_chapter_count
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (username, key) DO UPDATE SET
            source_id = EXCLUDED.source_id,
            source_name = EXCLUDED.source_name,
            manga_id = EXCLUDED.manga_id,
            title = EXCLUDED.title,
            cover = EXCLUDED.cover,
            save_time = EXCLUDED.save_time,
            description = EXCLUDED.description,
            author = EXCLUDED.author,
            status = EXCLUDED.status,
            last_chapter_id = EXCLUDED.last_chapter_id,
            last_chapter_name = EXCLUDED.last_chapter_name,
            latest_chapter_id = EXCLUDED.latest_chapter_id,
            latest_chapter_name = EXCLUDED.latest_chapter_name,
            latest_chapter_count = EXCLUDED.latest_chapter_count,
            unread_chapter_count = EXCLUDED.unread_chapter_count
        `)
        .bind(
          userName,
          key,
          item.sourceId,
          item.sourceName,
          item.mangaId,
          item.title,
          item.cover || '',
          item.saveTime,
          item.description || null,
          item.author || null,
          item.status || null,
          item.lastChapterId || null,
          item.lastChapterName || null,
          item.latestChapterId || null,
          item.latestChapterName || null,
          item.latestChapterCount ?? null,
          item.unreadChapterCount ?? null
        )
        .run();
    } catch (err) {
      console.error('PostgresStorage.setMangaShelf error:', err);
      throw err;
    }
  }

  async getAllMangaShelf(userName: string): Promise<{ [key: string]: MangaShelfItem }> {
    try {
      await this.schemaReady;
      const results = await this.db
        .prepare('SELECT * FROM manga_shelf WHERE username = $1 ORDER BY save_time DESC')
        .bind(userName)
        .all();

      const shelves: { [key: string]: MangaShelfItem } = {};
      if (!results.results) return shelves;

      for (const row of results.results) {
        shelves[row.key as string] = {
          title: row.title as string,
          cover: (row.cover as string) || '',
          sourceId: row.source_id as string,
          sourceName: row.source_name as string,
          mangaId: row.manga_id as string,
          saveTime: Number(row.save_time || 0),
          description: (row.description as string) || undefined,
          author: (row.author as string) || undefined,
          status: (row.status as string) || undefined,
          lastChapterId: (row.last_chapter_id as string) || undefined,
          lastChapterName: (row.last_chapter_name as string) || undefined,
          latestChapterId: (row.latest_chapter_id as string) || undefined,
          latestChapterName: (row.latest_chapter_name as string) || undefined,
          latestChapterCount:
            row.latest_chapter_count === null || row.latest_chapter_count === undefined
              ? undefined
              : Number(row.latest_chapter_count),
          unreadChapterCount:
            row.unread_chapter_count === null || row.unread_chapter_count === undefined
              ? undefined
              : Number(row.unread_chapter_count),
        };
      }

      return shelves;
    } catch (err) {
      console.error('PostgresStorage.getAllMangaShelf error:', err);
      throw err;
    }
  }

  async deleteMangaShelf(userName: string, key: string): Promise<void> {
    try {
      await this.db
        .prepare('DELETE FROM manga_shelf WHERE username = $1 AND key = $2')
        .bind(userName, key)
        .run();
    } catch (err) {
      console.error('PostgresStorage.deleteMangaShelf error:', err);
      throw err;
    }
  }

  // ==================== 漫画阅读历史 ====================

  async getMangaReadRecord(userName: string, key: string): Promise<MangaReadRecord | null> {
    try {
      const result = await this.db
        .prepare('SELECT * FROM manga_read_records WHERE username = $1 AND key = $2')
        .bind(userName, key)
        .first();

      if (!result) return null;
      return {
        title: result.title as string,
        cover: (result.cover as string) || '',
        sourceId: result.source_id as string,
        sourceName: result.source_name as string,
        mangaId: result.manga_id as string,
        chapterId: result.chapter_id as string,
        chapterName: result.chapter_name as string,
        pageIndex: Number(result.page_index || 0),
        pageCount: Number(result.page_count || 0),
        saveTime: Number(result.save_time || 0),
      };
    } catch (err) {
      console.error('PostgresStorage.getMangaReadRecord error:', err);
      throw err;
    }
  }

  async setMangaReadRecord(userName: string, key: string, record: MangaReadRecord): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO manga_read_records (
            username, key, source_id, source_name, manga_id, title, cover,
            chapter_id, chapter_name, page_index, page_count, save_time
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (username, key) DO UPDATE SET
            source_id = EXCLUDED.source_id,
            source_name = EXCLUDED.source_name,
            manga_id = EXCLUDED.manga_id,
            title = EXCLUDED.title,
            cover = EXCLUDED.cover,
            chapter_id = EXCLUDED.chapter_id,
            chapter_name = EXCLUDED.chapter_name,
            page_index = EXCLUDED.page_index,
            page_count = EXCLUDED.page_count,
            save_time = EXCLUDED.save_time
        `)
        .bind(
          userName,
          key,
          record.sourceId,
          record.sourceName,
          record.mangaId,
          record.title,
          record.cover || '',
          record.chapterId,
          record.chapterName,
          record.pageIndex,
          record.pageCount,
          record.saveTime
        )
        .run();
    } catch (err) {
      console.error('PostgresStorage.setMangaReadRecord error:', err);
      throw err;
    }
  }

  async getAllMangaReadRecords(userName: string): Promise<{ [key: string]: MangaReadRecord }> {
    try {
      const results = await this.db
        .prepare('SELECT * FROM manga_read_records WHERE username = $1 ORDER BY save_time DESC')
        .bind(userName)
        .all();

      const records: { [key: string]: MangaReadRecord } = {};
      if (!results.results) return records;

      for (const row of results.results) {
        records[row.key as string] = {
          title: row.title as string,
          cover: (row.cover as string) || '',
          sourceId: row.source_id as string,
          sourceName: row.source_name as string,
          mangaId: row.manga_id as string,
          chapterId: row.chapter_id as string,
          chapterName: row.chapter_name as string,
          pageIndex: Number(row.page_index || 0),
          pageCount: Number(row.page_count || 0),
          saveTime: Number(row.save_time || 0),
        };
      }

      return records;
    } catch (err) {
      console.error('PostgresStorage.getAllMangaReadRecords error:', err);
      throw err;
    }
  }

  async deleteMangaReadRecord(userName: string, key: string): Promise<void> {
    try {
      await this.db
        .prepare('DELETE FROM manga_read_records WHERE username = $1 AND key = $2')
        .bind(userName, key)
        .run();
    } catch (err) {
      console.error('PostgresStorage.deleteMangaReadRecord error:', err);
      throw err;
    }
  }

  async cleanupOldMangaReadRecords(userName: string): Promise<void> {
    try {
      const maxRecords = parseInt(process.env.MAX_MANGA_HISTORY_PER_USER || '100', 10);
      const threshold = maxRecords + 10;
      const countResult = await this.db
        .prepare('SELECT COUNT(*) as count FROM manga_read_records WHERE username = $1')
        .bind(userName)
        .first();

      const count = Number(countResult?.count || 0);
      if (count <= threshold) return;

      await this.db
        .prepare(`
          DELETE FROM manga_read_records
          WHERE username = $1
          AND key NOT IN (
            SELECT key FROM manga_read_records
            WHERE username = $1
            ORDER BY save_time DESC
            LIMIT $2
          )
        `)
        .bind(userName, maxRecords)
        .run();
    } catch (err) {
      console.error('PostgresStorage.cleanupOldMangaReadRecords error:', err);
      throw err;
    }
  }


  // ==================== 电子书书�?====================

  async getBookShelf(userName: string, key: string): Promise<BookShelfItem | null> {
    try {
      const result = await this.db
        .prepare('SELECT * FROM book_shelf WHERE username = $1 AND key = $2')
        .bind(userName, key)
        .first();

      if (!result) return null;
      return {
        sourceId: result.source_id as string,
        sourceName: result.source_name as string,
        bookId: result.book_id as string,
        title: result.title as string,
        author: (result.author as string) || undefined,
        cover: (result.cover as string) || undefined,
        format: (result.format as 'epub' | 'pdf' | null) || undefined,
        detailHref: (result.detail_href as string) || undefined,
        acquisitionHref: (result.acquisition_href as string) || undefined,
        progressPercent: result.progress_percent === null || result.progress_percent === undefined ? undefined : Number(result.progress_percent),
        lastReadTime: result.last_read_time === null || result.last_read_time === undefined ? undefined : Number(result.last_read_time),
        lastLocatorType: (result.last_locator_type as BookShelfItem['lastLocatorType']) || undefined,
        lastLocatorValue: (result.last_locator_value as string) || undefined,
        lastChapterTitle: (result.last_chapter_title as string) || undefined,
        saveTime: Number(result.save_time || 0),
      };
    } catch (err) {
      console.error('PostgresStorage.getBookShelf error:', err);
      throw err;
    }
  }

  async setBookShelf(userName: string, key: string, item: BookShelfItem): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO book_shelf (
            username, key, source_id, source_name, book_id, title, author, cover, format, detail_href, acquisition_href,
            progress_percent, last_read_time, last_locator_type, last_locator_value, last_chapter_title, save_time
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (username, key) DO UPDATE SET
            source_id = EXCLUDED.source_id,
            source_name = EXCLUDED.source_name,
            book_id = EXCLUDED.book_id,
            title = EXCLUDED.title,
            author = EXCLUDED.author,
            cover = EXCLUDED.cover,
            format = EXCLUDED.format,
            detail_href = EXCLUDED.detail_href,
            acquisition_href = EXCLUDED.acquisition_href,
            progress_percent = EXCLUDED.progress_percent,
            last_read_time = EXCLUDED.last_read_time,
            last_locator_type = EXCLUDED.last_locator_type,
            last_locator_value = EXCLUDED.last_locator_value,
            last_chapter_title = EXCLUDED.last_chapter_title,
            save_time = EXCLUDED.save_time
        `)
        .bind(
          userName, key, item.sourceId, item.sourceName, item.bookId, item.title, item.author || null,
          item.cover || null, item.format || null, item.detailHref || null, item.acquisitionHref || null, item.progressPercent ?? null,
          item.lastReadTime ?? null, item.lastLocatorType || null, item.lastLocatorValue || null,
          item.lastChapterTitle || null, item.saveTime
        )
        .run();
    } catch (err) {
      console.error('PostgresStorage.setBookShelf error:', err);
      throw err;
    }
  }

  async getAllBookShelf(userName: string): Promise<{ [key: string]: BookShelfItem }> {
    try {
      const results = await this.db
        .prepare('SELECT * FROM book_shelf WHERE username = $1 ORDER BY COALESCE(last_read_time, save_time) DESC')
        .bind(userName)
        .all();
      const shelves: { [key: string]: BookShelfItem } = {};
      if (!results.results) return shelves;
      for (const row of results.results) {
        shelves[row.key as string] = {
          sourceId: row.source_id as string,
          sourceName: row.source_name as string,
          bookId: row.book_id as string,
          title: row.title as string,
          author: (row.author as string) || undefined,
          cover: (row.cover as string) || undefined,
          format: (row.format as 'epub' | 'pdf' | null) || undefined,
          detailHref: (row.detail_href as string) || undefined,
          acquisitionHref: (row.acquisition_href as string) || undefined,
          progressPercent: row.progress_percent === null || row.progress_percent === undefined ? undefined : Number(row.progress_percent),
          lastReadTime: row.last_read_time === null || row.last_read_time === undefined ? undefined : Number(row.last_read_time),
          lastLocatorType: (row.last_locator_type as BookShelfItem['lastLocatorType']) || undefined,
          lastLocatorValue: (row.last_locator_value as string) || undefined,
          lastChapterTitle: (row.last_chapter_title as string) || undefined,
          saveTime: Number(row.save_time || 0),
        };
      }
      return shelves;
    } catch (err) {
      console.error('PostgresStorage.getAllBookShelf error:', err);
      throw err;
    }
  }

  async deleteBookShelf(userName: string, key: string): Promise<void> {
    try {
      await this.db.prepare('DELETE FROM book_shelf WHERE username = $1 AND key = $2').bind(userName, key).run();
    } catch (err) {
      console.error('PostgresStorage.deleteBookShelf error:', err);
      throw err;
    }
  }

  // ==================== 电子书阅读历�?====================

  async getBookReadRecord(userName: string, key: string): Promise<BookReadRecord | null> {
    try {
      const result = await this.db
        .prepare('SELECT * FROM book_read_records WHERE username = $1 AND key = $2')
        .bind(userName, key)
        .first();
      if (!result) return null;
      return {
        sourceId: result.source_id as string,
        sourceName: result.source_name as string,
        bookId: result.book_id as string,
        title: result.title as string,
        author: (result.author as string) || undefined,
        cover: (result.cover as string) || undefined,
        format: result.format as 'epub' | 'pdf',
        detailHref: (result.detail_href as string) || undefined,
        acquisitionHref: (result.acquisition_href as string) || undefined,
        locator: {
          type: result.locator_type as BookReadRecord['locator']['type'],
          value: result.locator_value as string,
          href: (result.chapter_href as string) || undefined,
          chapterTitle: (result.chapter_title as string) || undefined,
        },
        progressPercent: Number(result.progress_percent || 0),
        chapterTitle: (result.chapter_title as string) || undefined,
        chapterHref: (result.chapter_href as string) || undefined,
        saveTime: Number(result.save_time || 0),
      };
    } catch (err) {
      console.error('PostgresStorage.getBookReadRecord error:', err);
      throw err;
    }
  }

  async setBookReadRecord(userName: string, key: string, record: BookReadRecord): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO book_read_records (
            username, key, source_id, source_name, book_id, title, author, cover, format, detail_href, acquisition_href,
            locator_type, locator_value, chapter_title, chapter_href, progress_percent, save_time
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (username, key) DO UPDATE SET
            source_id = EXCLUDED.source_id,
            source_name = EXCLUDED.source_name,
            book_id = EXCLUDED.book_id,
            title = EXCLUDED.title,
            author = EXCLUDED.author,
            cover = EXCLUDED.cover,
            format = EXCLUDED.format,
            detail_href = EXCLUDED.detail_href,
            acquisition_href = EXCLUDED.acquisition_href,
            locator_type = EXCLUDED.locator_type,
            locator_value = EXCLUDED.locator_value,
            chapter_title = EXCLUDED.chapter_title,
            chapter_href = EXCLUDED.chapter_href,
            progress_percent = EXCLUDED.progress_percent,
            save_time = EXCLUDED.save_time
        `)
        .bind(
          userName, key, record.sourceId, record.sourceName, record.bookId, record.title, record.author || null,
          record.cover || null, record.format, record.detailHref || null, record.acquisitionHref || null, record.locator.type, record.locator.value,
          record.chapterTitle || record.locator.chapterTitle || null, record.chapterHref || record.locator.href || null,
          record.progressPercent, record.saveTime
        )
        .run();
    } catch (err) {
      console.error('PostgresStorage.setBookReadRecord error:', err);
      throw err;
    }
  }

  async getAllBookReadRecords(userName: string): Promise<{ [key: string]: BookReadRecord }> {
    try {
      const results = await this.db
        .prepare('SELECT * FROM book_read_records WHERE username = $1 ORDER BY save_time DESC')
        .bind(userName)
        .all();
      const records: { [key: string]: BookReadRecord } = {};
      if (!results.results) return records;
      for (const row of results.results) {
        records[row.key as string] = {
          sourceId: row.source_id as string,
          sourceName: row.source_name as string,
          bookId: row.book_id as string,
          title: row.title as string,
          author: (row.author as string) || undefined,
          cover: (row.cover as string) || undefined,
          format: row.format as 'epub' | 'pdf',
          detailHref: (row.detail_href as string) || undefined,
          acquisitionHref: (row.acquisition_href as string) || undefined,
          locator: {
            type: row.locator_type as BookReadRecord['locator']['type'],
            value: row.locator_value as string,
            href: (row.chapter_href as string) || undefined,
            chapterTitle: (row.chapter_title as string) || undefined,
          },
          progressPercent: Number(row.progress_percent || 0),
          chapterTitle: (row.chapter_title as string) || undefined,
          chapterHref: (row.chapter_href as string) || undefined,
          saveTime: Number(row.save_time || 0),
        };
      }
      return records;
    } catch (err) {
      console.error('PostgresStorage.getAllBookReadRecords error:', err);
      throw err;
    }
  }

  async deleteBookReadRecord(userName: string, key: string): Promise<void> {
    try {
      await this.db.prepare('DELETE FROM book_read_records WHERE username = $1 AND key = $2').bind(userName, key).run();
    } catch (err) {
      console.error('PostgresStorage.deleteBookReadRecord error:', err);
      throw err;
    }
  }

  async cleanupOldBookReadRecords(userName: string): Promise<void> {
    try {
      const maxRecords = parseInt(process.env.MAX_BOOK_HISTORY_PER_USER || '100', 10);
      const threshold = maxRecords + 10;
      const countResult = await this.db
        .prepare('SELECT COUNT(*) as count FROM book_read_records WHERE username = $1')
        .bind(userName)
        .first();
      const count = Number(countResult?.count || 0);
      if (count <= threshold) return;
      await this.db
        .prepare(`
          DELETE FROM book_read_records
          WHERE username = $1
          AND key NOT IN (
            SELECT key FROM book_read_records
            WHERE username = $1
            ORDER BY save_time DESC
            LIMIT $2
          )
        `)
        .bind(userName, maxRecords)
        .run();
    } catch (err) {
      console.error('PostgresStorage.cleanupOldBookReadRecords error:', err);
      throw err;
    }
  }

  // ==================== 跳过配置 ====================

  async getSkipConfig(userName: string, source: string, id: string): Promise<SkipConfig | null> {
    try {
      const key = `${source}+${id}`;
      const result = await this.db
        .prepare('SELECT * FROM skip_configs WHERE username = $1 AND key = $2')
        .bind(userName, key)
        .first();

      if (!result) return null;
      return {
        enable: result.enable === 1,
        intro_time: result.intro_time as number,
        outro_time: result.outro_time as number,
      };
    } catch (err) {
      console.error('PostgresStorage.getSkipConfig error:', err);
      return null;
    }
  }

  async setSkipConfig(userName: string, source: string, id: string, config: SkipConfig): Promise<void> {
    try {
      const key = `${source}+${id}`;
      await this.db
        .prepare(`
          INSERT INTO skip_configs (username, key, enable, intro_time, outro_time)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (username, key) DO UPDATE SET
            enable = EXCLUDED.enable,
            intro_time = EXCLUDED.intro_time,
            outro_time = EXCLUDED.outro_time
        `)
        .bind(userName, key, config.enable ? 1 : 0, config.intro_time, config.outro_time)
        .run();
    } catch (err) {
      console.error('PostgresStorage.setSkipConfig error:', err);
      throw err;
    }
  }

  async deleteSkipConfig(userName: string, source: string, id: string): Promise<void> {
    try {
      const key = `${source}+${id}`;
      await this.db
        .prepare('DELETE FROM skip_configs WHERE username = $1 AND key = $2')
        .bind(userName, key)
        .run();
    } catch (err) {
      console.error('PostgresStorage.deleteSkipConfig error:', err);
      throw err;
    }
  }

  async getAllSkipConfigs(userName: string): Promise<{ [key: string]: SkipConfig }> {
    try {
      const results = await this.db
        .prepare('SELECT * FROM skip_configs WHERE username = $1')
        .bind(userName)
        .all();

      const configs: { [key: string]: SkipConfig } = {};
      if (results.results) {
        for (const row of results.results) {
          configs[row.key as string] = {
            enable: row.enable === 1,
            intro_time: row.intro_time as number,
            outro_time: row.outro_time as number,
          };
        }
      }
      return configs;
    } catch (err) {
      console.error('PostgresStorage.getAllSkipConfigs error:', err);
      return {};
    }
  }

  async migrateSkipConfigs(userName: string): Promise<void> {
    try {
      await this.db
        .prepare('UPDATE users SET skip_migrated = 1 WHERE username = $1')
        .bind(userName)
        .run();
    } catch (err) {
      console.error('PostgresStorage.migrateSkipConfigs error:', err);
    }
  }

  // ==================== 弹幕过滤配置 ====================

  async getDanmakuFilterConfig(userName: string): Promise<DanmakuFilterConfig | null> {
    try {
      const result = await this.db
        .prepare('SELECT rules FROM danmaku_filter_configs WHERE username = $1')
        .bind(userName)
        .first();

      if (!result) return null;
      return JSON.parse(result.rules as string);
    } catch (err) {
      console.error('PostgresStorage.getDanmakuFilterConfig error:', err);
      return null;
    }
  }

  async setDanmakuFilterConfig(userName: string, config: DanmakuFilterConfig): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO danmaku_filter_configs (username, rules)
          VALUES ($1, $2)
          ON CONFLICT (username) DO UPDATE SET rules = EXCLUDED.rules
        `)
        .bind(userName, JSON.stringify(config))
        .run();
    } catch (err) {
      console.error('PostgresStorage.setDanmakuFilterConfig error:', err);
      throw err;
    }
  }

  async deleteDanmakuFilterConfig(userName: string): Promise<void> {
    try {
      await this.db
        .prepare('DELETE FROM danmaku_filter_configs WHERE username = $1')
        .bind(userName)
        .run();
    } catch (err) {
      console.error('PostgresStorage.deleteDanmakuFilterConfig error:', err);
      throw err;
    }
  }

  // ==================== 通知 ====================

  async getNotifications(userName: string): Promise<Notification[]> {
    try {
      const results = await this.db
        .prepare('SELECT * FROM notifications WHERE username = $1 ORDER BY timestamp DESC')
        .bind(userName)
        .all();

      if (!results.results) return [];
      return results.results.map((row) => ({
        id: row.id as string,
        type: row.type as any,
        title: row.title as string,
        message: row.message as string,
        timestamp: row.timestamp as number,
        read: row.read === 1,
        metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
      }));
    } catch (err) {
      console.error('PostgresStorage.getNotifications error:', err);
      return [];
    }
  }

  async addNotification(userName: string, notification: Notification): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO notifications (id, username, type, title, message, timestamp, read, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `)
        .bind(
          notification.id,
          userName,
          notification.type,
          notification.title,
          notification.message,
          notification.timestamp,
          notification.read ? 1 : 0,
          notification.metadata ? JSON.stringify(notification.metadata) : null
        )
        .run();
    } catch (err) {
      console.error('PostgresStorage.addNotification error:', err);
      throw err;
    }
  }

  async markNotificationAsRead(userName: string, notificationId: string): Promise<void> {
    try {
      await this.db
        .prepare('UPDATE notifications SET read = 1 WHERE username = $1 AND id = $2')
        .bind(userName, notificationId)
        .run();
    } catch (err) {
      console.error('PostgresStorage.markNotificationAsRead error:', err);
      throw err;
    }
  }

  async deleteNotification(userName: string, notificationId: string): Promise<void> {
    try {
      await this.db
        .prepare('DELETE FROM notifications WHERE username = $1 AND id = $2')
        .bind(userName, notificationId)
        .run();
    } catch (err) {
      console.error('PostgresStorage.deleteNotification error:', err);
      throw err;
    }
  }

  async clearAllNotifications(userName: string): Promise<void> {
    try {
      await this.db
        .prepare('DELETE FROM notifications WHERE username = $1')
        .bind(userName)
        .run();
    } catch (err) {
      console.error('PostgresStorage.clearAllNotifications error:', err);
      throw err;
    }
  }

  async getUnreadNotificationCount(userName: string): Promise<number> {
    try {
      const result = await this.db
        .prepare('SELECT COUNT(*) as count FROM notifications WHERE username = $1 AND read = 0')
        .bind(userName)
        .first();

      return (result?.count as number) || 0;
    } catch (err) {
      console.error('PostgresStorage.getUnreadNotificationCount error:', err);
      return 0;
    }
  }

  // ==================== 求片请求 ====================

  async getAllMovieRequests(): Promise<MovieRequest[]> {
    try {
      const results = await this.db
        .prepare('SELECT * FROM movie_requests ORDER BY created_at DESC')
        .all();

      if (!results.results) return [];
      return results.results.map((row) => this.rowToMovieRequest(row));
    } catch (err) {
      console.error('PostgresStorage.getAllMovieRequests error:', err);
      return [];
    }
  }

  async getMovieRequest(requestId: string): Promise<MovieRequest | null> {
    try {
      const result = await this.db
        .prepare('SELECT * FROM movie_requests WHERE id = $1')
        .bind(requestId)
        .first();

      if (!result) return null;
      return this.rowToMovieRequest(result);
    } catch (err) {
      console.error('PostgresStorage.getMovieRequest error:', err);
      return null;
    }
  }

  async createMovieRequest(request: MovieRequest): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO movie_requests (
            id, tmdb_id, title, year, media_type, season, poster, overview,
            requested_by, request_count, status, created_at, updated_at,
            fulfilled_at, fulfilled_source, fulfilled_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `)
        .bind(
          request.id,
          request.tmdbId || null,
          request.title,
          request.year || null,
          request.mediaType,
          request.season || null,
          request.poster || null,
          request.overview || null,
          JSON.stringify(request.requestedBy),
          request.requestCount,
          request.status,
          request.createdAt,
          request.updatedAt,
          request.fulfilledAt || null,
          request.fulfilledSource || null,
          request.fulfilledId || null
        )
        .run();
    } catch (err) {
      console.error('PostgresStorage.createMovieRequest error:', err);
      throw err;
    }
  }

  async updateMovieRequest(requestId: string, updates: Partial<MovieRequest>): Promise<void> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.requestedBy !== undefined) {
        fields.push(`requested_by = $${paramIndex++}`);
        values.push(JSON.stringify(updates.requestedBy));
      }
      if (updates.requestCount !== undefined) {
        fields.push(`request_count = $${paramIndex++}`);
        values.push(updates.requestCount);
      }
      if (updates.status !== undefined) {
        fields.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }
      if (updates.fulfilledAt !== undefined) {
        fields.push(`fulfilled_at = $${paramIndex++}`);
        values.push(updates.fulfilledAt);
      }
      if (updates.fulfilledSource !== undefined) {
        fields.push(`fulfilled_source = $${paramIndex++}`);
        values.push(updates.fulfilledSource);
      }
      if (updates.fulfilledId !== undefined) {
        fields.push(`fulfilled_id = $${paramIndex++}`);
        values.push(updates.fulfilledId);
      }

      fields.push(`updated_at = $${paramIndex++}`);
      values.push(Date.now());

      values.push(requestId);

      await this.db
        .prepare(`UPDATE movie_requests SET ${fields.join(', ')} WHERE id = $${paramIndex}`)
        .bind(...values)
        .run();
    } catch (err) {
      console.error('PostgresStorage.updateMovieRequest error:', err);
      throw err;
    }
  }

  async deleteMovieRequest(requestId: string): Promise<void> {
    try {
      await this.db
        .prepare('DELETE FROM movie_requests WHERE id = $1')
        .bind(requestId)
        .run();
    } catch (err) {
      console.error('PostgresStorage.deleteMovieRequest error:', err);
      throw err;
    }
  }

  async getUserMovieRequests(userName: string): Promise<string[]> {
    try {
      const results = await this.db
        .prepare('SELECT request_id FROM user_movie_requests WHERE username = $1')
        .bind(userName)
        .all();

      if (!results.results) return [];
      return results.results.map((row) => row.request_id as string);
    } catch (err) {
      console.error('PostgresStorage.getUserMovieRequests error:', err);
      return [];
    }
  }

  async addUserMovieRequest(userName: string, requestId: string): Promise<void> {
    try {
      await this.db
        .prepare('INSERT INTO user_movie_requests (username, request_id) VALUES ($1, $2) ON CONFLICT (username, request_id) DO NOTHING')
        .bind(userName, requestId)
        .run();
    } catch (err) {
      console.error('PostgresStorage.addUserMovieRequest error:', err);
      throw err;
    }
  }

  async removeUserMovieRequest(userName: string, requestId: string): Promise<void> {
    try {
      await this.db
        .prepare('DELETE FROM user_movie_requests WHERE username = $1 AND request_id = $2')
        .bind(userName, requestId)
        .run();
    } catch (err) {
      console.error('PostgresStorage.removeUserMovieRequest error:', err);
      throw err;
    }
  }

  private rowToMovieRequest(row: any): MovieRequest {
    return {
      id: row.id,
      tmdbId: row.tmdb_id || undefined,
      title: row.title,
      year: row.year || undefined,
      mediaType: row.media_type as 'movie' | 'tv',
      season: row.season || undefined,
      poster: row.poster || undefined,
      overview: row.overview || undefined,
      requestedBy: JSON.parse(row.requested_by),
      requestCount: row.request_count,
      status: row.status as 'pending' | 'fulfilled',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      fulfilledAt: row.fulfilled_at || undefined,
      fulfilledSource: row.fulfilled_source || undefined,
      fulfilledId: row.fulfilled_id || undefined,
    };
  }

  // ==================== 管理员配置和其他 ====================

  async getAdminConfig(): Promise<AdminConfig | null> {
    try {
      const result = await this.db
        .prepare('SELECT config FROM admin_config WHERE id = 1')
        .first();

      if (!result) return null;
      return JSON.parse(result.config as string);
    } catch (err) {
      console.error('PostgresStorage.getAdminConfig error:', err);
      return null;
    }
  }

  async setAdminConfig(config: AdminConfig): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO admin_config (id, config, updated_at)
          VALUES (1, $1, $2)
          ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config, updated_at = EXCLUDED.updated_at
        `)
        .bind(JSON.stringify(config), Date.now())
        .run();
    } catch (err) {
      console.error('PostgresStorage.setAdminConfig error:', err);
      throw err;
    }
  }

  async clearAllData(): Promise<void> {
    try {
      // 清空所有表（保留结构）
      const tables = [
        'play_records',
        'favorites',
        'search_history',
        'manga_shelf',
        'manga_read_records',
        'book_shelf',
        'book_read_records',
        'skip_configs',
        'music_v2_history',
        'music_v2_playlists',
        'music_v2_playlist_items',
        'danmaku_filter_configs',
        'notifications',
        'movie_requests',
        'user_movie_requests',
        'favorite_check_times',
        'global_config',
      ];

      for (const table of tables) {
        try {
          await this.db.prepare(`DELETE FROM ${table}`).run();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes('no such table') || message.includes('does not exist')) {
            console.warn('PostgresStorage.clearAllData warning:', table, message);
            continue;
          }
          throw err;
        }
      }
    } catch (err) {
      console.error('PostgresStorage.clearAllData error:', err);
      throw err;
    }
  }

  async getGlobalValue(key: string): Promise<string | null> {
    try {
      const result = await this.db
        .prepare('SELECT value FROM global_config WHERE key = $1')
        .bind(key)
        .first();

      return result ? (result.value as string) : null;
    } catch (err) {
      console.error('PostgresStorage.getGlobalValue error:', err);
      return null;
    }
  }

  async setGlobalValue(key: string, value: string): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO global_config (key, value, updated_at)
          VALUES ($1, $2, $3)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
        `)
        .bind(key, value, Date.now())
        .run();
    } catch (err) {
      console.error('PostgresStorage.setGlobalValue error:', err);
      throw err;
    }
  }

  async deleteGlobalValue(key: string): Promise<void> {
    try {
      await this.db
        .prepare('DELETE FROM global_config WHERE key = $1')
        .bind(key)
        .run();
    } catch (err) {
      console.error('PostgresStorage.deleteGlobalValue error:', err);
      throw err;
    }
  }

  async getLastFavoriteCheckTime(userName: string): Promise<number> {
    try {
      const result = await this.db
        .prepare('SELECT last_check_time FROM favorite_check_times WHERE username = $1')
        .bind(userName)
        .first();

      return (result?.last_check_time as number) || 0;
    } catch (err) {
      console.error('PostgresStorage.getLastFavoriteCheckTime error:', err);
      return 0;
    }
  }

  async setLastFavoriteCheckTime(userName: string, timestamp: number): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO favorite_check_times (username, last_check_time)
          VALUES ($1, $2)
          ON CONFLICT (username) DO UPDATE SET last_check_time = EXCLUDED.last_check_time
        `)
        .bind(userName, timestamp)
        .run();
    } catch (err) {
      console.error('PostgresStorage.setLastFavoriteCheckTime error:', err);
      throw err;
    }
  }

  async updateLastMovieRequestTime(userName: string, timestamp: number): Promise<void> {
    try {
      await this.db
        .prepare('UPDATE users SET last_movie_request_time = $1 WHERE username = $2')
        .bind(timestamp, userName)
        .run();
    } catch (err) {
      console.error('PostgresStorage.updateLastMovieRequestTime error:', err);
      throw err;
    }
  }
}

/**
 * Redis Hash 兼容适配�? * 用于支持设备管理功能（refresh token 存储�? *
 * 使用 global_config 表模�?Redis Hash 操作
 * key 格式：user_tokens:{username}:{tokenId}
 */
class PostgresRedisHashAdapter {
  constructor(private db: DatabaseAdapter) {}

  async hSet(hashKey: string, field: string, value: string): Promise<void> {
    const key = `${hashKey}:${field}`;
    await this.db
      .prepare(`
        INSERT INTO global_config (key, value, updated_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
      `)
      .bind(key, value, Date.now())
      .run();
  }

  async hGet(hashKey: string, field: string): Promise<string | null> {
    const key = `${hashKey}:${field}`;
    const result = await this.db
      .prepare('SELECT value FROM global_config WHERE key = $1')
      .bind(key)
      .first();

    return result ? (result.value as string) : null;
  }

  async hGetAll(hashKey: string): Promise<Record<string, string>> {
    const prefix = `${hashKey}:`;
    const results = await this.db
      .prepare('SELECT key, value FROM global_config WHERE key LIKE $1')
      .bind(`${prefix}%`)
      .all();

    const hash: Record<string, string> = {};

    if (results && results.results) {
      for (const row of results.results) {
        const fullKey = row.key as string;
        const field = fullKey.substring(prefix.length);
        hash[field] = row.value as string;
      }
    }

    return hash;
  }

  async hDel(hashKey: string, field: string): Promise<void> {
    const key = `${hashKey}:${field}`;
    await this.db
      .prepare('DELETE FROM global_config WHERE key = $1')
      .bind(key)
      .run();
  }

  async del(hashKey: string): Promise<void> {
    const prefix = `${hashKey}:`;
    await this.db
      .prepare('DELETE FROM global_config WHERE key LIKE $1')
      .bind(`${prefix}%`)
      .run();
  }
}
