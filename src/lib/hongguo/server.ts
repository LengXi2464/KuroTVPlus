/**
 * 红果短剧数据链路（仅服务端调用）。
 *
 * 默认走内置直连（vendor/hongguo-web：App 签名接口 + 官网兜底），
 * 失败时回落到 8899 兜底后端；HONGGUO_SOURCE=remote 可强制只用 8899，
 * HONGGUO_SOURCE=direct 可强制只用直连（不兜底）。
 */
import {
  HONGGUO_API_BASE,
  type HongguoEpisode,
  type HongguoPlayInfo,
  type HongguoSearchItem,
  type HongguoSeries,
  type HongguoStream,
} from './config';

type Source = 'direct' | 'remote';

function sourceOrder(): Source[] {
  const v = (process.env.HONGGUO_SOURCE || '').trim().toLowerCase();
  if (v === 'remote') return ['remote'];
  if (v === 'direct') return ['direct'];
  return ['direct', 'remote'];
}

// ==================== 直连（vendor/hongguo-web） ====================

/* eslint-disable @typescript-eslint/no-var-requires */
function vendor(): {
  search: (q: string, limit: number, offset: number) => Promise<{
    items: Array<Record<string, unknown>>;
    hasMore: boolean;
    nextSkip: number;
  }>;
  recommend: (limit: number, skip: number) => Promise<{
    items: Array<Record<string, unknown>>;
    hasMore: boolean;
    nextSkip: number;
  }>;
  detail: (seriesId: string) => Promise<{
    meta: Record<string, unknown>;
    episodes: Array<Record<string, unknown>>;
  }>;
  play: (vid: string, quality: string) => Promise<{
    url: string;
    codec: string;
    definition: string;
    size: number;
    encrypt: boolean;
    contentKey: string;
  }>;
} {
  return require('./vendor');
}
/* eslint-enable @typescript-eslint/no-var-requires */

function str(v: unknown, def = ''): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return def;
}
function num(v: unknown, def = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function mapDirectItem(it: Record<string, unknown>): HongguoSearchItem {
  return {
    id: str(it.series_id),
    title: str(it.title),
    cover: str(it.cover),
    desc: str(it.abstract),
    episodeCount: num(it.episode_cnt),
    score: it.score as string | number | undefined,
    playCount: num(it.play_cnt),
    tags: Array.isArray(it.tags) ? (it.tags as string[]) : [],
  };
}

async function directSearch(q: string, limit: number): Promise<HongguoSearchItem[]> {
  const pg = await vendor().search(q, limit, 0);
  return (pg.items || [])
    .map(mapDirectItem)
    .filter((it) => it.id !== '' && it.title !== '');
}

/** 首页推荐流：按热度取短剧，无需关键词。 */
async function directRecommend(limit = 40, skip = 0): Promise<HongguoSearchItem[]> {
  const pg = await vendor().recommend(limit, skip);
  return (pg.items || [])
    .map(mapDirectItem)
    .filter((it) => it.id !== '' && it.title !== '');
}

async function directDetail(seriesId: string): Promise<{
  series: HongguoSeries;
  episodes: HongguoEpisode[];
}> {
  const d = await vendor().detail(seriesId);
  const meta = d.meta || {};
  const episodes: HongguoEpisode[] = (d.episodes || [])
    .map((e) => {
      const seq = num(e.index);
      return {
        id: str(e.vid),
        title: str(e.title) || `第${seq}集`,
        seq,
        duration: num(e.duration),
        cover: str(e.cover),
      };
    })
    .filter((e) => e.id !== '');
  episodes.sort((a, b) => a.seq - b.seq);
  const series: HongguoSeries = {
    id: str(meta.series_id) || seriesId,
    title: str(meta.title) || seriesId,
    cover: str(meta.cover),
    description: str(meta.abstract),
    episodeCount: num(meta.episode_cnt) || episodes.length,
    status: str(meta.status),
  };
  return { series, episodes };
}

async function directPlay(vid: string): Promise<HongguoPlayInfo> {
  const v = vendor();
  const streams: HongguoStream[] = [];
  const seen = new Set<string>();
  for (const quality of ['720', '360']) {
    try {
      const t = await v.play(vid, quality);
      if (!t.url || seen.has(t.url)) continue;
      seen.add(t.url);
      streams.push({
        definition: t.definition || quality,
        codec: t.codec || 'hevc',
        url: t.url,
        size: t.size,
        contentKey: t.contentKey,
      });
    } catch {
      // 某个清晰度不存在时忽略，保留其余清晰度
    }
  }
  if (streams.length === 0) throw new Error('App 接口暂未提供本集播放信息');
  const encrypted = streams.some((s) => !!s.contentKey);
  return {
    ok: true,
    protected: encrypted,
    contentKey: streams.find((s) => s.contentKey)?.contentKey || '',
    streams,
  };
}

// ==================== 8899 兜底后端 ====================

async function remoteGet(pathname: string, params: Record<string, string>) {
  const url = new URL(HONGGUO_API_BASE + pathname);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`兜底后端 HTTP ${res.status}`);
  return res.json();
}

