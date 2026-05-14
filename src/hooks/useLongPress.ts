import { useCallback, useRef } from 'react';

interface UseLongPressOptions {
  onLongPress: () => void;
  onClick?: () => void;
  longPressDelay?: number;
  moveThreshold?: number;
}

interface TouchPosition {
  x: number;
  y: number;
}

export const useLongPress = ({
  onLongPress,
  onClick,
  longPressDelay = 500,
  moveThreshold = 10,
}: UseLongPressOptions) => {
  const isLongPress = useRef(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const startPosition = useRef<TouchPosition | null>(null);
  const isActive = useRef(false); // 防止重复触发
  const wasButton = useRef(false); // 记录触摸开始时是否是按�?
  const clearTimer = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const handleStart = useCallback(
    (clientX: number, clientY: number, isButton = false) => {
      // 如果已经有活跃的手势，忽略新的开�?      if (isActive.current) {
        return;
      }

      isActive.current = true;
      isLongPress.current = false;
      startPosition.current = { x: clientX, y: clientY };

      // 记录触摸开始时是否是按�?      wasButton.current = isButton;

      pressTimer.current = setTimeout(() => {
        // 再次检查是否仍然活�?        if (!isActive.current) return;

        isLongPress.current = true;

        if (navigator.vibrate) {
          navigator.vibrate(50);
        }

        // 触发长按事件
        onLongPress();
      }, longPressDelay);
    },
    [onLongPress, longPressDelay]
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!startPosition.current || !isActive.current) return;

      const distance = Math.sqrt(
        Math.pow(clientX - startPosition.current.x, 2) +
        Math.pow(clientY - startPosition.current.y, 2)
      );

      // 如果移动距离超过阈值，取消长按
      if (distance > moveThreshold) {
        clearTimer();
        isActive.current = false;
      }
    },
    [clearTimer, moveThreshold]
  );

  const handleEnd = useCallback(() => {
    clearTimer();

    // 根据情况决定是否触发点击事件�?    // 1. 如果是长按，不触发点�?    // 2. 如果不是长按且触摸开始时是按钮，不触发点�?    // 3. 否则触发点击
    const shouldClick = !isLongPress.current && !wasButton.current && onClick && isActive.current;

    if (shouldClick) {
      onClick();
    }

    // 重置所有状�?    isLongPress.current = false;
    startPosition.current = null;
    isActive.current = false;
    wasButton.current = false;
  }, [clearTimer, onClick]);

  // 触摸事件处理�?  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // 检查是否触摸的是按钮或其他交互元素
      const target = e.target as HTMLElement;
      const buttonElement = target.closest('[data-button]');

      // 更精确的按钮检测：只有当触摸目标直接是按钮元素或其直接子元素时才认为是按钮
      const isDirectButton = target.hasAttribute('data-button');
      const isButton = !!buttonElement && isDirectButton;

      // 阻止默认的长按行为，但不阻止触摸开始事�?      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY, !!isButton);
    },
    [handleStart]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    },
    [handleMove]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      // 始终阻止默认行为，避免任何系统长按菜�?      e.preventDefault();
      e.stopPropagation();
      handleEnd();
    },
    [handleEnd]
  );



  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
};
