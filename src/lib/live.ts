/* eslint-disable no-constant-condition */

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

const defaultUA = 'AptvPlayer/1.4.10';

export const DEFAULT_LIVE_REFRESH_INTERVAL_HOURS = 12;

let lastGlobalLiveRefreshTime = 0;

export function getLiveRefreshIntervalHours(refreshIntervalHours?: number): number {
  const normalizedInterval = Number(refreshIntervalHours);

  if (!Number.isFinite(normalizedInterval) || normalizedInterval <= 0) {
    return DEFAULT_LIVE_REFRESH_INTERVAL_HOURS;
  }

  return Math.floor(normalizedInterval);
}

export function getLastGlobalLiveRefreshTime(): number {
  return lastGlobalLiveRefreshTime;
}

export function setLastGlobalLiveRefreshTime(timestamp: number): void {
  lastGlobalLiveRefreshTime = timestamp;
}

export interface LiveChannels {
  channelNumber: number;
  channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
  }[];
  epgUrl: string;
  epgs: {
    [key: string]: {
      start: string;
      end: string;
      title: string;
    }[];
  };
}

const cachedLiveChannels: { [key: string]: LiveChannels } = {};

export function deleteCachedLiveChannels(key: string) {
  delete cachedLiveChannels[key];
}

export async function getCachedLiveChannels(
  key: string
): Promise<LiveChannels | null> {
  if (!cachedLiveChannels[key]) {
    const config = await getConfig();
    const liveInfo = config.LiveConfig?.find((live) => live.key === key);
    if (!liveInfo) {
      return null;
    }
    const channelNum = await refreshLiveChannels(liveInfo);
    if (channelNum === 0) {
      return null;
    }
    liveInfo.channelNumber = channelNum;
    await db.saveAdminConfig(config);
  }
  return cachedLiveChannels[key] || null;
}

export async function refreshLiveChannels(liveInfo: {
  key: string;
  name: string;
  url: string;
  ua?: string;
  epg?: string;
  from: 'config' | 'custom';
  channelNumber?: number;
  disabled?: boolean;
}): Promise<number> {
  if (cachedLiveChannels[liveInfo.key]) {
    delete cachedLiveChannels[liveInfo.key];
  }
  const ua = liveInfo.ua || defaultUA;
  const response = await fetch(liveInfo.url, {
    headers: {
      'User-Agent': ua,
    },
  });
  const data = await response.text();
  const result = isM3UContent(data)
    ? parseM3U(liveInfo.key, data)
    : parseTxtLive(liveInfo.key, data);
  const epgUrl = liveInfo.epg || result.tvgUrl;
  const tvgIds = result.channels
    .map((channel) => channel.tvgId)
    .filter((tvgId) => tvgId);
  const epgs = await parseEpg(epgUrl, liveInfo.ua || defaultUA, tvgIds);
  cachedLiveChannels[liveInfo.key] = {
    channelNumber: result.channels.length,
    channels: result.channels,
    epgUrl: epgUrl,
    epgs: epgs,
  };
  return result.channels.length;
}

