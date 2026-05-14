/* eslint-disable @typescript-eslint/no-explicit-any, no-console, @typescript-eslint/no-non-null-assertion */

import { db } from '@/lib/db';

import { AdminConfig } from './admin.types';

const BUILTIN_DANMAKU_API_BASE = 'https://mtvpls-danmu.netlify.app/87654321';
const DEFAULT_LIVE_REFRESH_INTERVAL_HOURS = 12;

function normalizeLiveRefreshIntervalHours(refreshIntervalHours?: number): number {
  const normalizedInterval = Number(refreshIntervalHours);

  if (!Number.isFinite(normalizedInterval) || normalizedInterval <= 0) {
    return DEFAULT_LIVE_REFRESH_INTERVAL_HOURS;
  }

  return Math.floor(normalizedInterval);
}

export interface ApiSite {
  key: string;
  api: string;
  name: string;
  detail?: string;
  proxyMode?: boolean;
}

export interface LiveCfg {
  name: string;
  url: string;
  ua?: string;
  epg?: string; // 节目�?}

interface ConfigFileStruct {
  cache_time?: number;
  api_site?: {
    [key: string]: ApiSite;
  };
  custom_category?: {
    name?: string;
    type: 'movie' | 'tv';
    query: string;
  }[];
  lives?: {
    [key: string]: LiveCfg;
  }
}

export const API_CONFIG = {
  search: {
    path: '?ac=videolist&wd=',
    pagePath: '?ac=videolist&wd={query}&pg={page}',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  },
  detail: {
    path: '?ac=videolist&ids=',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  },
};

// 在模块加载时根据环境决定配置来源
let cachedConfig: AdminConfig;
let configInitPromise: Promise<AdminConfig> | null = null;


// 从配置文件补充管理员配置
export function refineConfig(adminConfig: AdminConfig): AdminConfig {
  let fileConfig: ConfigFileStruct;
  try {
    fileConfig = JSON.parse(adminConfig.ConfigFile) as ConfigFileStruct;
  } catch (e) {
    fileConfig = {} as ConfigFileStruct;
  }

  // 合并文件中的源信�?  const apiSitesFromFile = Object.entries(fileConfig.api_site || []);
  const currentApiSites = new Map(
    (adminConfig.SourceConfig || []).map((s) => [s.key, s])
  );

  apiSitesFromFile.forEach(([key, site]) => {
    const existingSource = currentApiSites.get(key);
    if (existingSource) {
      // 如果已存在，只覆�?name、api、detail �?from
      existingSource.name = site.name;
      existingSource.api = site.api;
      existingSource.detail = site.detail;
      existingSource.from = 'config';
    } else {
      // 如果不存在，创建新条�?      currentApiSites.set(key, {
        key,
        name: site.name,
        api: site.api,
        detail: site.detail,
        from: 'config',
        disabled: false,
      });
    }
  });

  // 检查现有源是否�?fileConfig.api_site 中，如果不在则标记为 custom
  const apiSitesFromFileKey = new Set(apiSitesFromFile.map(([key]) => key));
  currentApiSites.forEach((source) => {
    if (!apiSitesFromFileKey.has(source.key)) {
      source.from = 'custom';
    }
  });

  // �?Map 转换回数�?  adminConfig.SourceConfig = Array.from(currentApiSites.values());

  // 覆盖 CustomCategories
  const customCategoriesFromFile = fileConfig.custom_category || [];
  const currentCustomCategories = new Map(
    (adminConfig.CustomCategories || []).map((c) => [c.query + c.type, c])
  );

  customCategoriesFromFile.forEach((category) => {
    const key = category.query + category.type;
    const existedCategory = currentCustomCategories.get(key);
    if (existedCategory) {
      existedCategory.name = category.name;
      existedCategory.query = category.query;
      existedCategory.type = category.type;
      existedCategory.from = 'config';
    } else {
      currentCustomCategories.set(key, {
        name: category.name,
        type: category.type,
        query: category.query,
        from: 'config',
        disabled: false,
      });
    }
  });

  // 检查现�?CustomCategories 是否�?fileConfig.custom_category 中，如果不在则标记为 custom
  const customCategoriesFromFileKeys = new Set(
    customCategoriesFromFile.map((c) => c.query + c.type)
  );
  currentCustomCategories.forEach((category) => {
    if (!customCategoriesFromFileKeys.has(category.query + category.type)) {
      category.from = 'custom';
    }
  });

  // �?Map 转换回数�?  adminConfig.CustomCategories = Array.from(currentCustomCategories.values());

  const livesFromFile = Object.entries(fileConfig.lives || []);
  const currentLives = new Map(
    (adminConfig.LiveConfig || []).map((l) => [l.key, l])
  );
  livesFromFile.forEach(([key, site]) => {
    const existingLive = currentLives.get(key);
    if (existingLive) {
      existingLive.name = site.name;
      existingLive.url = site.url;
      existingLive.ua = site.ua;
      existingLive.epg = site.epg;
    } else {
      // 如果不存在，创建新条�?      currentLives.set(key, {
        key,
        name: site.name,
        url: site.url,
        ua: site.ua,
        epg: site.epg,
        channelNumber: 0,
        from: 'config',
        disabled: false,
      });
    }
  });

  // 检查现�?LiveConfig 是否�?fileConfig.lives 中，如果不在则标记为 custom
  const livesFromFileKeys = new Set(livesFromFile.map(([key]) => key));
  currentLives.forEach((live) => {
    if (!livesFromFileKeys.has(live.key)) {
      live.from = 'custom';
    }
  });

  // �?Map 转换回数�?  adminConfig.LiveConfig = Array.from(currentLives.values());

  return adminConfig;
}

