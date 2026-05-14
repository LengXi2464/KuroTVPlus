/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AddToPlaylistModal from '@/components/AddToPlaylistModal';
import Toast, { ToastProps } from '@/components/Toast';
import LyricsPiPWindow from '@/components/LyricsPiPWindow';

const SPECTRUM_BIN_COUNT = 96;
const SPECTRUM_IDLE_LEVEL = 0.02;
const SPECTRUM_EDGE_TRIM = 8;
const SPECTRUM_REFERENCE_VOLUME = 10;
const SPECTRUM_MIN_VOLUME = 5;
const SPECTRUM_MAX_REFERENCE_VOLUME = 15;

type MusicSource = 'wy' | 'tx' | 'kw' | 'kg' | 'mg';

interface Song {
  id: string;
  name: string;
  artist: string;
  album?: string;
  pic?: string;
  platform: MusicSource;
  duration?: number;
  durationText?: string;
  songmid?: string;
}

interface PlayRecord {
  platform: MusicSource;
  id: string;
  playTime: number; // 播放时间（秒�?  duration: number; // 总时长（秒）
  timestamp: number; // 添加时间�?}

interface LyricLine {
  time: number;
  text: string;
  translation?: string;
}

interface Playlist {
  id: string;
  name: string;
  pic?: string;
  source?: MusicSource;
  updateFrequency?: string;
}

interface DbRecord {
  source: MusicSource;
  songId: string;
  id: string;
  playProgressSec: number;
  durationSec: number;
  createdAt: number;
  lastPlayedAt: number;
  name: string;
  artist: string;
  album?: string;
  cover?: string;
  durationText?: string;
  songmid?: string;
}

function MusicLoadingIndicator({
  text,
  size = 'md',
  className = '',
}: {
  text?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className={`flex items-center justify-center gap-3 text-zinc-400 ${className}`}>
      <div className="flex items-end gap-1.5">
        {[0, 1, 2].map((index) => (
          <svg
            key={index}
            className={`${iconSize} text-green-400`}
            fill="currentColor"
            viewBox="0 0 24 24"
            style={{ animation: `music-note-bounce 0.9s ease-in-out ${index * 0.14}s infinite` }}
          >
            <path d="M12 3v11.55A3.98 3.98 0 0010 14c-2.21 0-4 1.34-4 3s1.79 3 4 3 4-1.34 4-3V8h4V3h-6z" />
          </svg>
        ))}
      </div>
      {text ? <span className={`${textSize} font-medium tracking-wide`}>{text}</span> : null}
    </div>
  );
}

function AudioSpectrumCanvas({
  bars,
  compact = false,
}: {
  bars: number[];
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(rect.width * dpr);
      const height = Math.round(rect.height * dpr);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);

      const targetPitch = compact ? 4.2 : 4.6;
      const gap = Math.max(1, Math.round(dpr));
      const count = Math.max(1, Math.floor(rect.width / targetPitch));
      const barWidth = Math.max(2 * dpr, (width - gap * (count - 1)) / count);
      const cubeHeight = compact ? Math.max(2, Math.round(2 * dpr)) : Math.max(2, Math.round(2.5 * dpr));
      const cubeGap = 1;
      const scaleBase = compact ? height * 1.55 : height * 1.42;
      const themeColor = '#10b981';

      const sampleBar = (index: number) => {
        const usableLength = Math.max(1, bars.length - SPECTRUM_EDGE_TRIM * 2);
        const mappedStart = SPECTRUM_EDGE_TRIM + Math.floor((index / count) * usableLength);
        const start = Math.min(bars.length - 1, mappedStart);
        const mappedEnd = SPECTRUM_EDGE_TRIM + Math.max(mappedStart + 1, Math.floor(((index + 1) / count) * usableLength));
        const end = Math.min(bars.length, Math.max(start + 1, mappedEnd));
        let total = 0;
        for (let i = start; i < end; i++) total += bars[i] ?? 0;
        return total / Math.max(1, end - start);
      };

      ctx.fillStyle = themeColor;
      ctx.strokeStyle = themeColor;

      for (let i = 0; i < count; i++) {
        const q = Math.max(SPECTRUM_IDLE_LEVEL, sampleBar(i)) * scaleBase;
        const cubeCount = Math.max(1, Math.ceil(q / Math.max(1, barWidth * 0.9)));
        const x = i === count - 1 ? width - barWidth : i * (barWidth + gap);

        for (let segment = 0; segment < cubeCount; segment++) {
          const y = height - segment * (cubeHeight + cubeGap);
          ctx.beginPath();
          ctx.roundRect(x, y - cubeHeight, barWidth, cubeHeight, Math.min(2 * dpr, cubeHeight / 2));
          ctx.fill();
        }
      }
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [bars, compact]);

