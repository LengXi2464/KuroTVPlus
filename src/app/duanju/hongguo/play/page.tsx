'use client';

import { ArrowLeft, Clapperboard, Loader2, SkipBack, SkipForward } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  HongguoEpisode,
  HongguoPlayInfo,
  HongguoSeries,
  HongguoStream,
} from '@/lib/hongguo/config';
import {
  canPlayHevcNatively,
  HongguoPlayer,
  type HongguoPlaybackStatus,
} from '@/lib/hongguo/player';

import PageLayout from '@/components/PageLayout';

const progressKey = (seriesId: string) => `hongguo:progress:${seriesId}`;

function statusText(status: HongguoPlaybackStatus, detail?: string): string {
  switch (status) {
    case 'downloading':
      return '正在下载视频数据…';
    case 'parsing':
      return '正在解析视频…';
    case 'decrypting':
      return '正在解密视频…';
    case 'transcoding':
      return detail || '正在转码（HEVC → H.264）…';
    case 'playing':
      return '';
    case 'ended':
      return '本集播放完毕';
    default:
      return detail || '';
  }
}

function HongguoPlayClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const seriesId = searchParams.get('id') || '';
  const titleParam = searchParams.get('title') || '';
  const epParam = Number(searchParams.get('ep') || '0');

  const [series, setSeries] = useState<HongguoSeries | null>(null);
  const [episodes, setEpisodes] = useState<HongguoEpisode[]>([]);
  const [currentSeq, setCurrentSeq] = useState<number>(epParam > 0 ? epParam : 0);
  const [loadError, setLoadError] = useState('');

  const [status, setStatus] = useState<HongguoPlaybackStatus>('downloading');
  const [statusDetail, setStatusDetail] = useState('');
  const [progress, setProgress] = useState(0);
  const [playError, setPlayError] = useState('');
  const [mode, setMode] = useState('');
  const [streams, setStreams] = useState<HongguoStream[]>([]);
  const [selectedDef, setSelectedDef] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HongguoPlayer | null>(null);
  const playTokenRef = useRef(0);

  // 拉详情 + 分集
  useEffect(() => {
    if (!seriesId) return;
    let cancelled = false;
    (async () => {
      try {
        const [sr, er] = await Promise.all([
          fetch(`/api/duanju/hongguo/series?id=${seriesId}`).then((r) => r.json()),
          fetch(`/api/duanju/hongguo/episodes?series_id=${seriesId}`).then((r) => r.json()),
        ]);
        if (cancelled) return;
        if (!sr.ok) throw new Error(sr.message || '详情加载失败');
        if (!er.ok) throw new Error(er.message || '分集加载失败');
        setSeries(sr.series);
        setEpisodes(er.items || []);
        if (epParam <= 0) {
          let initial = 1;
          try {
            const saved = Number(localStorage.getItem(progressKey(seriesId)) || '0');
            if (saved >= 1 && saved <= (er.items || []).length) initial = saved;
          } catch {
            /* noop */
          }
          setCurrentSeq(initial);
        }
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId]);

  const currentEpisode = useMemo(
    () => episodes.find((e) => e.seq === currentSeq) || null,
    [episodes, currentSeq]
  );

  // 选流：原生可解 HEVC 选最高清，否则选最低清（转码省 CPU）
  const pickStream = useCallback((list: HongguoStream[]): HongguoStream | null => {
    if (list.length === 0) return null;
    const video = document.createElement('video');
    const nativeHevc = canPlayHevcNatively(video);
    const sorted = [...list].sort(
      (a, b) => parseInt(a.definition, 10) - parseInt(b.definition, 10)
    );
    return nativeHevc ? sorted[sorted.length - 1] : sorted[0];
  }, []);

  // 播放某一集
  const playEpisode = useCallback(
    async (ep: HongguoEpisode, preferredDef?: string) => {
      const token = ++playTokenRef.current;
      playerRef.current?.dispose();
      playerRef.current = null;
      setPlayError('');
      setProgress(0);
      setStatus('downloading');
      setStatusDetail('');

      try {
        const res = await fetch(`/api/duanju/hongguo/play?episode_id=${ep.id}`);
        const info: HongguoPlayInfo = await res.json();
        if (token !== playTokenRef.current) return;
        if (!info.ok || !info.streams?.length) {
          throw new Error(info.message || '该集暂无播放地址');
        }
        setStreams(info.streams);
        const stream =
          (selectedDef && info.streams.find((s) => s.definition === selectedDef)) ||
          (preferredDef && info.streams.find((s) => s.definition === preferredDef)) ||
          pickStream(info.streams);
        if (!stream) throw new Error('该集暂无可用清晰度');
        setSelectedDef(stream.definition);

        const video = videoRef.current;
        if (!video) return;
        const player = new HongguoPlayer({
          video,
          playUrl: stream.url,
          contentKey: stream.contentKey || info.contentKey || '',
          onStatus: (s, detail) => {
            if (token !== playTokenRef.current) return;
            setStatus(s);
            setStatusDetail(detail || '');
            if (s === 'ended') {
              // 自动下一集
              const next = episodes.find((e) => e.seq === ep.seq + 1);
              if (next) {
                try {
                  localStorage.setItem(progressKey(seriesId), String(next.seq));
                } catch {
                  /* noop */
                }
                router.replace(
                  `/duanju/hongguo/play?id=${seriesId}&title=${encodeURIComponent(
                    titleParam || (series && series.title) || ''
                  )}&ep=${next.seq}`
                );
                setCurrentSeq(next.seq);
              }
            }
          },
          onProgress: (r) => {
            if (token === playTokenRef.current) setProgress(r);
          },
          onMode: (m) => {
            if (token === playTokenRef.current) setMode(m);
          },
          onError: (err) => {
            if (token === playTokenRef.current) setPlayError(err.message);
          },
        });
        playerRef.current = player;
        void player.start();
      } catch (err) {
        if (token === playTokenRef.current) setPlayError((err as Error).message);
      }
    },
    [episodes, pickStream, router, selectedDef, series, seriesId, titleParam]
  );

  useEffect(() => {
    if (currentEpisode) {
      try {
        localStorage.setItem(progressKey(seriesId), String(currentEpisode.seq));
      } catch {
        /* noop */
      }
      void playEpisode(currentEpisode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEpisode?.id]);

  useEffect(
    () => () => {
      playTokenRef.current++;
      playerRef.current?.dispose();
    },
    []
  );

  const switchEpisode = (seq: number) => {
    if (!episodes.some((e) => e.seq === seq)) return;
    router.replace(
      `/duanju/hongguo/play?id=${seriesId}&title=${encodeURIComponent(
        titleParam || series?.title || ''
      )}&ep=${seq}`
    );
    setCurrentSeq(seq);
  };

  const title = series?.title || titleParam || '红果短剧';
  const busy = status !== 'playing' && status !== 'ended' && status !== 'error' && !playError;

  return (
    <PageLayout activePath='/duanju'>
      <div className='px-4 sm:px-10 py-6 max-w-6xl mx-auto'>
        <div className='mb-4 flex items-center gap-3'>
          <Link
            href='/duanju/hongguo'
            className='inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
          >
            <ArrowLeft className='h-4 w-4' />
            返回
          </Link>
          <div className='flex items-center gap-2 min-w-0'>
            <Clapperboard className='h-5 w-5 shrink-0 text-green-600' />
            <h1 className='truncate text-lg font-bold text-gray-900 dark:text-gray-100'>
              {title}
              {currentEpisode ? (
                <span className='ml-2 text-sm font-normal text-gray-500'>
                  第 {currentEpisode.seq} 集{episodes.length > 0 ? ` / 共 ${episodes.length} 集` : ''}
                </span>
              ) : null}
            </h1>
          </div>
        </div>

        {loadError && (
          <div className='mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300'>
            {loadError}
          </div>
        )}

        <div className='relative overflow-hidden rounded-2xl bg-black shadow-xl'>
          <video
            ref={videoRef}
            className='aspect-video w-full'
            controls
            playsInline
            autoPlay
            crossOrigin='anonymous'
            onEnded={() => switchEpisode(currentSeq + 1)}
          />
          {(busy || playError) && (
            <div className='absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center'>
              {playError ? (
                <>
                  <p className='text-sm text-red-300'>{playError}</p>
                  <button
                    onClick={() => currentEpisode && void playEpisode(currentEpisode)}
                    className='rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700'
                  >
                    重试
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className='h-8 w-8 animate-spin text-green-400' />
                  <p className='text-sm text-gray-200'>{statusText(status, statusDetail)}</p>
                  {(status === 'downloading' || status === 'decrypting' || status === 'transcoding') && (
                    <div className='h-1.5 w-56 overflow-hidden rounded-full bg-white/15'>
                      <div
                        className='h-full rounded-full bg-green-500 transition-all'
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                  )}
                  {status === 'transcoding' && (
                    <p className='text-xs text-gray-400'>
                      首次转码需要先把整集处理完，请稍候
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className='mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400'>
          {mode && (
            <span className='rounded-md bg-gray-100 px-2 py-1 dark:bg-gray-800'>
              {mode === 'native' ? '原生播放' : 'WASM 转码播放'}
            </span>
          )}
          {streams.length > 1 && (
            <span className='flex items-center gap-1'>
              清晰度：
              {streams.map((s) => (
                <button
                  key={s.definition}
                  onClick={() => currentEpisode && void playEpisode(currentEpisode, s.definition)}
                  className={`rounded-md px-2 py-1 ${
                    selectedDef === s.definition
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'
                  }`}
                >
                  {s.definition}
                </button>
              ))}
            </span>
          )}
          <span className='ml-auto flex items-center gap-2'>
            <button
              onClick={() => switchEpisode(currentSeq - 1)}
              disabled={!episodes.some((e) => e.seq === currentSeq - 1)}
              className='inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-40 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
            >
              <SkipBack className='h-4 w-4' />
              上一集
            </button>
            <button
              onClick={() => switchEpisode(currentSeq + 1)}
              disabled={!episodes.some((e) => e.seq === currentSeq + 1)}
              className='inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-40'
            >
              下一集
              <SkipForward className='h-4 w-4' />
            </button>
          </span>
        </div>

        {episodes.length > 0 && (
          <div className='mt-6'>
            <h2 className='mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100'>
              选集（{episodes.length}）
            </h2>
            <div className='grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12'>
              {episodes.map((ep) => (
                <button
                  key={ep.id}
                  onClick={() => switchEpisode(ep.seq)}
                  className={`rounded-lg py-2 text-sm transition-colors ${
                    ep.seq === currentSeq
                      ? 'bg-green-600 font-semibold text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  {ep.seq}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default function HongguoPlayPage() {
  return (
    <Suspense>
      <HongguoPlayClient />
    </Suspense>
  );
}