function mapRemoteItem(it: Record<string, unknown>): HongguoSearchItem {
  return {
    id: str(it.id) || str(it.series_id),
    title: str(it.title) || str(it.series_title) || str(it.name),
    cover: str(it.cover),
    desc:
      str(it.desc) ||
      str(it.description) ||
      str(it.abstract) ||
      str(it.series_intro),
    episodeCount: num(it.episodeCount ?? it.episode_cnt ?? it.episode_count),
    score: it.score as string | number | undefined,
    playCount: num(it.playCount ?? it.play_cnt),
    tags: Array.isArray(it.tags) ? (it.tags as string[]) : [],
  };
}

async function remoteSearch(q: string, limit: number): Promise<HongguoSearchItem[]> {
  const j = await remoteGet('/search', { q, limit: String(limit) });
  const raw = (j?.items || j?.results || j?.list || j?.data || []) as Array<Record<string, unknown>>;
  return raw
    .map(mapRemoteItem)
    .filter((it) => it.id !== '' && it.title !== '');
}

/** 兜底后端的推荐流（接口不存在时抛错，由 withFallback 汇总）。 */
async function remoteRecommend(limit: number): Promise<HongguoSearchItem[]> {
  const j = await remoteGet('/recommend', { limit: String(limit) });
  const raw = (j?.items || j?.results || j?.list || j?.data || []) as Array<Record<string, unknown>>;
  return raw
    .map(mapRemoteItem)
    .filter((it) => it.id !== '' && it.title !== '');
}

async function remoteDetail(seriesId: string): Promise<{
  series: HongguoSeries;
  episodes: HongguoEpisode[];
}> {
  const sj = await remoteGet(`/series/${encodeURIComponent(seriesId)}`, {});
  const s = (sj?.series || sj?.data || sj || {}) as Record<string, unknown>;
  const ej = await remoteGet('/episodes', { series_id: seriesId });
  const raw = (ej?.items || ej?.episodes || ej?.data || []) as Array<Record<string, unknown>>;
  const episodes: HongguoEpisode[] = raw
    .map((e, i) => {
      const seq = num(e.seq ?? e.index, i + 1);
      return {
        id: str(e.id) || str(e.vid),
        title: str(e.title) || `第${seq}集`,
        seq,
        duration: num(e.duration),
        cover: str(e.cover),
      };
    })
    .filter((e) => e.id !== '');
  episodes.sort((a, b) => a.seq - b.seq);
  return {
    series: {
      id: str(s.id) || str(s.series_id) || seriesId,
      title: str(s.title) || str(s.series_title) || seriesId,
      cover: str(s.cover),
      description: str(s.description) || str(s.abstract),
      episodeCount: num(s.episode_count ?? s.episode_cnt) || episodes.length,
      status: str(s.status),
    },
    episodes,
  };
}

async function remotePlay(vid: string): Promise<HongguoPlayInfo> {
  const j = await remoteGet('/play', { episode_id: vid });
  const streams = ((j?.streams || []) as Array<Record<string, unknown>>)
    .map((t) => ({
      definition: str(t.definition),
      codec: str(t.codec) || 'hevc',
      url: str(t.url),
      size: num(t.size),
      contentKey: str(t.contentKey) || str(j?.contentKey),
    }))
    .filter((t) => t.url !== '');
  if (!j?.ok || streams.length === 0) {
    throw new Error(str(j?.message) || '兜底后端未返回播放地址');
  }
  return {
    ok: true,
    protected: !!j.protected,
    contentKey: str(j.contentKey),
    streams,
  };
}

// ==================== 对外入口（直连优先，8899 兜底） ====================

async function withFallback<T>(
  directFn: () => Promise<T>,
  remoteFn: () => Promise<T>
): Promise<T> {
  const errs: string[] = [];
  for (const source of sourceOrder()) {
    try {
      return source === 'direct' ? await directFn() : await remoteFn();
    } catch (err) {
      const label = source === 'direct' ? '直连' : '兜底';
      errs.push(`${label}: ${(err as Error).message}`);
    }
  }
  throw new Error(errs.join('；') || '红果数据源不可用');
}

export function hongguoSearch(q: string, limit = 40): Promise<HongguoSearchItem[]> {
  return withFallback(
    () => directSearch(q, limit),
    () => remoteSearch(q, limit)
  );
}

export function hongguoRecommend(limit = 40): Promise<HongguoSearchItem[]> {
  return withFallback(
    () => directRecommend(limit, 0),
    () => remoteRecommend(limit)
  );
}

export function hongguoDetail(seriesId: string) {
  return withFallback(
    () => directDetail(seriesId),
    () => remoteDetail(seriesId)
  );
}

export function hongguoPlay(vid: string): Promise<HongguoPlayInfo> {
  return withFallback(
    () => directPlay(vid),
    () => remotePlay(vid)
  );
}
