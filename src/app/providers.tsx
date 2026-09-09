'use client';

import { ThemeProvider as CustomThemeProvider } from '@/contexts/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, lazy, Suspense } from 'react';
import { AppContextProvider } from '@/contexts/AppContext';
import { AuthContextProvider } from '@/contexts/AuthContext';
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
            // 内存治理:5.37 GB dev server 反复泄漏的根因之一是 query cache 永驻
            // 内存(gcTime 默认 5 min,但没人触发就持续累加)。给个 30 min 上限,
            // HMR 重新挂载后旧缓存自动回收;production 不会因为 gcTime 影响数据新鲜度
            // (staleTime 5 min < gcTime 30 min,取数仍会按需 refetch)。
            gcTime: 30 * 60 * 1000,
            retry: 2,
            retryDelay: (i) => Math.min(500 * 2 ** i, 2000),
            // 切走页面后立即停止请求,避免无意义的 network + 内存占用
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [mountFloating, setMountFloating] = useState(false);

  // MSW(src/mocks/*,约 5200 行、360 个假端点)已删除。
  //
  // 它撑起了一整套影子 API:未实现的后端接口由 Service Worker 在浏览器里
  // 返回假数据,于是「功能做完了」和「功能没做但 mock 顶着」在界面上无法区分,
  // 谁也说不清切到真后端会剩下什么。现在前端只连真后端,后端没做的接口返 501。
  //
  // 这里保留一次性注销:老用户浏览器里可能还注册着 mockServiceWorker.js,
  // 不注销它会继续拦截真实请求。等一个发布周期后可以删掉。
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .getRegistration('/mockServiceWorker.js')
      .then((reg) => reg?.unregister())
      .catch(() => {
        /* 注销失败无所谓:SW 无激活客户端时本就放行 */
      });
  }, []);

  // 浏览器空闲时再挂载浮窗数字人(等首次交互后再加载,避免阻塞 SSR)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // 立刻挂载 — setTimeout 0 让 React 先 commit 首屏
    // (不依赖 requestIdleCallback, 因为重页面 /home/recommend 可能永远不 idle)
    const t = setTimeout(() => setMountFloating(true), 200)
    return () => clearTimeout(t)
  }, []);

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
