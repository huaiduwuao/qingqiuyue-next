'use client';

import { useEffect } from 'react';

/**
 * 安卓客户端的返回键 / 返回手势先问页面怎么处理(MainActivity.handleOnBackPressed 调 window.__qqBack()):
 *
 * - 'handled':开着抽屉 / 弹窗 / 菜单 → 关掉最上面那个(发一个 Escape,MUI 的 Modal 自己会关)
 * - 'root':在一级页面(底部导航露着:首页各页签、创作、悬赏、消息、我的)→ 原生那边提示「再按一次退出」
 * - 'back':其它页面 → 原生那边照常后退
 *
 * 以前只看 WebView.canGoBack():单页应用切过页签、看过详情,历史栈就一直有东西,
 * 返回键在首页也只会一层层往回退,永远走不到「再按一次退出」。
 */
declare global {
  interface Window {
    __qqBack?: () => 'handled' | 'root' | 'back';
  }
}

function topModal(): HTMLElement | null {
  // MUI Modal(Drawer / Dialog / Menu / Popover)打开时根节点是 body 下的 .MuiModal-root,关上后移除或带 MuiModal-hidden
  const open = [...document.querySelectorAll<HTMLElement>('.MuiModal-root')].filter(
    (el) => !el.classList.contains('MuiModal-hidden') && el.getAttribute('aria-hidden') !== 'true',
  );
  return open[open.length - 1] ?? null;
}

export default function BackKeyBridge() {
  useEffect(() => {
    window.__qqBack = () => {
      const modal = topModal();
      if (modal) {
        modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        return 'handled';
      }
      if (document.querySelector('[data-mobile-bottom-nav]')) return 'root';
      return 'back';
    };
    return () => {
      delete window.__qqBack;
    };
  }, []);
  return null;
}
