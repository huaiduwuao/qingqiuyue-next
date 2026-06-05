'use client';

import { RefObject, useEffect, useState } from 'react';

/**
 * 监听元素滚动,返回 0-100 的百分比进度。
 *
 * 用法:
 *   const scrollRef = useRef<HTMLDivElement>(null);
 *   const progress = useScrollProgress(scrollRef);
 *
 * 自动 cleanup addEventListener,scroll 监听是 passive。
 */
export function useScrollProgress(ref: RefObject<HTMLElement | null>): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const compute = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const max = scrollHeight - clientHeight;
      const pct = max > 0 ? (scrollTop / max) * 100 : 0;
      setProgress(Math.min(100, Math.max(0, pct)));
    };

    compute();
    el.addEventListener('scroll', compute, { passive: true });
    return () => el.removeEventListener('scroll', compute);
  }, [ref]);

  return progress;
}
