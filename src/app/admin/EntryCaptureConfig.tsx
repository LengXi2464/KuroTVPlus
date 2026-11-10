'use client';

import { Camera, Loader2, UserCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

type UserInfo = { username: string; role?: string };

export default function EntryCaptureConfig() {
  const [enabled, setEnabled] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<UserInfo[]>([]);
  const [manual, setManual] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/entry-capture', { cache: 'no-store' });
      const json = (await res.json()) as { enabled?: boolean; users?: string[]; error?: string };
      if (!res.ok) throw new Error(json.error || '读取失败');
      setEnabled(!!json.enabled);
      setSelected(json.users || []);
      try {
        const ur = await fetch('/api/admin/users?page=1&pageSize=200', { cache: 'no-store' });
        if (ur.ok) {
          const uj = (await ur.json()) as { users?: UserInfo[] };
          setAllUsers(
            (uj.users || []).filter((u) => u.role !== 'owner' && u.role !== 'admin')
          );
        }
      } catch {
        /* 用户列表不可用时仅手动添加 */
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggle = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((u) => u !== name) : [...prev, name]
    );
  };

  const addManual = () => {
    const name = manual.trim();
    if (!name) return;
    if (!selected.includes(name)) setSelected((prev) => [...prev, name]);
    if (!allUsers.some((u) => u.username === name)) {
      setAllUsers((prev) => [...prev, { username: name }]);
    }
    setManual('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/entry-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, users: selected }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error || '保存失败');
      setMessage('已保存');
      setTimeout(() => setMessage(''), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='space-y-4'>
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5'>
        <div className='flex items-center gap-2 mb-1'>
          <Camera size={18} className='text-amber-600 dark:text-amber-400' />
          <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>进站留影圈选</h2>
        </div>
        <p className='text-xs text-gray-500 dark:text-gray-400 mb-4'>
          仅名单内用户登录后需要完成摄像头+位置授权，并进行进站拍照与操作留影；未选中用户、游客、管理员完全无感知。
        </p>

        {loading ? (
          <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400'>
            <Loader2 className='h-4 w-4 animate-spin' /> 读取中…
          </div>
        ) : (
          <>
            <label className='flex items-center justify-between py-2'>
              <span className='text-sm text-gray-800 dark:text-gray-200'>启用留影圈选</span>
              <input
                type='checkbox'
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className='h-4 w-4 accent-amber-500'
              />
            </label>

            {enabled && (
              <div className='mt-3 border-t border-gray-100 dark:border-gray-700 pt-3'>
                <p className='mb-2 flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300'>
                  <UserCheck size={14} /> 圈选用户（{selected.length}）
                </p>
                {allUsers.length > 0 && (
                  <div className='flex flex-wrap gap-2 mb-3'>
                    {allUsers.map((u) => (
                      <button
                        key={u.username}
                        type='button'
                        onClick={() => toggle(u.username)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                          selected.includes(u.username)
                            ? 'bg-amber-500 text-white'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {u.username}
                      </button>
                    ))}
                  </div>
                )}
                <div className='flex gap-2'>
                  <input
                    value={manual}
                    onChange={(e) => setManual(e.target.value)}
                    placeholder='手动添加用户名'
                    className='flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100'
                  />
                  <button
                    type='button'
                    onClick={addManual}
                    className='px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200'
                  >
                    添加
                  </button>
                </div>
                {selected.length > 0 && (
                  <p className='mt-2 text-[11px] text-gray-500 dark:text-gray-400'>
                    已圈选：{selected.join('、')}
                  </p>
                )}
              </div>
            )}

            {error && <p className='mt-3 text-xs text-red-500'>{error}</p>}
            {message && <p className='mt-3 text-xs text-green-600 dark:text-green-400'>{message}</p>}

            <div className='mt-4 flex justify-end'>
              <button
                type='button'
                onClick={() => void save()}
                disabled={saving}
                className='px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50'
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
