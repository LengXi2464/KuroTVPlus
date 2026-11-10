'use client';

import { Clapperboard, Flame, LayoutGrid, Loader2, Play, Search as SearchIcon, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import PageLayout from '@/components/PageLayout';
import { huangguoFetch } from '@/lib/huangguo/client';

type Tab = 'home' | 'category' | 'rank' | 'search';

const TABS: { id: Tab; label: string; icon: typeof Clapperboard }[] = [
  { id: 'home', label: '首页', icon: Clapperboard },
  { id: 'category', label: '分类', icon: LayoutGrid },
  { id: 'rank', label: '榜单', icon: Trophy },
  { id: 'search', label: '搜索', icon: SearchIcon },
];

const CATEGORIES = [
  { cate: 'ai-duanju', name: 'AI成人短剧' },
  { cate: 'ai-manju', name: 'AI成人漫剧' },
  { cate: 'ai-huanlian', name: 'AI换脸' },
  { cate: 'ai-mogai', name: 'AI魔改' },
];

const RANKS = [
  { type: 'hot', label: '热度榜' },
  { type: 'recommend', label: '推荐榜' },
  { type: 'potential', label: '潜力榜' },
];

type Card = {
  id: number;
  video_id?: number;
  title: string;
  cover: string;
  score?: number;
  tags?: string[];
  episode_count?: number;
  total_episodes?: number;
  cate_name?: string;
  rank?: number;
};

type Paged = { items?: Card[]; pagination?: { page: number; pages: number } };

const coverUrl = (u: string) => (u ? `/api/huangguo/cover?u=${encodeURIComponent(u)}` : '');

async function callApi(params: Record<string, string>): Promise<Paged> {
  const qs = new URLSearchParams(params).toString();
  const res = await huangguoFetch(`/api/huangguo/api?${qs}`);
  const json = (await res.json()) as { ok: boolean; data?: Paged | Card[]; message?: string };
  if (!json.ok) throw new Error(json.message || '请求失败');
  if (Array.isArray(json.data)) return { items: json.data, pagination: { page: 1, pages: 1 } };
  return json.data || {};
}

function DramaCard({ item, showRank }: { item: Card; showRank?: boolean }) {
  const id = item.id || item.video_id;
  const eps = item.total_episodes || item.episode_count || 0;
  return (
    <Link
      href={`/huangguo/play?id=${id}`}
      className='group overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200/70 transition hover:shadow-md dark:bg-gray-800 dark:ring-gray-700/70'
    >
      <div className='relative aspect-[3/4] w-full overflow-hidden bg-gray-100 dark:bg-gray-900'>
        {item.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl(item.cover)}
            alt={item.title}
            loading='lazy'
            className='h-full w-full object-cover transition duration-300 group-hover:scale-105'
          />
        ) : null}
        {showRank && item.rank ? (
          <span className='absolute left-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300'>
            #{item.rank}
          </span>
        ) : null}
        <span className='absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10.5px] text-white/90'>
          {eps ? `全${eps}集` : '更新中'}
        </span>
        <span className='absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100'>
          <Play className='h-8 w-8 text-white drop-shadow' />
        </span>
      </div>
      <div className='px-2 py-1.5'>
        <p className='line-clamp-1 text-[12.5px] font-medium text-gray-900 dark:text-gray-100'>{item.title}</p>
        <p className='mt-0.5 line-clamp-1 text-[10.5px] text-gray-500 dark:text-gray-400'>
          {item.cate_name || item.tags?.slice(0, 2).join(' · ') || (item.score ? `评分 ${item.score}` : '')}
        </p>
      </div>
    </Link>
  );
}

function Grid({ items, loading, showRank }: { items: Card[]; loading: boolean; showRank?: boolean }) {
  if (!items.length) {
    return (
      <div className='flex h-40 items-center justify-center text-sm text-gray-400 dark:text-gray-500'>
        {loading ? <Loader2 className='h-5 w-5 animate-spin' /> : '暂无内容'}
      </div>
    );
  }
  return (
    <div className='grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7'>
      {items.map((item) => (
        <DramaCard key={`${item.id || item.video_id}-${item.rank ?? ''}`} item={item} showRank={showRank} />
      ))}
    </div>
  );
}

/** 滚动到底部自动加载，不再需要「加载更多」按钮。 */
function InfiniteSentinel({ onReach, disabled }: { onReach: () => void; disabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onReach);
  cbRef.current = onReach;

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) cbRef.current();
      },
      { rootMargin: '800px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [disabled]);

  return <div ref={ref} className='h-10' />;
}

