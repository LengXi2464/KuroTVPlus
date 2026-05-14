/* eslint-disable react-hooks/exhaustive-deps */

import React, { useEffect, useRef, useState } from 'react';

interface CapsuleSwitchProps {
  options: { label: string; value: string; icon?: React.ReactNode }[];
  active: string;
  onChange: (value: string) => void;
  className?: string;
}

const CapsuleSwitch: React.FC<CapsuleSwitchProps> = ({
  options,
  active,
  onChange,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
  }>({ left: 0, width: 0 });

  const activeIndex = options.findIndex((opt) => opt.value === active);

  // 更新指示器位置（仅更新位置，不触发滚动）
  const updateIndicatorPosition = (autoScroll = false) => {
    if (
      activeIndex >= 0 &&
      buttonRefs.current[activeIndex] &&
      containerRef.current &&
      scrollContainerRef.current
    ) {
      const button = buttonRefs.current[activeIndex];
      const scrollContainer = scrollContainerRef.current;

      if (button) {
        const buttonOffsetLeft = button.offsetLeft;
        const buttonWidth = button.offsetWidth;

        setIndicatorStyle({
          left: buttonOffsetLeft,
          width: buttonWidth,
        });

        // 只在需要自动滚动时才执�?        if (autoScroll && !isScrollingRef.current) {
          const buttonRect = button.getBoundingClientRect();
          const scrollContainerRect = scrollContainer.getBoundingClientRect();
          const isVisible =
            buttonRect.left >= scrollContainerRect.left &&
            buttonRect.right <= scrollContainerRect.right;

          if (!isVisible) {
            // 将选中项滚动到视图中心
            const scrollToPosition =
              buttonOffsetLeft -
              scrollContainer.offsetWidth / 2 +
              buttonWidth / 2;
            scrollContainer.scrollTo({
              left: scrollToPosition,
              behavior: 'smooth',
            });
          }
        }
      }
    }
  };

  // 组件挂载时立即计算初始位置并滚动到选中�?  useEffect(() => {
    const timeoutId = setTimeout(() => updateIndicatorPosition(true), 0);
    return () => clearTimeout(timeoutId);
  }, []);

  // 监听选中项变化，自动滚动到新选中�?  useEffect(() => {
    const timeoutId = setTimeout(() => updateIndicatorPosition(true), 0);
    return () => clearTimeout(timeoutId);
  }, [activeIndex]);

  // 监听滚动事件，仅更新指示器位�?  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      // 标记正在滚动
      isScrollingRef.current = true;

      // 清除之前的超�?      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // 仅更新指示器位置，不触发自动滚动
      updateIndicatorPosition(false);

      // 滚动结束后重置标�?      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false;
      }, 150);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [activeIndex]);

  // 鼠标拖动功能
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      hasDraggedRef.current = false;
      startXRef.current = e.pageX - scrollContainer.offsetLeft;
      scrollLeftRef.current = scrollContainer.scrollLeft;
      scrollContainer.style.cursor = 'grabbing';
      scrollContainer.style.userSelect = 'none';
    };

    const handleMouseLeave = () => {
      isDraggingRef.current = false;
      scrollContainer.style.cursor = 'grab';
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      scrollContainer.style.cursor = 'grab';
      // 短暂延迟后重置拖动标记，防止点击事件被触�?      setTimeout(() => {
        hasDraggedRef.current = false;
      }, 50);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      const x = e.pageX - scrollContainer.offsetLeft;
      const walk = (x - startXRef.current) * 1.5; // 调整拖动速度

      // 如果移动距离超过5px，标记为已拖�?      if (Math.abs(walk) > 5) {
        hasDraggedRef.current = true;
      }

      scrollContainer.scrollLeft = scrollLeftRef.current - walk;
    };

    scrollContainer.style.cursor = 'grab';
    scrollContainer.addEventListener('mousedown', handleMouseDown);
    scrollContainer.addEventListener('mouseleave', handleMouseLeave);
    scrollContainer.addEventListener('mouseup', handleMouseUp);
    scrollContainer.addEventListener('mousemove', handleMouseMove);

    return () => {
      scrollContainer.removeEventListener('mousedown', handleMouseDown);
      scrollContainer.removeEventListener('mouseleave', handleMouseLeave);
      scrollContainer.removeEventListener('mouseup', handleMouseUp);
      scrollContainer.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex bg-gray-300/80 rounded-full p-1 dark:bg-gray-700 max-w-full ${
        className || ''
      }`}
    >
      {/* 可滚动容�?*/}
      <div
        ref={scrollContainerRef}
        className='relative flex overflow-x-auto scrollbar-hide'
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* 滑动的白色背景指示器 */}
        {indicatorStyle.width > 0 && (
          <div
            className='absolute top-0 bottom-0 bg-white dark:bg-gray-500 rounded-full shadow-sm transition-all duration-300 ease-out pointer-events-none'
            style={{
              left: `${indicatorStyle.left}px`,
              width: `${indicatorStyle.width}px`,
            }}
          />
        )}

        {options.map((opt, index) => {
          const isActive = active === opt.value;
          return (
            <button
              key={opt.value}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              onClick={(e) => {
                // 如果正在拖动，阻止点�?                if (hasDraggedRef.current) {
                  e.preventDefault();
                  return;
                }
                onChange(opt.value);
              }}
              className={`relative z-10 flex items-center justify-center gap-1.5 px-3 py-1 text-xs sm:px-4 sm:py-2 sm:text-sm rounded-full font-medium transition-all duration-200 cursor-pointer whitespace-nowrap flex-shrink-0 ${
                isActive
                  ? 'text-gray-900 dark:text-gray-100'
                  : 'text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
              }`}
            >
              {opt.icon && <span className='inline-flex items-center'>{opt.icon}</span>}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CapsuleSwitch;
