'use client';

import { useEffect, type RefObject } from 'react';

/**
 * 把顶栏实际高度(含 safe-area 顶部内边距)写进 :root 的 CSS 变量,
 * 页面内的 sticky 子栏用 `top: var(--topbar-h)` 对齐,不再各自硬编码 56/60/64/68。
 *
 * 之前各页 header 写死 `height: 56` 又加 `paddingTop: var(--sat)`,box-sizing 是
 * border-box,刘海屏上 47px 的安全区把内容区挤到只剩 9px —— 这就是"某些手机顶栏
 * 错位/重叠"的根因。现在 header 用 minHeight,真实高度由这里量出来。
 */
export function useTopbarHeight(ref: RefObject<HTMLElement | null>, varName = '--topbar-h') {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const update = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) root.style.setProperty(varName, `${Math.round(h)}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, varName]);
}