async function getInitConfig(configFile: string, subConfig: {
  URL: string;
  AutoUpdate: boolean;
  LastCheck: string;
} = {
    URL: "",
    AutoUpdate: false,
    LastCheck: "",
  }): Promise<AdminConfig> {
  let cfgFile: ConfigFileStruct;

  // 优先从环境变量读取订�?URL
  const envSubUrl = process.env.CONFIG_SUBSCRIPTION_URL || "";

  if (envSubUrl) {
    try {
      const response = await fetch(envSubUrl);
      if (response.ok) {
        const configContent = await response.text();
        const bs58 = (await import('bs58')).default;
        const decodedBytes = bs58.decode(configContent);
        const decodedContent = new TextDecoder().decode(decodedBytes);
        configFile = decodedContent;
        console.log('已从订阅 URL 获取配置');
      }
    } catch (e) {
      console.error('从订�?URL 获取配置失败:', e);
    }
  }

  // 优先从环境变量读取配�?  const envConfig = process.env.INIT_CONFIG || "";
  const configSource = envConfig || configFile;

  try {
    cfgFile = JSON.parse(configSource) as ConfigFileStruct;
  } catch (e) {
    cfgFile = {} as ConfigFileStruct;
  }
  const hasCustomDanmakuEnv = Boolean(
    process.env.DANMAKU_API_BASE || process.env.DANMAKU_API_TOKEN
  );
  const adminConfig: AdminConfig = {
    ConfigFile: configSource,
    ConfigSubscribtion: subConfig,
    SiteConfig: {
      SiteName: process.env.NEXT_PUBLIC_SITE_NAME || 'KuroTVPlus',
      Announcement:
        process.env.ANNOUNCEMENT ||
        '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责�?,
      SearchDownstreamMaxPage:
        Number(process.env.NEXT_PUBLIC_SEARCH_MAX_PAGE) || 5,
      SiteInterfaceCacheTime: cfgFile.cache_time || 7200,
      DoubanProxyType:
        process.env.NEXT_PUBLIC_DOUBAN_PROXY_TYPE || 'cmliussss-cdn-tencent',
      DoubanProxy: process.env.NEXT_PUBLIC_DOUBAN_PROXY || '',
      DoubanImageProxyType:
        process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE || 'cmliussss-cdn-tencent',
      DoubanImageProxy: process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY || '',
      DisableYellowFilter:
        process.env.NEXT_PUBLIC_DISABLE_YELLOW_FILTER === 'true',
      FluidSearch:
        process.env.NEXT_PUBLIC_FLUID_SEARCH !== 'false',
      // 弹幕配置
      DanmakuSourceType: hasCustomDanmakuEnv ? 'custom' : 'builtin',
      DanmakuApiBase:
        process.env.DANMAKU_API_BASE ||
        (hasCustomDanmakuEnv ? 'http://localhost:9321' : BUILTIN_DANMAKU_API_BASE),
      DanmakuApiToken: process.env.DANMAKU_API_TOKEN || '87654321',
      DanmakuAutoLoadDefault: true,
      // TMDB配置
      TMDBApiKey: process.env.TMDB_API_KEY || '',
      TMDBProxy: process.env.TMDB_PROXY || '',
      TMDBReverseProxy: process.env.TMDB_REVERSE_PROXY || '',
      // Pansou配置
      PansouApiUrl: '',
      PansouUsername: '',
      PansouPassword: '',
      PansouKeywordBlocklist: '',
      // 磁链配置
      MagnetProxy: '',
      MagnetMikanReverseProxy: '',
      MagnetDmhyReverseProxy: '',
      MagnetAcgripReverseProxy: '',
      // 评论功能开�?      EnableComments: false,
      EnableRegistration: false,
      RequireRegistrationInviteCode: false,
      RegistrationInviteCode: '',
      RegistrationRequireTurnstile: false,
      LoginRequireTurnstile: false,
      TurnstileSiteKey: '',
      TurnstileSecretKey: '',
      DefaultUserTags: [],
    },
    UserConfig: {
      Users: [],
    },
    SourceConfig: [],
    CustomCategories: [],
    LiveConfig: [],
  };

  // 用户信息已迁移到新版数据库，不再填充 UserConfig.Users
  // 保持为空数组，避免与新版用户系统冲突
  adminConfig.UserConfig.Users = [];

  // 从配置文件中补充源信�?  Object.entries(cfgFile.api_site || []).forEach(([key, site]) => {
    adminConfig.SourceConfig.push({
      key: key,
      name: site.name,
      api: site.api,
      detail: site.detail,
      from: 'config',
      disabled: false,
    });
  });

  // 从配置文件中补充自定义分类信�?  cfgFile.custom_category?.forEach((category) => {
    adminConfig.CustomCategories.push({
      name: category.name || category.query,
      type: category.type,
      query: category.query,
      from: 'config',
      disabled: false,
    });
  });

  // 从配置文件中补充直播源信�?  Object.entries(cfgFile.lives || []).forEach(([key, live]) => {
    if (!adminConfig.LiveConfig) {
      adminConfig.LiveConfig = [];
    }
    adminConfig.LiveConfig.push({
      key,
      name: live.name,
      url: live.url,
      ua: live.ua,
      epg: live.epg,
      channelNumber: 0,
      from: 'config',
      disabled: false,
    });
  });

  return adminConfig;
}