async function parseEpg(
  epgUrl: string,
  ua: string,
  tvgIds: string[]
): Promise<{
  [key: string]: {
    start: string;
    end: string;
    title: string;
  }[];
}> {
  if (!epgUrl) {
    return {};
  }

  const tvgs = new Set(tvgIds);
  const result: {
    [key: string]: { start: string; end: string; title: string }[];
  } = {};

  try {
    const response = await fetch(epgUrl, {
      headers: {
        'User-Agent': ua,
      },
    });
    if (!response.ok) {
      return {};
    }

    // 检查是否是 gzip 压缩文件
    const isGzip =
      epgUrl.endsWith('.gz') ||
      response.headers.get('content-encoding') === 'gzip';

    // 使用 ReadableStream 逐行处理，避免将整个文件加载到内�?    let reader;

    // 如果�?gzip 压缩，需要先解压
    if (isGzip && typeof DecompressionStream !== 'undefined') {
      // 浏览器环境或支持 DecompressionStream 的环�?      if (!response.body) {
        return {};
      }
      const decompressedStream = response.body.pipeThrough(
        new DecompressionStream('gzip')
      );
      reader = decompressedStream.getReader();
    } else if (isGzip) {
      // Node.js 环境，使�?zlib
      reader = response.body?.getReader();
      if (!reader) {
        return {};
      }
      // 需要将整个响应读取后再解压（因�?zlib 不支持流�?ReadableStream�?      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // 合并所�?chunks
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const allChunks = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        allChunks.set(chunk, offset);
        offset += chunk.length;
      }

      // 使用 zlib 解压
      const zlib = await import('zlib');
      const decompressed = zlib.gunzipSync(Buffer.from(allChunks));

      // 创建一个新�?ReadableStream 从解压后的数�?      const decompressedText = decompressed.toString('utf-8');
      const lines = decompressedText.split('\n');

      // 直接处理解压后的文本
      return parseEpgLines(lines, tvgs);
    } else {
      // 非压缩文�?      reader = response.body?.getReader();
      if (!reader) {
        return {};
      }
    }

    const decoder = new TextDecoder();
    let buffer = '';
    // 频道ID映射：数字ID -> 频道名称
    const channelIdMap: { [key: string]: string } = {};
    let currentChannelId = '';
    let currentTvgId = '';
    let currentProgram: { start: string; end: string; title: string } | null =
      null;
    let shouldSkipCurrentProgram = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // 保留最后一行（可能不完整）
      buffer = lines.pop() || '';

      // 处理完整的行
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // 解析 <channel> 标签，建立ID映射
        if (trimmedLine.startsWith('<channel id=')) {
          const channelIdMatch = trimmedLine.match(/id="([^"]*)"/);
          currentChannelId = channelIdMatch ? channelIdMatch[1] : '';
        }
        // 解析 <display-name> 标签，获取频道名�?        if (trimmedLine.includes('<display-name') && currentChannelId) {
          const displayNameMatch = trimmedLine.match(
            /<display-name(?:\s+[^>]*)?>(.*?)<\/display-name>/
          );
          if (displayNameMatch) {
            const displayName = displayNameMatch[1];
            channelIdMap[currentChannelId] = displayName;
            currentChannelId = '';
          }
        }
        // 解析 <programme> 标签（注意：不使�?else if，因为可能和 </programme> 在同一行）
        if (trimmedLine.includes('<programme')) {
          // 提取频道ID
          const channelIdMatch = trimmedLine.match(/channel="([^"]*)"/);
          const channelId = channelIdMatch ? channelIdMatch[1] : '';

          // 通过映射获取频道名称，如果映射不存在则直接使用channelId
          // 这样可以同时支持两种格式�?          // 1. channel="1" 需要映射到 "CCTV1"
          // 2. channel="CCTV1" 直接使用
          currentTvgId = channelIdMap[channelId] || channelId;

          // 提取开始时�?          const startMatch = trimmedLine.match(/start="([^"]*)"/);
          const start = startMatch ? startMatch[1] : '';

          // 提取结束时间
          const endMatch = trimmedLine.match(/stop="([^"]*)"/);
          const end = endMatch ? endMatch[1] : '';

          if (currentTvgId && start && end) {
            currentProgram = { start, end, title: '' };
            // 优化：如果当前频道不在我们关注的列表中，标记为跳�?            shouldSkipCurrentProgram = !tvgs.has(currentTvgId);
          }
        }
        // 解析 <title> 标签 - 只有在需要解析当前节目时才处�?        if (
          trimmedLine.includes('<title') &&
          currentProgram &&
          !shouldSkipCurrentProgram
        ) {
          // 处理带有语言属性的title标签，如 <title lang="zh">远方的家2025-60</title>
          const titleMatch = trimmedLine.match(
            /<title(?:\s+[^>]*)?>(.*?)<\/title>/
          );
          if (titleMatch && currentProgram) {
            currentProgram.title = titleMatch[1];

            // 保存节目信息（这里不需要再检查tvgs.has，因为shouldSkipCurrentProgram已经确保了相关性）
            if (!result[currentTvgId]) {
              result[currentTvgId] = [];
            }
            result[currentTvgId].push({ ...currentProgram });

            currentProgram = null;
          }
        }
      }
    }
  } catch (error) {
    // ignore
  }

  return result;
}

