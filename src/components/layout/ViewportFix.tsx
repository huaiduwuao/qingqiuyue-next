'use client';

import { useEffect } from 'react';

/**
 * ViewportFix —— 给不支持 100dvh 的 WebView 补 --app-height。
 *
 * globals.css 里 --app-height 默认 100vh,@supports (height:100dvh) 时覆盖成 100dvh。
 * 老 WebView(Android 8/9 自带 Chrome、iOS < 15.4)两者都不理想:100vh 在地址栏
 * 收起前会比可视区高一截,底部导航被顶出屏幕。这里在不支持 dvh 的环境用
 * innerHeight 实时写入,配合各 layout 的 height: var(--app-height)。
 */
export default function ViewportFix() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supportsDvh =
      typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('height', '100dvh');
    if (supportsDvh) return;
    const root = document.documentElement;
    const apply = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      root.style.setProperty('--app-height', `${Math.round(h)}px`);
    };
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    window.visualViewport?.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
      window.visualViewport?.removeEventListener('resize', apply);
    };
  }, []);
  return null;
}
