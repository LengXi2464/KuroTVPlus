import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getCacheTime, getConfig } from '@/lib/config';
import { getDetailFromApi } from '@/lib/downstream';
import {
  executeSavedSourceScript,
  normalizeScriptDetailResult,
  normalizeScriptSources,
  parseScriptSourceValue,
} from '@/lib/source-script';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const sourceCode = searchParams.get('source');

  if (!id || !sourceCode) {
    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
  }

  const parsedScriptSource = parseScriptSourceValue(sourceCode);
  if (parsedScriptSource) {
    try {
      const sourcesExecution = await executeSavedSourceScript({
        key: parsedScriptSource.scriptKey,
        hook: 'getSources',
        payload: {},
      });
      const sources = normalizeScriptSources(sourcesExecution.result);
      const sourceInfo =
        sources.find((item) => item.id === parsedScriptSource.sourceId) || {
          id: parsedScriptSource.sourceId,
          name: parsedScriptSource.sourceId,
        };

      const detailExecution = await executeSavedSourceScript({
        key: parsedScriptSource.scriptKey,
        hook: 'detail',
        payload: {
          id,
          sourceId: parsedScriptSource.sourceId,
        },
      });

      const normalized = normalizeScriptDetailResult({
        source: sourceCode,
        scriptKey: parsedScriptSource.scriptKey,
        scriptName: detailExecution.meta?.name || parsedScriptSource.scriptKey,
        sourceId: parsedScriptSource.sourceId,
        sourceName: sourceInfo.name,
        detailId: id,
        result: detailExecution.result,
      });

      return NextResponse.json(normalized);
    } catch (error) {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 500 }
      );
    }
  }

  // 特殊处理 openlist �?  if (sourceCode === 'openlist') {
    try {
      const config = await getConfig();
      const openListConfig = config.OpenListConfig;

      if (
        !openListConfig ||
        !openListConfig.Enabled ||
        !openListConfig.URL ||
        !openListConfig.Username ||
        !openListConfig.Password
      ) {
        throw new Error('OpenList 未配置或未启�?);
      }

      const rootPath = openListConfig.RootPath || '/';

      // 1. 读取 metainfo 获取元数�?      let metaInfo: any = null;
      let folderMeta: any = null;
      try {
        const { getCachedMetaInfo, setCachedMetaInfo } = await import('@/lib/openlist-cache');
        const { db } = await import('@/lib/db');

        metaInfo = getCachedMetaInfo();

        if (!metaInfo) {
          const metainfoJson = await db.getGlobalValue('video.metainfo');
          if (metainfoJson) {
            metaInfo = JSON.parse(metainfoJson);
            setCachedMetaInfo(metaInfo);
          }
        }

        // 使用 key 查找文件夹信�?        folderMeta = metaInfo?.folders?.[id];
        if (!folderMeta) {
          throw new Error('未找到该视频信息');
        }
      } catch (error) {
        throw new Error('读取视频信息失败: ' + (error as Error).message);
      }

      // 使用 folderName 构建实际路径
      const folderName = folderMeta.folderName;
      const folderPath = `${rootPath}${rootPath.endsWith('/') ? '' : '/'}${folderName}`;

      // 2. 直接调用 OpenList 客户端获取视频列�?      const { OpenListClient } = await import('@/lib/openlist.client');
      const { getCachedVideoInfo, setCachedVideoInfo } = await import('@/lib/openlist-cache');
      const { parseVideoFileName } = await import('@/lib/video-parser');

      const client = new OpenListClient(
        openListConfig.URL,
        openListConfig.Username,
        openListConfig.Password
      );

      let videoInfo = getCachedVideoInfo(folderPath);

      // 获取所有分页的视频文件
      const allFiles: any[] = [];
      let currentPage = 1;
      const pageSize = 100;
      let total = 0;

      while (true) {
        const listResponse = await client.listDirectory(folderPath, currentPage, pageSize);

        if (listResponse.code !== 200) {
          throw new Error('OpenList 列表获取失败1');
        }

        total = listResponse.data.total;
        allFiles.push(...listResponse.data.content);

        if (allFiles.length >= total) {
          break;
        }

        currentPage++;
      }

      const videoExtensions = ['.mp4', '.mkv', '.avi', '.m3u8', '.flv', '.ts', '.mov', '.wmv', '.webm', '.rmvb', '.rm', '.mpg', '.mpeg', '.3gp', '.f4v', '.m4v', '.vob'];
      const videoFiles = allFiles.filter((item) => {
        if (item.is_dir || item.name.startsWith('.') || item.name.endsWith('.json')) return false;
        return videoExtensions.some(ext => item.name.toLowerCase().endsWith(ext));
      });

      if (!videoInfo) {
        videoInfo = { episodes: {}, last_updated: Date.now() };
        videoFiles.sort((a, b) => a.name.localeCompare(b.name));
        for (let i = 0; i < videoFiles.length; i++) {
          const file = videoFiles[i];
          const parsed = parseVideoFileName(file.name);
          videoInfo.episodes[file.name] = {
            episode: parsed.episode || (i + 1),
            season: parsed.season,
            title: parsed.title,
            parsed_from: 'filename',
            isOVA: parsed.isOVA,
          };
        }
        setCachedVideoInfo(folderPath, videoInfo);
      }

      const episodes = videoFiles
        .map((file, index) => {
          const parsed = parseVideoFileName(file.name);
          let episodeInfo;
          if (parsed.episode) {
            episodeInfo = { episode: parsed.episode, season: parsed.season, title: parsed.title, parsed_from: 'filename', isOVA: parsed.isOVA };
          } else {
            episodeInfo = videoInfo!.episodes[file.name] || { episode: index + 1, season: undefined, title: undefined, parsed_from: 'filename' };
          }
          let displayTitle = episodeInfo.title;
          if (!displayTitle && episodeInfo.episode) {
            displayTitle = episodeInfo.isOVA ? `OVA ${episodeInfo.episode}` : `�?{episodeInfo.episode}集`;
          }
          if (!displayTitle) {
            displayTitle = file.name;
          }
          return { fileName: file.name, episode: episodeInfo.episode || 0, season: episodeInfo.season, title: displayTitle, isOVA: episodeInfo.isOVA };
        })
        .sort((a, b) => {
          // OVA 排在最�?          if (a.isOVA && !b.isOVA) return 1;
          if (!a.isOVA && b.isOVA) return -1;
          // 都是 OVA 或都不是 OVA，按集数排序
          return a.episode !== b.episode ? a.episode - b.episode : a.fileName.localeCompare(b.fileName);
        });

      // 3. �?metainfo 中获取元数据
      const { getTMDBImageUrl } = await import('@/lib/tmdb.search');

      const result = {
        source: 'openlist',
        source_name: '私人影库',
        id: id,
        title: folderMeta?.title || folderName,
        poster: folderMeta?.poster_path ? getTMDBImageUrl(folderMeta.poster_path) : '',
        year: folderMeta?.release_date ? folderMeta.release_date.split('-')[0] : '',
        douban_id: 0,
        desc: folderMeta?.overview || '',
        episodes: episodes.map((ep) => `/api/openlist/play?folder=${encodeURIComponent(folderName)}&fileName=${encodeURIComponent(ep.fileName)}`),
        episodes_titles: episodes.map((ep) => ep.title),
        proxyMode: false, // openlist 源不使用代理模式
      };

      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 500 }
      );
    }
  }

  if (!/^[\w-]+$/.test(id)) {
    return NextResponse.json({ error: '无效的视频ID格式' }, { status: 400 });
  }

  try {
    const apiSites = await getAvailableApiSites(authInfo.username);
    const apiSite = apiSites.find((site) => site.key === sourceCode);

    if (!apiSite) {
      return NextResponse.json({ error: '无效的API来源' }, { status: 400 });
    }

    const result = await getDetailFromApi(apiSite, id);

    // 添加 proxyMode 到返回结�?    const resultWithProxy = {
      ...result,
      proxyMode: apiSite.proxyMode || false,
    };

    const cacheTime = await getCacheTime();

    return NextResponse.json(resultWithProxy, {
      headers: {
        'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Netlify-Vary': 'query',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
