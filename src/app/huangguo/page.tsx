'use client';

import { Clapperboard, Flame, LayoutGrid, Loader2, Play, Search as SearchIcon, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import PageLayout from '@/components/PageLayout';

type Tab = 'home' | 'category' | 'rank' | 'search';

const TABS: { id: Tab; label: string; icon: typeof Clapperboard }[] = [
  { id: 'home', label: '首页', icon: Clapperboard },
  { id: 'category', label: '分类', icon: LayoutGrid },
  { id: 'rank', label: '榜单', icon: Trophy },
  { id: 'search', label: '搜索', icon: SearchIcon },
];

const CATEGORIES = [
  { cate: 'ai-duanju', name: 'AI成人短剧', desc: '高能反转 · 一口气看完' },
  { cate: 'ai-manju', name: 'AI成人漫剧', desc: '国创漫剧 · 每周更新' },
  { cate: 'ai-huanlian', name: 'AI换脸', desc: '换脸演绎 · 全新剧情' },
  { cate: 'ai-mogai', name: 'AI魔改', desc: '魔改名场面 · 脑洞大开' },
];

const RANKS = [
  { type: 'hot', label: '热度榜' },
  { type: 'recommend', label: '推荐榜' },
  { type: 'potential', label: '潜力榜' },
];

type Video = {
  id: number;
  title: string;
  cover: string;
  score?: number;
  tags?: string[];
  episode_count?: number;
  total_episodes?: number;
  is_finished?: boolean;
};

type Card = Video & { cate_name?: string; metric_label?: string; metric_value?: number; rank?: number };

type Paged = { items?: Card[]; pagination?: { page: number; pages: number } };

const coverUrl = (u: string) => (u ? `/api/huangguo/cover?u=${encodeURIComponent(u)}` : '');

async function callApi(params: Record<string, string>): Promise<Paged> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/huangguo/api?${qs}`);
  const json = (await res.json()) as { ok: boolean; data?: Paged | Card[]; message?: string };
  if (!json.ok) throw new Error(json.message || '请求失败');
  if (Array.isArray(json.data)) return { items: json.data, pagination: { page: 1, pages: 1 } };
  return json.data || {};
}

function DramaCard({ item, showRank }: { item: Card; showRank?: boolean }) {
  const eps = item.total_episodes || item.episode_count || 0;
  return (
    <Link
      href={`/huangguo/play?id=${item.id}`}
      className='group relative overflow-hidden rounded-xl bg-[color:var(--bg-elevated,#1c1c1f)] ring-1 ring-white/5 transition hover:ring-[color:var(--accent,#f97316)]/60'
    >
      <div className='relative aspect-[3/4] w-full overflow-hidden bg-black/40'>
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
        <span className='absolute bottom-1.5 right-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10.5px] text-white/90'>
          {eps ? `全${eps}集` : '更新中'}
        </span>
        <span className='absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100'>
          <Play className='h-8 w-8 text-white drop-shadow' />
        </span>
      </div>
      <div className='px-2 py-1.5'>
        <p className='line-clamp-1 text-[12.5px] text-[color:var(--text-primary,#fff)]'>{item.title}</p>
        <p className='mt-0.5 line-clamp-1 text-[10.5px] text-white/45'>
          {item.cate_name || item.tags?.slice(0, 2).join(' · ') || (item.score ? `评分 ${item.score}` : '')}
        </p>
      </div>
    </Link>
  );
}

function Grid({ items, loading, showRank }: { items: Card[]; loading: boolean; showRank?: boolean }) {
  if (!items.length) {
    return (
      <div className='flex h-40 items-center justify-center text-sm text-white/40'>
        {loading ? <Loader2 className='h-5 w-5 animate-spin' /> : '暂无内容'}
      </div>
    );
  }
  return (
    <div className='grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7'>
      {items.map((item) => (
        <DramaCard key={`${item.id}-${item.rank ?? ''}`} item={item} showRank={showRank} />
      ))}
    </div>
  );
}

function LoadMore({ loading, done, onClick }: { loading: boolean; done: boolean; onClick: () => void }) {
  if (done) return <p className='py-4 text-center text-xs text-white/30'>没有更多了</p>;
  return (
    <div className='py-4 text-center'>
      <button
        type='button'
        onClick={onClick}
        disabled={loading}
        className='rounded-full bg-white/10 px-5 py-1.5 text-xs text-white/80 transition hover:bg-white/20 disabled:opacity-50'
      >
        {loading ? '加载中…' : '加载更多'}
      </button>
    </div>
  );
}

function usePaged(fetcher: (page: number) => Record<string, string>) {
  const [items, setItems] = useState<Card[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const reqId = useRef(0);

  const load = useCallback(
    async (target: number) => {
      const id = ++reqId.current;
      setLoading(true);
      setError('');
      try {
        const data = await callApi(fetcher(target));
        if (id !== reqId.current) return;
        const list = data.items || [];
        setItems((prev) => (target === 1 ? list : [...prev, ...list]));
        setPage(target);
        setPages(data.pagination?.pages || 1);
      } catch (e) {
        if (id === reqId.current) setError((e as Error).message);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [fetcher]
  );

  useEffect(() => {
    setItems([]);
    setPages(1);
    void load(1);
  }, [load]);

  return { items, page, pages, loading, error, load };
}

function FeedTab({ cate }: { cate?: string }) {
  const fetcher = useCallback(
    (page: number): Record<string, string> =>
      cate ? { action: 'category', cate, page: String(page), size: '24' } : { action: 'feed', page: String(page), size: '24' },
    [cate]
  );
  const { items, page, pages, loading, error, load } = usePaged(fetcher);
  return (
    <div>
      {error && <p className='mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300'>{error}</p>}
      <Grid items={items} loading={loading} />
      <LoadMore loading={loading} done={page >= pages} onClick={() => void load(page + 1)} />
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
              cate === c.cate ? 'bg-[color:var(--accent,#f97316)] text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'
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
              type === r.type ? 'bg-[color:var(--accent,#f97316)] text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'
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
      .then((d) => {
        if (!alive) return;
        const list = (d.items || []).map((it) => ({
          ...it,
          id: it.id || (it as unknown as { video_id: number }).video_id,
        }));
        setItems(list);
      })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [type]);
  return (
    <div>
      {error && <p className='mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300'>{error}</p>}
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
          className='h-9 flex-1 rounded-full bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:bg-white/15'
        />
        <button type='submit' className='h-9 rounded-full bg-[color:var(--accent,#f97316)] px-4 text-sm text-white'>
          搜索
        </button>
      </form>
      {error && <p className='mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300'>{error}</p>}
      {!items.length && !loading && !error ? (
        <p className='py-16 text-center text-sm text-white/35'>输入关键词开始搜索</p>
      ) : (
        <Grid items={items} loading={loading} />
      )}
    </div>
  );
}

function HuangguoContent() {
  const sp = useSearchParams();
  const initial = (sp.get('tab') as Tab) || 'home';
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.id === initial) ? initial : 'home');

  return (
    <PageLayout activePath='/huangguo'>
      <div className='mx-auto w-full max-w-6xl px-3 pb-24 pt-4 sm:px-5'>
        <div className='mb-4 flex items-center gap-2'>
          <Flame className='h-5 w-5 text-[color:var(--accent,#f97316)]' />
          <h1 className='text-base font-semibold text-white'>黄果短剧</h1>
        </div>
        <div className='mb-5 flex gap-1 overflow-x-auto rounded-full bg-white/5 p-1'>
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type='button'
                onClick={() => setTab(t.id)}
                className={`flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition ${
                  tab === t.id ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white/80'
                }`}
              >
                <Icon className='h-3.5 w-3.5' />
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
          <Loader2 className='h-6 w-6 animate-spin text-white/60' />
        </div>
      }
    >
      <HuangguoContent />
    </Suspense>
  );
}
