'use client';

import { useEffect, useState } from 'react';

import { BackButton } from './BackButton';
import MobileBottomNav from './MobileBottomNav';
import MobileHeader from './MobileHeader';
import Sidebar from './Sidebar';
import { ThemeToggle } from './ThemeToggle';
import { UpdateNotification } from './UpdateNotification';
import { UserMenu } from './UserMenu';
import { VersionCheckProvider } from './VersionCheckProvider';

interface PageLayoutProps {
  children: React.ReactNode;
  activePath?: string;
  hideNavigation?: boolean; // 控制是否隐藏顶部和底部导航栏
}

const PageLayout = ({ children, activePath = '/', hideNavigation = false }: PageLayoutProps) => {
  const [backgroundImage, setBackgroundImage] = useState('');
  const shouldShowSharedBackground = !hideNavigation && activePath !== '/play';

  useEffect(() => {
    if (typeof window === 'undefined' || !shouldShowSharedBackground) {
      setBackgroundImage('');
      return;
    }

    const homeBg = (
      window as Window & {
        RUNTIME_CONFIG?: {
          HOME_BACKGROUND_IMAGE?: string;
        };
      }
    ).RUNTIME_CONFIG?.HOME_BACKGROUND_IMAGE;
    if (!homeBg) {
      setBackgroundImage('');
      return;
    }

    const urls = homeBg
      .split('\n')
      .map((url: string) => url.trim())
      .filter((url: string) => url !== '');

    if (urls.length === 0) {
      setBackgroundImage('');
      return;
    }

    const randomIndex = Math.floor(Math.random() * urls.length);
    setBackgroundImage(urls[randomIndex]);
  }, [shouldShowSharedBackground]);

  return (
    <VersionCheckProvider>
      <div className='relative w-full min-h-screen overflow-hidden'>
        {shouldShowSharedBackground && backgroundImage && (
          <>
            <div
              className='absolute inset-0 pointer-events-none bg-cover bg-center bg-no-repeat opacity-45'
              style={{ backgroundImage: `url(${backgroundImage})` }}
            />
            <div className='absolute inset-0 pointer-events-none bg-white/50 dark:bg-gray-950/50' />
          </>
        )}

        {/* 移动端头�?*/}
        {!hideNavigation && (
          <MobileHeader showBackButton={['/play', '/live'].includes(activePath)} />
        )}

        {/* 主要布局容器 */}
        <div className='relative z-10 flex md:grid md:grid-cols-[auto_1fr] w-full min-h-screen md:min-h-auto'>
          {/* 侧边�?- 桌面端显示，移动端隐�?*/}
          {!hideNavigation && (
            <div className='hidden md:block'>
              <Sidebar activePath={activePath} />
            </div>
          )}

          {/* 主内容区�?*/}
          <div className='relative min-w-0 flex-1 transition-all duration-300'>
            {/* 桌面端左上角返回按钮 */}
            {!hideNavigation && ['/play', '/live'].includes(activePath) && (
              <div className='absolute top-3 left-1 z-20 hidden md:flex'>
                <BackButton />
              </div>
            )}

            {/* 桌面端顶部按�?*/}
            {!hideNavigation && (
              <div className='absolute top-2 right-4 z-20 hidden md:flex items-center gap-2'>
                <ThemeToggle />
                <UserMenu />
                <UpdateNotification />
              </div>
            )}

            {/* 主内�?*/}
            <main
              className='flex-1 md:min-h-0 mb-14 md:mb-0 md:mt-0 mt-12'
              style={{
                paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom))',
              }}
            >
              {children}
            </main>
          </div>
        </div>

        {/* 移动端底部导�?*/}
        {!hideNavigation && (
          <div className='md:hidden'>
            <MobileBottomNav activePath={activePath} />
          </div>
        )}
      </div>
    </VersionCheckProvider>
  );
};

export default PageLayout;
