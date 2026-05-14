'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { BookSource } from '@/lib/book.types';

function BooksHomeSkeleton() {
  return (
    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3 animate-pulse'>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className='rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950'>
          <div className='h-5 w-32 rounded bg-gray-200 dark:bg-gray-800' />
          <div className='mt-3 flex gap-2'>
            <div className='h-6 w-16 rounded-full bg-gray-200 dark:bg-gray-800' />
            <div className='h-6 w-16 rounded-full bg-gray-200 dark:bg-gray-800' />
          </div>
          <div className='mt-4 flex gap-2'>
            <div className='h-10 w-24 rounded-2xl bg-gray-200 dark:bg-gray-800' />
            <div className='h-10 w-24 rounded-2xl bg-gray-200 dark:bg-gray-800' />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BooksHomePage() {
  const [sources, setSources] = useState<BookSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as Window & { RUNTIME_CONFIG?: { BOOKS_ENABLED?: boolean } }).RUNTIME_CONFIG?.BOOKS_ENABLED) {
      window.location.href = '/';
      return;
    }
    fetch('/api/books/sources')
      .then((res) => res.json())
      .then((data) => setSources(data.sources || []))
      .catch((err) => setError(err.message || '加载书源失败'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className='space-y-6'>
      <section className='rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950'>
        <h1 className='text-lg font-semibold'>OPDS 电子书源</h1>
        <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>支持分类浏览、搜索、书架与 EPUB 在线阅读�?/p>
      </section>

      {loading ? <BooksHomeSkeleton /> : null}
      {error ? <div className='text-sm text-red-500'>{error}</div> : null}

      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
        {sources.map((source) => (
          <div key={source.id} className='rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950'>
            <div className='text-base font-semibold'>{source.name}</div>
            <div className='mt-2 flex flex-wrap gap-2 text-xs'>
              <span className={`rounded-full px-2 py-1 ${source.capabilities?.catalogSupported ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-400'}`}>分类{source.capabilities?.catalogSupported ? '可用' : '不可�?}</span>
              <span className={`rounded-full px-2 py-1 ${source.capabilities?.searchSupported ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-400'}`}>搜索{source.capabilities?.searchSupported ? '可用' : '不可�?}</span>
            </div>
            <div className='mt-4 flex flex-wrap gap-2'>
              {source.capabilities?.catalogSupported && <Link href={`/books/catalog?sourceId=${encodeURIComponent(source.id)}`} className='rounded-2xl bg-sky-600 px-4 py-2 text-sm text-white'>浏览目录</Link>}
              {source.capabilities?.searchSupported && <Link href={`/books/search?sourceId=${encodeURIComponent(source.id)}`} className='rounded-2xl border border-gray-200 px-4 py-2 text-sm dark:border-gray-700'>搜索书籍</Link>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
