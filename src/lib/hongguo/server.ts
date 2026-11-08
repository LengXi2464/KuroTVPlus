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
  type HongguoFilterRow,
  type HongguoPage,
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
  browse: (genre: string, opts: Record<string, unknown>, skip: number) => Promise<{
    items: Array<Record<string, unknown>>;
    hasMore: boolean;
    nextSkip: number;
  }>;
  filters: (genre: string) => Promise<Array<Record<string, unknown>>>;
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

function toPage(pg: {
  items?: Array<Record<string, unknown>>;
  hasMore?: boolean;
  nextSkip?: number;
}): HongguoPage {
  return {
    items: (pg.items || [])
      .map(mapDirectItem)
      .filter((it) => it.id !== '' && it.title !== ''),
    hasMore: !!pg.hasMore,
    nextSkip: num(pg.nextSkip),
  };
}

/** 首页推荐流：按热度取短剧，无需关键词。 */
async function directRecommend(limit = 40, skip = 0): Promise<HongguoPage> {
  return toPage(await vendor().recommend(limit, skip));
}

/** 分类/榜单浏览：按体裁 + 筛选项取列表。 */
async function directBrowse(
  genre: string,
  opts: {
    theme?: string;
    setting?: string;
    background?: string;
    sort?: string;
    gender?: string;
    status?: string;
    days?: string;
    limit?: number;
    skip?: number;
  } = {}
): Promise<HongguoPage> {
  const { limit = 60, skip = 0, ...filter } = opts;
  return toPage(await vendor().browse(genre, { ...filter, limit }, skip));
}

/** 分类页筛选面板。 */
async function directFilters(genre: string): Promise<HongguoFilterRow[]> {
  const rows = await vendor().filters(genre);
  return (rows || [])
    .map((r) => {
      const items = Array.isArray(r.items) ? (r.items as Array<Record<string, unknown>>) : [];
      return {
        type: str(r.type),
        rowName: str(r.row_name),
        items: items
          .map((it) => ({ id: str(it.id), name: str(it.name) }))
          .filter((it) => it.id !== '' && it.name !== ''),
      };
    })
    .filter((r) => r.type !== '' && r.items.length > 0);
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
async function remoteRecommend(limit: number, skip = 0): Promise<HongguoPage> {
  const j = await remoteGet('/recommend', { limit: String(limit), skip: String(skip) });
  const raw = (j?.items || j?.results || j?.list || j?.data || []) as Array<Record<string, unknown>>;
  return {
    items: raw.map(mapRemoteItem).filter((it) => it.id !== '' && it.title !== ''),
    hasMore: !!j?.hasMore,
    nextSkip: skip + raw.length,
  };
}

/** 兜底后端的分类浏览（接口不存在时抛错，由 withFallback 汇总）。 */
async function remoteBrowse(
  genre: string,
  opts: {
    theme?: string;
    setting?: string;
    background?: string;
    sort?: string;
    gender?: string;
    status?: string;
    days?: string;
    limit?: number;
    skip?: number;
  } = {}
): Promise<HongguoPage> {
  const params: Record<string, string> = { genre };
  for (const k of ['theme', 'setting', 'background', 'sort', 'gender', 'status', 'days'] as const) {
    const v = opts[k];
    if (v) params[k] = String(v);
  }
  const limit = opts.limit ?? 60;
  const skip = opts.skip ?? 0;
  params.limit = String(limit);
  params.skip = String(skip);
  const j = await remoteGet('/browse', params);
  const raw = (j?.items || j?.results || j?.list || j?.data || []) as Array<Record<string, unknown>>;
  return {
    items: raw.map(mapRemoteItem).filter((it) => it.id !== '' && it.title !== ''),
    hasMore: !!j?.hasMore,
    nextSkip: skip + raw.length,
  };
}

/** 兜底后端的筛选面板（接口不存在时抛错，由 withFallback 汇总）。 */
async function remoteFilters(genre: string): Promise<HongguoFilterRow[]> {
  const j = await remoteGet('/filters', { genre });
  const raw = (j?.rows || j?.items || j?.data || []) as Array<Record<string, unknown>>;
  return raw
    .map((r) => {
      const items = Array.isArray(r.items)
        ? (r.items as Array<Record<string, unknown>>)
        : [];
      return {
        type: str(r.type),
        rowName: str(r.row_name) || str(r.rowName) || str(r.name),
        items: items
          .map((it) => ({ id: str(it.id), name: str(it.name) }))
          .filter((it) => it.id !== '' && it.name !== ''),
      };
    })
    .filter((r) => r.type !== '' && r.items.length > 0);
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

/** 确定性随机数（mulberry32）：同一 seed 得到同一序列。 */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 确定性洗牌：同一 seed 顺序稳定，保证分页可续、换一批可复现。 */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = arr.slice();
  const rnd = mulberry32(seed || 1);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 推荐池大小：一次取够，客户端在池内换一批/翻页。 */
const RECOMMEND_POOL = 120;

/**
 * 推荐流：取热门池后按 seed 洗牌，再按 skip/limit 切片。
 * seed 变化即「换一批」，顺序与首页（按热度原序）不同，避免两页重复。
 */
export async function hongguoRecommend(
  limit = 60,
  skip = 0,
  seed = 0
): Promise<HongguoPage> {
  const pool = await withFallback(
    () => directRecommend(RECOMMEND_POOL, 0),
    () => remoteRecommend(RECOMMEND_POOL, 0)
  );
  const list = seededShuffle(pool.items, seed + 1);
  const from = Math.min(Math.max(skip, 0), list.length);
  const to = Math.min(from + Math.max(limit, 1), list.length);
  return { items: list.slice(from, to), hasMore: to < list.length, nextSkip: to };
}

export function hongguoBrowse(
  genre: string,
  opts: {
    theme?: string;
    setting?: string;
    background?: string;
    sort?: string;
    gender?: string;
    status?: string;
    days?: string;
    limit?: number;
    skip?: number;
  } = {}
): Promise<HongguoPage> {
  return withFallback(
    () => directBrowse(genre, opts),
    () => remoteBrowse(genre, opts)
  );
}

export function hongguoFilters(genre: string): Promise<HongguoFilterRow[]> {
  return withFallback(
    () => directFilters(genre),
    () => remoteFilters(genre)
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