export async function getConfig(): Promise<AdminConfig> {
  // 直接使用内存缓存
  if (cachedConfig) {
    return cachedConfig;
  }

  // 如果正在初始化，等待初始化完�?  if (configInitPromise) {
    return configInitPromise;
  }

  // 创建初始�?Promise
  configInitPromise = (async () => {
    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

    // localStorage 模式下直接从环境变量初始�?    if (storageType === 'localstorage') {
      console.log('localStorage 模式：从环境变量初始化配�?);
      const adminConfig = await getInitConfig("");
      cachedConfig = configSelfCheck(adminConfig);
      configInitPromise = null;
      return cachedConfig;
    }

    // �?db
    let adminConfig: AdminConfig | null = null;
    let dbReadFailed = false;
    try {
      adminConfig = await db.getAdminConfig();
    } catch (e) {
      console.error('获取管理员配置失�?', e);
      dbReadFailed = true;
    }

    // db 中无配置，执行一次初始化
    if (!adminConfig) {
      if (dbReadFailed) {
        // 数据库读取失败，使用默认配置但不保存，避免覆盖数据库
        console.warn('数据库读取失败，使用临时默认配置（不会保存到数据库）');
        adminConfig = await getInitConfig("");
      } else {
        // 数据库中确实没有配置，首次初始化并保�?        console.log('首次初始化配�?);
        adminConfig = await getInitConfig("");
        await db.saveAdminConfig(adminConfig);
      }
    }

    // 检查是否有旧格式Emby配置需要迁�?    const needsEmbyMigration = adminConfig.EmbyConfig &&
                                adminConfig.EmbyConfig.ServerURL &&
                                !adminConfig.EmbyConfig.Sources;

    adminConfig = configSelfCheck(adminConfig);
    cachedConfig = adminConfig;

    // 如果进行了Emby配置迁移，保存到数据�?    if (!dbReadFailed && needsEmbyMigration) {
      try {
        await db.saveAdminConfig(adminConfig);
        console.log('[Config] Emby配置迁移已保存到数据�?);
      } catch (error) {
        console.error('[Config] 保存迁移后的配置失败:', error);
      }
    }

    // 自动迁移用户（如果配置中有用户且V2存储支持�?    // 过滤掉站长后检查是否有需要迁移的用户
    const nonOwnerUsers = adminConfig.UserConfig.Users.filter(
      (u) => u.username !== process.env.USERNAME
    );
    if (!dbReadFailed && nonOwnerUsers.length > 0) {
      try {
        // 检查是否支持V2存储
        const storage = (db as any).storage;
        if (storage && typeof storage.createUserV2 === 'function') {
          console.log('检测到配置中有用户，开始自动迁�?..');
          await db.migrateUsersFromConfig(adminConfig);
          // 迁移完成后，清空配置中的用户列表并保�?          adminConfig.UserConfig.Users = [];
          await db.saveAdminConfig(adminConfig);
          cachedConfig = adminConfig;
          console.log('用户自动迁移完成');
        }
      } catch (error) {
        console.error('自动迁移用户失败:', error);
        // 不影响主流程，继续执�?      }
    }

    // 清除初始�?Promise
    configInitPromise = null;
    return cachedConfig;
  })();

  return configInitPromise;
}

