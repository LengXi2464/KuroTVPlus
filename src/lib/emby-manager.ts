/* eslint-disable @typescript-eslint/no-explicit-any */

import { AdminConfig } from './admin.types';
import { getConfig } from './config';
import { EmbyClient } from './emby.client';

interface EmbySourceConfig {
  key: string;
  name: string;
  enabled: boolean;
  ServerURL: string;
  ApiKey?: string;
  Username?: string;
  Password?: string;
  UserId?: string;
  AuthToken?: string;
  Libraries?: string[];
  LastSyncTime?: number;
  ItemCount?: number;
  isDefault?: boolean;
  // 高级流媒体选项
  removeEmbyPrefix?: boolean;
  appendMediaSourceId?: boolean;
  transcodeMp4?: boolean;
  proxyPlay?: boolean; // 视频播放代理开�?}

class EmbyManager {
  private static instance: EmbyManager;
  private clients: Map<string, EmbyClient> = new Map();

  private constructor() {}

  static getInstance(): EmbyManager {
    if (!EmbyManager.instance) {
      EmbyManager.instance = new EmbyManager();
    }
    return EmbyManager.instance;
  }

  /**
   * 从配置中获取所有Emby源（支持新旧格式�?   */
  private async getSources(): Promise<EmbySourceConfig[]> {
    const config = await getConfig();

    // 如果是新格式（Sources数组�?    if (config.EmbyConfig?.Sources && Array.isArray(config.EmbyConfig.Sources)) {
      return config.EmbyConfig.Sources;
    }

    // 如果是旧格式（单源配置），转换为数组格式
    if (config.EmbyConfig?.ServerURL) {
      return [{
        key: 'default',
        name: 'Emby',
        enabled: config.EmbyConfig.Enabled ?? false,
        ServerURL: config.EmbyConfig.ServerURL,
        ApiKey: config.EmbyConfig.ApiKey,
        Username: config.EmbyConfig.Username,
        Password: config.EmbyConfig.Password,
        UserId: config.EmbyConfig.UserId,
        AuthToken: config.EmbyConfig.AuthToken,
        Libraries: config.EmbyConfig.Libraries,
        LastSyncTime: config.EmbyConfig.LastSyncTime,
        ItemCount: config.EmbyConfig.ItemCount,
        isDefault: true,
      }];
    }

    return [];
  }

  /**
   * 获取指定key的EmbyClient
   * @param key Emby源的key，如果不指定则使用默认源
   */
  async getClient(key?: string): Promise<EmbyClient> {
    const sources = await this.getSources();

    if (sources.length === 0) {
      throw new Error('未配�?Emby �?);
    }

    // 如果没有指定key，使用默认源（第一个或标记为default的）
    if (!key) {
      const defaultSource = sources.find(s => s.isDefault) || sources[0];
      key = defaultSource.key;
    }

    // 从缓存获取或创建新实�?    if (!this.clients.has(key)) {
      const sourceConfig = sources.find(s => s.key === key);
      if (!sourceConfig) {
        throw new Error(`未找�?Emby �? ${key}`);
      }

      if (!sourceConfig.enabled) {
        throw new Error(`Emby 源已禁用: ${sourceConfig.name}`);
      }

      this.clients.set(key, new EmbyClient(sourceConfig));
    }

    return this.clients.get(key)!;
  }

  /**
   * 获取所有启用的EmbyClient
   */
  async getAllClients(): Promise<Map<string, { client: EmbyClient; config: EmbySourceConfig }>> {
    const sources = await this.getSources();
    const enabledSources = sources.filter(s => s.enabled);
    const result = new Map<string, { client: EmbyClient; config: EmbySourceConfig }>();

    for (const source of enabledSources) {
      if (!this.clients.has(source.key)) {
        this.clients.set(source.key, new EmbyClient(source));
      }
      result.set(source.key, {
        client: this.clients.get(source.key)!,
        config: source,
      });
    }

    return result;
  }

  /**
   * 获取所有启用的Emby源配�?   */
  async getEnabledSources(): Promise<EmbySourceConfig[]> {
    const sources = await this.getSources();
    return sources.filter(s => s.enabled);
  }

  /**
   * 检查是否配置了Emby
   */
  async hasEmby(): Promise<boolean> {
    const sources = await this.getSources();
    return sources.some(s => s.enabled && s.ServerURL);
  }

  /**
   * 清除缓存的客户端实例
   */
  clearCache() {
    this.clients.clear();
  }
}

export const embyManager = EmbyManager.getInstance();

/**
 * 配置迁移函数：将旧格式配置迁移到新格�? */
export function migrateEmbyConfig(config: AdminConfig): AdminConfig {
  // 如果已经是新格式，直接返�?  if (config.EmbyConfig?.Sources) {
    return config;
  }

  // 如果是旧格式，迁移到新格�?  if (config.EmbyConfig && config.EmbyConfig.ServerURL) {
    const oldConfig = config.EmbyConfig;
    config.EmbyConfig = {
      Sources: [{
        key: 'default',
        name: 'Emby',
        enabled: oldConfig.Enabled ?? false,
        ServerURL: oldConfig.ServerURL || '',
        ApiKey: oldConfig.ApiKey,
        Username: oldConfig.Username,
        Password: oldConfig.Password,
        UserId: oldConfig.UserId,
        AuthToken: oldConfig.AuthToken,
        Libraries: oldConfig.Libraries,
        LastSyncTime: oldConfig.LastSyncTime,
        ItemCount: oldConfig.ItemCount,
        isDefault: true,
        // 高级选项默认�?        removeEmbyPrefix: false,
        appendMediaSourceId: false,
        transcodeMp4: false,
        proxyPlay: false,
      }],
    };
  }

  return config;
}