// 辅助函数：解�?EPG �?function parseEpgLines(
  lines: string[],
  tvgs: Set<string>
): {
  [key: string]: {
    start: string;
    end: string;
    title: string;
  }[];
} {
  const result: {
    [key: string]: { start: string; end: string; title: string }[];
  } = {};
  // 频道ID映射：数字ID -> 频道名称
  const channelIdMap: { [key: string]: string } = {};
  let currentChannelId = '';
  let currentTvgId = '';
  let currentProgram: { start: string; end: string; title: string } | null =
    null;
  let shouldSkipCurrentProgram = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // 解析 <channel> 标签，建立ID映射
    if (trimmedLine.startsWith('<channel id=')) {
      const channelIdMatch = trimmedLine.match(/id="([^"]*)"/);
      currentChannelId = channelIdMatch ? channelIdMatch[1] : '';
    }
    // 解析 <display-name> 标签，获取频道名�?    if (trimmedLine.includes('<display-name') && currentChannelId) {
      const displayNameMatch = trimmedLine.match(
        /<display-name(?:\s+[^>]*)?>(.*?)<\/display-name>/
      );
      if (displayNameMatch) {
        const displayName = displayNameMatch[1];
        channelIdMap[currentChannelId] = displayName;
        currentChannelId = '';
      }
    }
    // 解析 <programme> 标签（注意：不使�?else if，因为可能和 </programme> 在同一行）
    if (trimmedLine.includes('<programme')) {
      // 提取频道ID
      const channelIdMatch = trimmedLine.match(/channel="([^"]*)"/);
      const channelId = channelIdMatch ? channelIdMatch[1] : '';

      // 通过映射获取频道名称，如果映射不存在则直接使用channelId
      // 这样可以同时支持两种格式�?      // 1. channel="1" 需要映射到 "CCTV1"
      // 2. channel="CCTV1" 直接使用
      currentTvgId = channelIdMap[channelId] || channelId;

      // 提取开始时�?      const startMatch = trimmedLine.match(/start="([^"]*)"/);
      const start = startMatch ? startMatch[1] : '';

      // 提取结束时间
      const endMatch = trimmedLine.match(/stop="([^"]*)"/);
      const end = endMatch ? endMatch[1] : '';

      if (currentTvgId && start && end) {
        currentProgram = { start, end, title: '' };
        // 优化：如果当前频道不在我们关注的列表中，标记为跳�?        shouldSkipCurrentProgram = !tvgs.has(currentTvgId);
      }
    }
    // 解析 <title> 标签 - 只有在需要解析当前节目时才处�?    if (
      trimmedLine.includes('<title') &&
      currentProgram &&
      !shouldSkipCurrentProgram
    ) {
      // 处理带有语言属性的title标签，如 <title lang="zh">远方的家2025-60</title>
      const titleMatch = trimmedLine.match(
        /<title(?:\s+[^>]*)?>(.*?)<\/title>/
      );
      if (titleMatch && currentProgram) {
        currentProgram.title = titleMatch[1];

        // 保存节目信息
        if (!result[currentTvgId]) {
          result[currentTvgId] = [];
        }
        result[currentTvgId].push({ ...currentProgram });

        currentProgram = null;
      }
    }
  }

  return result;
}

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, '');
}

function isM3UContent(content: string) {
  const normalized = stripBom(content).trim();
  return normalized.includes('#EXTM3U') || normalized.includes('#EXTINF');
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function parseTxtLive(
  sourceKey: string,
  txtContent: string
): {
  tvgUrl: string;
  channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
  }[];
} {
  const channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
  }[] = [];

  const lines = txtContent
    .split('\n')
    .map((line) => stripBom(line).trim())
    .filter((line) => line.length > 0);

  let currentGroup = '无分�?;
  let channelIndex = 0;

  for (const line of lines) {
    const commaIndex = line.indexOf(',');
    if (commaIndex === -1) {
      continue;
    }

    const name = line.slice(0, commaIndex).trim();
    const value = line.slice(commaIndex + 1).trim();

    if (!name) {
      continue;
    }

    if (value === '#genre#') {
      currentGroup = name;
      continue;
    }

    if (!value || !isHttpUrl(value)) {
      continue;
    }

    channels.push({
      id: `${sourceKey}-${channelIndex}`,
      tvgId: name,
      name,
      logo: '',
      group: currentGroup,
      url: value,
    });
    channelIndex++;
  }

  return { tvgUrl: '', channels };
}

/**
 * 解析M3U文件内容，提取频道信�? * @param m3uContent M3U文件的内容字符串
 * @returns 频道信息数组
 */