export function configSelfCheck(adminConfig: AdminConfig): AdminConfig {
  // 确保必要的属性存在和初始�?  if (!adminConfig.SiteConfig) {
    adminConfig.SiteConfig = {
      SiteName: 'KuroTVPlus',
      Announcement: '',
      SearchDownstreamMaxPage: 5,
      SiteInterfaceCacheTime: 7200,
      DoubanProxyType: 'cmliussss-cdn-tencent',
      DoubanProxy: '',
      DoubanImageProxyType: 'cmliussss-cdn-tencent',
      DoubanImageProxy: '',
      DisableYellowFilter: false,
      FluidSearch: true,
      DanmakuSourceType: 'builtin',
      DanmakuApiBase: BUILTIN_DANMAKU_API_BASE,
      DanmakuApiToken: '87654321',
      DanmakuAutoLoadDefault: true,
      PansouApiUrl: '',
      PansouUsername: '',
      PansouPassword: '',
      PansouKeywordBlocklist: '',
      MagnetProxy: '',
      MagnetMikanReverseProxy: '',
      MagnetDmhyReverseProxy: '',
      MagnetAcgripReverseProxy: '',
      EnableComments: false,
      EnableRegistration: false,
      RequireRegistrationInviteCode: false,
      RegistrationInviteCode: '',
      RegistrationRequireTurnstile: false,
      LoginRequireTurnstile: false,
      TurnstileSiteKey: '',
      TurnstileSecretKey: '',
      DefaultUserTags: [],
    };
  }
  // 确保弹幕配置存在
  if (adminConfig.SiteConfig.DanmakuSourceType === undefined) {
    adminConfig.SiteConfig.DanmakuSourceType = 'custom';
  }
  if (!adminConfig.SiteConfig.DanmakuApiBase) {
    adminConfig.SiteConfig.DanmakuApiBase =
      adminConfig.SiteConfig.DanmakuSourceType === 'builtin'
        ? BUILTIN_DANMAKU_API_BASE
        : 'http://localhost:9321';
  }
  if (!adminConfig.SiteConfig.DanmakuApiToken) {
    adminConfig.SiteConfig.DanmakuApiToken = '87654321';
  }
  if (adminConfig.SiteConfig.DanmakuAutoLoadDefault === undefined) {
    adminConfig.SiteConfig.DanmakuAutoLoadDefault = true;
  }
  // 确保评论开关存�?  if (adminConfig.SiteConfig.EnableComments === undefined) {
    adminConfig.SiteConfig.EnableComments = false;
  }
  if (adminConfig.SiteConfig.EnableRegistration === undefined) {
    adminConfig.SiteConfig.EnableRegistration = false;
  }
  if (adminConfig.SiteConfig.RequireRegistrationInviteCode === undefined) {
    adminConfig.SiteConfig.RequireRegistrationInviteCode = false;
  }
  if (adminConfig.SiteConfig.RegistrationInviteCode === undefined) {
    adminConfig.SiteConfig.RegistrationInviteCode = '';
  }
  if (adminConfig.SiteConfig.RegistrationRequireTurnstile === undefined) {
    adminConfig.SiteConfig.RegistrationRequireTurnstile = false;
  }
  if (adminConfig.SiteConfig.LoginRequireTurnstile === undefined) {
    adminConfig.SiteConfig.LoginRequireTurnstile = false;
  }
  if (adminConfig.SiteConfig.TurnstileSiteKey === undefined) {
    adminConfig.SiteConfig.TurnstileSiteKey = '';
  }
  if (adminConfig.SiteConfig.TurnstileSecretKey === undefined) {
    adminConfig.SiteConfig.TurnstileSecretKey = '';
  }
  if (adminConfig.SiteConfig.DefaultUserTags === undefined) {
    adminConfig.SiteConfig.DefaultUserTags = [];
  }
  if (adminConfig.SiteConfig.PansouKeywordBlocklist === undefined) {
    adminConfig.SiteConfig.PansouKeywordBlocklist = '';
  }
  if (adminConfig.SiteConfig.MagnetProxy === undefined) {
    adminConfig.SiteConfig.MagnetProxy = '';
  }
  if (adminConfig.SiteConfig.MagnetMikanReverseProxy === undefined) {
    adminConfig.SiteConfig.MagnetMikanReverseProxy = '';
  }
  if (adminConfig.SiteConfig.MagnetDmhyReverseProxy === undefined) {
    adminConfig.SiteConfig.MagnetDmhyReverseProxy = '';
  }
  if (adminConfig.SiteConfig.MagnetAcgripReverseProxy === undefined) {
    adminConfig.SiteConfig.MagnetAcgripReverseProxy = '';
  }
  if (!adminConfig.UserConfig) {
    adminConfig.UserConfig = { Users: [] };
  }
  if (!adminConfig.UserConfig.Users || !Array.isArray(adminConfig.UserConfig.Users)) {
    adminConfig.UserConfig.Users = [];
  }
  if (!adminConfig.SourceConfig || !Array.isArray(adminConfig.SourceConfig)) {
    adminConfig.SourceConfig = [];
  }
  if (!adminConfig.CustomCategories || !Array.isArray(adminConfig.CustomCategories)) {
    adminConfig.CustomCategories = [];
  }
  if (!adminConfig.LiveConfig || !Array.isArray(adminConfig.LiveConfig)) {
    adminConfig.LiveConfig = [];
  }
  adminConfig.LiveRefreshIntervalHours = normalizeLiveRefreshIntervalHours(adminConfig.LiveRefreshIntervalHours);

  // 用户信息已迁移到新版数据�?  // 这里只保留站长用户用于兼容性，其他用户从数据库读取
  const ownerUser = process.env.USERNAME;
  adminConfig.UserConfig.Users = [{
    username: ownerUser!,
    role: 'owner',
    banned: false,
  }];

  // 采集源去�?  const seenSourceKeys = new Set<string>();
  adminConfig.SourceConfig = adminConfig.SourceConfig.filter((source) => {
    if (seenSourceKeys.has(source.key)) {
      return false;
    }
    seenSourceKeys.add(source.key);
    return true;
  });

  // 自定义分类去�?  const seenCustomCategoryKeys = new Set<string>();
  adminConfig.CustomCategories = adminConfig.CustomCategories.filter((category) => {
    if (seenCustomCategoryKeys.has(category.query + category.type)) {
      return false;
    }
    seenCustomCategoryKeys.add(category.query + category.type);
    return true;
  });

  // 直播源去�?  const seenLiveKeys = new Set<string>();
  adminConfig.LiveConfig = adminConfig.LiveConfig.filter((live) => {
    if (seenLiveKeys.has(live.key)) {
      return false;
    }
    seenLiveKeys.add(live.key);
    return true;
  });

  // Emby配置迁移：将旧格式迁移到新格�?  if (adminConfig.EmbyConfig) {
    // 如果是旧格式（有ServerURL但没有Sources�?    if (adminConfig.EmbyConfig.ServerURL && !adminConfig.EmbyConfig.Sources) {
      console.log('[Config] 检测到旧格式Emby配置，自动迁移到新格�?);
      const oldConfig = adminConfig.EmbyConfig;
      adminConfig.EmbyConfig = {
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
        }],
      };
    }

    // Emby源去�?    if (adminConfig.EmbyConfig?.Sources) {
      const seenEmbyKeys = new Set<string>();
      adminConfig.EmbyConfig.Sources = adminConfig.EmbyConfig.Sources.filter((source) => {
        if (seenEmbyKeys.has(source.key)) {
          return false;
        }
        seenEmbyKeys.add(source.key);
        return true;
      });
    }
  }

  if (!adminConfig.SuwayomiConfig) {
    adminConfig.SuwayomiConfig = {
      Enabled: process.env.SUWAYOMI_ENABLED === 'true',
      ServerURL: process.env.SUWAYOMI_URL || process.env.NEXT_PUBLIC_SUWAYOMI_URL || '',
      AuthMode: (process.env.SUWAYOMI_AUTH_MODE as 'none' | 'basic_auth' | 'simple_login' | undefined) || 'none',
      Username: process.env.SUWAYOMI_USERNAME || '',
      Password: process.env.SUWAYOMI_PASSWORD || '',
      DefaultLang: process.env.SUWAYOMI_DEFAULT_LANG || 'zh',
      SourceIds: [],
      MaxSources: Number(process.env.SUWAYOMI_MAX_SOURCES || 10),
    };
  }
  if (adminConfig.SuwayomiConfig.Enabled === undefined) {
    adminConfig.SuwayomiConfig.Enabled = false;
  }
  if (adminConfig.SuwayomiConfig.ServerURL === undefined) {
    adminConfig.SuwayomiConfig.ServerURL = '';
  }
  if (
    adminConfig.SuwayomiConfig.AuthMode !== 'basic_auth' &&
    adminConfig.SuwayomiConfig.AuthMode !== 'simple_login'
  ) {
    adminConfig.SuwayomiConfig.AuthMode = 'none';
  }
  if (adminConfig.SuwayomiConfig.Username === undefined) {
    adminConfig.SuwayomiConfig.Username = '';
  }
  if (adminConfig.SuwayomiConfig.Password === undefined) {
    adminConfig.SuwayomiConfig.Password = '';
  }
  if (adminConfig.SuwayomiConfig.DefaultLang === undefined) {
    adminConfig.SuwayomiConfig.DefaultLang = 'zh';
  }
  if (!Array.isArray(adminConfig.SuwayomiConfig.SourceIds)) {
    adminConfig.SuwayomiConfig.SourceIds = [];
  }
  if (adminConfig.SuwayomiConfig.MaxSources === undefined || Number.isNaN(adminConfig.SuwayomiConfig.MaxSources)) {
    adminConfig.SuwayomiConfig.MaxSources = 10;
  }

  if (!adminConfig.OPDSConfig) {
    adminConfig.OPDSConfig = {
      Enabled: process.env.OPDS_ENABLED === 'true',
      Sources: (() => {
        const json = process.env.OPDS_SOURCES_JSON;
        if (json) {
          try {
            const parsed = JSON.parse(json);
            if (Array.isArray(parsed)) return parsed;
          } catch {
            // ignore invalid env json
          }
        }

        const envUrl = process.env.OPDS_URL || process.env.NEXT_PUBLIC_OPDS_URL;
        if (!envUrl) return [];

        return [{
          id: 'default',
          name: process.env.OPDS_NAME || '默认书源',
          url: envUrl,
          enabled: true,
          authMode: (process.env.OPDS_AUTH_MODE as 'none' | 'basic' | 'header' | undefined) || 'none',
          username: process.env.OPDS_USERNAME || '',
          password: process.env.OPDS_PASSWORD || '',
          headerName: process.env.OPDS_HEADER_NAME || '',
          headerValue: process.env.OPDS_HEADER_VALUE || '',
          searchTemplate: process.env.OPDS_SEARCH_TEMPLATE || '',
        }];
      })(),
      CacheTTL: Number(process.env.OPDS_CACHE_TTL_MS || 10 * 60 * 1000),
    };
  }
  if (adminConfig.OPDSConfig.Enabled === undefined) {
    adminConfig.OPDSConfig.Enabled = false;
  }
  if (!Array.isArray(adminConfig.OPDSConfig.Sources)) {
    adminConfig.OPDSConfig.Sources = [];
  }
  if (adminConfig.OPDSConfig.CacheTTL === undefined || Number.isNaN(adminConfig.OPDSConfig.CacheTTL)) {
    adminConfig.OPDSConfig.CacheTTL = Number(process.env.OPDS_CACHE_TTL_MS || 10 * 60 * 1000);
  }

  if (!adminConfig.NetDiskConfig) {
    adminConfig.NetDiskConfig = {
      Quark: {
        Enabled: false,
        Cookie: '',
        SavePath: '/',
      },
      Mobile: {
        Enabled: false,
        Authorization: '',
      },
      Baidu: {
        Enabled: false,
        Cookie: '',
      },
      Tianyi: {
        Enabled: false,
        Account: '',
        Password: '',
      },
      Pan123: {
        Enabled: false,
        Account: '',
        Password: '',
      },
      UC: {
        Enabled: false,
        Cookie: '',
        Token: '',
        SavePath: '/',
      },
      Pan115: {
        Enabled: false,
        Cookie: '',
      },
    };
  }

  if (!adminConfig.NetDiskConfig.Quark) {
    adminConfig.NetDiskConfig.Quark = {
      Enabled: false,
      Cookie: '',
      SavePath: '/',
    };
  }

  if (!adminConfig.NetDiskConfig.Mobile) {
    adminConfig.NetDiskConfig.Mobile = {
      Enabled: false,
      Authorization: '',
    };
  }

  if (!adminConfig.NetDiskConfig.Baidu) {
    adminConfig.NetDiskConfig.Baidu = {
      Enabled: false,
      Cookie: '',
    };
  }

  if (!adminConfig.NetDiskConfig.Tianyi) {
    adminConfig.NetDiskConfig.Tianyi = {
      Enabled: false,
      Account: '',
      Password: '',
    };
  }

  if (!adminConfig.NetDiskConfig.Pan123) {
    adminConfig.NetDiskConfig.Pan123 = {
      Enabled: false,
      Account: '',
      Password: '',
    };
  }

  if (!adminConfig.NetDiskConfig.UC) {
    adminConfig.NetDiskConfig.UC = {
      Enabled: false,
      Cookie: '',
      Token: '',
      SavePath: '/',
    };
  }

  if (!adminConfig.NetDiskConfig.Pan115) {
    adminConfig.NetDiskConfig.Pan115 = {
      Enabled: false,
      Cookie: '',
    };
  }

  // 确保音乐配置存在
  if (!adminConfig.MusicConfig) {
    adminConfig.MusicConfig = {
      Enabled: false,
      BaseUrl: '',
      Token: '',
      ProxyEnabled: true,
    };
  } else if (adminConfig.MusicConfig.ProxyEnabled === undefined) {
    adminConfig.MusicConfig.ProxyEnabled = true;
  }

  if (!adminConfig.OPDSConfig) {
    adminConfig.OPDSConfig = {
      Enabled: false,
      Sources: [],
      CacheTTL: 10 * 60 * 1000,
    };
  } else {
    if (adminConfig.OPDSConfig.CacheTTL === undefined) {
      adminConfig.OPDSConfig.CacheTTL = 10 * 60 * 1000;
    }
  }

  return adminConfig;
}

