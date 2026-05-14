/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

interface Song {
  id: string;
  name: string;
  artist: string;
  album?: string;
  pic?: string;
  platform: 'wy' | 'tx' | 'kw' | 'kg' | 'mg';
}

interface LyricLine {
  time: number;
  text: string;
  translation?: string;
}

interface LyricsPiPWindowProps {
  currentSong: Song | null;
  lyrics: LyricLine[];
  currentLyricIndex: number;
  isPlaying: boolean;
  currentTime: number;
  opacity: number;
  minimized: boolean;
  onOpacityChange: (opacity: number) => void;
  onMinimizedChange: (minimized: boolean) => void;
  onClose: () => void;
}

interface PiPLyricsContentProps {
  currentSong: Song | null;
  lyrics: LyricLine[];
  currentLyricIndex: number;
  opacity: number;
  minimized: boolean;
  onOpacityChange: (opacity: number) => void;
  onMinimizedChange: (minimized: boolean) => void;
  onClose: () => void;
}

// PiP 窗口内容组件
const PiPLyricsContent = ({
  currentSong,
  lyrics,
  currentLyricIndex,
  opacity,
  minimized,
  onOpacityChange,
  onMinimizedChange,
  onClose,
}: PiPLyricsContentProps) => {
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  // 自动滚动到当前歌�?  useEffect(() => {
    if (lyricsContainerRef.current && currentLyricIndex >= 0 && !minimized) {
      const container = lyricsContainerRef.current;
      const currentLine = container.children[currentLyricIndex] as HTMLElement;
      if (currentLine) {
        const containerHeight = container.clientHeight;
        const lineTop = currentLine.offsetTop;
        const lineHeight = currentLine.clientHeight;
        const scrollTop = lineTop - containerHeight / 2 + lineHeight / 2;
        container.scrollTo({ top: scrollTop, behavior: 'smooth' });
      }
    }
  }, [currentLyricIndex, minimized]);

  return (
    <div
      className="pip-container"
      style={{
        backgroundColor: `rgba(0, 0, 0, ${opacity})`,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* 头部：歌曲信�?+ 控制按钮 */}
      <div
        className="pip-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          gap: '8px',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            opacity: 0.7,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {currentSong ? `${currentSong.name} - ${currentSong.artist}` : '暂无播放'}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          {/* 透明度滑�?*/}
          <input
            type="range"
            min="0.3"
            max="1"
            step="0.1"
            value={opacity}
            onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
            style={{ width: '60px', cursor: 'pointer' }}
            title={`透明�? ${Math.round(opacity * 100)}%`}
          />
          {/* 最小化按钮 */}
          <button
            onClick={() => onMinimizedChange(!minimized)}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '11px',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            title={minimized ? '展开' : '最小化'}
          >
            {minimized ? '展开' : '最小化'}
          </button>
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            style={{
              background: 'rgba(239, 68, 68, 0.8)',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'background 0.2s',
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.8)';
            }}
            title="关闭"
          >
            ×
          </button>
        </div>
      </div>

      {/* 歌词内容 */}
      {minimized ? (
        // 最小化模式：仅显示当前歌词
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            textAlign: 'center',
            padding: '0 16px',
            lineHeight: 1.5,
          }}
        >
          {lyrics.length > 0 && currentLyricIndex >= 0
            ? (
              lyrics[currentLyricIndex]?.translation
                ? `${lyrics[currentLyricIndex]?.text || '�?}\n${lyrics[currentLyricIndex]?.translation}`
                : lyrics[currentLyricIndex]?.text || '�?
            )
            : currentSong
            ? '暂无歌词'
            : '请播放歌�?}
        </div>
      ) : (
        // 完整模式：显示所有歌�?        <div
          ref={lyricsContainerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            paddingTop: '20px',
            paddingBottom: '20px',
          }}
        >
          {lyrics.length > 0 ? (
            lyrics.map((line, index) => (
              <div
                key={index}
                style={{
                  padding: '8px 0',
                  textAlign: 'center',
                  fontSize: index === currentLyricIndex ? '16px' : '14px',
                  opacity: index === currentLyricIndex ? 1 : 0.5,
                  color: index === currentLyricIndex ? '#22c55e' : 'white',
                  transition: 'all 0.3s ease',
                  fontWeight: index === currentLyricIndex ? 'bold' : 'normal',
                }}
              >
                <div>{line.text}</div>
                {line.translation && (
                  <div
                    style={{
                      marginTop: '4px',
                      fontSize: index === currentLyricIndex ? '13px' : '12px',
                      opacity: index === currentLyricIndex ? 0.85 : 0.55,
                      fontWeight: 'normal',
                    }}
                  >
                    {line.translation}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                opacity: 0.5,
              }}
            >
              {currentSong ? '暂无歌词' : '请播放歌�?}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 复制样式表到 PiP 窗口
const copyStylesToPiPWindow = (pipWin: Window) => {
  const styleSheets = Array.from(document.styleSheets);
  styleSheets.forEach((styleSheet) => {
    try {
      const cssRules = Array.from(styleSheet.cssRules)
        .map((rule) => rule.cssText)
        .join('');
      const style = pipWin.document.createElement('style');
      style.textContent = cssRules;
      pipWin.document.head.appendChild(style);
    } catch (e) {
      // 跨域样式表使�?link 标签
      if ((styleSheet as any).href) {
        const link = pipWin.document.createElement('link');
        link.rel = 'stylesheet';
        link.href = (styleSheet as any).href;
        pipWin.document.head.appendChild(link);
      }
    }
  });
};

// 主组件：管理 PiP 窗口
export default function LyricsPiPWindow({
  currentSong,
  lyrics,
  currentLyricIndex,
  isPlaying,
  currentTime,
  opacity,
  minimized,
  onOpacityChange,
  onMinimizedChange,
  onClose,
}: LyricsPiPWindowProps) {
  const pipWindowRef = useRef<Window | null>(null);
  const rootRef = useRef<ReactDOM.Root | null>(null);

  // 渲染 PiP 内容
  const renderPiPContent = (pipWin: Window) => {
    const container = pipWin.document.createElement('div');
    container.id = 'pip-lyrics-root';
    pipWin.document.body.appendChild(container);

    // 设置 body 样式
    pipWin.document.body.style.margin = '0';
    pipWin.document.body.style.padding = '0';
    pipWin.document.body.style.overflow = 'hidden';

    // 使用 ReactDOM 渲染组件�?PiP 窗口
    const root = ReactDOM.createRoot(container);
    rootRef.current = root;

    root.render(
      <PiPLyricsContent
        currentSong={currentSong}
        lyrics={lyrics}
        currentLyricIndex={currentLyricIndex}
        opacity={opacity}
        minimized={minimized}
        onOpacityChange={(newOpacity) => {
          window.postMessage({ type: 'PIP_OPACITY_CHANGE', opacity: newOpacity }, '*');
        }}
        onMinimizedChange={(newMinimized) => {
          window.postMessage({ type: 'PIP_MINIMIZED_CHANGE', minimized: newMinimized }, '*');
        }}
        onClose={() => {
          window.postMessage({ type: 'PIP_CLOSE' }, '*');
        }}
      />
    );
  };

  // 更新 PiP 内容
  useEffect(() => {
    if (pipWindowRef.current && !pipWindowRef.current.closed && rootRef.current) {
      rootRef.current.render(
        <PiPLyricsContent
          currentSong={currentSong}
          lyrics={lyrics}
          currentLyricIndex={currentLyricIndex}
          opacity={opacity}
          minimized={minimized}
          onOpacityChange={(newOpacity) => {
            window.postMessage({ type: 'PIP_OPACITY_CHANGE', opacity: newOpacity }, '*');
          }}
          onMinimizedChange={(newMinimized) => {
            window.postMessage({ type: 'PIP_MINIMIZED_CHANGE', minimized: newMinimized }, '*');
          }}
          onClose={() => {
            window.postMessage({ type: 'PIP_CLOSE' }, '*');
          }}
        />
      );
    }
  }, [currentSong, lyrics, currentLyricIndex, opacity, minimized]);

  // 打开 PiP 窗口
  useEffect(() => {
    const openPiPWindow = async () => {
      if (!('documentPictureInPicture' in window)) {
        console.error('浏览器不支持 Document Picture-in-Picture API');
        return;
      }

      try {
        const pipWin = await (window as any).documentPictureInPicture.requestWindow({
          width: 400,
          height: 300,
        });

        pipWindowRef.current = pipWin;

        // 复制样式表到 PiP 窗口
        copyStylesToPiPWindow(pipWin);

        // 监听窗口关闭
        pipWin.addEventListener('pagehide', () => {
          if (rootRef.current) {
            rootRef.current.unmount();
            rootRef.current = null;
          }
          pipWindowRef.current = null;
          onClose();
        });

        // 渲染内容
        renderPiPContent(pipWin);
      } catch (error) {
        console.error('打开画中画窗口失�?', error);
        onClose();
      }
    };

    openPiPWindow();

    // 清理函数
    return () => {
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.close();
      }
      if (rootRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
      }
    };
  }, []); // 只在组件挂载时执行一�?
  return null; // 此组件不渲染任何内容到主窗口
}