function parseM3U(
  sourceKey: string,
  m3uContent: string
): {
  tvgUrl: string;
  channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
  }[];
} {
  const channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
  }[] = [];

  const lines = m3uContent
    .split('\n')
    .map((line) => stripBom(line).trim())
    .filter((line) => line.length > 0);

  let tvgUrl = '';
  let channelIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检查是否是 #EXTM3U 行，提取 tvg-url
    if (line.startsWith('#EXTM3U')) {
      // 支持两种格式：x-tvg-url �?url-tvg
      const tvgUrlMatch = line.match(/(?:x-tvg-url|url-tvg)="([^"]*)"/);
      tvgUrl = tvgUrlMatch ? tvgUrlMatch[1].split(',')[0].trim() : '';
      continue;
    }

    // 检查是否是 #EXTINF �?    if (line.startsWith('#EXTINF:')) {
      // 提取 tvg-id
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
      let tvgId = tvgIdMatch ? tvgIdMatch[1] : '';

      // 提取 tvg-name
      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
      const tvgName = tvgNameMatch ? tvgNameMatch[1] : '';

      // 提取 tvg-logo
      const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
      const logo = tvgLogoMatch ? tvgLogoMatch[1] : '';

      // 提取 group-title
      const groupTitleMatch = line.match(/group-title="([^"]*)"/);
      const group = groupTitleMatch ? groupTitleMatch[1] : '无分�?;

      // 提取标题�?EXTINF 行最后的逗号后面的内容）
      const titleMatch = line.match(/,([^,]*)$/);
      const title = titleMatch ? titleMatch[1].trim() : '';

      // 优先使用 tvg-name，如果没有则使用标题
      const name = title || tvgName || '';

      // 如果 tvg-id 为空，使�?tvg-name 或频道名称作为备�?      // 这样可以支持没有 tvg-id 的M3U文件
      if (!tvgId) {
        tvgId = tvgName || name;
      }

      // 检查下一行是否是URL
      if (i + 1 < lines.length && !lines[i + 1].startsWith('#')) {
        const url = lines[i + 1];

        // 只有当有名称和URL时才添加到结果中
        if (name && url) {
          channels.push({
            id: `${sourceKey}-${channelIndex}`,
            tvgId,
            name,
            logo,
            group,
            url,
          });
          channelIndex++;
        }

        // 跳过下一行，因为已经处理�?        i++;
      }
    }
  }

  return { tvgUrl, channels };
}

// utils/urlResolver.js
export function resolveUrl(baseUrl: string, relativePath: string) {
  try {
    // 如果已经是完整的 URL，直接返�?    if (
      relativePath.startsWith('http://') ||
      relativePath.startsWith('https://')
    ) {
      return relativePath;
    }

    // 如果是协议相对路�?(//example.com/path)
    if (relativePath.startsWith('//')) {
      const baseUrlObj = new URL(baseUrl);
      return `${baseUrlObj.protocol}${relativePath}`;
    }

    // 使用 URL 构造函数处理相对路�?    const baseUrlObj = new URL(baseUrl);
    const resolvedUrl = new URL(relativePath, baseUrlObj);
    return resolvedUrl.href;
  } catch (error) {
    // 降级处理
    return fallbackUrlResolve(baseUrl, relativePath);
  }
}

function fallbackUrlResolve(baseUrl: string, relativePath: string) {
  // 移除 baseUrl 末尾的文件名，保留目录路�?  let base = baseUrl;
  if (!base.endsWith('/')) {
    base = base.substring(0, base.lastIndexOf('/') + 1);
  }

  // 处理不同类型的相对路�?  if (relativePath.startsWith('/')) {
    // 绝对路径 (/path/to/file)
    const urlObj = new URL(base);
    return `${urlObj.protocol}//${urlObj.host}${relativePath}`;
  } else if (relativePath.startsWith('../')) {
    // 上级目录相对路径 (../path/to/file)
    const segments = base.split('/').filter((s) => s);
    const relativeSegments = relativePath.split('/').filter((s) => s);

    for (const segment of relativeSegments) {
      if (segment === '..') {
        segments.pop();
      } else if (segment !== '.') {
        segments.push(segment);
      }
    }

    const urlObj = new URL(base);
    return `${urlObj.protocol}//${urlObj.host}/${segments.join('/')}`;
  } else {
    // 当前目录相对路径 (file.ts �?./file.ts)
    const cleanRelative = relativePath.startsWith('./')
      ? relativePath.slice(2)
      : relativePath;
    return base + cleanRelative;
  }
}

// 获取 M3U8 的基础 URL
export function getBaseUrl(m3u8Url: string) {
  try {
    const url = new URL(m3u8Url);
    // 如果 URL �?.m3u8 结尾，移除文件名
    if (url.pathname.endsWith('.m3u8')) {
      url.pathname = url.pathname.substring(
        0,
        url.pathname.lastIndexOf('/') + 1
      );
    } else if (!url.pathname.endsWith('/')) {
      url.pathname += '/';
    }
    return url.protocol + '//' + url.host + url.pathname;
  } catch (error) {
    return m3u8Url.endsWith('/') ? m3u8Url : m3u8Url + '/';
  }
}
