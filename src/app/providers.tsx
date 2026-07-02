'use client';

import { ThemeProvider as CustomThemeProvider } from '@/contexts/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, lazy, Suspense } from 'react';
import { AppContextProvider } from '@/contexts/AppContext';
import { AuthContextProvider } from '@/contexts/AuthContext';
import { startMock, stopMock, mockEnabled } from '@/mocks/init';
import EmotionProvider from '@/lib/emotion-provider';

// 延迟加载 three.js(避免 Turbopack 首次编译整个 app 时卡在 three 大依赖上)。
// 用户首次点击页面再 mount;非 /digital-human 路由永远不会触发。
const FloatingDigitalHuman = lazy(() =>
  typeof window === 'undefined'
    ? Promise.resolve({ default: () => null })
    : import('@/digital-human/FloatingDigitalHuman'),
);

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
  const [mountFloating, setMountFloating] = useState(false);

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

  // 浏览器空闲时再挂载浮窗数字人(等首次交互后再加载,避免阻塞 SSR)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // 立刻挂载 — setTimeout 0 让 React 先 commit 首屏
    // (不依赖 requestIdleCallback, 因为重页面 /home/recommend 可能永远不 idle)
    const t = setTimeout(() => setMountFloating(true), 200)
    return () => clearTimeout(t)
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
              {mountFloating && (
                <Suspense fallback={null}>
                  <FloatingDigitalHuman />
                </Suspense>
              )}
            </AuthContextProvider>
          </AppContextProvider>
        </CustomThemeProvider>
      </EmotionProvider>
    </QueryClientProvider>
  );
}
