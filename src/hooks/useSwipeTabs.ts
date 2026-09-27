'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * 左右滑动切换页签(手机 / 安卓客户端,像抖音、B 站 App 的首页)。
 *
 * 挂在内容区上,原生 touch 监听(passive,不拦页面自己的竖向滚动):
 *   - 手指先明显横着走(|dx| > 1.5·|dy|)才算横滑,先竖着走的一律当滚动,后面再横也不管
 *   - 松手时横向位移过 72px 或宽度的 22%,或者是一下快速轻扫,才切换
 *   - 起点在能横向滚的元素里(频道条、TOP 10 横滑、表格)、输入框 / 滑块里、带 data-no-swipe 的
 *     元素里,或屏幕左右边缘 20px 内(系统返回手势)的,不接管
 * dir = 1 往后一个页签(手指往左划),-1 往前一个。
 */
export function useSwipeTabs(
  ref: RefObject<HTMLElement | null>,
  onSwipe: (dir: 1 | -1) => void,
  enabled = true,
) {
  const cb = useRef(onSwipe);
  useEffect(() => {
    cb.current = onSwipe;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let active = false;
    let axis: 'x' | 'y' | null = null;
    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    let dx = 0;

    const onStart = (e: TouchEvent) => {
      active = false;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX < 20 || t.clientX > window.innerWidth - 20) return;
      if (blocksSwipe(e.target as Element | null, el)) return;
      active = true;
      axis = null;
      x0 = t.clientX;
      y0 = t.clientY;
      t0 = performance.now();
      dx = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!active) return;
      if (e.touches.length !== 1) {
        active = false;
        return;
      }
      const t = e.touches[0];
      dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (!axis && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        axis = Math.abs(dx) > Math.abs(dy) * 1.5 ? 'x' : 'y';
        if (axis === 'y') active = false;
      }
    };
    const onEnd = () => {
      if (!active || axis !== 'x') {
        active = false;
        return;
      }
      active = false;
      const dt = performance.now() - t0;
      const far = Math.abs(dx) > Math.max(72, el.clientWidth * 0.22);
      const flick = Math.abs(dx) > 40 && dt < 250;
      if (far || flick) cb.current(dx < 0 ? 1 : -1);
    };
    const onCancel = () => {
      active = false;
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onCancel);
    };
  }, [ref, enabled]);
}

function blocksSwipe(target: Element | null, root: Element): boolean {
  for (let el = target; el && el !== root; el = el.parentElement) {
    if (el.matches('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="slider"], [data-no-swipe]')) return true;
    if (el.scrollWidth > el.clientWidth + 1) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
  }
  return false;
}
