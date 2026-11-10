'use client';

import { Check, Copy, KeyRound, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

type Visitor = {
  ip: string;
  device: string;
  model: string;
  loc: string;
  lastSeen: number;
  admin: boolean;
};

type AccessData = {
  enabled: boolean;
  autoRotate: boolean;
  rotateHours: number;
  customPassword: string;
  required: boolean;
  mode: 'off' | 'custom' | 'auto' | 'env';
  currentPassword: string;
  nextRotateAt: number | null;
  online?: number;
  visitors?: Visitor[];
};

const HOUR_OPTIONS = [1, 2, 4, 6, 8, 12, 24, 48, 72, 168];

export default function HuangguoAccessConfig() {
  const [data, setData] = useState<AccessData | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [rotateHours, setRotateHours] = useState(24);
  const [customPassword, setCustomPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const apply = (d: AccessData) => {
    setData(d);
    setEnabled(d.enabled);
    setAutoRotate(d.autoRotate);
    setRotateHours(d.rotateHours || 24);
    setCustomPassword(d.customPassword || '');
  };

  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/huangguo-access', { cache: 'no-store' });
      const json = (await res.json()) as AccessData & { error?: string };
      if (!res.ok) throw new Error(json.error || '读取失败');
      apply(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // 轮询在线人数（内存级统计，仅当前实例）
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load(false);
    }, 20000);
    return () => clearInterval(timer);
  }, []);

  const save = async (rotateNow = false) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/huangguo-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          autoRotate: enabled ? autoRotate : false,
          rotateHours,
          customPassword,
          rotateNow,
        }),
      });
      const json = (await res.json()) as AccessData & { error?: string; success?: boolean };
      if (!res.ok || !json.success) throw new Error(json.error || '保存失败');
      apply(json);
      setMessage(rotateNow ? '已立即更换新密码' : '已保存');
      setTimeout(() => setMessage(''), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    if (!data?.currentPassword) return;
    try {
      await navigator.clipboard.writeText(data.currentPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className='space-y-4'>
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5'>
        <div className='flex items-center gap-2 mb-1'>
          <KeyRound size={18} className='text-amber-600 dark:text-amber-400' />
          <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>黄果短剧访问密码</h2>
        </div>
        <p className='text-xs text-gray-500 dark:text-gray-400 mb-4'>
          开启后访问「黄果」页面需要输入密码。可设置固定密码，也可按小时自动更换；密码更换后已登录的访客会重新要求输入。
        </p>

        {loading ? (
          <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400'>
            <Loader2 className='h-4 w-4 animate-spin' /> 读取中…
          </div>
        ) : (
          <>
            <label className='flex items-center justify-between py-2'>
              <span className='text-sm text-gray-800 dark:text-gray-200'>启用访问密码</span>
              <input
                type='checkbox'
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className='h-4 w-4 accent-amber-500'
              />
            </label>

            {enabled && (
              <div className='mt-3 space-y-4 border-t border-gray-100 dark:border-gray-700 pt-3'>
                <div className='flex gap-2'>
                  <button
                    type='button'
                    onClick={() => setAutoRotate(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      autoRotate
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    自动更换
                  </button>
                  <button
                    type='button'
                    onClick={() => setAutoRotate(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      !autoRotate
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    自定义密码
                  </button>
                </div>

                {autoRotate ? (
                  <div className='space-y-3'>
                    <div className='flex items-center gap-2'>
                      <span className='text-sm text-gray-700 dark:text-gray-300'>更换周期</span>
                      <select
                        value={rotateHours}
                        onChange={(e) => setRotateHours(Number(e.target.value))}
                        className='px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100'
                      >
                        {HOUR_OPTIONS.map((h) => (
                          <option key={h} value={h}>
                            {h % 24 === 0 ? `${h / 24} 天` : `${h} 小时`}
                          </option>
                        ))}
                      </select>
                      <span className='text-xs text-gray-500 dark:text-gray-400'>保存后生效</span>
                    </div>

                    <div className='rounded-lg bg-amber-50 dark:bg-amber-500/10 p-3'>
                      <p className='text-xs text-gray-600 dark:text-gray-300 mb-1'>当前密码</p>
                      <div className='flex items-center gap-2'>
                        <code className='text-lg font-mono font-semibold tracking-wider text-amber-700 dark:text-amber-300'>
                          {data?.currentPassword || '-'}
                        </code>
                        <button
                          type='button'
                          onClick={copy}
                          className='p-1.5 rounded-md text-gray-500 hover:bg-amber-100 dark:hover:bg-amber-500/20'
                          title='复制'
                        >
                          {copied ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <button
                          type='button'
                          onClick={() => void save(true)}
                          disabled={saving}
                          className='ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 disabled:opacity-50'
                        >
                          <RefreshCw size={12} /> 立即更换
                        </button>
                      </div>
                      {data?.nextRotateAt ? (
                        <p className='mt-1.5 text-[11px] text-gray-500 dark:text-gray-400'>
                          下次自动更换：{new Date(data.nextRotateAt).toLocaleString('zh-CN')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className='block text-sm text-gray-700 dark:text-gray-300 mb-1'>自定义密码</label>
                    <input
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      placeholder='输入访客需要输入的密码'
                      className='w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100'
                    />
                    <p className='mt-1 text-[11px] text-gray-500 dark:text-gray-400'>
                      自定义密码不会自动更换
                    </p>
                  </div>
                )}
              </div>
            )}

            {error && <p className='mt-3 text-xs text-red-500'>{error}</p>}
            {message && <p className='mt-3 text-xs text-green-600 dark:text-green-400'>{message}</p>}

            <div className='mt-4 flex justify-end'>
              <button
                type='button'
                onClick={() => void save(false)}
                disabled={saving}
                className='px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50'
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className='bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5'>
        <div className='flex items-center justify-between mb-3'>
          <h2 className='text-base font-semibold text-gray-900 dark:text-gray-100'>访问情况</h2>
          <span className='text-xs text-gray-500 dark:text-gray-400'>
            在线 <span className='font-semibold text-green-600 dark:text-green-400'>{data?.online ?? 0}</span> 人
          </span>
        </div>
        {!data?.visitors?.length ? (
          <p className='text-xs text-gray-500 dark:text-gray-400'>最近 30 分钟暂无访问记录</p>
        ) : (
          <div className='space-y-1.5'>
            {data.visitors.map((v, i) => (
              <div
                key={`${v.ip}-${v.device}-${i}`}
                className='rounded-md bg-gray-50 dark:bg-gray-900/60 px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300'
              >
                <div className='flex items-center justify-between'>
                  <span className='flex items-center gap-2'>
                    <span>{v.device}</span>
                    <span className='font-mono text-[11px] text-gray-500 dark:text-gray-400'>{v.ip}</span>
                    {v.admin && <span className='rounded bg-amber-100 dark:bg-amber-500/20 px-1 text-[10px] text-amber-700 dark:text-amber-300'>管理员</span>}
                  </span>
                  <span className='text-[11px] text-gray-400'>{new Date(v.lastSeen).toLocaleTimeString('zh-CN')}</span>
                </div>
                {(v.loc || v.model) && (
                  <div className='mt-0.5 text-[11px] text-gray-500 dark:text-gray-400'>
                    {v.loc ? `位置：${v.loc}` : ''}
                    {v.loc && v.model ? ' · ' : ''}
                    {v.model ? `设备：${v.model}` : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <p className='mt-3 text-[11px] text-gray-400 dark:text-gray-500'>
          在线=最近 5 分钟有访问；仅统计当前实例（多实例/重启后重新计数）。站点所有者账号访问黄果免密。
        </p>
      </div>

      <div className='text-xs text-gray-500 dark:text-gray-400 px-1'>
        提示：环境变量 HUANGGUO_ACCESS_PASSWORD 仍作为后备；后台配置开启后以后台为准。当前状态：
        {data?.mode === 'off'
          ? '未启用'
          : data?.mode === 'auto'
            ? `自动更换（每 ${data.rotateHours} 小时）`
            : data?.mode === 'custom'
              ? '自定义密码'
              : '环境变量密码'}
      </div>
    </div>
  );
}
