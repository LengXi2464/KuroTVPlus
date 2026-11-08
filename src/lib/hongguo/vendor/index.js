'use strict';
/**
 * hongguo-web 直连链路适配层（服务端专用）。
 *
 * 在加载 vendor 模块之前完成两件事：
 *  1. HONGGUO_CONFIG 指向项目根的 hongguo.config.json（上游 base_query/请求头）；
 *  2. HONGGUO_DEVICE_ID 给一个本进程稳定的 16 位设备号（列表/搜索接口必需，
 *     避免 vendor 的 keystore 落盘；播放走 playback-device 的匿名注册，进程内存态）。
 *
 * 用法（仅在 node runtime 的 API 路由里调用）：
 *   const direct = require('@/lib/hongguo/vendor');
 *   const pg = await direct.search('关键词', 40, 0);
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * 与项目根 hongguo.config.json 内容一致的内嵌配置。
 * 部署到 serverless（Next 打包不会带上根目录的 JSON）时通过
 * HONGGUO_CONFIG_JSON 注入，全链路不依赖磁盘文件。
 */
const EMBEDDED_CONFIG = {
  upstream: {
    api_host: 'api5-normal-sinfonlinea.fqnovel.com',
    base_query: {
      aid: '8662',
      app_name: 'novelread',
      version_code: '72232',
      version_name: '7.2.2.32',
      channel: 'audit',
      device_platform: 'android',
      device_type: 'audit-windows',
      os_version: '12',
      update_version_code: '72232',
    },
    session_headers: {
      'user-agent': 'hongguo-web/1.0',
      'x-tt-store-region': 'cn-sh',
      'x-tt-store-region-src': 'uid',
      'passport-sdk-version': '5051452',
      'sdk-version': '2',
    },
  },
};

function hasFile(p) {
  try {
    return !!p && fs.existsSync(p);
  } catch (e) {
    return false;
  }
}

function ensureEnv() {
  const cwdConfig = path.join(process.cwd(), 'hongguo.config.json');
  if (hasFile(cwdConfig)) {
    if (!process.env.HONGGUO_CONFIG) process.env.HONGGUO_CONFIG = cwdConfig;
  } else if (!hasFile(process.env.HONGGUO_CONFIG)
    && !process.env.HONGGUO_CONFIG_JSON) {
    process.env.HONGGUO_CONFIG_JSON = JSON.stringify(EMBEDDED_CONFIG);
  }
  if (!process.env.HONGGUO_DEVICE_ID || !/^\d{10,20}$/.test(process.env.HONGGUO_DEVICE_ID)) {
    const n = crypto.randomBytes(8).readBigUInt64BE() % 9000000000000000n;
    process.env.HONGGUO_DEVICE_ID = String(n + 1000000000000000n);
  }
  // landpage（推荐/筛选）走签名后上游才返回数据；不签名会拿到空列表。
  if (!process.env.HG_SIGN_LIST) process.env.HG_SIGN_LIST = '1';
}

ensureEnv();

const Client = require('./service/client');
const AppSource = require('./service/app-source');
const Spade = require('./core/spade');

/** 搜索：返回 { items, hasMore, nextSkip }，items 为 parseSearchCell 结构。 */
async function search(query, limit, offset) {
  return Client.searchPage(query, limit || 0, offset || 0);
}

/** 剧集详情 + 分集：返回 { meta, episodes }。 */
async function detail(seriesId) {
  return Client.getEpisodes(String(seriesId));
}

/**
 * 推荐流（首页用）：按热度浏览短剧体裁，返回 { items, hasMore, nextSkip }。
 * items 结构与搜索一致（series_id/title/cover/episode_cnt/abstract…）。
 */
async function recommend(limit, skip) {
  return Client.browsePage('short_play', {
    sort: 'hot_score',
    limit: limit || 40,
  }, null, skip || 0);
}

/**
 * 取某集的一个清晰度直链。
 * quality: '' / '360' / '720' 等；返回 { url, codec, definition, size, contentKey, encrypt }。
 */
async function play(vid, quality) {
  const t = await AppSource.fetch(String(vid), quality || '');
  let contentKey = '';
  if (t.spadeA) {
    const r = Spade.spadeToKey(t.spadeA, 0);
    if (r && r.key) contentKey = r.key;
  }
  return {
    url: t.url,
    codec: t.codec,
    definition: t.definition,
    size: t.size,
    encrypt: !!t.encrypt,
    contentKey,
  };
}

module.exports = { search, detail, play, recommend };
