/* eslint-disable @typescript-eslint/no-explicit-any,no-console */
import bs58 from 'bs58';
import he from 'he';
import Hls from 'hls.js';

export type DoubanImageProxyType =
  | 'direct'
  | 'server'
  | 'img3'
  | 'cmliussss-cdn-tencent'
  | 'cmliussss-cdn-ali'
  | 'baidu'
  | 'custom';

function normalizeDoubanImageProxyConfig(
  proxyType: DoubanImageProxyType,
  proxyUrl: string
): {
  proxyType: DoubanImageProxyType;
  proxyUrl: string;
} {
  const normalizedProxyUrl = proxyUrl.trim();

  if (proxyType === 'custom' && !normalizedProxyUrl) {
    return {
      proxyType: 'server',
      proxyUrl: '',
    };
  }

  return {
    proxyType,
    proxyUrl: normalizedProxyUrl,
  };
}

function buildDoubanImageUrl(
  originalUrl: string,
  proxyType: DoubanImageProxyType,
  proxyUrl: string
): string {
  switch (proxyType) {
    case 'server':
      return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
    case 'img3':
      return originalUrl.replace(/img\d+\.doubanio\.com/g, 'img3.doubanio.com');
    case 'cmliussss-cdn-tencent':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.net'
      );
    case 'cmliussss-cdn-ali':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.com'
      );
    case 'baidu':
      return `https://image.baidu.com/search/down?url=${encodeURIComponent(originalUrl)}`;
    case 'custom':
      return proxyUrl ? `${proxyUrl}${encodeURIComponent(originalUrl)}` : originalUrl;
    case 'direct':
    default:
      return originalUrl;
  }
}

function getDoubanImageProxyConfig(): {
  proxyType: DoubanImageProxyType;
  proxyUrl: string;
  backupProxyType: DoubanImageProxyType;
  backupProxyUrl: string;
} {
  // 确保在浏览器环境中执�?  if (typeof window === 'undefined') {
    return {
      proxyType: 'cmliussss-cdn-tencent',
      proxyUrl: '',
      backupProxyType: 'server',
      backupProxyUrl: '',
    };
  }

  const doubanImageProxyType =
    localStorage.getItem('doubanImageProxyType') ||
    (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY_TYPE ||
    'cmliussss-cdn-tencent';
  const doubanImageProxy =
    localStorage.getItem('doubanImageProxyUrl') ||
    (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY ||
    '';
  const doubanImageProxyBackupType =
    (localStorage.getItem('doubanImageProxyTypeBackup') as DoubanImageProxyType | null) ||
    'server';
  const doubanImageProxyBackupUrl =
    localStorage.getItem('doubanImageProxyUrlBackup') || '';
  const primaryConfig = normalizeDoubanImageProxyConfig(
    doubanImageProxyType,
    doubanImageProxy
  );
  const backupConfig = normalizeDoubanImageProxyConfig(
    doubanImageProxyBackupType,
    doubanImageProxyBackupUrl
  );
  return {
    proxyType: primaryConfig.proxyType,
    proxyUrl: primaryConfig.proxyUrl,
    backupProxyType: backupConfig.proxyType,
    backupProxyUrl: backupConfig.proxyUrl,
  };
}

export function getDoubanImageFallbackUrl(originalUrl: string): string | null {
  if (!originalUrl || !originalUrl.includes('doubanio.com')) {
    return null;
  }

  const { proxyType, proxyUrl, backupProxyType, backupProxyUrl } =
    getDoubanImageProxyConfig();
  const primaryUrl = buildDoubanImageUrl(originalUrl, proxyType, proxyUrl);
  const backupUrl = buildDoubanImageUrl(
    originalUrl,
    backupProxyType,
    backupProxyUrl
  );

  if (backupUrl === primaryUrl) {
    return null;
  }

  return backupUrl;
}

export function tryApplyDoubanImageFallback(
  target: HTMLImageElement,
  originalUrl: string
): boolean {
  if (!originalUrl || !originalUrl.includes('doubanio.com')) {
    return false;
  }

  if (target.dataset.doubanBackupTried === 'true') {
    return false;
  }

  const fallbackUrl = getDoubanImageFallbackUrl(originalUrl);
  if (!fallbackUrl || fallbackUrl === target.currentSrc || fallbackUrl === target.src) {
    return false;
  }

  target.dataset.doubanBackupTried = 'true';
  target.src = fallbackUrl;
  return true;
}

/**
 * 处理图片 URL，根据用户设置使用相应的代理
 */
export function processImageUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;

  // 如果已经是代理URL，直接返�?  if (originalUrl.startsWith('/api/image-proxy')) {
    return originalUrl;
  }

  // 处理 TMDB 图片 URL 替换
  if (originalUrl.includes('image.tmdb.org')) {
    if (typeof window !== 'undefined') {
      const tmdbImageBaseUrl = localStorage.getItem('tmdbImageBaseUrl') || 'https://image.tmdb.org';
      // 只有当用户设置了不同�?baseUrl 时才进行替换
      if (tmdbImageBaseUrl !== 'https://image.tmdb.org') {
        return originalUrl.replace('https://image.tmdb.org', tmdbImageBaseUrl);
      }
    }
    return originalUrl;
  }

  // 处理豆瓣图片代理
  if (!originalUrl.includes('doubanio.com')) {
    return originalUrl;
  }

  const { proxyType, proxyUrl } = getDoubanImageProxyConfig();
  return buildDoubanImageUrl(originalUrl, proxyType, proxyUrl);
}

