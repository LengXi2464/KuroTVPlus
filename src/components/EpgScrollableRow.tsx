/* eslint-disable react-hooks/exhaustive-deps */

import { BarChart3,Clock, List, Target, Tv } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { formatTimeToHHMM, parseCustomTimeFormat } from '@/lib/time';

interface EpgProgram {
  start: string;
  end: string;
  title: string;
}

interface EpgScrollableRowProps {
  programs: EpgProgram[];
  currentTime?: Date;
  isLoading?: boolean;
}

type ViewMode = 'list' | 'timeline';

export default function EpgScrollableRow({
  programs,
  currentTime = new Date(),
  isLoading = false,
}: EpgScrollableRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineHorizontalRef = useRef<HTMLDivElement>(null);
  const timelineVerticalRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number>(-1);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // 处理滚轮事件，实现横向滚�?  const handleWheel = (e: WheelEvent) => {
    if (isHovered && containerRef.current) {
      e.preventDefault(); // 阻止默认的竖向滚�?
      const container = containerRef.current;
      const scrollAmount = e.deltaY * 4; // 增加滚动速度

      // 根据滚轮方向进行横向滚动
      container.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // 阻止页面竖向滚动
  const preventPageScroll = (e: WheelEvent) => {
    if (isHovered) {
      e.preventDefault();
    }
  };

  // 自动滚动到正在播放的节目（列表视图）
  const scrollToCurrentProgram = () => {
    if (containerRef.current) {
      const currentProgramIndex = programs.findIndex(program => isCurrentlyPlaying(program));
      if (currentProgramIndex !== -1) {
        const programElement = containerRef.current.children[currentProgramIndex] as HTMLElement;
        if (programElement) {
          const container = containerRef.current;
          const programLeft = programElement.offsetLeft;
          const containerWidth = container.clientWidth;
          const programWidth = programElement.offsetWidth;

          // 计算滚动位置，使正在播放的节目居中显�?          const scrollLeft = programLeft - (containerWidth / 2) + (programWidth / 2);

          container.scrollTo({
            left: Math.max(0, scrollLeft),
            behavior: 'smooth'
          });
        }
      }
    }
  };

  // 自动滚动到正在播放的节目（时间线视图�?  const scrollToCurrentProgramTimeline = () => {
    const currentProgramIndex = programs.findIndex(program => isCurrentlyPlaying(program));
    if (currentProgramIndex === -1) return;

    // 横向时间�?    if (timelineHorizontalRef.current && window.innerWidth >= 768) {
      const programElement = timelineHorizontalRef.current.children[currentProgramIndex] as HTMLElement;
      if (programElement) {
        const container = timelineHorizontalRef.current;
        const programLeft = programElement.offsetLeft;
        const containerWidth = container.clientWidth;
        const programWidth = programElement.offsetWidth;

        const scrollLeft = programLeft - (containerWidth / 2) + (programWidth / 2);

        container.scrollTo({
          left: Math.max(0, scrollLeft),
          behavior: 'smooth'
        });
      }
    }
    // 竖向时间�?    else if (timelineVerticalRef.current) {
      const programElement = timelineVerticalRef.current.children[currentProgramIndex] as HTMLElement;
      if (programElement) {
        // 找到包含滚动的父容器
        const scrollContainer = timelineVerticalRef.current.parentElement;
        if (scrollContainer) {
          const programTop = programElement.offsetTop;
          const containerHeight = scrollContainer.clientHeight;
          const programHeight = programElement.offsetHeight;

          const scrollTop = programTop - (containerHeight / 2) + (programHeight / 2);

          scrollContainer.scrollTo({
            top: Math.max(0, scrollTop),
            behavior: 'smooth'
          });
        }
      }
    }
  };

  useEffect(() => {
    if (isHovered) {
      // 鼠标悬停时阻止页面滚�?      document.addEventListener('wheel', preventPageScroll, { passive: false });
      document.addEventListener('wheel', handleWheel, { passive: false });
    } else {
      // 鼠标离开时恢复页面滚�?      document.removeEventListener('wheel', preventPageScroll);
      document.removeEventListener('wheel', handleWheel);
    }

    return () => {
      document.removeEventListener('wheel', preventPageScroll);
      document.removeEventListener('wheel', handleWheel);
    };
  }, [isHovered]);

  // 组件加载后自动滚动到正在播放的节�?  useEffect(() => {
    // 延迟执行，确保DOM完全渲染
    const timer = setTimeout(() => {
      // 初始化当前正在播放的节目索引
      const initialPlayingIndex = programs.findIndex(program => isCurrentlyPlaying(program));
      setCurrentPlayingIndex(initialPlayingIndex);
      scrollToCurrentProgram();
    }, 100);

    return () => clearTimeout(timer);
  }, [programs, currentTime]);

  // 定时刷新正在播放状�?  useEffect(() => {
    // 每分钟刷新一次正在播放状�?    const interval = setInterval(() => {
      // 更新当前正在播放的节目索�?      const newPlayingIndex = programs.findIndex(program => {
        try {
          const start = parseCustomTimeFormat(program.start);
          const end = parseCustomTimeFormat(program.end);
          return currentTime >= start && currentTime < end;
        } catch {
          return false;
        }
      });

      if (newPlayingIndex !== currentPlayingIndex) {
        setCurrentPlayingIndex(newPlayingIndex);
        // 如果正在播放的节目发生变化，自动滚动到新位置
        scrollToCurrentProgram();
      }
    }, 60000); // 60�?= 1分钟

    return () => clearInterval(interval);
  }, [programs, currentTime, currentPlayingIndex]);

  // 切换视图时自动跳转到当前播放位置
  useEffect(() => {
    // 延迟执行，确保DOM完全渲染
    const timer = setTimeout(() => {
      if (viewMode === 'list') {
        scrollToCurrentProgram();
      } else if (viewMode === 'timeline') {
        scrollToCurrentProgramTimeline();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [viewMode]);

  // 格式化时间显�?  const formatTime = (timeString: string) => {
    return formatTimeToHHMM(timeString);
  };

  // 判断节目是否正在播放
  const isCurrentlyPlaying = (program: EpgProgram) => {
    try {
      const start = parseCustomTimeFormat(program.start);
      const end = parseCustomTimeFormat(program.end);
      return currentTime >= start && currentTime < end;
    } catch {
      return false;
    }
  };

  // 计算节目时长（分钟）
  const getProgramDuration = (program: EpgProgram) => {
    try {
      const start = parseCustomTimeFormat(program.start);
      const end = parseCustomTimeFormat(program.end);
      return (end.getTime() - start.getTime()) / (1000 * 60); // 转换为分�?    } catch {
      return 30; // 默认30分钟
    }
  };

  // 计算当前时间在时间线上的位置百分�?  const getCurrentTimePosition = () => {
    if (programs.length === 0) return 0;

    try {
      const firstProgram = programs[0];
      const lastProgram = programs[programs.length - 1];
      const startTime = parseCustomTimeFormat(firstProgram.start).getTime();
      const endTime = parseCustomTimeFormat(lastProgram.end).getTime();
      const currentTimeMs = currentTime.getTime();

      if (currentTimeMs < startTime) return 0;
      if (currentTimeMs > endTime) return 100;

      return ((currentTimeMs - startTime) / (endTime - startTime)) * 100;
    } catch {
      return 0;
    }
  };

  // 加载中状�?  if (isLoading) {
    return (
      <div className="pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
            今日节目�?          </h4>
          <div className="w-16 sm:w-20"></div>
        </div>
        <div className="min-h-[100px] sm:min-h-[120px] flex items-center justify-center">
          <div className="flex items-center gap-3 sm:gap-4 text-gray-500 dark:text-gray-400">
            <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
            <span className="text-sm sm:text-base">加载节目�?..</span>
          </div>
        </div>
      </div>
    );
  }

  // 无节目单状�?  if (!programs || programs.length === 0) {
    return (
      <div className="pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
            今日节目�?          </h4>
          <div className="w-16 sm:w-20"></div>
        </div>
        <div className="min-h-[100px] sm:min-h-[120px] flex items-center justify-center">
          <div className="flex items-center gap-2 sm:gap-3 text-gray-400 dark:text-gray-500">
            <Tv className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-sm sm:text-base">暂无节目单数�?/span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 mt-2">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
          今日节目�?        </h4>
        <div className="flex items-center gap-2">
          {/* 视图切换按钮 */}
          <div className="flex items-center gap-1 bg-gray-200 dark:bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-all duration-200 ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
              title="列表视图"
            >
              <List className="w-3 h-3" />
              <span className="hidden sm:inline">列表</span>
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-all duration-200 ${
                viewMode === 'timeline'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
              title="时间线视�?
            >
              <BarChart3 className="w-3 h-3" />
              <span className="hidden sm:inline">时间�?/span>
            </button>
          </div>

          {/* 当前播放按钮 */}
          {currentPlayingIndex !== -1 && (
            <button
              onClick={viewMode === 'list' ? scrollToCurrentProgram : scrollToCurrentProgramTimeline}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 sm:py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 bg-gray-300/50 dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700 transition-all duration-200"
              title="滚动到当前播放位�?
            >
              <Target className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span className="hidden sm:inline">当前播放</span>
              <span className="sm:hidden">当前</span>
            </button>
          )}
        </div>
      </div>

      {/* 列表视图 */}
      {viewMode === 'list' && (
        <div
          className='relative'
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div
            ref={containerRef}
            className='flex overflow-x-auto scrollbar-hide py-2 pb-4 px-2 sm:px-4 min-h-[100px] sm:min-h-[120px]'
          >
            {programs.map((program, index) => {
            // 使用 currentPlayingIndex 来判断播放状态，确保样式能正确更�?            const isPlaying = index === currentPlayingIndex;
            const isFinishedProgram = index < currentPlayingIndex;
            const isUpcomingProgram = index > currentPlayingIndex;

            return (
              <div
                key={index}
                className={`flex-shrink-0 w-36 sm:w-48 p-2 sm:p-3 rounded-lg border transition-all duration-200 flex flex-col min-h-[100px] sm:min-h-[120px] ${isPlaying
                  ? 'bg-green-500/10 dark:bg-green-500/20 border-green-500/30'
                  : isFinishedProgram
                    ? 'bg-gray-300/50 dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                    : isUpcomingProgram
                      ? 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/30'
                      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
              >
                {/* 时间显示在顶�?*/}
                <div className="flex items-center justify-between mb-2 sm:mb-3 flex-shrink-0">
                  <span className={`text-xs font-medium ${isPlaying
                    ? 'text-green-600 dark:text-green-400'
                    : isFinishedProgram
                      ? 'text-gray-500 dark:text-gray-400'
                      : isUpcomingProgram
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}>
                    {formatTime(program.start)}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatTime(program.end)}
                  </span>
                </div>

                {/* 标题在中间，占据剩余空间 */}
                <div
                  className={`text-xs sm:text-sm font-medium flex-1 ${isPlaying
                    ? 'text-green-900 dark:text-green-100'
                    : isFinishedProgram
                      ? 'text-gray-600 dark:text-gray-400'
                      : isUpcomingProgram
                        ? 'text-blue-900 dark:text-blue-100'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: '1.4',
                    maxHeight: '2.8em'
                  }}
                  title={program.title}
                >
                  {program.title}
                </div>

                {/* 正在播放状态在底部 */}
                {isPlaying && (
                  <div className="mt-auto pt-1 sm:pt-2 flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      正在播放
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* 时间线视�?*/}
      {viewMode === 'timeline' && (
        <div className='relative'>
          {/* 电脑端：横向时间�?*/}
          <div className='hidden md:block'>
            <div className='bg-gray-100 dark:bg-gray-800 rounded-lg p-4'>
              {/* 时间线容�?- 可横向滚�?*/}
              <div
                className='relative'
                onMouseEnter={(e) => {
                  const container = timelineHorizontalRef.current;
                  if (container) {
                    const handleWheel = (e: WheelEvent) => {
                      if (container.scrollWidth > container.clientWidth) {
                        e.preventDefault();
                        container.scrollLeft += e.deltaY * 4;
                      }
                    };
                    container.addEventListener('wheel', handleWheel, { passive: false });
                    (container as any)._wheelHandler = handleWheel;
                  }
                }}
                onMouseLeave={(e) => {
                  const container = timelineHorizontalRef.current;
                  if (container && (container as any)._wheelHandler) {
                    container.removeEventListener('wheel', (container as any)._wheelHandler);
                    delete (container as any)._wheelHandler;
                  }
                }}
              >
                <div
                  ref={timelineHorizontalRef}
                  className='flex overflow-x-auto scrollbar-hide pb-2 px-2 sm:px-4 max-h-[400px]'
                >
                {programs.map((program, index) => {
                  const isPlaying = index === currentPlayingIndex;
                  const isFinished = index < currentPlayingIndex;
                  const duration = getProgramDuration(program);

                  return (
                    <div key={index} className='flex flex-col items-center flex-shrink-0'>
                      {/* 节目信息卡片 */}
                      <div className={`w-48 p-3 rounded-lg border transition-all duration-200 mb-3 h-[110px] flex flex-col ${
                        isPlaying
                          ? 'bg-green-500/10 dark:bg-green-500/20 border-green-500/30'
                          : isFinished
                          ? 'bg-gray-300/50 dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                          : 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/30'
                      }`}>
                        <div className='flex items-start justify-between mb-2 flex-shrink-0'>
                          <span className={`text-xs font-medium ${
                            isPlaying
                              ? 'text-green-600 dark:text-green-400'
                              : isFinished
                              ? 'text-gray-500 dark:text-gray-400'
                              : 'text-blue-600 dark:text-blue-400'
                          }`}>
                            {formatTime(program.start)}
                          </span>
                          <span className='text-xs text-gray-400 dark:text-gray-500'>
                            {Math.round(duration)}分钟
                          </span>
                        </div>
                        <div
                          className={`text-sm font-medium flex-1 ${
                            isPlaying
                              ? 'text-green-900 dark:text-green-100'
                              : isFinished
                              ? 'text-gray-600 dark:text-gray-400'
                              : 'text-blue-900 dark:text-blue-100'
                          }`}
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: '1.4'
                          }}
                        >
                          {program.title}
                        </div>
                        {isPlaying && (
                          <div className='mt-auto pt-2 flex items-center gap-1.5 flex-shrink-0'>
                            <div className='w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse'></div>
                            <span className='text-xs text-green-600 dark:text-green-400 font-medium'>
                              正在播放
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 时间线轴 */}
                      <div className='flex items-center flex-shrink-0'>
                        {/* 时间�?*/}
                        <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                          isPlaying
                            ? 'bg-green-500 border-green-500 animate-pulse'
                            : isFinished
                            ? 'bg-gray-400 border-gray-400'
                            : 'bg-blue-500 border-blue-500'
                        }`}></div>

                        {/* 右侧连接�?*/}
                        {index < programs.length - 1 && (
                          <div className={`h-0.5 w-48 ${
                            isFinished
                              ? 'bg-gray-300 dark:bg-gray-600'
                              : isPlaying
                              ? 'bg-green-300 dark:bg-green-700'
                              : 'bg-blue-300 dark:bg-blue-700'
                          }`}></div>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          </div>

          {/* 手机端：竖向时间�?*/}
          <div className='md:hidden'>
            <div className='relative bg-gray-100 dark:bg-gray-800 rounded-lg p-4 max-h-[500px] overflow-y-auto'>
              {/* 时间线容�?*/}
              <div ref={timelineVerticalRef} className='relative'>
                {programs.map((program, index) => {
                  const isPlaying = index === currentPlayingIndex;
                  const isFinished = index < currentPlayingIndex;
                  const duration = getProgramDuration(program);

                  return (
                    <div key={index} className='relative flex gap-3 mb-3 last:mb-0'>
                      {/* 时间线轴 */}
                      <div className='relative flex flex-col items-center flex-shrink-0' style={{ paddingTop: '0.375rem' }}>
                        {/* 时间�?*/}
                        <div className={`w-3 h-3 rounded-full border-2 z-10 ${
                          isPlaying
                            ? 'bg-green-500 border-green-500 animate-pulse'
                            : isFinished
                            ? 'bg-gray-400 border-gray-400'
                            : 'bg-blue-500 border-blue-500'
                        }`}></div>

                        {/* 连接�?- 根据状态显示不同颜�?*/}
                        {index < programs.length - 1 && (
                          <div
                            className={`absolute w-0.5 ${
                              isFinished
                                ? 'bg-gray-300 dark:bg-gray-600'
                                : isPlaying
                                ? 'bg-green-300 dark:bg-green-700'
                                : 'bg-blue-300 dark:bg-blue-700'
                            }`}
                            style={{
                              top: '0.375rem',
                              bottom: 'calc(-0.75rem - 100%)',
                              left: '50%',
                              transform: 'translateX(-50%)'
                            }}
                          ></div>
                        )}
                      </div>

                      {/* 节目信息 */}
                      <div className={`flex-1 p-3 rounded-lg border transition-all duration-200 ${
                        isPlaying
                          ? 'bg-green-500/10 dark:bg-green-500/20 border-green-500/30'
                          : isFinished
                          ? 'bg-gray-300/50 dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                          : 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/30'
                      }`}>
                        <div className='flex items-start justify-between mb-2'>
                          <span className={`text-xs font-medium ${
                            isPlaying
                              ? 'text-green-600 dark:text-green-400'
                              : isFinished
                              ? 'text-gray-500 dark:text-gray-400'
                              : 'text-blue-600 dark:text-blue-400'
                          }`}>
                            {formatTime(program.start)}
                          </span>
                          <span className='text-xs text-gray-400 dark:text-gray-500'>
                            {Math.round(duration)}分钟
                          </span>
                        </div>
                        <div className={`text-sm font-medium ${
                          isPlaying
                            ? 'text-green-900 dark:text-green-100'
                            : isFinished
                            ? 'text-gray-600 dark:text-gray-400'
                            : 'text-blue-900 dark:text-blue-100'
                        }`}>
                          {program.title}
                        </div>
                        {isPlaying && (
                          <div className='mt-2 flex items-center gap-1.5'>
                            <div className='w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse'></div>
                            <span className='text-xs text-green-600 dark:text-green-400 font-medium'>
                              正在播放
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
