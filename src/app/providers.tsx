'use client';

import { ThemeProvider as CustomThemeProvider } from '@/contexts/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { AppContextProvider } from '@/contexts/AppContext';
import { AuthContextProvider } from '@/contexts/AuthContext';
import { startMock, stopMock, mockEnabled } from '@/mocks/init';
import dynamic from 'next/dynamic';
import EmotionProvider from '@/lib/emotion-provider';

const FloatingDigitalHuman = dynamic(() => import('@/digital-human/FloatingDigitalHuman'), { ssr: false });

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            retry: 2,
            retryDelay: (i) => Math.min(500 * 2 ** i, 2000),
          },
        },
      })
  );

  const [mockReady, setMockReady] = useState(!mockEnabled);

  useEffect(() => {
    if (!mockEnabled) {
      // 生产 / compose 构建:注销可能残留的 mock service worker,避免其继续拦截真实请求
      stopMock().finally(() => setMockReady(true));
      return;
    }
    let cancelled = false;
    startMock()
      .then(() => {
        if (!cancelled) setMockReady(true);
      })
      .catch((err) => {
        // MSW 启动失败时也不要锁死 UI —— 让页面继续渲染,
        // 失败的请求会自然返回 404,UI 走错误态
        console.error('[MSW] startMock failed, continuing without mock:', err);
        if (!cancelled) setMockReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mockReady) {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-mock-loading', '1');
    }
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <EmotionProvider>
        <CustomThemeProvider>
          <AppContextProvider>
            <AuthContextProvider>
              {children}
              <FloatingDigitalHuman />
            </AuthContextProvider>
          </AppContextProvider>
        </CustomThemeProvider>
      </EmotionProvider>
    </QueryClientProvider>
  );
}