/**
 * 处理视频 URL，根据用户设置使用相应的代理
 */
export function processVideoUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;

  // 仅处理豆瓣视频代�?  if (!originalUrl.includes('doubanio.com')) {
    return originalUrl;
  }

  // 获取用户配置的代理设�?  const { proxyType, proxyUrl } = getDoubanImageProxyConfig();

  // 根据代理类型处理URL
  switch (proxyType) {
    case 'direct':
      // 直连，不使用代理
      return originalUrl;

    case 'server':
      // 使用服务器代�?      return `/api/video-proxy?url=${encodeURIComponent(originalUrl)}`;

    case 'img3':
      // 使用 img3.doubanio.com 代理
      return originalUrl.replace(/img\d\.doubanio\.com/g, 'img3.doubanio.com');

    case 'cmliussss-cdn-tencent':
      // 使用腾讯云CDN代理
      return originalUrl.replace(
        /https?:\/\/img\d\.doubanio\.com/g,
        'https://douban-img.cmliussss.workers.dev'
      );

    case 'cmliussss-cdn-ali':
      // 使用阿里云CDN代理
      return originalUrl.replace(
        /https?:\/\/img\d\.doubanio\.com/g,
        'https://douban-img-ali.cmliussss.workers.dev'
      );

    case 'custom':
      // 使用自定义代�?      if (proxyUrl) {
        return originalUrl.replace(/https?:\/\/img\d\.doubanio\.com/g, proxyUrl);
      }
      return originalUrl;

    default:
      // 默认使用腾讯云CDN代理
      return originalUrl.replace(
        /https?:\/\/img\d\.doubanio\.com/g,
        'https://douban-img.cmliussss.workers.dev'
      );
  }
}

/**
 * 从m3u8地址获取视频质量等级和网络信�? * @param m3u8Url m3u8播放列表的URL
 * @returns Promise<{quality: string, loadSpeed: string, pingTime: number, bitrate: string}> 视频质量等级和网络信�? */
