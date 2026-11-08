'use client';

import { Clapperboard, Loader2, Play, Search as SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import type { HongguoSearchItem } from '@/lib/hongguo/config';

import PageLayout from '@/components/PageLayout';

function HongguoListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [keyword, setKeyword] = useState(initialQuery);
  const [items, setItems] = useState<HongguoSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const res = await fetch(`/api/duanju/hongguo/search?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || '搜索失败');
      setItems(json.items || []);
    } catch (err) {
      setError((err as Error).message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery) {
      void doSearch(initialQuery);
    } else {
      // 默认给一个热门词，保证首屏有内容
      const fallback = '甜宠';
      setKeyword(fallback);
      router.replace(`/duanju/hongguo?q=${encodeURIComponent(fallback)}`);
      void doSearch(fallback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = keyword.trim();
    if (!q) return;
    router.replace(`/duanju/hongguo?q=${encodeURIComponent(q)}`);
    void doSearch(q);
  };

  return (
    <PageLayout activePath='/duanju'>
      <div className='px-4 sm:px-10 py-6 sm:py-8 max-w-7xl mx-auto'>
        <div className='flex items-center gap-3 mb-6'>
          <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/15 text-green-600 dark:text-green-400'>
            <Clapperboard className='h-5 w-5' />
          </div>
          <div>
            <h1 className='text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100'>
              红果短剧
            </h1>
            <p className='text-xs sm:text-sm text-gray-500 dark:text-gray-400'>
              全集直连 · 即点即播
            </p>
          </div>
        </div>

        <form onSubmit={submit} className='mb-6 flex gap-2'>
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
            disabled={loading}
            className='rounded-xl bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-60'
          >
            搜索
          </button>
        </form>

        {error && (
          <div className='mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300'>
            {error}
            <button onClick={() => void doSearch(keyword)} className='ml-3 underline'>
              重试
            </button>
          </div>
        )}

        {loading ? (
          <div className='flex items-center justify-center py-24 text-gray-400'>
            <Loader2 className='h-6 w-6 animate-spin' />
          </div>
        ) : searched && items.length === 0 && !error ? (
          <div className='py-24 text-center text-sm text-gray-400'>
            没有找到相关短剧，换个关键词试试
          </div>
        ) : (
          <div className='grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7'>
            {items.map((item) => (
              <Link
                key={item.id}
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
                  {item.episodeCount > 0 && (
                    <span className='absolute bottom-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white'>
                      全{item.episodeCount}集
                    </span>
                  )}
                </div>
                <div className='mt-2 line-clamp-2 text-xs sm:text-sm font-medium text-gray-900 group-hover:text-green-600 dark:text-gray-100 dark:group-hover:text-green-400'>
                  {item.title}
                </div>
                {item.desc && (
                  <div className='mt-0.5 line-clamp-1 text-[11px] text-gray-400 dark:text-gray-500'>
                    {item.desc}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default function HongguoListPage() {
  return (
    <Suspense>
      <HongguoListClient />
    </Suspense>
  );
}