  return (
    <div
      className={`relative w-full overflow-hidden ${compact ? 'h-6' : 'h-8'}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-50" />
    </div>
  );
}

// 扩展 Window 接口以支�?Document PiP API
declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow: (options: { width: number; height: number }) => Promise<Window>;
      window: Window | null;
    };
  }
}

export default function MusicPage() {
  const router = useRouter();
  const [currentSource, setCurrentSource] = useState<MusicSource>('wy');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentView, setCurrentView] = useState<'playlists' | 'songs' | 'myPlaylists'>('playlists');
  const [currentPlaylistTitle, setCurrentPlaylistTitle] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [quality, setQuality] = useState<'128k' | '320k' | 'flac' | 'flac24bit'>('320k');
  const [playMode, setPlayMode] = useState<'loop' | 'single' | 'random'>('loop');
  const [currentSongIndex, setCurrentSongIndex] = useState(-1);
  const [showPlayer, setShowPlayer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [musicProxyEnabled, setMusicProxyEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return (window as any).RUNTIME_CONFIG?.MUSIC_PROXY_ENABLED !== false;
  });
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
  const [currentSongUrl, setCurrentSongUrl] = useState('');
  const [playRecords, setPlayRecords] = useState<PlayRecord[]>([]); // 播放记录（只存平台和ID�?  const [playlist, setPlaylist] = useState<Song[]>([]); // 完整歌曲信息（用于显示）
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [playlistIndex, setPlaylistIndex] = useState(-1); // 当前在播放列表中的索�?  const [showQualityMenu, setShowQualityMenu] = useState(false); // 音质选择菜单
  const [showSourceMenu, setShowSourceMenu] = useState(false); // 移动端音源菜�?  const [showVolumeSlider, setShowVolumeSlider] = useState(false); // 音量滑块显示状�?  const [pendingSongToPlay, setPendingSongToPlay] = useState<{ platform: string; id: string } | null>(null); // 待播放的歌曲信息
  const [resolvingCount, setResolvingCount] = useState(0); // 当前解析中的歌曲数量
  const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState(false); // 添加到歌单弹�?  const [songToAddToPlaylist, setSongToAddToPlaylist] = useState<Song | null>(null); // 要添加到歌单的歌�?
  // 我的歌单相关状�?  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);
  const [selectedUserPlaylist, setSelectedUserPlaylist] = useState<any | null>(null);
  const [userPlaylistSongs, setUserPlaylistSongs] = useState<any[]>([]);
  const [loadingUserPlaylists, setLoadingUserPlaylists] = useState(false);
  const [loadingUserPlaylistSongs, setLoadingUserPlaylistSongs] = useState(false);
  const [loadingPlayAll, setLoadingPlayAll] = useState(false); // 播放全部加载状�?  const [loadingCurrentPlayAll, setLoadingCurrentPlayAll] = useState(false); // 当前排行�?详情页播放全部加载状�?  const [deletingPlaylistId, setDeletingPlaylistId] = useState<string | null>(null); // 正在删除的歌单ID

  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).RUNTIME_CONFIG?.MUSIC_ENABLED) {
      router.replace('/');
    }
  }, [router]);

  // Toast �?Confirm Modal 状�?  const [toast, setToast] = useState<ToastProps | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  // PiP 相关状�?  const [showPiPLyrics, setShowPiPLyrics] = useState(false);
  const [pipOpacity, setPipOpacity] = useState(0.9);
  const [pipMinimized, setPipMinimized] = useState(false);
  const [showSpectrum, setShowSpectrum] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('musicShowSpectrum') !== '0';
  });
  const [spectrumBars, setSpectrumBars] = useState<number[]>(
    () => Array.from({ length: SPECTRUM_BIN_COUNT }, () => SPECTRUM_IDLE_LEVEL)
  );

  const audioRef = useRef<HTMLAudioElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const restoredTimeRef = useRef<number>(0);
  const songStartTimeRef = useRef<number>(0); // 歌曲开始播放的时间�?  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const spectrumDataRef = useRef<Uint8Array | null>(null);
  const spectrumFrameRef = useRef<number | null>(null);
  const currentTimeRef = useRef(0);
  const volumeRef = useRef(volume);
  const spectrumSeedRef = useRef(Math.random() * Math.PI * 2);

  const mapSong = (song: any): Song => ({
    id: song.songId || song.id,
    name: song.name,
    artist: song.artist,
    album: song.album,
    pic: song.cover || song.pic,
    platform: normalizeSource(song.source || song.platform),
    duration: song.durationSec || song.duration,
    durationText: song.durationText || song.interval,
    songmid: song.songmid,
  });

  const normalizeSource = (source: string | undefined): MusicSource => {
    switch (source) {
      case 'netease': return 'wy';
      case 'qq': return 'tx';
      case 'kuwo': return 'kw';
      case 'wy':
      case 'tx':
      case 'kw':
      case 'kg':
      case 'mg':
        return source;
      default:
        return 'wy';
    }
  };

  const musicSources: Array<{ key: MusicSource; label: string }> = [
    { key: 'wy', label: '网易�? },
    { key: 'tx', label: 'QQ' },
    { key: 'kw', label: '酷我' },
    { key: 'kg', label: '酷狗' },
    { key: 'mg', label: '咪咕' },
  ];

  const buildStreamUrl = (song: Song, source: MusicSource, songQuality: '128k' | '320k' | 'flac' | 'flac24bit') => {
    const params = new URLSearchParams({
      songId: song.id,
      source,
      quality: songQuality,
      songmid: song.songmid || song.id.split('_').slice(1).join('_'),
      name: song.name,
      artist: song.artist,
    });

    if (song.durationText) params.set('durationText', song.durationText);

    return `/api/music/v2/stream?${params.toString()}`;
  };

  const getMusicProxyEnabled = () => {
    if (typeof window === 'undefined') return true;
    return (window as any).RUNTIME_CONFIG?.MUSIC_PROXY_ENABLED !== false;
  };

  const fetchPlayData = async (
    song: Song,
    source: MusicSource,
    songQuality: '128k' | '320k' | 'flac' | 'flac24bit',
    includeUrl = false
  ) => {
    const response = await fetch('/api/music/v2/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        includeUrl,
        song: {
          songId: song.id,
          source,
          songmid: song.songmid,
          name: song.name,
          artist: song.artist,
          album: song.album,
          cover: song.pic,
          durationSec: song.duration,
          durationText: song.durationText,
        },
        quality: songQuality,
      }),
    });

    return response.json();
  };

  const beginResolving = () => {
    setResolvingCount((prev) => prev + 1);
  };

  const endResolving = () => {
    setResolvingCount((prev) => Math.max(0, prev - 1));
  };

  const saveHistoryRecord = async (
    record: PlayRecord,
    song: Song,
    playTime: number,
    totalDuration: number,
    lastPlayedAt = Date.now()
  ) => {
    await fetch('/api/music/v2/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        song: {
          songId: record.id,
          source: record.platform,
          songmid: song.songmid,
          name: song.name,
          artist: song.artist,
          album: song.album,
          cover: song.pic,
          durationSec: totalDuration || song.duration || 0,
          durationText: song.durationText,
        },
        playProgressSec: playTime,
        lastPlayedAt,
        lastQuality: quality,
      }),
    });
  };

  const saveHistoryRecordSafely = (
    record: PlayRecord,
    song: Song,
    playTime = 0,
    totalDuration = 0,
    lastPlayedAt?: number
  ) => {
    saveHistoryRecord(record, song, playTime, totalDuration, lastPlayedAt).catch(err => {
      console.error('保存播放记录到数据库失败:', err);
    });
  };

  // 保存播放状态到 localStorage
  const savePlayState = () => {
    if (!currentSong) return;

    const playState = {
      currentSong,
      currentSongIndex,
      songs,
      currentPlaylistTitle,
      currentSource,
      currentView,
      quality,
      playMode,
      volume,
      currentTime: audioRef.current?.currentTime || 0,
      currentSongUrl,
      lyrics,
      playRecords, // 只保存播放记录（平台+ID+播放信息�?      playlist, // 保存完整歌曲信息（用于显示）
      playlistIndex,
    };

    localStorage.setItem('musicPlayState', JSON.stringify(playState));
  };

  // 清空当前播放状态，并在需要时停止正在播放的音�?  const clearCurrentPlaybackState = () => {
    const audio = audioRef.current;

    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }

    setIsPlaying(false);
    setCurrentSong(null);
    setCurrentSongIndex(-1);
    setCurrentSongUrl('');
    setCurrentTime(0);
    setDuration(0);
    setLyrics([]);
    setCurrentLyricIndex(-1);
    setShowPlayer(false);
    setShowLyrics(false);
    setShowPiPLyrics(false);
    setPendingSongToPlay(null);
    restoredTimeRef.current = 0;
    lastSaveTimeRef.current = 0;
    currentTimeRef.current = 0;

    localStorage.removeItem('musicPlayState');
  };

  // �?localStorage 恢复播放状态（已废弃，现在统一使用数据库）
  const restorePlayState = async () => {
    // 此函数已不再使用，所有状态恢复都�?initializePlayState 中完�?  };

  useEffect(() => {
    setMusicProxyEnabled(getMusicProxyEnabled());
  }, []);

  // 页面加载时恢复播放状态和数据库记�?  useEffect(() => {
    const initializePlayState = async () => {
      try {
        const response = await fetch('/api/music/v2/history');
        const history = await response.json();
        const dbRecords = (history.data?.records || []) as DbRecord[];

        const queueRecords = dbRecords;

        const sortedRecords: PlayRecord[] = queueRecords.map((record) => ({
          platform: record.source,
          id: record.songId,
          playTime: record.playProgressSec,
          duration: record.durationSec || 0,
          timestamp: record.createdAt || record.lastPlayedAt || 0,
        }));

        const sortedSongs: Song[] = queueRecords.map((record) => ({
          id: record.songId,
          name: record.name,
          artist: record.artist,
          album: record.album,
          pic: record.cover,
          platform: record.source,
          duration: record.durationSec,
          durationText: record.durationText,
          songmid: record.songmid,
        }));

        // 2. 更新播放列表
        if (sortedRecords.length > 0) {
          setPlayRecords(sortedRecords);
          setPlaylist(sortedSongs);
        }

        // 3. 获取 localStorage 配置（只获取配置，不获取歌曲信息�?        const savedPlayState = localStorage.getItem('musicPlayState');
        const playState = savedPlayState ? JSON.parse(savedPlayState) : {};

        // 恢复配置状态（不包括歌曲）
        setSongs(playState.songs || []);
        setCurrentPlaylistTitle(playState.currentPlaylistTitle || '');
        setCurrentSource(normalizeSource(playState.currentSource));
        setCurrentView(playState.currentView || 'playlists');
        setQuality(playState.quality || '320k');
        setPlayMode(playState.playMode || 'loop');
        setVolume(playState.volume || 100);

        // 4. 使用数据库的最新记录（歌曲和进度都从数据库获取�?        if (sortedRecords.length > 0) {
          const proxyEnabled = getMusicProxyEnabled();
          setMusicProxyEnabled(proxyEnabled);
          const latestIndex = queueRecords.reduce((bestIndex, record, index) => {
            if (bestIndex < 0) return index;
            return (record.lastPlayedAt || 0) > (queueRecords[bestIndex].lastPlayedAt || 0) ? index : bestIndex;
          }, -1);
          const activeIndex = latestIndex >= 0 ? latestIndex : 0;
          const latestDbRecord = sortedRecords[activeIndex];
          const latestDbSong = sortedSongs[activeIndex];

          // 使用数据库的歌曲信息
          setCurrentSong(latestDbSong);
          setPlaylistIndex(activeIndex);
          setShowPlayer(true);

          // 从数据库恢复播放进度
          const dbPlayTime = latestDbRecord.playTime || 0;
          songStartTimeRef.current = Date.now();

          const platform = latestDbSong.platform || 'kw';
          const selectedQuality = playState.quality || '320k';

          const restoreTime = () => {
            if (audioRef.current && dbPlayTime > 0) {
              audioRef.current.currentTime = dbPlayTime;
            }
          };

          if (proxyEnabled) {
            const streamUrl = buildStreamUrl(latestDbSong, platform, selectedQuality);
            setCurrentSongUrl(streamUrl);

            if (audioRef.current) {
              audioRef.current.src = streamUrl;
              audioRef.current.addEventListener('loadedmetadata', restoreTime, { once: true });
              audioRef.current.load();
            }

            fetchPlayData(latestDbSong, platform, selectedQuality, false)
              .then((data) => {
                if (data.success && data.data?.lyric?.lyric) {
                  const parsedLyrics = parseLyric(data.data.lyric.lyric, data.data.lyric.tlyric);
                  setLyrics(parsedLyrics);
                }
              })
              .catch((error) => {
                console.error('加载歌词失败:', error);
              });
          } else {
            const data = await fetchPlayData(latestDbSong, platform, selectedQuality, true);
            if (data.success && data.data?.play?.directUrl && audioRef.current) {
              setCurrentSongUrl(data.data.play.directUrl);
              audioRef.current.src = data.data.play.directUrl;
              audioRef.current.addEventListener('loadedmetadata', restoreTime, { once: true });
              audioRef.current.load();

              if (data.data.lyric?.lyric) {
                const parsedLyrics = parseLyric(data.data.lyric.lyric, data.data.lyric.tlyric);
                setLyrics(parsedLyrics);
              }
            }
          }
        }
      } catch (error) {
        console.error('加载播放记录失败:', error);
      }
    };

    initializePlayState();
  }, []);

  // 恢复 PiP 偏好设置
  useEffect(() => {
    const savedOpacity = localStorage.getItem('lyricsPiPOpacity');
    const savedMinimized = localStorage.getItem('lyricsPiPMinimized');
    if (savedOpacity) setPipOpacity(parseFloat(savedOpacity));
    if (savedMinimized) setPipMinimized(savedMinimized === 'true');
  }, []);

  // 监听来自 PiP 窗口的消�?  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      switch (event.data.type) {
        case 'PIP_OPACITY_CHANGE':
          setPipOpacity(event.data.opacity);
          localStorage.setItem('lyricsPiPOpacity', event.data.opacity.toString());
          break;
        case 'PIP_MINIMIZED_CHANGE':
          setPipMinimized(event.data.minimized);
          localStorage.setItem('lyricsPiPMinimized', event.data.minimized.toString());
          break;
        case 'PIP_CLOSE':
          setShowPiPLyrics(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // 监听播放状态变化，自动保存
  useEffect(() => {
    if (currentSong) {
      savePlayState();
    }
  }, [currentSong, currentSongIndex, songs, currentPlaylistTitle, currentSource, currentView, quality, playMode, volume, currentSongUrl, lyrics, playRecords, playlistIndex]);

  // 监听 playRecords 变化，更�?playlistIndex
  useEffect(() => {
    if (pendingSongToPlay) {
      const index = playRecords.findIndex(
        r => r.platform === pendingSongToPlay.platform && r.id === pendingSongToPlay.id
      );
      setPlaylistIndex(index);
      setPendingSongToPlay(null);
    }
  }, [playRecords, pendingSongToPlay]);

  // 同步音量状态到 audio 元素
  useEffect(() => {
    volumeRef.current = volume;
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // 加载排行榜列�?  const loadPlaylists = async (source: string) => {
    setLoading(true);
    try {
      const boardsResponse = await fetch(`/api/music/v2/discovery/boards?source=${source}`);
      const boardsData = await boardsResponse.json();

      if (boardsResponse.ok && boardsData.success) {
        setPlaylists((boardsData.data?.list || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          source: normalizeSource(item.source || boardsData.data?.source || source),
          updateFrequency: item.updateFrequency || item.description || '',
        })));
      } else {
        console.error('加载排行榜失�?', boardsData);
        setPlaylists([]);
      }
    } catch (error) {
      console.error('加载排行榜失�?', error);
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  };

  // 加载歌单详情
  const loadPlaylist = async (playlistId: string, playlistName: string, playlistSource?: MusicSource) => {
    setLoading(true);
    try {
      const source = playlistSource || currentSource;
      const response = await fetch(
        `/api/music/v2/discovery/board-songs?source=${source}&boardId=${playlistId}`
      );
      const data = await response.json();
      setSongs((data.data?.list || []).map(mapSong));
      setCurrentPlaylistTitle(playlistName);
      setCurrentView('songs');
    } catch (error) {
      console.error('加载歌单失败:', error);
      setSongs([]);
    } finally {
      setLoading(false);
    }
  };

  // 当前排行榜歌单：播放全部
  const handlePlayAllCurrentSongs = async () => {
    setLoadingCurrentPlayAll(true);

    try {
      if (songs.length === 0) {
        setToast({
          message: '当前歌单为空',
          type: 'error',
          onClose: () => setToast(null),
        });
        return;
      }

      await fetch('/api/music/v2/history', { method: 'DELETE' });

      const baseTime = Date.now();
      const recordsToAdd = songs.map((song, i) => ({
        song: {
          songId: song.id,
          source: song.platform,
          songmid: song.songmid,
          name: song.name,
          artist: song.artist,
          album: song.album,
          cover: song.pic,
          durationSec: song.duration || 0,
          durationText: song.durationText,
        },
        playProgressSec: 0,
        lastPlayedAt: baseTime + i,
        playCount: 1,
        lastQuality: quality,
      }));

      await fetch('/api/music/v2/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: recordsToAdd }),
      });

      const newRecords: PlayRecord[] = songs.map((song, i) => ({
        platform: song.platform,
        id: song.id,
        playTime: 0,
        duration: song.duration || 0,
        timestamp: baseTime + i,
      }));

      setPlayRecords(newRecords);
      setPlaylist(songs);
      setPlaylistIndex(0);
      await playSong(songs[0], 0);

      setToast({
        message: `已开始播�?${currentPlaylistTitle || '当前歌单'}`,
        type: 'success',
        onClose: () => setToast(null),
      });
    } catch (error) {
      console.error('排行榜播放全部失�?', error);
      setToast({
        message: '播放全部失败',
        type: 'error',
        onClose: () => setToast(null),
      });
    } finally {
      setLoadingCurrentPlayAll(false);
    }
  };

  // 搜索歌曲
  const searchSongs = async () => {
    if (!searchKeyword.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/music/v2/search?source=${currentSource}&q=${encodeURIComponent(searchKeyword)}&page=1&limit=20`
      );
      const data = await response.json();
      setSongs((data.data?.list || []).map(mapSong));
      setCurrentPlaylistTitle(`搜索: ${searchKeyword}`);
      setCurrentView('songs');
    } catch (error) {
      console.error('搜索失败:', error);
      setSongs([]);
    } finally {
      setLoading(false);
    }
  };

  // 打开添加到歌单弹�?  const handleAddToPlaylist = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发播�?    setSongToAddToPlaylist(song);
    setShowAddToPlaylistModal(true);
  };

  // 稍后播放：追加到当前播放列表末尾，不立即播放
  const handlePlayLater = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!currentSong && playlist.length === 0 && playRecords.length === 0) {
      playSong(song, -1);
      return;
    }

    const platform = song.platform || currentSource;
    const exists = playlist.some((item) => item.id === song.id && item.platform === platform);

    if (exists) {
      setToast({
        message: '歌曲已在播放列表�?,
        type: 'info',
        onClose: () => setToast(null),
      });
      return;
    }

    const record: PlayRecord = {
      platform,
      id: song.id,
      playTime: 0,
      duration: song.duration || 0,
      timestamp: Date.now(),
    };

    setPlayRecords((prev) => [...prev, record]);
    setPlaylist((prev) => [...prev, { ...song, platform }]);
    saveHistoryRecordSafely(record, { ...song, platform }, 0, song.duration || 0, 0);
    setToast({
      message: '已加入稍后播�?,
      type: 'success',
      onClose: () => setToast(null),
    });
  };

  // 加载用户歌单列表
  const loadUserPlaylists = async () => {
    try {
      setLoadingUserPlaylists(true);
      const response = await fetch('/api/music/v2/playlists');
      if (response.ok) {
        const data = await response.json();
        setUserPlaylists(data.data?.playlists || []);
      }
    } catch (error) {
      console.error('加载歌单失败:', error);
    } finally {
      setLoadingUserPlaylists(false);
    }
  };

  // 加载歌单中的歌曲
  const loadUserPlaylistSongs = async (playlistId: string) => {
    try {
      setLoadingUserPlaylistSongs(true);
      const response = await fetch(`/api/music/v2/playlists/${playlistId}/songs`);
      if (response.ok) {
        const data = await response.json();
        setUserPlaylistSongs((data.data?.songs || []).map((song: any) => ({
          ...song,
          id: song.songId,
          platform: song.source,
          pic: song.cover,
          duration: song.durationSec,
        })));
      }
    } catch (error) {
      console.error('加载歌单歌曲失败:', error);
    } finally {
      setLoadingUserPlaylistSongs(false);
    }
  };

  // 选择歌单
  const handleSelectUserPlaylist = (playlist: any) => {
    setSelectedUserPlaylist(playlist);
    loadUserPlaylistSongs(playlist.id);
  };

  // 播放全部歌单歌曲
  const handlePlayAllPlaylist = async () => {
    if (!selectedUserPlaylist || userPlaylistSongs.length === 0) {
      setToast({
        message: '歌单为空',
        type: 'error',
        onClose: () => setToast(null),
      });
      return;
    }

    setLoadingPlayAll(true);
    try {
      // 1. 清空所有播放历�?      await fetch('/api/music/v2/history', { method: 'DELETE' });

      // 2. 清空本地状�?      setPlayRecords([]);
      setPlaylist([]);

      // 3. 批量添加歌单中的所有歌曲到播放历史
      const baseTime = Date.now();
      const recordsToAdd = userPlaylistSongs.map((song, i) => ({
        song: {
          songId: song.id,
          source: song.platform,
          songmid: song.songmid,
          name: song.name,
          artist: song.artist,
          album: song.album,
          cover: song.pic,
          durationSec: song.duration || 0,
          durationText: song.durationText,
        },
        playProgressSec: 0,
        lastPlayedAt: baseTime + i,
        playCount: 1,
        lastQuality: quality,
      }));

      // 一次性批量添加所有歌�?      const response = await fetch('/api/music/v2/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: recordsToAdd,
        }),
      });

      if (!response.ok) {
        throw new Error('批量添加歌曲失败');
      }

      // 4. 立即更新本地状�?      const newRecords: PlayRecord[] = userPlaylistSongs.map((song, i) => ({
        platform: song.platform,
        id: song.id,
        playTime: 0,
        duration: song.duration || 0,
        timestamp: baseTime + i,
      }));

      const newPlaylist: Song[] = userPlaylistSongs.map((song) => ({
        id: song.id,
        name: song.name,
        artist: song.artist,
        album: song.album,
        pic: song.pic,
        platform: song.platform,
        duration: song.duration,
        durationText: song.durationText,
        songmid: song.songmid,
      }));

      setPlayRecords(newRecords);
      setPlaylist(newPlaylist);

      // 5. 直接播放第一首歌
      if (userPlaylistSongs.length > 0) {
        setPlaylistIndex(0);
        await playSong(userPlaylistSongs[0], 0);
      }

      setToast({
        message: `已将 ${userPlaylistSongs.length} 首歌曲添加到播放列表`,
        type: 'success',
        onClose: () => setToast(null),
      });
    } catch (error) {
      console.error('播放全部失败:', error);
      setToast({
        message: '播放全部失败',
        type: 'error',
        onClose: () => setToast(null),
      });
    } finally {
      setLoadingPlayAll(false);
    }
  };

  // 删除歌单
  const handleDeleteUserPlaylist = async (playlistId: string) => {
    setConfirmModal({
      isOpen: true,
      title: '确认删除',
      message: '确定要删除这个歌单吗�?,
      onConfirm: async () => {
        // 先关闭确认框
        setConfirmModal({
          isOpen: false,
          title: '',
          message: '',
          onConfirm: () => {},
          onCancel: () => {},
        });

        // 然后执行删除
        setDeletingPlaylistId(playlistId);
        try {
          const response = await fetch(`/api/music/v2/playlists/${playlistId}`, { method: 'DELETE' });

          if (response.ok) {
            setToast({
              message: '删除成功',
              type: 'success',
              onClose: () => setToast(null),
            });
            if (selectedUserPlaylist?.id === playlistId) {
              setSelectedUserPlaylist(null);
              setUserPlaylistSongs([]);
            }
            loadUserPlaylists();
          } else {
            const data = await response.json();
            setToast({
              message: data.error || '删除失败',
              type: 'error',
              onClose: () => setToast(null),
            });
          }
        } catch (error) {
          console.error('删除歌单失败:', error);
          setToast({
            message: '删除歌单失败',
            type: 'error',
            onClose: () => setToast(null),
          });
        } finally {
          setDeletingPlaylistId(null);
        }
      },
      onCancel: () => {
        setConfirmModal({
          isOpen: false,
          title: '',
          message: '',
          onConfirm: () => {},
          onCancel: () => {},
        });
      },
    });
  };

  // 从歌单中移除歌曲
  const handleRemoveSongFromUserPlaylist = async (song: any) => {
    if (!selectedUserPlaylist) return;

    setConfirmModal({
      isOpen: true,
      title: '确认移除',
      message: `确定要从歌单中移�?"${song.name}" 吗？`,
      onConfirm: async () => {
        try {
          const response = await fetch(
            `/api/music/v2/playlists/${selectedUserPlaylist.id}/songs?songId=${encodeURIComponent(song.id)}`,
            { method: 'DELETE' }
          );

          if (response.ok) {
            setToast({
              message: '移除成功',
              type: 'success',
              onClose: () => setToast(null),
            });
            loadUserPlaylistSongs(selectedUserPlaylist.id);
          } else {
            const data = await response.json();
            setToast({
              message: data.error || '移除失败',
              type: 'error',
              onClose: () => setToast(null),
            });
          }
        } catch (error) {
          console.error('移除歌曲失败:', error);
          setToast({
            message: '移除歌曲失败',
            type: 'error',
            onClose: () => setToast(null),
          });
        }
        setConfirmModal({
          isOpen: false,
          title: '',
          message: '',
          onConfirm: () => {},
          onCancel: () => {},
        });
      },
      onCancel: () => {
        setConfirmModal({
          isOpen: false,
          title: '',
          message: '',
          onConfirm: () => {},
          onCancel: () => {},
        });
      },
    });
  };

  // 播放歌曲
  const playSong = async (song: Song, index: number) => {
    beginResolving();
    try {
      // 使用歌曲自己的平台信息，如果没有则使用当前选择的平�?          const platform = song.platform || currentSource;
          const proxyEnabled = getMusicProxyEnabled();
          setMusicProxyEnabled(proxyEnabled);

      // 记录歌曲开始播放的时间
      songStartTimeRef.current = Date.now();

      // 先设置当前歌曲和显示播放�?      setCurrentSong(song);
      setCurrentSongIndex(index);
      setShowPlayer(true);
      setLyrics([]); // 清空旧歌�?
      // 添加到播放记录和播放列表
      const record: PlayRecord = {
        platform: platform,
        id: song.id,
        playTime: 0, // 初始播放时间
        duration: song.duration || 0, // 将在音频加载后更�?        timestamp: Date.now(),
      };

      // 设置待播放歌曲信息，用于�?playRecords 更新后找到索�?      setPendingSongToPlay({ platform, id: song.id });

      setPlayRecords(prev => {
        const existingIndex = prev.findIndex(r => r.platform === record.platform && r.id === record.id);
        if (existingIndex >= 0) {
          // 记录已存在，更新时间戳但不重置播放时�?          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            timestamp: Date.now(),
          };
          return updated;
        } else {
          // 新记录，添加到列表末�?          return [...prev, record];
        }
      });

      setPlaylist(prev => {
        const existingIndex = prev.findIndex(s => s.id === song.id && s.platform === platform);
        if (existingIndex >= 0) {
          return prev;
        } else {
          return [...prev, { ...song, platform }];
        }
      });

      saveHistoryRecordSafely(record, { ...song, platform }, 0, song.duration || 0);

      if (proxyEnabled) {
        const streamUrl = buildStreamUrl(song, platform, quality);
        setCurrentSongUrl(streamUrl);

        if (audioRef.current) {
          audioRef.current.src = streamUrl;
          audioRef.current.load();
          audioRef.current.play().catch(err => {
            console.error('播放失败:', err);
          });
          setIsPlaying(true);
        }

        fetchPlayData(song, platform, quality, false)
          .then((data) => {
            if (data.success) {
              if (data.data.song?.cover) {
                setCurrentSong({
                  ...song,
                  pic: data.data.song.cover,
                  platform,
                });
              }

              if (data.data.lyric?.lyric) {
                const parsedLyrics = parseLyric(data.data.lyric.lyric, data.data.lyric.tlyric);
                setLyrics(parsedLyrics);
              }
            } else {
              console.error('播放信息获取失败:', data);
            }
          })
          .catch((error) => {
            console.error('加载歌词失败:', error);
          });
      } else {
        const data = await fetchPlayData(song, platform, quality, true);
        if (data.success && data.data?.play?.directUrl) {
          if (data.data.song?.cover) {
            setCurrentSong({
              ...song,
              pic: data.data.song.cover,
              platform,
            });
          }

          if (data.data.lyric?.lyric) {
            const parsedLyrics = parseLyric(data.data.lyric.lyric, data.data.lyric.tlyric);
            setLyrics(parsedLyrics);
          }

          setCurrentSongUrl(data.data.play.directUrl);

          if (audioRef.current) {
            audioRef.current.src = data.data.play.directUrl;
            audioRef.current.load();
            audioRef.current.play().catch(err => {
              console.error('播放失败:', err);
            });
            setIsPlaying(true);
          }
        } else {
          console.error('播放信息获取失败:', data);
        }
      }
    } catch (error) {
      console.error('播放失败:', error);
    } finally {
      endResolving();
    }
  };

  // 解析歌词文本
  const parseLyric = (lyricText: string, tlyricText?: string): LyricLine[] => {
    if (!lyricText && !tlyricText) return [];

    // 匹配 [mm:ss.xx] �?[mm:ss] 格式
    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
    const parseLyricText = (text: string) => {
      const parsed = new Map<number, string>();
      const lines = text.split('\n');

      lines.forEach(line => {
        const matches = Array.from(line.matchAll(timeRegex));
        if (matches.length > 0) {
          const content = line.replace(timeRegex, '').trim();
          if (content) {
            matches.forEach(match => {
              const minutes = parseInt(match[1]);
              const seconds = parseInt(match[2]);
              const milliseconds = match[3] ? parseInt(match[3].padEnd(3, '0')) : 0;
              const time = minutes * 60 + seconds + milliseconds / 1000;
              parsed.set(time, content);
            });
          }
        }
      });

      return parsed;
    };

    const mainMap = parseLyricText(lyricText || '');
    const transMap = parseLyricText(tlyricText || '');
    const times = Array.from(new Set([
      ...Array.from(mainMap.keys()),
      ...Array.from(transMap.keys()),
    ])).sort((a, b) => a - b);

    return times
      .map(time => ({
        time,
        text: mainMap.get(time) || '',
        translation: transMap.get(time) || undefined,
      }))
      .filter(line => line.text || line.translation);
  };

  // 切换播放/暂停
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        // 暂停时保存状态到 localStorage 和数据库
        savePlayState();

        // �?秒不保存（避免加载时的跳转触发保存）
        if (Date.now() - songStartTimeRef.current < 5000) {
          return;
        }

        // 保存到数据库
        if (currentSong && playlistIndex >= 0 && playRecords[playlistIndex]) {
          const record = playRecords[playlistIndex];
          saveHistoryRecord(record, currentSong, audioRef.current.currentTime, audioRef.current.duration || 0).catch(err => {
            console.error('暂停时保存播放记录失�?', err);
          });
        }
      } else {
        audioRef.current.play().catch(err => {
          console.error('播放失败:', err);
        });
        setIsPlaying(true);
      }
    }
  };

  // 上一�?  const playPrev = () => {
    // 优先从播放列表切�?    if (playlist.length > 0) {
      // 如果已经是第一首，循环到最后一�?      const prevIndex = playlistIndex > 0 ? playlistIndex - 1 : playlist.length - 1;
      setPlaylistIndex(prevIndex);
      playSong(playlist[prevIndex], -1);
    } else if (currentSongIndex > 0) {
      playSong(songs[currentSongIndex - 1], currentSongIndex - 1);
    }
  };

  // 下一�?  const playNext = () => {
    // 优先从播放列表切�?    if (playlist.length > 0) {
      // 如果已经是最后一首，循环到第一�?      const nextIndex = playlistIndex < playlist.length - 1 ? playlistIndex + 1 : 0;
      setPlaylistIndex(nextIndex);
      playSong(playlist[nextIndex], -1);
    } else if (currentSongIndex < songs.length - 1) {
      playSong(songs[currentSongIndex + 1], currentSongIndex + 1);
    }
  };

  // 切换音质
  const cycleQuality = () => {
    const qualities: Array<'128k' | '320k' | 'flac' | 'flac24bit'> = ['128k', '320k', 'flac', 'flac24bit'];
    const currentIndex = qualities.indexOf(quality);
    const nextIndex = (currentIndex + 1) % qualities.length;
    setQuality(qualities[nextIndex]);
  };

  // 清空播放记录
  const handleClearPlayRecords = () => {
    setConfirmModal({
      isOpen: true,
      title: '确认清空',
      message: '确定要清空全部播放记录吗�?,
      onConfirm: async () => {
        try {
          await fetch('/api/music/v2/history', { method: 'DELETE' });
          clearCurrentPlaybackState();
          setPlaylist([]);
          setPlayRecords([]);
          setPlaylistIndex(-1);
          setToast({
            message: '播放记录已清�?,
            type: 'success',
            onClose: () => setToast(null),
          });
        } catch (error) {
          console.error('清空播放记录失败:', error);
          setToast({
            message: '清空播放记录失败',
            type: 'error',
            onClose: () => setToast(null),
          });
        } finally {
          setConfirmModal({
            isOpen: false,
            title: '',
            message: '',
            onConfirm: () => {},
            onCancel: () => {},
          });
        }
      },
      onCancel: () => {
        setConfirmModal({
          isOpen: false,
          title: '',
          message: '',
          onConfirm: () => {},
          onCancel: () => {},
        });
      },
    });
  };

  // 切换播放模式
  const toggleMode = () => {
    const modes: Array<'loop' | 'single' | 'random'> = ['loop', 'single', 'random'];
    const currentIndex = modes.indexOf(playMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setPlayMode(modes[nextIndex]);
  };

  // 返回
  const goBack = () => {
    if (currentView === 'songs') {
      setCurrentView('playlists');
      setSongs([]);
    } else if (currentView === 'myPlaylists') {
      setCurrentView('playlists');
      setSelectedUserPlaylist(null);
      setUserPlaylistSongs([]);
    } else {
      router.back();
    }
  };

  // 下载歌曲
  const downloadSong = () => {
    if (!currentSongUrl || !currentSong) return;

    // 创建一个临时的 a 标签来触发下�?    const link = document.createElement('a');
    link.href = currentSongUrl;
    link.download = `${currentSong.name} - ${currentSong.artist}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 切换平台
  const switchSource = (source: MusicSource) => {
    setCurrentSource(source);
    setCurrentView('playlists');
    setSongs([]);
    setSearchKeyword('');
  };

  // 音频事件监听
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);

      // 更新当前歌词索引
      if (lyrics.length > 0) {
        let index = -1;
        for (let i = 0; i < lyrics.length; i++) {
          if (lyrics[i].time <= audio.currentTime) {
            index = i;
          } else {
            break;
          }
        }
        setCurrentLyricIndex(index);
      }

      // �?0秒保存一次播放进度和播放时间
      const now = Date.now();
      if (now - lastSaveTimeRef.current > 20000) {
        lastSaveTimeRef.current = now;

        // �?秒不保存（避免加载时的跳转触发保存）
        if (Date.now() - songStartTimeRef.current < 5000) {
          return;
        }

        // 更新当前播放记录的播放时�?        if (currentSong && playlistIndex >= 0) {
          setPlayRecords(prev => {
            const updated = [...prev];
            if (updated[playlistIndex]) {
              updated[playlistIndex] = {
                ...updated[playlistIndex],
                playTime: audio.currentTime,
              };

              // 保存到数据库
              const record = updated[playlistIndex];
              saveHistoryRecord(record, currentSong, audio.currentTime, audio.duration || 0).catch(err => {
                console.error('保存播放记录到数据库失败:', err);
              });
            }
            return updated;
          });
        }

        savePlayState();
      }
    };

    const handleLoadedMetadata = () => {
      // 恢复播放进度
      if (restoredTimeRef.current > 0) {
        audio.currentTime = restoredTimeRef.current;
        restoredTimeRef.current = 0; // 清除标记
      }
    };

    const handleDurationChange = () => {
      setDuration(audio.duration);

      // �?秒不保存（避免加载时的跳转触发保存）
      if (Date.now() - songStartTimeRef.current < 5000) {
        return;
      }

      // 更新当前播放记录的总时�?      if (currentSong && playlistIndex >= 0) {
        setPlayRecords(prev => {
          const updated = [...prev];
          if (updated[playlistIndex]) {
            updated[playlistIndex] = {
              ...updated[playlistIndex],
              duration: audio.duration,
            };

            // 保存到数据库（包含时长信息）
            const record = updated[playlistIndex];
            saveHistoryRecord(record, currentSong, record.playTime, audio.duration).catch(err => {
              console.error('保存播放记录到数据库失败:', err);
            });
          }
          return updated;
        });
      }
    };
    const handleEnded = () => {
      if (playMode === 'single') {
        audio.currentTime = 0;
        audio.play();
      } else if (playMode === 'random') {
        // 优先从播放列表中随机选择
        if (playlist.length > 0) {
          const randomIndex = Math.floor(Math.random() * playlist.length);
          setPlaylistIndex(randomIndex);
          playSong(playlist[randomIndex], -1);
        } else if (songs.length > 0) {
          const randomIndex = Math.floor(Math.random() * songs.length);
          playSong(songs[randomIndex], randomIndex);
        }
      } else {
        playNext();
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [playMode, songs, currentSongIndex, lyrics, currentSong, playlistIndex, playRecords]);

  // 初始加载
  useEffect(() => {
    loadPlaylists(currentSource);
  }, [currentSource]);

  // 当切换到我的歌单视图时加载歌单列�?  useEffect(() => {
    if (currentView === 'myPlaylists') {
      loadUserPlaylists();
    }
  }, [currentView]);

  // 歌词自动滚动
  useEffect(() => {
    if (lyricsContainerRef.current && currentLyricIndex >= 0) {
      const container = lyricsContainerRef.current;
      const activeLine = container.querySelector(`[data-index="${currentLyricIndex}"]`);
      if (activeLine) {
        activeLine.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [currentLyricIndex]);

  // 搜索框回�?  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchSongs();
    }
  };

  // 进度条拖�?  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = (parseFloat(e.target.value) / 100) * duration;
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // 音量调节
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
  };

  // 触摸/鼠标滑动音量调节（移动端兼容�?  const handleVolumeSliderInteraction = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const slider = e.currentTarget;
    const rect = slider.getBoundingClientRect();

    const updateVolume = (clientY: number) => {
      // 计算相对于滑块顶部的位置
      const y = clientY - rect.top;
      // 限制在滑块范围内
      const clampedY = Math.max(0, Math.min(rect.height, y));
      // 从上到下�?% -> 100%，从下到上：100% -> 0%
      const percentage = 100 - (clampedY / rect.height) * 100;
      const newVolume = Math.round(percentage);

      setVolume(newVolume);
      if (audioRef.current) {
        audioRef.current.volume = newVolume / 100;
      }
    };

    // 获取初始触摸/点击位置
    const clientY = 'touches' in e ? e.touches[0]?.clientY || 0 : e.clientY;
    updateVolume(clientY);

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      moveEvent.preventDefault();
      const moveClientY = 'touches' in moveEvent ? moveEvent.touches[0]?.clientY || 0 : moveEvent.clientY;
      updateVolume(moveClientY);
    };

    const handleEnd = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
  };

  // PiP 窗口管理
  const togglePiPLyrics = () => {
    if (!('documentPictureInPicture' in window)) {
      setToast({
        message: '您的浏览器不支持画中画功能，请使�?Chrome 116+ 版本',
        type: 'error',
      });
      // 降级方案：打开全屏歌词
      setShowLyrics(true);
      return;
    }

    if (!currentSong) {
      setToast({
        message: '请先播放歌曲',
        type: 'info',
      });
      return;
    }

    setShowPiPLyrics(!showPiPLyrics);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const toggleSpectrum = () => {
    setShowSpectrum(prev => !prev);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('musicShowSpectrum', showSpectrum ? '1' : '0');
  }, [showSpectrum]);

  const getQualityLabel = () => {
    switch (quality) {
      case '128k': return '标准';
      case '320k': return 'HQ';
      case 'flac': return 'SQ';
      case 'flac24bit': return 'HR';
    }
  };

  const getSourceLabel = () => {
    switch (currentSource) {
      case 'wy': return '网易�?;
      case 'tx': return 'QQ音乐';
      case 'kw': return '酷我';
      case 'kg': return '酷狗';
      case 'mg': return '咪咕';
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds === 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || typeof window === 'undefined') return;

    let cancelled = false;

    const ensureAnalyser = async () => {
      try {
        const AudioContextClass = window.AudioContext || (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;

        if (!AudioContextClass) return;

        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextClass();
        }

        if (!mediaSourceRef.current) {
          mediaSourceRef.current = audioContextRef.current.createMediaElementSource(audio);
        }

        if (!analyserRef.current) {
          const analyser = audioContextRef.current.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.8;
          mediaSourceRef.current.connect(analyser);
          analyser.connect(audioContextRef.current.destination);
          analyserRef.current = analyser;
          spectrumDataRef.current = new Uint8Array(analyser.frequencyBinCount);
        }

        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
      } catch (error) {
        console.warn('初始化频谱分析器失败，将使用模拟动画:', error);
      }
    };

    const tick = () => {
      if (cancelled) return;

      const analyser = analyserRef.current;
      const data = spectrumDataRef.current;
      const isActive = !audio.paused && !audio.ended;
      let nextBars = Array.from({ length: SPECTRUM_BIN_COUNT }, () => SPECTRUM_IDLE_LEVEL);

      if (isActive && analyser && data) {
        analyser.getByteFrequencyData(data);
        const usableBins = Math.max(1, Math.floor(data.length * 0.88));
        const visualVolume = Math.max(SPECTRUM_MIN_VOLUME, volumeRef.current || SPECTRUM_REFERENCE_VOLUME);
        const visualVolumeScale =
          visualVolume > SPECTRUM_MAX_REFERENCE_VOLUME
            ? Math.sqrt(SPECTRUM_MAX_REFERENCE_VOLUME / visualVolume)
            : SPECTRUM_REFERENCE_VOLUME / visualVolume;

        nextBars = Array.from({ length: SPECTRUM_BIN_COUNT }, (_, index) => {
          const start = Math.floor((index / SPECTRUM_BIN_COUNT) * usableBins);
          const end = Math.max(start + 1, Math.floor(((index + 1) / SPECTRUM_BIN_COUNT) * usableBins));
          let total = 0;

          for (let i = start; i < end; i++) {
            total += data[i] ?? 0;
          }

          const average = (total / Math.max(1, end - start)) * visualVolumeScale;
          const rightBias = index / Math.max(1, SPECTRUM_BIN_COUNT - 1);
          const highFreqCompensation = 1 + rightBias * 0.85;
          const floorLift = rightBias * 0.035;
          return Math.max(
            SPECTRUM_IDLE_LEVEL,
            Math.min(1, (average / 255) * highFreqCompensation + floorLift)
          );
        });
      } else if (isActive) {
        nextBars = Array.from({ length: SPECTRUM_BIN_COUNT }, (_, index) => {
          const wave =
            Math.sin(currentTimeRef.current * 5.2 + index * 0.28 + spectrumSeedRef.current) * 0.12 +
            Math.sin(currentTimeRef.current * 2.6 + index * 0.16) * 0.08 +
            0.22;
          return Math.max(SPECTRUM_IDLE_LEVEL, Math.min(0.65, wave));
        });
      }

      setSpectrumBars(prev =>
        nextBars.map((value, index) => {
          const previous = prev[index] ?? SPECTRUM_IDLE_LEVEL;
          return previous + (value - previous) * (isActive ? 0.34 : 0.12);
        })
      );

      spectrumFrameRef.current = window.requestAnimationFrame(tick);
    };

    void ensureAnalyser();
    spectrumFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (spectrumFrameRef.current) {
        window.cancelAnimationFrame(spectrumFrameRef.current);
        spectrumFrameRef.current = null;
      }
    };
  }, [currentSong]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && spectrumFrameRef.current) {
        window.cancelAnimationFrame(spectrumFrameRef.current);
      }
      analyserRef.current?.disconnect();
      mediaSourceRef.current?.disconnect();
      audioContextRef.current?.close().catch(() => undefined);
    };
  }, []);

  return (
    <div className="music-theme min-h-screen bg-zinc-950 text-white">
      <>
      <style jsx>{`
        @keyframes music-note-bounce {
          0%,
          100% {
            transform: translateY(0);
            opacity: 0.55;
          }
          50% {
            transform: translateY(-8px);
            opacity: 1;
          }
        }
      `}</style>
      {resolvingCount > 0 && (
        <div className="fixed top-4 right-4 z-[80] pointer-events-none">
          <div className="relative w-16 h-16 md:w-20 md:h-20">
            <div className="absolute inset-0 rounded-full border-4 border-white/10" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-green-500 border-r-emerald-400 animate-spin shadow-[0_0_20px_rgba(34,197,94,0.35)]" />
            <div className="absolute inset-1 rounded-full bg-zinc-950/90 backdrop-blur-md border border-white/10 flex flex-col items-center justify-center">
              <div className="text-[10px] md:text-xs text-zinc-400 leading-none mb-1">解析�?/div>
              <div className="text-lg md:text-xl font-bold text-white leading-none">{resolvingCount}</div>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-white/10 px-4 md:px-6">
        <div className="w-full mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 py-3">
          <div className="flex items-center justify-between md:justify-start md:gap-6 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="返回首页"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 text-green-500">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                </svg>
              </div>
              <span className="font-bold text-lg text-white">音乐</span>
            </div>
            <div className="md:hidden relative">
              <button
                onClick={() => setShowSourceMenu(true)}
                className="relative h-10 min-w-[132px] rounded-full border border-white/10 bg-gradient-to-r from-white/8 to-white/4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] px-3"
              >
                <div className="absolute inset-0 flex items-center justify-between px-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-green-500/15 text-green-400 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500 leading-none">音源</div>
                      <div className="text-sm font-medium text-white leading-tight truncate">
                        {musicSources.find((source) => source.key === currentSource)?.label || '酷我'}
                      </div>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-white/6 border border-white/8 flex items-center justify-center text-zinc-300 shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
            <div className="hidden md:flex flex-wrap bg-white/5 rounded-lg p-1 gap-1 border border-white/5">
              {musicSources.map((source) => (
                <button
                  key={source.key}
                  onClick={() => switchSource(source.key)}
                  className={`px-3 py-1 md:px-4 rounded text-[10px] font-bold tracking-wider transition-all ${
                    currentSource === source.key
                      ? 'bg-green-500 text-white border border-white/30 shadow-lg shadow-green-500/50'
                      : 'text-zinc-400 border border-transparent'
                  }`}
                >
                  {source.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center w-full md:flex-1 md:max-w-md md:ml-auto h-10 md:h-9 gap-2">
            {(currentView === 'songs' || currentView === 'myPlaylists') && (
              <button
                onClick={goBack}
                className="w-10 h-full rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white border border-white/10"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div
              className="relative group w-full h-full rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-zinc-500 transition-colors group-focus-within:text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full h-full appearance-none border-0 bg-transparent pl-9 pr-4 text-sm text-white outline-none focus:outline-none focus:ring-0 font-mono placeholder:text-zinc-500"
                placeholder="搜索歌曲或艺术家..."
              />
            </div>
            <button
              onClick={() => setCurrentView('myPlaylists')}
              className="w-10 h-full rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white border border-white/10 shrink-0"
              title="我的歌单"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-[136px] md:pt-[108px] pb-32 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          {loading && (
            <MusicLoadingIndicator className="py-8" />
          )}

          {/* Playlists View */}
          {currentView === 'playlists' && !loading && (
            <div>
              <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-2">
                <h2 className="text-xs font-mono text-white/50 tracking-widest">排行�?/h2>
                <span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded text-white">
                  {getSourceLabel()}
                </span>
              </div>
              {playlists.length > 0 ? (
                <div className="space-y-2">
                  {playlists.map((playlist, index) => (
                    <button
                      key={playlist.id}
                      onClick={() => loadPlaylist(playlist.id, playlist.name, playlist.source)}
                      className="w-full text-left rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors px-4 py-3"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 text-sm text-zinc-500 dark:text-zinc-300 font-mono shrink-0">
                          {String(index + 1).padStart(2, '0')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white/90 truncate">{playlist.name}</div>
                          {playlist.updateFrequency ? (
                            <div className="text-xs text-zinc-500 mt-1 truncate">{playlist.updateFrequency}</div>
                          ) : null}
                        </div>
                        <div className="text-zinc-500 shrink-0">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-zinc-400">
                  <div className="text-base font-medium text-white/80 mb-2">当前音源暂无排行�?/div>
                  <div className="text-sm text-zinc-500">
                    你可以切换其它音源，或使用上方搜索继续找歌�?                  </div>
                </div>
              )}
            </div>
          )}

          {/* Songs View */}
          {currentView === 'songs' && !loading && (
            <div>
              <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <h2 className="text-xl font-bold text-white/80 tracking-tight truncate max-w-md">
                    {currentPlaylistTitle}
                  </h2>
                  <span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded text-white shrink-0">
                    {songs.length} 首歌�?                  </span>
                </div>
                <button
                  onClick={handlePlayAllCurrentSongs}
                  disabled={songs.length === 0 || loadingCurrentPlayAll}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm text-white shrink-0"
                >
                  {loadingCurrentPlayAll ? (
                    <MusicLoadingIndicator size="sm" className="gap-2 text-white" />
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      播放全部
                    </>
                  )}
                </button>
              </div>
              <div className="space-y-1">
                {songs.map((song, index) => (
                  <div
                    key={`${song.id}-${index}`}
                    className={`grid grid-cols-[40px_1fr_auto_auto] md:grid-cols-[50px_2fr_1fr_auto_auto] gap-2 px-3 py-3 rounded-lg cursor-pointer transition-all ${
                      currentSongIndex === index
                        ? 'bg-white/12 border-l-2 border-green-500'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div
                      className="text-center text-zinc-500 dark:text-zinc-300 text-sm col-span-1"
                      onClick={() => playSong(song, index)}
                    >
                      {index + 1}
                    </div>
                    <div
                      className="min-w-0 col-span-1"
                      onClick={() => playSong(song, index)}
                    >
                      <div className="text-sm font-medium text-white truncate">{song.name}</div>
                      <div className="text-xs text-zinc-500 truncate md:hidden">{song.artist}</div>
                    </div>
                    <div
                      className="hidden md:block text-sm text-zinc-400 truncate col-span-1"
                      onClick={() => playSong(song, index)}
                    >
                      {song.artist}
                    </div>
                    <div
                      className="text-xs text-zinc-600 col-span-1"
                      onClick={() => playSong(song, index)}
                    >
                      {getSourceLabel()}
                    </div>
                    <div className="col-span-1 flex flex-col items-center justify-center gap-0.5 leading-none">
                      <button
                        onClick={(e) => handleAddToPlaylist(song, e)}
                        className="text-zinc-500 hover:text-red-500 transition-colors p-0.5"
                        title="添加到歌�?
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handlePlayLater(song, e)}
                        className="text-zinc-500 hover:text-green-500 transition-colors p-0.5"
                        title="稍后播放"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-9-9 9 9 0 019 9z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* My Playlists View */}
          {currentView === 'myPlaylists' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Playlists List */}
              <div className="md:col-span-1">
                <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/10">
                  <h2 className="text-lg font-bold mb-4">歌单列表</h2>
                  {loadingUserPlaylists ? (
                    <MusicLoadingIndicator className="py-8" />
                  ) : userPlaylists.length === 0 ? (
                    <div className="text-center py-8 text-zinc-400">
                      还没有歌�?                      <br />
                      <button
                        onClick={() => setCurrentView('playlists')}
                        className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                      >
                        去添加歌�?                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {userPlaylists.map((playlist) => (
                        <div
                          key={playlist.id}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedUserPlaylist?.id === playlist.id
                              ? 'bg-green-600/20 border border-green-500'
                              : 'bg-white/5 hover:bg-white/10'
                          }`}
                          onClick={() => handleSelectUserPlaylist(playlist)}
                        >
                          <div className="flex items-center gap-3">
                            {playlist.cover ? (
                              <img
                                src={playlist.cover}
                                alt={playlist.name}
                                className="w-12 h-12 rounded object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded bg-zinc-700 flex items-center justify-center">
                                <svg className="w-6 h-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                </svg>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{playlist.name}</div>
                              {playlist.description && (
                                <div className="text-xs text-zinc-500 truncate">{playlist.description}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Playlist Songs */}
              <div className="md:col-span-2">
                {selectedUserPlaylist ? (
                  <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-bold">{selectedUserPlaylist.name}</h2>
                        {selectedUserPlaylist.description && (
                          <p className="text-sm text-zinc-400 mt-1">{selectedUserPlaylist.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handlePlayAllPlaylist}
                          disabled={userPlaylistSongs.length === 0 || loadingPlayAll}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
                        >
                          {loadingPlayAll ? (
                            <MusicLoadingIndicator size="sm" className="gap-2 text-white" />
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                              播放全部
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteUserPlaylist(selectedUserPlaylist.id)}
                          disabled={deletingPlaylistId !== null}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
                        >
                          {deletingPlaylistId === selectedUserPlaylist.id ? (
                            <>
                              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              删除�?..
                            </>
                          ) : (
                            '删除歌单'
                          )}
                        </button>
                      </div>
                    </div>

                    {loadingUserPlaylistSongs ? (
                      <MusicLoadingIndicator className="py-8" />
                    ) : userPlaylistSongs.length === 0 ? (
                      <div className="text-center py-8 text-zinc-400">歌单为空</div>
                    ) : (
                      <div className="space-y-2">
                        {userPlaylistSongs.map((song, index) => (
                          <div
                            key={`${song.platform}+${song.id}`}
                            className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                          >
                            <div className="text-zinc-500 dark:text-zinc-300 text-sm w-8 text-center">{index + 1}</div>
                            {song.pic && (
                              <img
                                src={song.pic}
                                alt={song.name}
                                className="w-12 h-12 rounded object-cover"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{song.name}</div>
                              <div className="text-sm text-zinc-400 truncate">{song.artist}</div>
                            </div>
                            <button
                              onClick={() => playSong(song, index)}
                              className="text-zinc-500 hover:text-green-500 transition-colors p-2"
                              title="播放"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleRemoveSongFromUserPlaylist(song)}
                              className="text-zinc-500 hover:text-red-500 transition-colors p-2"
                              title="移除"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/10 h-full flex items-center justify-center">
                    <div className="text-center text-zinc-400">
                      <svg className="w-16 h-16 mx-auto mb-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      <p>选择一个歌单查看详�?/p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Player */}
      {showPlayer && currentSong && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-3xl z-50">
          {showSpectrum && (
            <div className="pointer-events-none px-4">
              <AudioSpectrumCanvas bars={spectrumBars} compact />
            </div>
          )}

          <div className="relative bg-zinc-900/95 backdrop-blur-md rounded-xl p-4 pt-5 border border-white/10 shadow-2xl">
            {/* Progress Bar */}
            <div className="absolute left-0 right-0 top-0 h-1 bg-white/10 rounded-t-xl overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all pointer-events-none"
                style={{ width: `${progress}%` }}
              />
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={handleProgressChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between gap-4 mt-1">
              {/* Song Info */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setShowLyrics(true)}
                >
                  {currentSong.pic ? (
                    <img
                      src={currentSong.pic}
                      alt={currentSong.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // 图片加载失败时显示默认图�?                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <svg className="w-6 h-6 text-zinc-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{currentSong.name}</div>
                  <div className="text-xs text-zinc-500 truncate">{currentSong.artist}</div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-4">
                <button onClick={playPrev} className="text-zinc-500 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                  </svg>
                </button>
                <button
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-colors"
                >
                  {isPlaying ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
                <button onClick={playNext} className="text-zinc-500 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                  </svg>
                </button>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2">
                  <input
                    type="range"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                  />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (currentSong) {
                      setSongToAddToPlaylist(currentSong);
                      setShowAddToPlaylistModal(true);
                    }
                  }}
                  className="text-zinc-500 hover:text-red-500 transition-colors"
                  title="添加到歌�?
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
                <button
                  onClick={downloadSong}
                  className="text-zinc-500 hover:text-white transition-colors"
                  title="下载歌曲"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                <button
                  onClick={toggleMode}
                  className="text-zinc-500 hover:text-white transition-colors"
                  title={playMode === 'loop' ? '列表循环' : playMode === 'single' ? '单曲循环' : '随机播放'}
                >
                  {playMode === 'loop' && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  {playMode === 'single' && (
                    <div className="relative w-4 h-4">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">1</span>
                    </div>
                  )}
                  {playMode === 'random' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audio Element */}
      <audio ref={audioRef} className="hidden" />

      {/* Lyrics Modal */}
      {showLyrics && currentSong && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={(e) => {
            // 点击背景关闭音量�?            if (e.target === e.currentTarget) {
              setShowVolumeSlider(false);
            }
          }}
        >
          <div
            className="relative w-full max-w-6xl h-[90vh] bg-zinc-900/95 rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex flex-col"
            onClick={() => setShowVolumeSlider(false)}
          >
            <button
              onClick={() => setShowLyrics(false)}
              className="absolute top-2 right-2 md:top-4 md:right-4 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex flex-1 min-h-0 flex-col md:flex-row">
              {/* Cover / Meta */}
              <div className="relative h-32 md:h-auto md:w-[320px] lg:w-[360px] xl:w-[420px] bg-gradient-to-b from-zinc-800 to-zinc-900 shrink-0">
                {currentSong.pic && (
                  <div className="absolute inset-0">
                    <img
                      src={currentSong.pic}
                      alt={currentSong.name}
                      className="w-full h-full object-cover opacity-30 blur-xl"
                    />
                  </div>
                )}
                <div className="relative h-full flex flex-col items-center justify-center p-4 md:p-6 lg:p-8">
                  <div className="w-16 h-16 md:w-40 md:h-40 lg:w-56 lg:h-56 rounded-xl lg:rounded-2xl overflow-hidden shadow-2xl mb-2 md:mb-4 lg:mb-6">
                    {currentSong.pic ? (
                      <img
                        src={currentSong.pic}
                        alt={currentSong.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                        <svg className="w-8 h-8 md:w-16 md:h-16 lg:w-20 lg:h-20 text-zinc-600" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <h2 className="text-base md:text-lg lg:text-2xl font-bold text-white text-center mb-1 line-clamp-2">{currentSong.name}</h2>
                  <p className="text-xs md:text-sm lg:text-base text-zinc-400 line-clamp-1 text-center">{currentSong.artist}</p>
                </div>
              </div>

              {/* Lyrics Content */}
              <div ref={lyricsContainerRef} className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                {lyrics.length > 0 ? (
                  <div className="space-y-4 md:space-y-5">
                    {lyrics.map((line, index) => (
                      <div
                        key={index}
                        data-index={index}
                        className={`text-center transition-all duration-300 ${
                          index === currentLyricIndex
                            ? 'text-white text-lg md:text-xl lg:text-2xl font-bold scale-110'
                            : index === currentLyricIndex - 1 || index === currentLyricIndex + 1
                            ? 'text-zinc-400 text-base md:text-lg'
                            : 'text-zinc-600 text-sm md:text-base'
                        }`}
                      >
                        <div>{line.text}</div>
                        {line.translation && (
                          <div
                            className={`mt-1 ${
                              index === currentLyricIndex
                                ? 'text-zinc-300 text-sm md:text-base lg:text-lg font-normal'
                                : 'text-zinc-500 text-xs md:text-sm lg:text-base font-normal'
                            }`}
                          >
                            {line.translation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center space-y-4 pt-10 md:pt-16 lg:pt-20">
                    <p className="text-zinc-500 text-sm md:text-base">暂无歌词</p>
                    <p className="text-zinc-600 text-xs md:text-sm">纯音乐或歌词获取失败</p>
                  </div>
                )}
              </div>
            </div>

            {/* Mini Player Controls */}
            <div className="border-t border-white/5 p-3 md:p-4 shrink-0">
              {/* 上排：播放控制按�?*/}
              <div className="flex items-center justify-center gap-4 md:gap-6 mb-2 md:mb-3">
                <button onClick={playPrev} className="text-zinc-500 hover:text-white transition-colors">
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                  </svg>
                </button>
                <button
                  onClick={togglePlay}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-colors"
                >
                  {isPlaying ? (
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 md:w-5 md:h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
                <button onClick={playNext} className="text-zinc-500 hover:text-white transition-colors">
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                  </svg>
                </button>
              </div>

              {/* 下排：其他按钮（小一号） */}
              <div className="flex items-center justify-center gap-3 md:gap-4 mb-2 md:mb-3">
                <button
                  onClick={() => setShowPlaylist(true)}
                  className="text-zinc-500 hover:text-white transition-colors relative"
                  title="播放列表"
                >
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  {playlist.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">
                      {playlist.length > 9 ? '9+' : playlist.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={downloadSong}
                  className="text-zinc-500 hover:text-white transition-colors"
                  title="下载歌曲"
                >
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowQualityMenu(true)}
                  className="px-2 py-0.5 rounded border text-amber-400 border-amber-500/50 bg-amber-900/20 text-[9px] md:text-[10px] font-mono min-w-[32px] text-center hover:bg-amber-900/30 transition-colors"
                  title="音质选择"
                >
                  {getQualityLabel()}
                </button>
                <button
                  onClick={toggleMode}
                  className="text-zinc-500 hover:text-white transition-colors"
                  title={playMode === 'loop' ? '列表循环' : playMode === 'single' ? '单曲循环' : '随机播放'}
                >
                  {playMode === 'loop' && (
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  {playMode === 'single' && (
                    <div className="relative w-4 h-4 md:w-5 md:h-5">
                      <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[7px] md:text-[8px] font-bold">1</span>
                    </div>
                  )}
                  {playMode === 'random' && (
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                    </svg>
                  )}
                </button>
                {/* 音量控制 */}
                <div
                  className="relative"
                  onMouseEnter={() => setShowVolumeSlider(true)}
                  onMouseLeave={() => setShowVolumeSlider(false)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowVolumeSlider(!showVolumeSlider);
                    }}
                    className="text-zinc-500 hover:text-white transition-colors"
                    title="音量"
                  >
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {/* 垂直音量�?- 桌面悬浮/移动端点�?*/}
                  <div
                    className={`absolute bottom-full left-1/2 -translate-x-1/2 pb-2 transition-opacity ${showVolumeSlider ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="bg-zinc-800/95 backdrop-blur-sm rounded-lg p-3 shadow-xl border border-white/10">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-xs text-zinc-400 font-mono">{volume}</span>
                        <div
                          className="h-24 w-6 bg-white/10 rounded-full relative cursor-pointer select-none"
                          onMouseDown={handleVolumeSliderInteraction}
                          onTouchStart={handleVolumeSliderInteraction}
                        >
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-green-500 rounded-full transition-all pointer-events-none"
                            style={{ height: `${volume}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* PiP 歌词按钮 */}
                <button
                  onClick={toggleSpectrum}
                  className={`transition-colors ${
                    showSpectrum ? 'text-green-500 hover:text-green-400' : 'text-zinc-500 hover:text-white'
                  }`}
                  title={showSpectrum ? '隐藏音谱�? : '显示音谱�?}
                >
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showSpectrum ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 18V9m4 9V6m4 12v-4m4 4V8m4 10V4" />
                    ) : (
                      <>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 18V9m4 9V6m4 12v-4m4 4V8m4 10V4" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" />
                      </>
                    )}
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePiPLyrics();
                  }}
                  className={`transition-colors ${
                    showPiPLyrics
                      ? 'text-green-500 hover:text-green-400'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                  title={showPiPLyrics ? '关闭画中画歌�? : '画中画歌�?}
                  disabled={!currentSong}
                >
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z"/>
                  </svg>
                </button>
                {/* 添加到歌单按�?*/}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (currentSong) {
                      setSongToAddToPlaylist(currentSong);
                      setShowAddToPlaylistModal(true);
                    }
                  }}
                  className="text-zinc-500 hover:text-red-500 transition-colors"
                  title="添加到歌�?
                >
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </div>

              {/* 进度�?*/}
              <div>
                {showSpectrum && (
                  <div className="mb-3 flex items-center gap-2 text-xs">
                    <span className="invisible">{formatTime(currentTime)}</span>
                    <div className="flex-1">
                      <AudioSpectrumCanvas bars={spectrumBars} />
                    </div>
                    <span className="invisible">{formatTime(duration)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>{formatTime(currentTime)}</span>
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-green-500 transition-all pointer-events-none"
                      style={{ width: `${progress}%` }}
                    />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={progress}
                      onChange={handleProgressChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Playlist Modal */}
      {showPlaylist && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl h-[90vh] md:h-auto max-h-[90vh] bg-zinc-900/95 rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="relative h-16 bg-gradient-to-b from-zinc-800 to-zinc-900 shrink-0 flex items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-white">播放列表</h2>
                <span className="text-xs text-zinc-500">({playlist.length})</span>
              </div>
              <div className="flex items-center gap-2">
                {playlist.length > 0 && (
                  <button
                    onClick={handleClearPlayRecords}
                    className="px-3 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors border border-red-500/50"
                    title="清空全部"
                  >
                    清空
                  </button>
                )}
                <button
                  onClick={() => setShowPlaylist(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Playlist */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {playlist.length > 0 ? (
                <div className="space-y-2">
                  {playlist.map((song, index) => (
                    <div
                      key={`${song.id}-${index}`}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors group ${
                        index === playlistIndex
                          ? 'bg-green-500/20 border border-green-500/50'
                          : 'bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div
                        onClick={() => {
                          setPlaylistIndex(index);
                          playSong(song, -1);
                          setShowPlaylist(false);
                        }}
                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                          {song.pic ? (
                            <img
                              src={song.pic}
                              alt={song.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-6 h-6 text-zinc-600" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium truncate transition-colors ${
                            index === playlistIndex ? 'text-green-400' : 'text-white group-hover:text-green-400'
                          }`}>
                            {song.name}
                          </div>
                          <div className="text-xs text-zinc-500 truncate">{song.artist}</div>
                        </div>
                        {index === playlistIndex ? (
                          <svg className="w-5 h-5 text-green-400 shrink-0 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-zinc-600 group-hover:text-white transition-colors shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        )}
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await fetch(`/api/music/v2/history?songId=${encodeURIComponent(song.id)}`, { method: 'DELETE' });

                            // 更新本地状�?                            const newPlaylist = playlist.filter((_, i) => i !== index);
                            const newRecords = playRecords.filter((_, i) => i !== index);
                            setPlaylist(newPlaylist);
                            setPlayRecords(newRecords);

                            // 如果删除的是当前播放的歌曲，调整索引
                            if (index === playlistIndex) {
                              setPlaylistIndex(-1);
                            } else if (index < playlistIndex) {
                              setPlaylistIndex(playlistIndex - 1);
                            }
                          } catch (error) {
                            console.error('删除播放记录失败:', error);
                          }
                        }}
                        className="w-8 h-8 rounded-lg bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                        title="删除"
                      >
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <svg className="w-16 h-16 text-zinc-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <p className="text-zinc-500 text-sm">播放列表为空</p>
                  <p className="text-zinc-600 text-xs mt-2">播放歌曲后会自动添加到列�?/p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quality Selection Menu */}
      {showQualityMenu && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end justify-center"
          onClick={() => setShowQualityMenu(false)}
        >
          <div
            className="w-full max-w-md bg-zinc-900 rounded-t-2xl border-t border-white/10 shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-white text-center">选择音质</h3>
            </div>

            {/* Quality Options */}
            <div className="p-4 space-y-2">
              <button
                onClick={() => {
                  setQuality('128k');
                  setShowQualityMenu(false);
                }}
                className={`w-full p-4 rounded-lg flex items-center justify-between transition-colors ${
                  quality === '128k'
                    ? 'bg-amber-500/20 border border-amber-500/50'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${quality === '128k' ? 'bg-amber-400' : 'bg-zinc-600'}`} />
                  <div className="text-left">
                    <div className="text-white font-medium">标准音质</div>
                    <div className="text-xs text-zinc-500">128kbps</div>
                  </div>
                </div>
                {quality === '128k' && (
                  <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              <button
                onClick={() => {
                  setQuality('320k');
                  setShowQualityMenu(false);
                }}
                className={`w-full p-4 rounded-lg flex items-center justify-between transition-colors ${
                  quality === '320k'
                    ? 'bg-amber-500/20 border border-amber-500/50'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${quality === '320k' ? 'bg-amber-400' : 'bg-zinc-600'}`} />
                  <div className="text-left">
                    <div className="text-white font-medium">高品�?HQ</div>
                    <div className="text-xs text-zinc-500">320kbps</div>
                  </div>
                </div>
                {quality === '320k' && (
                  <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              <button
                onClick={() => {
                  setQuality('flac');
                  setShowQualityMenu(false);
                }}
                className={`w-full p-4 rounded-lg flex items-center justify-between transition-colors ${
                  quality === 'flac'
                    ? 'bg-amber-500/20 border border-amber-500/50'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${quality === 'flac' ? 'bg-amber-400' : 'bg-zinc-600'}`} />
                  <div className="text-left">
                    <div className="text-white font-medium">无损音质 SQ</div>
                    <div className="text-xs text-zinc-500">FLAC</div>
                  </div>
                </div>
                {quality === 'flac' && (
                  <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              <button
                onClick={() => {
                  setQuality('flac24bit');
                  setShowQualityMenu(false);
                }}
                className={`w-full p-4 rounded-lg flex items-center justify-between transition-colors ${
                  quality === 'flac24bit'
                    ? 'bg-amber-500/20 border border-amber-500/50'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${quality === 'flac24bit' ? 'bg-amber-400' : 'bg-zinc-600'}`} />
                  <div className="text-left">
                    <div className="text-white font-medium">Hi-Res音质 HR</div>
                    <div className="text-xs text-zinc-500">FLAC 24bit</div>
                  </div>
                </div>
                {quality === 'flac24bit' && (
                  <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>

            {/* Cancel Button */}
            <div className="p-4 pt-0">
              <button
                onClick={() => setShowQualityMenu(false)}
                className="w-full p-3 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {showSourceMenu && (
        <div className="md:hidden fixed inset-0 z-[90]">
          <button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSourceMenu(false)}
            aria-label="关闭音源菜单"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-white/10 bg-zinc-950/98 px-4 pb-6 pt-4 shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/15" />
            <div className="mb-3 px-1 text-sm font-medium text-white">切换音源</div>
            <div className="space-y-2">
              {musicSources.map((source) => {
                const active = currentSource === source.key;
                return (
                  <button
                    key={source.key}
                    onClick={() => {
                      setShowSourceMenu(false);
                      if (!active) switchSource(source.key);
                    }}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all ${
                      active
                        ? 'border-green-500/50 bg-green-500/12 text-white'
                        : 'border-white/8 bg-white/5 text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${active ? 'bg-green-500/20 text-green-400' : 'bg-white/8 text-zinc-400'}`}>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                        </svg>
                      </div>
                      <div className="text-base font-medium">{source.label}</div>
                    </div>
                    {active ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <div className="text-zinc-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add to Playlist Modal */}
      <AddToPlaylistModal
        song={songToAddToPlaylist}
        isOpen={showAddToPlaylistModal}
        onClose={() => {
          setShowAddToPlaylistModal(false);
          setSongToAddToPlaylist(null);
        }}
        onSuccess={() => {
          setToast({
            message: '已添加到歌单',
            type: 'success',
            onClose: () => setToast(null),
          });
        }}
        onError={(message) => {
          setToast({
            message,
            type: 'error',
            onClose: () => setToast(null),
          });
        }}
      />

      {/* Toast */}
      {toast && <Toast {...toast} />}

      {/* Confirm Modal */}
      {confirmModal.isOpen &&
        createPortal(
          <div
            className="music-theme-portal fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            style={{ zIndex: 99999 }}
            onClick={confirmModal.onCancel}
          >
            <div
              className="bg-zinc-900 rounded-xl max-w-md w-full border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    {confirmModal.title}
                  </h3>
                  <button
                    onClick={confirmModal.onCancel}
                    className="text-zinc-400 hover:text-white transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="mb-6">
                  <p className="text-sm text-zinc-400">
                    {confirmModal.message}
                  </p>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={confirmModal.onCancel}
                    disabled={deletingPlaylistId !== null}
                    className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmModal.onConfirm}
                    disabled={deletingPlaylistId !== null}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    {deletingPlaylistId !== null ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        删除�?..
                      </>
                    ) : (
                      '确定'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* PiP Lyrics Window */}
      {showPiPLyrics && (
        <LyricsPiPWindow
          currentSong={currentSong}
          lyrics={lyrics}
          currentLyricIndex={currentLyricIndex}
          isPlaying={isPlaying}
          currentTime={currentTime}
          opacity={pipOpacity}
          minimized={pipMinimized}
          onOpacityChange={(opacity) => {
            setPipOpacity(opacity);
            localStorage.setItem('lyricsPiPOpacity', opacity.toString());
          }}
          onMinimizedChange={(minimized) => {
            setPipMinimized(minimized);
            localStorage.setItem('lyricsPiPMinimized', minimized.toString());
          }}
          onClose={() => setShowPiPLyrics(false)}
        />
      )}
      <style jsx global>{`
        :root {
          --music-bg: #f4f7fb;
          --music-bg-strong: rgba(255, 255, 255, 0.96);
          --music-surface: rgba(255, 255, 255, 0.88);
          --music-surface-soft: rgba(241, 245, 249, 0.92);
          --music-overlay: rgba(15, 23, 42, 0.45);
          --music-glass: rgba(15, 23, 42, 0.06);
          --music-glass-strong: rgba(15, 23, 42, 0.1);
          --music-border: rgba(148, 163, 184, 0.28);
          --music-text: #0f172a;
          --music-text-soft: #475569;
          --music-text-muted: #64748b;
        }

        .dark {
          --music-bg: #09090b;
          --music-bg-strong: rgba(9, 9, 11, 0.95);
          --music-surface: rgba(24, 24, 27, 0.9);
          --music-surface-soft: rgba(39, 39, 42, 0.88);
          --music-overlay: rgba(0, 0, 0, 0.72);
          --music-glass: rgba(255, 255, 255, 0.05);
          --music-glass-strong: rgba(255, 255, 255, 0.1);
          --music-border: rgba(255, 255, 255, 0.1);
          --music-text: #f8fafc;
          --music-text-soft: #cbd5e1;
          --music-text-muted: #94a3b8;
        }

        .music-theme {
          background: linear-gradient(180deg, var(--music-bg) 0%, color-mix(in srgb, var(--music-bg) 82%, #22c55e 18%) 100%);
          color: var(--music-text);
        }

        .music-theme :is([class*='bg-zinc-950'], [class*='bg-zinc-900']),
        .music-theme-portal :is([class*='bg-zinc-950'], [class*='bg-zinc-900']) {
          background-color: var(--music-bg-strong) !important;
        }

        .music-theme [class*='bg-zinc-800'],
        .music-theme-portal [class*='bg-zinc-800'] {
          background-color: var(--music-surface-soft) !important;
        }

        .music-theme :is([class*='bg-white/5'], [class*='bg-white/6'], [class*='bg-white/8'], [class*='bg-white/10'], [class*='bg-white/12']),
        .music-theme-portal :is([class*='bg-white/5'], [class*='bg-white/6'], [class*='bg-white/8'], [class*='bg-white/10'], [class*='bg-white/12']) {
          background-color: var(--music-glass) !important;
        }

        .music-theme [class*='bg-white/20'],
        .music-theme-portal [class*='bg-white/20'] {
          background-color: var(--music-glass-strong) !important;
        }

        .music-theme :is([class*='bg-black/90'], [class*='bg-black/50'], [class*='bg-black/30']),
        .music-theme-portal :is([class*='bg-black/90'], [class*='bg-black/50'], [class*='bg-black/30']) {
          background-color: var(--music-overlay) !important;
        }

        .music-theme :is([class*='border-white/'], [class*='border-zinc-']),
        .music-theme-portal :is([class*='border-white/'], [class*='border-zinc-']) {
          border-color: var(--music-border) !important;
        }

        .music-theme :is([class*='text-white'], [class*='text-zinc-200']),
        .music-theme-portal :is([class*='text-white'], [class*='text-zinc-200']) {
          color: var(--music-text) !important;
        }

        .music-theme :is([class*='text-zinc-300'], [class*='text-zinc-400']),
        .music-theme-portal :is([class*='text-zinc-300'], [class*='text-zinc-400']) {
          color: var(--music-text-soft) !important;
        }

        .music-theme :is([class*='text-zinc-500'], [class*='text-zinc-600']),
        .music-theme-portal :is([class*='text-zinc-500'], [class*='text-zinc-600']) {
          color: var(--music-text-muted) !important;
        }

        .music-theme :is([class*='from-zinc-800'], [class*='from-zinc-900']) {
          --tw-gradient-from: var(--music-surface-soft) var(--tw-gradient-from-position) !important;
          --tw-gradient-to: rgb(255 255 255 / 0) var(--tw-gradient-to-position) !important;
          --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important;
        }

        .music-theme :is([class*='to-zinc-900'], [class*='to-zinc-800']) {
          --tw-gradient-to: var(--music-bg-strong) var(--tw-gradient-to-position) !important;
        }

        .music-theme input::placeholder,
        .music-theme textarea::placeholder {
          color: var(--music-text-muted) !important;
        }
      `}</style>
      </>
    </div>
  );
}
