'use client';

import { KeyRound, Loader2, Lock } from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useState } from 'react';

/** 黄果访问密码：未配置 HUANGGUO_ACCESS_PASSWORD 时直接放行。 */
export default function HuangguoGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'locked' | 'open'>('loading');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/huangguo/gate', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { required?: boolean; unlocked?: boolean }) => {
        if (!alive) return;
        setState(j.required && !j.unlocked ? 'locked' : 'open');
      })
      .catch(() => alive && setState('open'));
    return () => {
      alive = false;
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/huangguo/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const j = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !j.ok) throw new Error(j.message || '密码错误');
      setState('open');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (state === 'loading') {
    return (
      <div className='flex h-screen items-center justify-center'>
        <Loader2 className='h-6 w-6 animate-spin text-gray-400' />
      </div>
    );
  }

  if (state === 'locked') {
    return (
      <div className='flex min-h-screen items-center justify-center px-5'>
        <form
          onSubmit={submit}
          className='w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700/70'
        >
          <div className='mb-4 flex flex-col items-center gap-2 text-center'>
            <div className='flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400'>
              <Lock className='h-6 w-6' />
            </div>
            <h1 className='text-base font-semibold text-gray-900 dark:text-gray-100'>黄果短剧 · 需要访问密码</h1>
            <p className='text-xs text-gray-500 dark:text-gray-400'>请输入密码后继续浏览</p>
          </div>
          <div className='relative'>
            <KeyRound className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400' />
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              placeholder='访问密码'
              className='w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
            />
          </div>
          {error && <p className='mt-2 text-xs text-red-500'>{error}</p>}
          <button
            type='submit'
            disabled={busy || !password}
            className='mt-4 w-full rounded-xl bg-amber-500 py-2.5 text-sm font-medium text-white transition hover:bg-amber-600 disabled:opacity-50'
          >
            {busy ? '验证中…' : '进入'}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