export async function getVideoResolutionFromM3u8(
  m3u8Url: string,
  timeoutMs = 6000
): Promise<{
  quality: string; // �?20p�?080p�?  loadSpeed: string; // 自动转换为KB/s或MB/s
  pingTime: number; // 网络延迟（毫秒）
  bitrate: string; // 视频码率（如 "2.5 Mbps"�?}> {
  try {
    // 直接使用m3u8 URL作为视频源，避免CORS问题
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.preload = 'metadata';

      // 测量网络延迟（ping时间�?- 使用m3u8 URL而不是ts文件
      const pingStart = performance.now();
      let pingTime = 0;

      // 测量ping时间（使用m3u8 URL�?      fetch(m3u8Url, { method: 'HEAD', mode: 'no-cors' })
        .then(() => {
          pingTime = performance.now() - pingStart;
        })
        .catch(() => {
          pingTime = performance.now() - pingStart; // 记录到失败为止的时间
        });

      // 固定使用hls.js加载
      const hls = new Hls();

      let actualLoadSpeed = '未知';
      let hasSpeedCalculated = false;
      let hasMetadataLoaded = false;
      let estimatedBitrate = 0; // 估算的码率（bps�?
      // 提取核心返回逻辑�?resolve �?timeout 共同调用
      const resolveCurrentState = () => {
        const width = video.videoWidth;
        const quality =
          width >= 3840
            ? '4K'
            : width >= 2560
              ? '2K'
              : width >= 1920
                ? '1080p'
                : width >= 1280
                  ? '720p'
                  : width >= 854
                    ? '480p'
                    : width > 0
                      ? 'SD'
                      : '未知';

        const bitrateStr = estimatedBitrate > 0
          ? estimatedBitrate >= 1000000
            ? `${(estimatedBitrate / 1000000).toFixed(1)} Mbps`
            : `${Math.round(estimatedBitrate / 1000)} Kbps`
          : '未知';

        hls.destroy();
        video.remove();

        resolve({
          quality,
          loadSpeed: actualLoadSpeed,
          pingTime: Math.round(pingTime),
          bitrate: bitrateStr,
        });
      };

      // 设置超时处理 - 如果部分数据已拿到，则宽容返�?      const timeout = setTimeout(() => {
        if (hasMetadataLoaded || hasSpeedCalculated) {
          resolveCurrentState();
        } else {
          hls.destroy();
          video.remove();
          reject(new Error('Timeout loading video metadata'));
        }
      }, timeoutMs);

      video.onerror = () => {
        clearTimeout(timeout);
        hls.destroy();
        video.remove();
        reject(new Error('Failed to load video metadata'));
      };

      let fragmentStartTime = 0;

      // 检查是否可以相互满足要�?      const checkAndResolve = () => {
        if (
          hasMetadataLoaded &&
          (hasSpeedCalculated || actualLoadSpeed !== '未知')
        ) {
          clearTimeout(timeout);
          resolveCurrentState();
        }
      };

      // 监听片段加载开�?      hls.on(Hls.Events.FRAG_LOADING, () => {
        fragmentStartTime = performance.now();
      });

      // 监听片段加载完成，只需首个分片即可计算速度
      hls.on(Hls.Events.FRAG_LOADED, (event: any, data: any) => {
        if (
          fragmentStartTime > 0 &&
          data &&
          data.payload &&
          !hasSpeedCalculated
        ) {
          const loadTime = performance.now() - fragmentStartTime;
          const size = data.payload.byteLength || 0;

          if (loadTime > 0 && size > 0) {
            const speedKBps = size / 1024 / (loadTime / 1000);

            // 立即计算速度，无需等待更多分片
            const avgSpeedKBps = speedKBps;

            if (avgSpeedKBps >= 1024) {
              actualLoadSpeed = `${(avgSpeedKBps / 1024).toFixed(1)} MB/s`;
            } else {
              actualLoadSpeed = `${avgSpeedKBps.toFixed(1)} KB/s`;
            }
            hasSpeedCalculated = true;

            // 从分片估算码�?            if (data.frag && data.frag.duration > 0) {
              const fragmentDuration = data.frag.duration; // 分片时长（秒�?              const fragmentSize = size; // 分片大小（字节）

              // 码率 = (分片大小 × 8 bits) / 分片时长
              estimatedBitrate = Math.round((fragmentSize * 8) / fragmentDuration);

              console.log(`[测速] 估算码率: ${(estimatedBitrate / 1000000).toFixed(2)} Mbps (分片: ${(fragmentSize / 1024 / 1024).toFixed(2)} MB, 时长: ${fragmentDuration.toFixed(1)}s)`);
            }

            checkAndResolve(); // 尝试返回结果
          }
        }
      });

      // 为分片请求添加时间戳参数破除浏览器缓�?      hls.config.xhrSetup = function (xhr: XMLHttpRequest, url: string) {
        const urlWithTimestamp = url.includes('?')
          ? `${url}&_t=${Date.now()}`
          : `${url}?_t=${Date.now()}`;
        xhr.open('GET', urlWithTimestamp, true);
      };

      hls.loadSource(m3u8Url);
      hls.attachMedia(video);

      // 监听hls.js错误
      hls.on(Hls.Events.ERROR, (event: any, data: any) => {
        console.error('HLS错误:', data);
        if (data.fatal) {
          const statusCode = data.response?.code || data.response?.status;
          // 防止 415 代理兜底熔断导致正常的二进制源在优选逻辑中被剔除
          if (statusCode === 415 && (m3u8Url.includes('/api/proxy-m3u8') || m3u8Url.includes('/api/proxy/vod/m3u8'))) {
            console.log('[测速] 测速通道嗅探到这是底层的媒体流文件，免测速通过');
            clearTimeout(timeout);
            hls.destroy();
            video.remove();
            resolve({
              quality: '原生画质',
              loadSpeed: '直连',
              pingTime: 10,
              bitrate: '未知',
            });
            return;
          }

          clearTimeout(timeout);
          hls.destroy();
          video.remove();
          reject(new Error(`HLS播放失败: ${data.type}`));
        }
      });

      // 监听视频元数据加载完�?      video.onloadedmetadata = () => {
        hasMetadataLoaded = true;
        checkAndResolve(); // 尝试返回结果
      };
    });
  } catch (error) {
    throw new Error(
      `Error getting video resolution: ${error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function cleanHtmlTags(text: string): string {
  if (!text) return '';

  const cleanedText = text
    .replace(/<[^>]+>/g, '\n') // �?HTML 标签替换为换�?    .replace(/\n+/g, '\n') // 将多个连续换行合并为一�?    .replace(/[ \t]+/g, ' ') // 将多个连续空格和制表符合并为一个空格，但保留换行符
    .replace(/^\n+|\n+$/g, '') // 去掉首尾换行
    .trim(); // 去掉首尾空格

  // 使用 he 库解�?HTML 实体
  return he.decode(cleanedText);
}

/**
 * 将字符串编码�?Base58
 * @param str 要编码的字符�? * @returns Base58 编码后的字符�? */
export function base58Encode(str: string): string {
  if (!str) return '';

  // 在浏览器环境中使�?TextEncoder
  if (typeof window !== 'undefined') {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    return bs58.encode(bytes);
  }

  // �?Node.js 环境中使�?Buffer
  const buffer = Buffer.from(str, 'utf-8');
  return bs58.encode(buffer);
}

/**
 * �?Base58 字符串解码为原始字符�? * @param encoded Base58 编码的字符串
 * @returns 解码后的原始字符�? */
export function base58Decode(encoded: string): string {
  if (!encoded) return '';

  const bytes = bs58.decode(encoded);

  // 在浏览器环境中使�?TextDecoder
  if (typeof window !== 'undefined') {
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  }

  // �?Node.js 环境中使�?Buffer
  return Buffer.from(bytes).toString('utf-8');
}
