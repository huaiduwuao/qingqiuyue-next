'use client';

import { ThemeProvider as CustomThemeProvider } from '@/contexts/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useState, useEffect } from 'react';
import { AppContextProvider } from '@/contexts/AppContext';
import { AuthContextProvider } from '@/contexts/AuthContext';
import EmotionProvider from '@/lib/emotion-provider';
import PageViewTracker from '@/components/PageViewTracker';
import ViewportFix from '@/components/layout/ViewportFix';
import DeepLinkBridge from '@/components/client/DeepLinkBridge';
import AppUpdater from '@/components/client/AppUpdater';
import ClientPlatformAttr from '@/components/client/ClientPlatformAttr';
import NativeTransitions from '@/components/client/NativeTransitions';
import NavProgress from '@/components/client/NavProgress';
import ClickSpark from '@/components/reactbits/ClickSpark';
import GlobalPlayers from '@/components/player/GlobalPlayers';
import EmbedBridge from '@/components/layout/EmbedBridge';
import RealtimeProvider from '@/components/realtime/RealtimeProvider';

// React 19(≤19.3.0) estimateBandwidth 有一个 off-by-one:遍历
// performance.getEntriesByType("resource") 时,若最后一个条目恰是静态资源
// (img/css/script...),内层 for(i+=1;...) 会越界,overlapEntry 变成 undefined,
// 读 .startTime 抛 "Cannot read properties of undefined (reading 'startTime')"。
// 这是 React 内部代码,业务侧改不到;该函数由 Suspense 预加载决策调用,而
// /topic 这类一次性并发加载几十张封面的页面最容易踩中(资源条目越多越可能
// 让末尾元素满足静态资源条件)。
//
// 规避:把性能资源缓冲区设小并周期性清理,让 getEntriesByType 返回的数组
// 始终很短,末尾几乎不会停在"静态资源 + 越界"那个临界点上。这不改变任何业务
// 行为,只是限制 performance timeline 的条目数(默认上限本就 250+)。
if (typeof window !== 'undefined' && typeof performance !== 'undefined') {
  try {
    // 收紧缓冲:默认 250 条很容易让末尾停在静态资源上,20 条基本不触发越界。
    performance.setResourceTimingBufferSize?.(20);
    // 页面加载早期清一次存量,去掉 SSR/预加载阶段已堆积的条目。
    performance.clearResourceTimings?.();
  } catch {
    /* 某些 webview 不支持这两个方法,忽略即可 */
  }
}

// 全站浮窗小助手已移除:它常驻在右下角,会压住数字人页的角色选择面板等界面元素。
// 数字人还在,但只在 /digital-human 这一个页面里(ImmersiveDigitalHuman)。

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
  return (
    <QueryClientProvider client={queryClient}>
      <EmotionProvider>
        <CustomThemeProvider>
          <AppContextProvider>
            <AuthContextProvider>
              <PageViewTracker />
              <EmbedBridge />
              {/* 全站唯一一条通知长连接:私信 / 互动消息 / 系统公告 / 客服都从这里下来 */}
              <RealtimeProvider />
              {/* 老 WebView 的 100dvh 兜底 + 全站点击火花(React Bits ClickSpark) */}
              <ViewportFix />
              {/* 客户端:接住系统浏览器授权完成后的 qingqiuyue:// 回跳(网页里是空组件) */}
              <DeepLinkBridge />
              {/* 客户端:启动 / 每 6 小时检查新版本,桌面端自动下载安装(网页里是空组件) */}
              <AppUpdater />
              {/* <html data-client=…>(客户端)/ data-touch(手机浏览器),供 globals.css 收掉网页才有的交互 */}
              <ClientPlatformAttr />
              {/* 页面前进/返回转场(网页 + 客户端)+ 客户端真机滑不动诊断 */}
              {/* useSearchParams 在静态导出下必须包 Suspense */}
              <Suspense fallback={null}>
                <NativeTransitions />
              </Suspense>
              {/* 点下去反应慢(换页 / 提交)时的顶部进度条和遮罩 */}
              <NavProgress />
              <ClickSpark sparkColor="var(--brand-color, #FE2C55)">
                {children}
              </ClickSpark>
              {/* 音乐底栏 / 视频小窗:跨路由常驻,切页面不断播 */}
              <GlobalPlayers />
            </AuthContextProvider>
          </AppContextProvider>
        </CustomThemeProvider>
      </EmotionProvider>
    </QueryClientProvider>
  );
}
