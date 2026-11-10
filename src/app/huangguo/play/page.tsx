'use client';

import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import PageLayout from '@/components/PageLayout';

type Episode = { ep_num: number; title?: string; duration?: number; status?: number };

type Detail = {
  id: number;
  title: string;
  description?: string;
  cover?: string;
  tags?: string[];
  score?: number;
  episodes?: Episode[];
  total_episodes?: number;
  is_finished?: boolean;
};

type PlayInfo = { url: string; hevc?: string; auth?: string };

const hlsUrl = (u: string, auth?: string) =>
  `/api/huangguo/hls?u=${encodeURIComponent(u)}${auth ? `&h=${encodeURIComponent(auth)}` : ''}`;
const progressKey = (id: string) => `huangguo:progress:${id}`;

function Player({ src, auth, cover, onEnded }: { src: string; auth?: string; cover?: string; onEnded: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setError('');
    const isHls = /\.m3u8(\?|$)/i.test(src);
    let destroy: (() => void) | undefined;

    if (isHls && !video.canPlayType('application/vnd.apple.mpegurl')) {
      let cancelled = false;
      import('hls.js')
        .then(({ default: Hls }) => {
          if (cancelled || !Hls.isSupported()) {
            if (!cancelled) setError('当前浏览器不支持 HLS 播放');
            return;
          }
          const hls = new Hls({ maxBufferLength: 30 });
          hls.loadSource(hlsUrl(src, auth));
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (data.fatal) setError('视频加载失败，请切换线路或重试');
          });
          destroy = () => hls.destroy();
        })
        .catch(() => setError('播放器加载失败'));
      return () => {
        cancelled = true;
        destroy?.();
      };
    }

    video.src = isHls ? hlsUrl(src, auth) : src;
    return () => {
      video.removeAttribute('src');
      video.load();
    };
  }, [src, auth]);

  return (
    <div className='relative w-full overflow-hidden rounded-xl bg-black shadow-sm'>
      <video
        ref={videoRef}
        controls
        autoPlay
        playsInline
        onEnded={onEnded}
        poster={cover ? `/api/huangguo/cover?u=${encodeURIComponent(cover)}` : undefined}
        className='aspect-video w-full bg-black'
      />
      {error && (
        <p className='absolute inset-x-0 bottom-0 bg-red-600/80 px-3 py-1.5 text-center text-xs text-white'>{error}</p>
      )}
    </div>
  );
}

function PlayContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const id = sp.get('id') || '';
  const epParam = parseInt(sp.get('ep') || '1', 10) || 1;

  const [detail, setDetail] = useState<Detail | null>(null);
  const [play, setPlay] = useState<PlayInfo | null>(null);
  const [ep, setEp] = useState(epParam);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const episodes = detail?.episodes || [];
  const maxEp = episodes.length ? Math.max(...episodes.map((e) => e.ep_num)) : detail?.total_episodes || 1;

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    fetch(`/api/huangguo/api?action=detail&id=${id}`)
      .then((r) => r.json())
      .then((j: { ok: boolean; data?: Detail; message?: string }) => {
        if (!alive) return;
        if (!j.ok) throw new Error(j.message || '详情加载失败');
        setDetail(j.data || null);
      })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  const loadPlay = useCallback(
    async (target: number) => {
      if (!id) return;
      setError('');
      try {
        const res = await fetch(`/api/huangguo/api?action=play&id=${id}&ep=${target}`);
        const j = (await res.json()) as { ok: boolean; data?: PlayInfo; message?: string };
        if (!j.ok || !j.data) throw new Error(j.message || '播放地址获取失败');
        setPlay(j.data);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [id]
  );

  useEffect(() => {
    void loadPlay(ep);
    router.replace(`/huangguo/play?id=${id}&ep=${ep}`, { scroll: false });
    try {
      localStorage.setItem(progressKey(id), String(ep));
    } catch {
      /* ignore */
    }
  }, [ep, id, loadPlay, router]);

  const switchEpisode = useCallback(
    (target: number) => {
      if (target < 1 || target > maxEp) return;
      setEp(target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [maxEp]
  );

  const src = play?.url || '';

  return (
    <PageLayout activePath='/huangguo'>
      <div className='mx-auto w-full max-w-5xl px-3 pb-24 pt-3 sm:px-6 sm:pt-6'>
        <div className='mb-3 flex items-center gap-2'>
          <Link
            href='/huangguo'
            className='flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-700'
          >
            <ArrowLeft className='h-3.5 w-3.5' /> 返回
          </Link>
          <h1 className='line-clamp-1 text-sm font-medium text-gray-900 dark:text-gray-100'>
            {detail?.title || '加载中…'}
          </h1>
        </div>

        {src ? (
          <Player key={`${id}-${ep}`} src={src} auth={play?.auth} cover={detail?.cover} onEnded={() => switchEpisode(ep + 1)} />
        ) : (
          <div className='flex aspect-video w-full items-center justify-center rounded-xl bg-gray-900/90'>
            {error ? (
              <span className='px-4 text-center text-xs text-red-300'>{error}</span>
            ) : (
              <Loader2 className='h-6 w-6 animate-spin text-white/60' />
            )}
          </div>
        )}

        <div className='mt-3 flex items-center justify-between'>
          <button
            type='button'
            onClick={() => switchEpisode(ep - 1)}
            disabled={ep <= 1}
            className='flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs text-gray-700 ring-1 ring-gray-200 transition hover:bg-gray-50 disabled:opacity-40 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-gray-700'
          >
            <ChevronLeft className='h-3.5 w-3.5' /> 上一集
          </button>
          <span className='text-xs text-gray-500 dark:text-gray-400'>
            第 {ep} / {maxEp} 集
          </span>
          <button
            type='button'
            onClick={() => switchEpisode(ep + 1)}
            disabled={ep >= maxEp}
            className='flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs text-gray-700 ring-1 ring-gray-200 transition hover:bg-gray-50 disabled:opacity-40 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-gray-700'
          >
            下一集 <ChevronRight className='h-3.5 w-3.5' />
          </button>
        </div>

        {detail && (
          <div className='mt-4 rounded-xl bg-white p-3 ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700/70'>
            <p className='mb-1 line-clamp-1 text-xs text-gray-600 dark:text-gray-300'>
              {detail.tags?.slice(0, 4).join(' · ') || ''}
              {detail.score ? ` · 评分 ${detail.score}` : ''}
              {detail.is_finished ? ' · 已完结' : ''}
            </p>
            {detail.description && (
              <p className='line-clamp-3 text-[11.5px] leading-relaxed text-gray-500 dark:text-gray-400'>
                {detail.description}
              </p>
            )}
          </div>
        )}

        {loading && <p className='mt-4 text-center text-xs text-gray-400 dark:text-gray-500'>加载剧集中…</p>}

        {episodes.length > 0 && (
          <div className='mt-4'>
            <p className='mb-2 text-xs text-gray-600 dark:text-gray-300'>选集</p>
            <div className='grid grid-cols-6 gap-2 sm:grid-cols-10 md:grid-cols-12'>
              {episodes.map((e) => (
                <button
                  key={e.ep_num}
                  type='button'
                  onClick={() => switchEpisode(e.ep_num)}
                  className={`rounded-lg py-1.5 text-xs transition ${
                    e.ep_num === ep
                      ? 'bg-amber-500 text-white'
                      : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-gray-700'
                  }`}
                >
                  {e.ep_num}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default function HuangguoPlayPage() {
  return (
    <Suspense
      fallback={
        <div className='flex h-screen items-center justify-center'>
          <Loader2 className='h-6 w-6 animate-spin text-gray-400' />
        </div>
      }
    >
      <PlayContent />
    </Suspense>
  );
}