export async function resetConfig() {
  let originConfig: AdminConfig | null = null;
  try {
    originConfig = await db.getAdminConfig();
  } catch (e) {
    console.error('获取管理员配置失�?', e);
  }
  if (!originConfig) {
    originConfig = {} as AdminConfig;
  }
  const adminConfig = await getInitConfig(originConfig.ConfigFile, originConfig.ConfigSubscribtion);
  cachedConfig = adminConfig;
  await db.saveAdminConfig(adminConfig);

  return;
}

export async function getCacheTime(): Promise<number> {
  const config = await getConfig();
  return config.SiteConfig.SiteInterfaceCacheTime || 7200;
}

export async function getAvailableApiSites(user?: string): Promise<ApiSite[]> {
  const config = await getConfig();
  const allApiSites = config.SourceConfig.filter((s) => !s.disabled);

  if (!user) {
    return allApiSites;
  }

  // localStorage 模式下直接返回所有可用源
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return allApiSites;
  }

  // 从V2存储中获取用户信�?  const userInfoV2 = await db.getUserInfoV2(user);
  if (!userInfoV2) {
    return allApiSites;
  }

  // 优先根据用户自己�?enabledApis 配置查找
  if (userInfoV2.enabledApis && userInfoV2.enabledApis.length > 0) {
    const userApiSitesSet = new Set(userInfoV2.enabledApis);
    return allApiSites.filter((s) => userApiSitesSet.has(s.key)).map((s) => ({
      key: s.key,
      name: s.name,
      api: s.api,
      detail: s.detail,
      proxyMode: s.proxyMode,
    }));
  }

  // 如果没有 enabledApis 配置，则根据 tags 查找
  if (userInfoV2.tags && userInfoV2.tags.length > 0 && config.UserConfig.Tags) {
    const enabledApisFromTags = new Set<string>();

    // 遍历用户的所�?tags，收集对应的 enabledApis
    userInfoV2.tags.forEach(tagName => {
      const tagConfig = config.UserConfig.Tags?.find(t => t.name === tagName);
      if (tagConfig && tagConfig.enabledApis) {
        tagConfig.enabledApis.forEach(apiKey => enabledApisFromTags.add(apiKey));
      }
    });

    if (enabledApisFromTags.size > 0) {
      return allApiSites.filter((s) => enabledApisFromTags.has(s.key)).map((s) => ({
        key: s.key,
        name: s.name,
        api: s.api,
        detail: s.detail,
        proxyMode: s.proxyMode,
      }));
    }
  }

  // 如果都没有配置，返回所有可用的 API 站点
  return allApiSites;
}

export async function setCachedConfig(config: AdminConfig) {
  cachedConfig = config;
}

export async function clearConfigCache() {
  cachedConfig = null as any;
  configInitPromise = null;
}
