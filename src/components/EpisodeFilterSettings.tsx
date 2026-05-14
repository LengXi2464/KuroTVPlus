/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Plus, ToggleLeft, ToggleRight,Trash2, X } from 'lucide-react';
import { useEffect, useRef,useState } from 'react';
import { createPortal } from 'react-dom';

import { getEpisodeFilterConfig, saveEpisodeFilterConfig } from '@/lib/db.client';
import { normalizeEpisodeFilterConfig } from '@/lib/episode-filter';
import { EpisodeFilterConfig, EpisodeFilterRule } from '@/lib/types';

interface EpisodeFilterSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdate?: (config: EpisodeFilterConfig) => void;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function EpisodeFilterSettings({
  isOpen,
  onClose,
  onConfigUpdate,
  onShowToast,
}: EpisodeFilterSettingsProps) {
  const [config, setConfig] = useState<EpisodeFilterConfig>(normalizeEpisodeFilterConfig());
  const [newKeyword, setNewKeyword] = useState('');
  const [newType, setNewType] = useState<'normal' | 'regex'>('normal');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [inputKey, setInputKey] = useState(0); // 用于强制重新渲染输入�?  const inputRef = useRef<HTMLInputElement>(null); // 用于直接操作输入�?DOM
  const [mounted, setMounted] = useState(false);

  // 确保组件在客户端挂载后才渲染 Portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // 控制动画状�?  useEffect(() => {
    let animationId: number;
    let timer: NodeJS.Timeout;

    if (isOpen) {
      setIsVisible(true);
      // 使用双重 requestAnimationFrame 确保DOM完全渲染
      animationId = requestAnimationFrame(() => {
        animationId = requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      // 等待动画完成后隐藏组�?      timer = setTimeout(() => {
        setIsVisible(false);
      }, 300);
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [isOpen]);

  // 阻止背景滚动
  useEffect(() => {
    if (isVisible) {
      // 保存当前滚动位置
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      const body = document.body;
      const html = document.documentElement;

      // 获取滚动条宽�?      const scrollBarWidth = window.innerWidth - html.clientWidth;

      // 保存原始样式
      const originalBodyStyle = {
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        paddingRight: body.style.paddingRight,
        overflow: body.style.overflow,
      };

      // 设置body样式来阻止滚动，但保持原位置
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = `-${scrollX}px`;
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      body.style.paddingRight = `${scrollBarWidth}px`;

      return () => {
        // 恢复所有原始样�?        body.style.position = originalBodyStyle.position;
        body.style.top = originalBodyStyle.top;
        body.style.left = originalBodyStyle.left;
        body.style.right = originalBodyStyle.right;
        body.style.width = originalBodyStyle.width;
        body.style.paddingRight = originalBodyStyle.paddingRight;
        body.style.overflow = originalBodyStyle.overflow;

        // 使用 requestAnimationFrame 确保样式恢复后再滚动
        requestAnimationFrame(() => {
          window.scrollTo(scrollX, scrollY);
        });
      };
    }
  }, [isVisible]);

  // 加载配置
  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const loadedConfig = await getEpisodeFilterConfig();
      if (loadedConfig) {
        setConfig(normalizeEpisodeFilterConfig(loadedConfig));
      } else {
        setConfig(normalizeEpisodeFilterConfig());
      }
    } catch (error) {
      console.error('加载集数过滤配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleReverseMode = () => {
    setConfig((prev) => {
      const normalizedConfig = normalizeEpisodeFilterConfig(prev);
      return {
        ...normalizedConfig,
        reverseMode: !normalizedConfig.reverseMode,
      };
    });
  };

  // 保存配置
  const handleSave = async () => {
    const normalizedConfig = normalizeEpisodeFilterConfig(config);
    if (normalizedConfig.reverseMode && normalizedConfig.rules.length === 0) {
      if (onShowToast) {
        onShowToast('启用相反模式时，至少需要添加一条规�?, 'info');
      }
      return;
    }

    setSaving(true);
    try {
      await saveEpisodeFilterConfig(normalizedConfig);
      if (onConfigUpdate) {
        onConfigUpdate(normalizedConfig);
      }
      if (onShowToast) {
        onShowToast('保存成功�?, 'success');
      }
      // 延迟关闭面板，让用户看到toast
      setTimeout(() => {
        onClose();
      }, 300);
    } catch (error) {
      console.error('保存集数过滤配置失败:', error);
      if (onShowToast) {
        onShowToast('保存失败，请重试', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  // 添加规则
  const handleAddRule = () => {
    if (!newKeyword.trim()) {
      if (onShowToast) {
        onShowToast('请输入关键字', 'info');
      }
      return;
    }

    const newRule: EpisodeFilterRule = {
      keyword: newKeyword.trim(),
      type: newType,
      enabled: true,
      id: Date.now().toString(),
    };

    setConfig((prev) => {
      const normalizedConfig = normalizeEpisodeFilterConfig(prev);
      return {
        ...normalizedConfig,
        rules: [...normalizedConfig.rules, newRule],
      };
    });

    // 清空输入框并强制重新渲染
    setNewKeyword('');

    // 使用 setTimeout 确保在状态更新后操作 DOM
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.value = ''; // 直接清空 DOM �?        inputRef.current.blur(); // 失去焦点，阻止自动填�?      }
      setInputKey(prev => prev + 1); // 强制重新渲染输入�?    }, 0);
  };

  // 删除规则
  const handleDeleteRule = (id: string | undefined) => {
    if (!id) return;
    setConfig((prev) => {
      const normalizedConfig = normalizeEpisodeFilterConfig(prev);
      return {
        ...normalizedConfig,
        rules: normalizedConfig.rules.filter((rule) => rule.id !== id),
      };
    });
  };

  // 切换规则启用状�?  const handleToggleRule = (id: string | undefined) => {
    if (!id) return;
    setConfig((prev) => {
      const normalizedConfig = normalizeEpisodeFilterConfig(prev);
      return {
        ...normalizedConfig,
        rules: normalizedConfig.rules.map((rule) =>
          rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
        ),
      };
    });
  };

  if (!isVisible || !mounted) return null;

  const content = (
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center"
      onTouchMove={(e) => {
        // 阻止最外层容器的触摸移动，防止背景滚动
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        touchAction: 'none', // 禁用所有触摸操�?      }}
    >
      {/* 背景遮罩 */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ease-out ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        onTouchMove={(e) => {
          // 只阻止滚动，允许其他触摸事件（包括点击）
          e.preventDefault();
        }}
        onWheel={(e) => {
          // 阻止滚轮滚动
          e.preventDefault();
        }}
        style={{
          backdropFilter: 'blur(4px)',
          willChange: 'opacity',
          touchAction: 'none', // 禁用所有触摸操�?        }}
      />

      {/* 弹窗主体 */}
      <div
        className="relative w-full bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl transition-all duration-300 ease-out max-h-[85vh] flex flex-col"
        onTouchMove={(e) => {
          // 允许弹窗内部滚动，阻止事件冒泡到外层
          e.stopPropagation();
        }}
        style={{
          marginBottom: 'calc(0rem + env(safe-area-inset-bottom))',
          willChange: 'transform, opacity',
          backfaceVisibility: 'hidden', // 避免闪烁
          transform: isAnimating
            ? 'translateY(0) translateZ(0)'
            : 'translateY(100%) translateZ(0)', // 组合变换保持滑入效果和硬件加�?          opacity: isAnimating ? 1 : 0,
          touchAction: 'auto', // 允许弹窗内的正常触摸操作
        }}
      >
        {/* 顶部拖拽指示�?*/}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 pt-3 pb-2">
          <div className="flex justify-center">
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
          </div>
        </div>

        {/* 头部 */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            集数屏蔽设置
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {/* 添加规则 */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3 rounded-xl bg-white dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 px-4 py-3">
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  相反模式
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  开启后，将屏蔽改为仅显示符合规则的集数�?                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                  启用时必须至少保留一条规则才能保存�?                </p>
              </div>
              <button
                onClick={handleToggleReverseMode}
                className="flex-shrink-0 active:scale-95 transition-transform duration-150"
                title={config.reverseMode ? '关闭相反模式' : '开启相反模�?}
              >
                {config.reverseMode ? (
                  <ToggleRight
                    size={28}
                    className="text-green-500 hover:text-green-400 transition-colors duration-150"
                  />
                ) : (
                  <ToggleLeft
                    size={28}
                    className="text-gray-400 hover:text-gray-300 transition-colors duration-150"
                  />
                )}
              </button>
            </div>

            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              添加屏蔽规则
            </h3>
            <div className="space-y-3">
              <input
                key={inputKey}
                ref={inputRef}
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddRule()}
                placeholder="输入要屏蔽的集数关键字（如：预告、花絮）"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                data-form-type="other"
                data-lpignore="true"
                className="w-full px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg border border-gray-200 dark:border-gray-600 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-all duration-200"
              />
              <div className="flex gap-2">
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as 'normal' | 'regex')}
                  className="flex-1 px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg border border-gray-200 dark:border-gray-600 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-all duration-200"
                >
                  <option value="normal">普通模�?/option>
                  <option value="regex">正则模式</option>
                </select>
                <button
                  onClick={handleAddRule}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-lg transition-all duration-200 flex items-center gap-2 active:scale-[0.98] shadow-sm hover:shadow-md"
                >
                  <Plus size={18} />
                  <span className="font-medium">添加</span>
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              💡 普通模式：集数标题包含关键字即命中规则<br/>
              🔄 相反模式：仅显示命中规则的集�?br/>
              🔧 正则模式：支持正则表达式匹配（如：^预告.*匹配�?预告"开头的集数�?            </p>
          </div>

          {/* 规则列表 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                当前规则
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                {config.rules.length}
              </span>
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <div className="inline-flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-green-500 rounded-full animate-spin"></div>
                  <span>加载�?..</span>
                </div>
              </div>
            ) : config.rules.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <div className="inline-flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <Plus size={24} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium">暂无屏蔽规则</p>
                    <p className="text-sm mt-1">点击上方添加关键�?/p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {config.rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 active:bg-gray-100 dark:active:bg-gray-750 transition-colors duration-150"
                  >
                    {/* 启用/禁用按钮 */}
                    <button
                      onClick={() => handleToggleRule(rule.id)}
                      className="flex-shrink-0 active:scale-95 transition-transform duration-150"
                    >
                      {rule.enabled ? (
                        <ToggleRight
                          size={28}
                          className="text-green-500 hover:text-green-400 transition-colors duration-150"
                        />
                      ) : (
                        <ToggleLeft
                          size={28}
                          className="text-gray-400 hover:text-gray-300 transition-colors duration-150"
                        />
                      )}
                    </button>

                    {/* 关键�?*/}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col gap-1.5">
                        <span
                          className={`font-mono text-sm break-all leading-relaxed ${
                            rule.enabled ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {rule.keyword}
                        </span>
                        <span
                          className={`inline-flex items-center self-start text-xs px-2.5 py-1 rounded-full font-medium ${
                            rule.type === 'regex'
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          }`}
                        >
                          {rule.type === 'regex' ? '🔧 正则' : '💬 普�?}
                        </span>
                      </div>
                    </div>

                    {/* 删除按钮 */}
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="flex-shrink-0 p-2 text-red-500 hover:text-red-600 active:text-red-700 active:scale-90 transition-all duration-150"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-4 py-4">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 dark:active:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-all duration-200 active:scale-[0.98]"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-700 text-white rounded-xl font-medium transition-all duration-200 active:scale-[0.98] shadow-sm hover:shadow-md disabled:shadow-none"
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  保存�?..
                </span>
              ) : (
                '保存'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // 使用 Portal 将组件渲染到 document.body
  return createPortal(content, document.body);
}
