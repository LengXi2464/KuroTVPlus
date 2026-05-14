'use client';

import React, { useCallback,useEffect, useRef, useState } from 'react';

interface DanmakuData {
  time: number;
  text: string;
  [key: string]: any;
}

interface CustomHeatmapProps {
  danmakuList: DanmakuData[];
  duration: number;
  currentTime: number;
  enabled: boolean;
  onSeek?: (time: number) => void;
  className?: string;
}

const CustomHeatmap: React.FC<CustomHeatmapProps> = ({
  danmakuList,
  duration,
  currentTime,
  enabled,
  onSeek,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [heatmapData, setHeatmapData] = useState<number[]>([]);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverTime, setHoverTime] = useState(0);

  // 计算热力图数�?  const calculateHeatmapData = useCallback(() => {
    if (!duration || duration <= 0 || danmakuList.length === 0) {
      return [];
    }

    // 将视频时长分成若干个时间段（每秒一个）
    const segments = Math.ceil(duration);
    const heatData = new Array(segments).fill(0);

    // 统计每个时间段的弹幕数量
    danmakuList.forEach((danmaku) => {
      const segmentIndex = Math.floor(danmaku.time);
      if (segmentIndex >= 0 && segmentIndex < segments) {
        heatData[segmentIndex]++;
      }
    });

    // 归一化数据到 0-1 范围
    const maxCount = Math.max(...heatData, 1);
    return heatData.map((count) => count / maxCount);
  }, [danmakuList, duration]);

  // 当弹幕列表或时长变化时重新计算热力图数据
  useEffect(() => {
    const data = calculateHeatmapData();
    setHeatmapData(data);
  }, [calculateHeatmapData]);

  // 绘制热力�?  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || heatmapData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    // 计算每个柱子的宽�?    const barWidth = width / heatmapData.length;
    const progressRatio = duration > 0 ? currentTime / duration : 0;

    // 绘制热力图柱状图
    heatmapData.forEach((value, index) => {
      const x = index * barWidth;
      const barHeight = value * height;
      const y = height - barHeight;

      // 判断是否已播�?      const isPlayed = (index / heatmapData.length) <= progressRatio;

      // 使用灰色透明，已播放的部分深色一�?      const opacity = isPlayed ? 0.5 + value * 0.3 : 0.2 + value * 0.3;
      const color = `rgba(128, 128, 128, ${opacity})`;

      ctx.fillStyle = color;
      ctx.fillRect(x, y, Math.ceil(barWidth) + 1, barHeight);
    });

    // 绘制当前播放位置指示�?    if (duration > 0) {
      const progressX = (currentTime / duration) * width;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(progressX - 1, 0, 2, height);
    }
  }, [heatmapData, currentTime, duration]);

  // 处理鼠标移动
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || !duration) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const time = percentage * duration;

    setHoverTime(time);
    setIsHovering(true);
  };

  // 处理鼠标离开
  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  // 处理点击跳转
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || !duration || !onSeek) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const time = percentage * duration;

    onSeek(time);
  };

  // 格式化时间显�?  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // 获取悬停位置的弹幕密�?  const getHoverDensity = (): string => {
    if (!isHovering || heatmapData.length === 0) return '';

    const segmentIndex = Math.floor(hoverTime);
    if (segmentIndex >= 0 && segmentIndex < heatmapData.length) {
      const density = heatmapData[segmentIndex];
      if (density < 0.2) return '�?;
      if (density < 0.5) return '�?;
      if (density < 0.8) return '�?;
      return '极高';
    }
    return '';
  };

  if (!enabled) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`custom-heatmap ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        cursor: 'pointer',
      }}
    >
      <canvas
        ref={canvasRef}
        width={1000}
        height={30}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />

      {/* 悬停提示 */}
      {isHovering && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: `${(hoverTime / duration) * 100}%`,
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            padding: '4px 8px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            fontSize: '12px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {formatTime(hoverTime)} - 弹幕密度: {getHoverDensity()}
        </div>
      )}
    </div>
  );
};

export default CustomHeatmap;
