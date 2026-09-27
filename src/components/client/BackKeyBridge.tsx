'use client';

import { useEffect } from 'react';
import { isDesktopClient } from '@/lib/clientAuth';
import { closeTopOverlay, installOverlayHistoryGuard } from '@/lib/backStack';

/**
 * 返回键 / 返回手势先关弹层(见 lib/backStack)。
 *
 * 安卓客户端:MainActivity.handleOnBackPressed 调 window.__qqBack():
 * - 'handled':开着抽屉 / 弹窗 / 菜单 / 评论栏 / 页内全屏 → 关掉最上面那个
 * - 'root':在一级页面(底部导航露着:首页各页签、创作、悬赏、消息、我的)→ 原生那边提示「再按一次退出」
 * - 'back':其它页面 → 原生那边照常后退
 *
 * 以前只看 WebView.canGoBack():单页应用切过页签、看过详情,历史栈就一直有东西,
 * 返回键在首页也只会一层层往回退,永远走不到「再按一次退出」。
 *
 * 手机浏览器(触屏、不是客户端):没有原生回调,用历史记录垫一条(installOverlayHistoryGuard)。
 */
declare global {
  interface Window {
    __qqBack?: () => 'handled' | 'root' | 'back';
  }
}

export default function BackKeyBridge() {
  useEffect(() => {
    window.__qqBack = () => {
      if (closeTopOverlay()) return 'handled';
      if (document.querySelector('[data-mobile-bottom-nav]')) return 'root';
      return 'back';
    };
    if (!isDesktopClient() && window.matchMedia?.('(hover: none) and (pointer: coarse)').matches) {
      installOverlayHistoryGuard();
    }
    return () => {
      delete window.__qqBack;
    };
  }, []);
  return null;
}
