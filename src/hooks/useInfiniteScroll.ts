'use client';

import { useEffect, useRef, useState } from 'react';

interface UseInfiniteScrollOptions {
  /** 触发加载的交叉比例 (默认 0.1) */
  threshold?: number;
  /** 提前触发距离 (默认 100px)，即距离底部还有多远时触发 */
  rootMargin?: string;
  /** 是否启用 */
  enabled?: boolean;
}

/**
 * 通用无限滚动 Hook
 * 使用 IntersectionObserver 检测滚动到底部
 *
 * @example
 * const { sentinelRef, isNearBottom } = useInfiniteScroll({
 *   enabled: !isLoading && hasMore,
 * });
 * // 在列表底部添加 <Box ref={sentinelRef} />
 */
export function useInfiniteScroll(options: UseInfiniteScrollOptions = {}) {
  const {
    threshold = 0.1,
    rootMargin = '100px',
    enabled = true,
  } = options;

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIsNearBottom(false);
      return;
    }

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        setIsNearBottom(entries[0].isIntersecting);
      },
      { threshold, rootMargin }
    );

    observerRef.current.observe(sentinel);

    return () => observerRef.current?.disconnect();
  }, [enabled, threshold, rootMargin]);

  return { sentinelRef, isNearBottom };
}
