'use client';

import {
  Clapperboard,
  LayoutGrid,
  Loader2,
  Play,
  Search as SearchIcon,
  Sparkles,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import type { HongguoFilterRow, HongguoSearchItem } from '@/lib/hongguo/config';

import PageLayout from '@/components/PageLayout';

type Tab = 'home' | 'recommend' | 'category' | 'rank';

const TABS: { id: Tab; label: string; icon: typeof Clapperboard }[] = [
  { id: 'home', label: '首页', icon: Clapperboard },
  { id: 'recommend', label: '推荐', icon: Sparkles },
  { id: 'category', label: '分类', icon: LayoutGrid },
  { id: 'rank', label: '榜单', icon: Trophy },
];

const GENRES = [
  { id: 'short_play', label: '短剧' },
  { id: 'comic_series', label: '漫剧' },
  { id: 'ai_series', label: 'AI短剧' },
];

/** 筛选面板 type -> browse 接口查询参数。 */
const FILTER_PARAM: Record<string, string> = {
  category_dim_theme: 'theme',
  category_dim_role: 'setting',
  category_dim_epoch: 'background',
  sort: 'sort',
  gender: 'gender',
  creation_status: 'status',
  online_time: 'days',
};

const RANK_BOARDS = [
  { id: 'hot_score', label: '热播榜' },
  { id: 'hot_collect', label: '收藏榜' },
  { id: 'online_time', label: '最新榜' },
];

interface CardItem extends HongguoSearchItem {
  rank?: number;
}

function DramaCard({ item }: { item: CardItem }) {
  return (
    <Link
      href={`/duanju/hongguo/play?id=${item.id}&title=${encodeURIComponent(item.title)}`}
      className='group'
    >
      <div className='relative aspect-[3/4] overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.cover}
          alt={item.title}
          loading='lazy'
          className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
          referrerPolicy='no-referrer'
        />
        <div className='absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100'>
          <Play className='h-8 w-8 text-white' fill='currentColor' />
        </div>
        {item.rank !== undefined && (
          <span className='absolute left-0 top-0 rounded-br-lg bg-gradient-to-br from-amber-500 to-red-500 px-2 py-0.5 text-xs font-bold text-white shadow'>
            {item.rank}
          </span>
        )}
        {item.episodeCount > 0 && (
          <span className='absolute bottom-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white'>
            全{item.episodeCount}集
          </span>
        )}
      </div>
      <div className='mt-2 line-clamp-2 text-xs font-medium text-gray-900 group-hover:text-green-600 sm:text-sm dark:text-gray-100 dark:group-hover:text-green-400'>
        {item.title}
      </div>
      {item.desc && (
        <div className='mt-0.5 line-clamp-1 text-[11px] text-gray-400 dark:text-gray-500'>
          {item.desc}
        </div>
      )}
    </Link>
  );
}

function CardGrid({ items }: { items: CardItem[] }) {
  return (
    <div className='grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7'>
      {items.map((item) => (
        <DramaCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function HongguoClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>('home');
  const [keyword, setKeyword] = useState(searchParams.get('q') || '');
  const [searching, setSearching] = useState(false);
  const [searchItems, setSearchItems] = useState<HongguoSearchItem[]>([]);
  const [shownQuery, setShownQuery] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = keyword.trim();
    if (!q) return;
    router.replace(`/duanju/hongguo?q=${encodeURIComponent(q)}`);
    setSearching(true);
    setShownQuery(q);
    void fetch(`/api/duanju/hongguo/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((json) => setSearchItems(json.ok ? json.items || [] : []))
      .catch(() => setSearchItems([]));
  };

  const clearSearch = () => {
    setKeyword('');
    setSearching(false);
    router.replace('/duanju/hongguo');
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    if (searching) clearSearch();
  };

  return (
    <PageLayout activePath='/duanju'>
      <div className='mx-auto max-w-7xl px-4 py-6 sm:px-10 sm:py-8'>
        <div className='mb-6 flex items-center gap-3'>
          <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/15 text-green-600 dark:text-green-400'>
            <Clapperboard className='h-5 w-5' />
          </div>
          <div>
            <h1 className='text-xl font-bold text-gray-900 sm:text-2xl dark:text-gray-100'>
              红果短剧
            </h1>
            <p className='text-xs text-gray-500 sm:text-sm dark:text-gray-400'>
              全集直连 · 即点即播
            </p>
          </div>
        </div>

        <form onSubmit={submit} className='mb-5 flex gap-2'>
          <div className='relative flex-1'>
            <SearchIcon className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400' />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder='搜索短剧，如：甜宠 / 战神 / 归来'
              className='w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
            />
          </div>
          <button
            type='submit'
            className='rounded-xl bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700'
          >
            搜索
          </button>
        </form>

        {!searching && (
          <div className='mb-6 flex gap-1 border-b border-gray-200 dark:border-gray-800'>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => switchTab(id)}
                className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === id
                    ? 'border-green-600 text-green-600 dark:border-green-400 dark:text-green-400'
                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <Icon className='h-4 w-4' />
                {label}
              </button>
            ))}
          </div>
        )}

        {searching ? (
          <SearchResults
            query={shownQuery}
            items={searchItems}
            onBack={clearSearch}
          />
        ) : tab === 'home' ? (
          <HomeTab />
        ) : tab === 'recommend' ? (
          <RecommendTab />
        ) : tab === 'category' ? (
          <CategoryTab />
        ) : (
          <RankTab />
        )}
      </div>
    </PageLayout>
  );
}

/** 搜索态视图。 */
function SearchResults({
  query,
  items,
  onBack,
}: {
  query: string;
  items: HongguoSearchItem[];
  onBack: () => void;
}) {
  return (
    <div>
      <div className='mb-3 flex items-center justify-between'>
        <h2 className='text-sm font-semibold text-gray-700 dark:text-gray-300'>
          「{query}」的搜索结果
        </h2>
        <button
          onClick={onBack}
          className='text-xs text-gray-500 underline hover:text-green-600 dark:text-gray-400'
        >
          返回
        </button>
      </div>
      {items.length === 0 ? (
        <div className='py-24 text-center text-sm text-gray-400'>
          没有找到相关短剧，换个关键词试试
        </div>
      ) : (
        <CardGrid items={items} />
      )}
    </div>
  );
}

/**
 * 懒加载列表通用逻辑：首屏 + 无限滚动续页。
 * deps（体裁/筛选/榜单/换一批）变化时清空重载；请求带序号，
 * 丢弃过期响应，避免快速切换时旧结果覆盖新结果。
 */
function usePagedList(buildUrl: (skip: number) => string, deps: unknown[]) {
  const [items, setItems] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [nextSkip, setNextSkip] = useState(0);
  const reqId = useRef(0);

  const load = useCallback(
    async (skip: number, append: boolean) => {
      const my = reqId.current + 1;
      reqId.current = my;
      setLoading(true);
      setError('');
      try {
        const res = await fetch(buildUrl(skip));
        const json = await res.json();
        if (my !== reqId.current) return;
        if (!json.ok) throw new Error(json.message || '加载失败');
        const list = (json.items || []) as CardItem[];
        setItems((prev) => (append ? [...prev, ...list] : list));
        setHasMore(!!json.hasMore);
        setNextSkip(json.nextSkip ?? skip + list.length);
      } catch (err) {
        if (my !== reqId.current) return;
        setError((err as Error).message);
        if (!append) setItems([]);
      } finally {
        if (my === reqId.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  );

  useEffect(() => {
    setItems([]);
    setHasMore(false);
    setNextSkip(0);
    void load(0, false);
  }, [load]);

  return { items, loading, error, hasMore, nextSkip, load };
}

/**
 * 无限滚动列表体：滚到底自动续页，无需「加载更多」按钮。
 * ranked 为真时给卡片加排名角标。
 */
function PagedGrid({
  items,
  loading,
  error,
  hasMore,
  nextSkip,
  load,
  ranked = false,
  emptyText = '暂无内容',
}: {
  items: CardItem[];
  loading: boolean;
  error: string;
  hasMore: boolean;
  nextSkip: number;
  load: (skip: number, append: boolean) => Promise<void>;
  ranked?: boolean;
  emptyText?: string;
}) {
  const sentinel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) void load(nextSkip, true);
      },
      { rootMargin: '600px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, nextSkip, load]);

  if (items.length === 0) {
    if (loading) {
      return (
        <div className='flex justify-center py-24 text-gray-400'>
          <Loader2 className='h-6 w-6 animate-spin' />
        </div>
      );
    }
    if (error) {
      return (
        <div className='py-24 text-center text-sm text-red-600 dark:text-red-400'>
          {error}
          <button onClick={() => void load(0, false)} className='ml-3 underline'>
            重试
          </button>
        </div>
      );
    }
    return <div className='py-24 text-center text-sm text-gray-400'>{emptyText}</div>;
  }

  const shown: CardItem[] = ranked ? items.map((it, i) => ({ ...it, rank: i + 1 })) : items;

  return (
    <div>
      <CardGrid items={shown} />
      {error && (
        <div className='py-6 text-center text-sm text-red-600 dark:text-red-400'>
          {error}
          <button onClick={() => void load(nextSkip, true)} className='ml-3 underline'>
            重试
          </button>
        </div>
      )}
      {hasMore && <div ref={sentinel} className='h-10' />}
      {loading && (
        <div className='flex justify-center py-6 text-gray-400'>
          <Loader2 className='h-5 w-5 animate-spin' />
        </div>
      )}
      {!hasMore && !loading && (
        <div className='py-6 text-center text-xs text-gray-400 dark:text-gray-500'>
          已经到底啦
        </div>
      )}
    </div>
  );
}

/** 首页：大量短剧，按热度排列。 */
function HomeTab() {
  const { items, loading, error, hasMore, nextSkip, load } = usePagedList(
    (skip) =>
      `/api/duanju/hongguo/browse?genre=short_play&sort=hot_score&limit=60&skip=${skip}`,
    []
  );

  return (
    <div>
      <h2 className='mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300'>全部短剧</h2>
      <PagedGrid
        items={items}
        loading={loading}
        error={error}
        hasMore={hasMore}
        nextSkip={nextSkip}
        load={load}
        emptyText='暂无内容'
      />
    </div>
  );
}

/** 推荐：热门池按 seed 重排的随机流。 */
function RecommendTab() {
  const [seed, setSeed] = useState(0);
  const { items, loading, error, hasMore, nextSkip, load } = usePagedList(
    (skip) => `/api/duanju/hongguo/recommend?limit=36&seed=${seed}&skip=${skip}`,
    [seed]
  );

  return (
    <div>
      <div className='mb-3 flex items-center justify-between'>
        <h2 className='text-sm font-semibold text-gray-700 dark:text-gray-300'>为你推荐</h2>
        <button
          onClick={() => setSeed((s) => s + 1)}
          className='text-xs text-gray-500 underline hover:text-green-600 dark:text-gray-400'
        >
          换一批
        </button>
      </div>
      <PagedGrid
        items={items}
        loading={loading}
        error={error}
        hasMore={hasMore}
        nextSkip={nextSkip}
        load={load}
        emptyText='暂时没有推荐内容'
      />
    </div>
  );
}

/** 分类：体裁 + 筛选面板 + 结果。 */
function CategoryTab() {
  const [genre, setGenre] = useState('short_play');
  const [rows, setRows] = useState<HongguoFilterRow[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [selKey, setSelKey] = useState('');

  useEffect(() => {
    setRows([]);
    setSelected({});
    setSelKey('');
    void fetch(`/api/duanju/hongguo/filters?genre=${genre}`)
      .then((r) => r.json())
      .then((json) => setRows(json.ok ? json.rows || [] : []))
      .catch(() => setRows([]));
  }, [genre]);

  const { items, loading, error, hasMore, nextSkip, load } = usePagedList(
    (skip) => {
      const params = new URLSearchParams({ genre, limit: '60', skip: String(skip) });
      for (const [k, v] of Object.entries(selected)) {
        if (v) params.set(k, v);
      }
      return `/api/duanju/hongguo/browse?${params.toString()}`;
    },
    [genre, selKey]
  );

  const toggle = (paramKey: string, id: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[paramKey] === id) delete next[paramKey];
      else next[paramKey] = id;
      return next;
    });
    setSelKey(`${paramKey}:${id}:${Date.now()}`);
  };

  return (
    <div>
      <div className='mb-4 flex gap-2'>
        {GENRES.map((g) => (
          <button
            key={g.id}
            onClick={() => setGenre(g.id)}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              genre === g.id
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {rows.length > 0 && (
        <div className='mb-5 space-y-2.5'>
          {rows.map((row) => {
            const paramKey = FILTER_PARAM[row.type];
            if (!paramKey) return null;
            return (
              <div key={row.type} className='flex gap-3'>
                <span className='w-14 shrink-0 pt-1 text-xs text-gray-400 dark:text-gray-500'>
                  {row.rowName}
                </span>
                <div className='flex flex-wrap gap-2'>
                  {row.items.map((it) => {
                    const active = selected[paramKey] === it.id;
                    return (
                      <button
                        key={it.id}
                        onClick={() => toggle(paramKey, it.id)}
                        className={`rounded-full px-3 py-1 text-xs transition-colors ${
                          active
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                      >
                        {it.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PagedGrid
        items={items}
        loading={loading}
        error={error}
        hasMore={hasMore}
        nextSkip={nextSkip}
        load={load}
        emptyText='没有符合条件的短剧'
      />
    </div>
  );
}

/** 榜单：热播 / 收藏 / 最新。 */
function RankTab() {
  const [board, setBoard] = useState('hot_score');
  const { items, loading, error, hasMore, nextSkip, load } = usePagedList(
    (skip) => `/api/duanju/hongguo/browse?genre=short_play&sort=${board}&limit=60&skip=${skip}`,
    [board]
  );

  return (
    <div>
      <div className='mb-4 flex gap-2'>
        {RANK_BOARDS.map((b) => (
          <button
            key={b.id}
            onClick={() => setBoard(b.id)}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              board === b.id
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <PagedGrid
        items={items}
        loading={loading}
        error={error}
        hasMore={hasMore}
        nextSkip={nextSkip}
        load={load}
        ranked
        emptyText='暂无榜单数据'
      />
    </div>
  );
}

export default function HongguoPage() {
  return (
    <Suspense>
      <HongguoClient />
    </Suspense>
  );
}
