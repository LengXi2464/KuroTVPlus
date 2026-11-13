'use client';

import { Camera, Loader2, MapPin, ShieldAlert } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';

import OperationWatcher from './OperationWatcher';

/* 进站留影门禁（按后台圈选的用户生效）：
   - /api/entry/status 返回 capture=true（登录且被圈选、非管理员）时才启动
   - 启动后在站内页面请求摄像头+GPS 授权；拒绝则全屏拦截可重弹
   - 授权通过：先发一次 📸 进站记录（前后照+GPS），再挂载 OperationWatcher 持续操作留影
   - 未圈选用户/游客/管理员：无任何弹窗、无拍照 */

const SS_KEY = 'entry_capture_ok';
const LS_KEY = 'entry_capture_last';
const COOLDOWN_MS = 10 * 60 * 1000;

const AUTH_PAGES = ['/login', '/register', '/oidc-register', '/qr-login', '/tv/login', '/warning'];

type Perm = 'idle' | 'checking' | 'ok' | 'blocked';
type Gps = { lat: number; lng: number; acc: number };

async function grabFrame(stream: MediaStream): Promise<string | undefined> {
  let video: HTMLVideoElement | null = null;
  try {
    video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    // iOS/iPadOS Safari 不解码未挂载的 video：挂 1px 透明节点
    video.style.position = 'fixed';
    video.style.top = '0';
    video.style.left = '0';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    video.style.zIndex = '-1';
    document.body.appendChild(video);
    video.srcObject = stream;
    await video.play().catch(() => undefined);
    const t0 = Date.now();
    while (!video.videoWidth && Date.now() - t0 < 2500) {
      await new Promise((r) => setTimeout(r, 100));
    }
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
    video?.remove();
  }
}

const isDeny = (e: unknown) => {
  const name = (e as DOMException)?.name;
  return name === 'NotAllowedError' || name === 'SecurityError';
};

async function probeCamera(): Promise<'denied' | 'ok'> {
  if (!navigator.mediaDevices?.getUserMedia) return 'denied';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    });
    stream.getTracks().forEach((t) => t.stop());
    return 'ok';
  } catch (e) {
    return isDeny(e) ? 'denied' : 'ok';
  }
}

/** 仅「确实拒绝」算 denied；iOS 弹窗被抑制（权限仍为 prompt）时放行。 */
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
    /* ignore */
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
  const [capture, setCapture] = useState(false);
  const [perm, setPerm] = useState<Perm>('idle');
  const [missing, setMissing] = useState<string[]>([]);
  const [round, setRound] = useState(0);
  const reportedRef = useRef(false);

  /* 每次路由变化查询是否圈选目标（登录态变化后自动生效） */
  useEffect(() => {
    let alive = true;
    fetch('/api/entry/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { capture?: boolean }) => alive && setCapture(!!j.capture))
      .catch(() => alive && setCapture(false));
    return () => {
      alive = false;
    };
  }, [pathname]);

  /* 命中目标后，在站内页面请求授权。
     注意：不能用 perm 状态做清理取消——setPerm('checking') 会重跑本 effect，
     清理函数会把在飞的检测取消导致永远卡在 checking。用 'checking' 状态本身防重入。 */
  useEffect(() => {
    if (!capture || perm === 'ok' || perm === 'checking') return;
    if (AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return;
    setPerm('checking');
    (async () => {
      const miss: string[] = [];
      const cam = await probeCamera();
      if (cam === 'denied') miss.push('摄像头');
      const gps = await probeGps();
      if (gps === 'denied') miss.push('位置');
      if (miss.length) {
        setMissing(miss);
        setPerm('blocked');
      } else {
        setPerm('ok');
      }
    })();
  }, [capture, pathname, perm, round]);

  /* 授权通过后发一次 📸 进站记录（每会话/10 分钟冷却一次） */
  useEffect(() => {
    if (!capture || perm !== 'ok' || reportedRef.current) return;
    let skip = false;
    try {
      if (sessionStorage.getItem(SS_KEY)) skip = true;
      const last = Number(localStorage.getItem(LS_KEY) || 0);
      if (last && Date.now() - last < COOLDOWN_MS) skip = true;
    } catch {
      /* ignore */
    }
    if (skip) {
      reportedRef.current = true;
      return;
    }
    reportedRef.current = true;
    (async () => {
      try {
        const cam = await captureCameras();
        const gps = await getGpsSoft();
        const device = await deviceInfo();
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
        /* 任何意外都不拦人 */
      }
    })();
  }, [capture, perm]);

  if (capture && perm !== 'ok') {
    return (
      <div className='fixed inset-0 z-[9999] flex items-center justify-center bg-gray-950/95 px-5 backdrop-blur'>
        <div className='w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-gray-800'>
          <div className='mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400'>
            {perm === 'checking' ? (
              <Loader2 className='h-7 w-7 animate-spin' />
            ) : (
              <ShieldAlert className='h-7 w-7' />
            )}
          </div>
          {perm === 'checking' ? (
            <>
              <h1 className='text-base font-semibold text-gray-900 dark:text-gray-100'>
                正在进行进入验证
              </h1>
              <p className='mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400'>
                你的账号被纳入留影名单，需要验证摄像头与位置授权，请在弹窗中选择「允许」。
              </p>
              <p className='mt-2 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500'>
                授权后站内每次操作都会拍摄前后摄像头照片与屏幕截图，连同账号、IP、位置发送给站长留档。
              </p>
            </>
          ) : (
            <>
              <h1 className='text-base font-semibold text-gray-900 dark:text-gray-100'>
                授权未完成，无法进入
              </h1>
              <p className='mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400'>
                缺少授权：{missing.join('、')}。你的账号在留影名单内，必须同时允许
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
                onClick={() => {
                  setPerm('idle');
                  setRound((r) => r + 1);
                }}
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

  return (
    <>
      {children}
      {capture && perm === 'ok' && <OperationWatcher />}
    </>
  );
}