function usePaged(build: (page: number) => Record<string, string>) {
  const [items, setItems] = useState<Card[]>([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pageRef = useRef(0);
  const pagesRef = useRef(1);
  const loadingRef = useRef(false);
  const reqRef = useRef(0);

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return;
    if (pageRef.current > 0 && pageRef.current >= pagesRef.current) return;
    const next = pageRef.current + 1;
    const reqId = ++reqRef.current;
    loadingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const data = await callApi(build(next));
      if (reqId !== reqRef.current) return;
      const list = data.items || [];
      setItems((prev) => (next === 1 ? list : [...prev, ...list]));
      pageRef.current = next;
      pagesRef.current = data.pagination?.pages || 1;
      setPage(next);
      setPages(pagesRef.current);
    } catch (e) {
      if (reqId === reqRef.current) setError((e as Error).message);
    } finally {
      if (reqId === reqRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [build]);

  useEffect(() => {
    pageRef.current = 0;
    pagesRef.current = 1;
    setItems([]);
    setPage(0);
    setPages(1);
    void loadMore();
  }, [loadMore]);

  return { items, page, pages, loading, error, loadMore };
}

function FeedTab({ cate }: { cate?: string }) {
  const build = useCallback(
    (page: number): Record<string, string> =>
      cate
        ? { action: 'category', cate, page: String(page), size: '24' }
        : { action: 'feed', page: String(page), size: '24' },
    [cate]
  );
  const { items, page, pages, loading, error, loadMore } = usePaged(build);
  const done = page >= pages;

  return (
    <div>
      {error && (
        <div className='mb-3 flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300'>
          <span>{error}</span>
          <button type='button' onClick={() => void loadMore()} className='underline'>
            重试
          </button>
        </div>
      )}
      <Grid items={items} loading={loading && !items.length} />
      {loading && items.length > 0 && (
        <div className='flex justify-center py-4'>
          <Loader2 className='h-5 w-5 animate-spin text-gray-400 dark:text-gray-500' />
        </div>
      )}
      {done && !loading && <p className='py-4 text-center text-xs text-gray-400 dark:text-gray-500'>没有更多了</p>}
      <InfiniteSentinel onReach={loadMore} disabled={done || !!error} />
    </div>
  );
}

function CategoryTab() {
  const [cate, setCate] = useState(CATEGORIES[0].cate);
  return (
    <div>
      <div className='mb-4 flex gap-2 overflow-x-auto pb-1'>
        {CATEGORIES.map((c) => (
          <button
            key={c.cate}
            type='button'
            onClick={() => setCate(c.cate)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs transition ${
              cate === c.cate
                ? 'bg-amber-500 text-white'
                : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-700'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <FeedTab key={cate} cate={cate} />
    </div>
  );
}

function RankTab() {
  const [type, setType] = useState(RANKS[0].type);
  return (
    <div>
      <div className='mb-4 flex gap-2 overflow-x-auto pb-1'>
        {RANKS.map((r) => (
          <button
            key={r.type}
            type='button'
            onClick={() => setType(r.type)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs transition ${
              type === r.type
                ? 'bg-amber-500 text-white'
                : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-700'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <RankList key={type} type={type} />
    </div>
  );
}

function RankList({ type }: { type: string }) {
  const [items, setItems] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    setLoading(true);
    callApi({ action: 'rank', type })
      .then((d) => alive && setItems(d.items || []))
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [type]);
  return (
    <div>
      {error && (
        <p className='mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300'>{error}</p>
      )}
      <Grid items={items} loading={loading} showRank />
    </div>
  );
}

function SearchTab() {
  const sp = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(sp.get('q') || '');
  const [items, setItems] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searched = useRef(false);

  const run = useCallback((keyword: string) => {
    const k = keyword.trim();
    if (!k) return;
    searched.current = true;
    setLoading(true);
    setError('');
    callApi({ action: 'search', q: k, page: '1', size: '30' })
      .then((d) => setItems(d.items || []))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const initial = sp.get('q');
    if (initial && !searched.current) run(initial);
  }, [sp, run]);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.replace(`/huangguo?tab=search&q=${encodeURIComponent(q)}`);
          run(q);
        }}
        className='mb-4 flex gap-2'
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='搜索黄果短剧'
          className='h-10 flex-1 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500'
        />
        <button type='submit' className='h-10 rounded-xl bg-amber-500 px-4 text-sm font-medium text-white hover:bg-amber-600'>
          搜索
        </button>
      </form>
      {error && (
        <p className='mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300'>{error}</p>
      )}
      {!items.length && !loading && !error ? (
        <p className='py-16 text-center text-sm text-gray-400 dark:text-gray-500'>输入关键词开始搜索</p>
      ) : (
        <Grid items={items} loading={loading} />
      )}
    </div>
  );
}

function HuangguoContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const urlTab = sp.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(urlTab && TABS.some((t) => t.id === urlTab) ? urlTab : 'home');

  const switchTab = (t: Tab) => {
    setTab(t);
    router.replace(t === 'home' ? '/huangguo' : `/huangguo?tab=${t}`, { scroll: false });
  };

  return (
    <PageLayout activePath='/huangguo'>
      <div className='mx-auto w-full max-w-6xl px-3 pb-24 pt-4 sm:px-6 sm:pt-6'>
        <div className='mb-4 flex items-center gap-3'>
          <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400'>
            <Flame className='h-5 w-5' />
          </div>
          <div>
            <h1 className='text-lg font-bold text-gray-900 dark:text-gray-100'>黄果短剧</h1>
            <p className='text-xs text-gray-500 dark:text-gray-400'>滚动自动加载 · 自动连播下一集</p>
          </div>
        </div>

        <div className='mb-5 flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800'>
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type='button'
                onClick={() => switchTab(t.id)}
                className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <Icon className='h-4 w-4' />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'home' && <FeedTab />}
        {tab === 'category' && <CategoryTab />}
        {tab === 'rank' && <RankTab />}
        {tab === 'search' && <SearchTab />}
      </div>
    </PageLayout>
  );
}

export default function HuangguoPage() {
  return (
    <Suspense
      fallback={
        <div className='flex h-screen items-center justify-center'>
          <Loader2 className='h-6 w-6 animate-spin text-gray-400' />
        </div>
      }
    >
      <HuangguoContent />
    </Suspense>
  );
}
