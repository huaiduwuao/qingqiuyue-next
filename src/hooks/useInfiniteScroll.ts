'use client';

import { useEffect, useRef, useState } from 'react';

interface UseInfiniteScrollOptions {
  /** 触发加载的交叉比例 (默认 0.1) */
  threshold?: number;
  /** 提前触发距离 (默认 100px)，即距离底部还有多远时触发 */
  rootMargin?: string;
  /** 是否启用 */
  enabled?: boolean;
  /** 滚动容器，默认是窗口。传入 ref 以支持内部滚动容器 */
  containerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * 通用无限滚动 Hook
 * 使用 IntersectionObserver 检测滚动到底部
 *
 * @example
 * const { sentinelRef, isNearBottom } = useInfiniteScroll({
 *   enabled: !isLoading && hasMore,
 *   containerRef: scrollContainerRef, // 可选，指定滚动容器
 * });
 * // 在列表底部添加 <Box ref={sentinelRef} />
 */
export function useInfiniteScroll(options: UseInfiniteScrollOptions = {}) {
  const {
    threshold = 0.1,
    rootMargin = '100px',
    enabled = true,
    containerRef,
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

    const root = containerRef?.current ?? null;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        setIsNearBottom(entries[0].isIntersecting);
      },
      { threshold, rootMargin, root }
    );

    observerRef.current.observe(sentinel);

    return () => observerRef.current?.disconnect();
  }, [enabled, threshold, rootMargin, containerRef]);

  return { sentinelRef, isNearBottom };
}

/**
 * 基于滚动事件的无穷滚动 Hook
 * 适用于 IntersectionObserver 无法正确工作的场景（如嵌套滚动容器）
 *
 * @example
 * const { sentinelRef, isNearBottom } = useScrollToBottom({
 *   enabled: !isLoading && hasMore,
 *   containerRef: scrollContainerRef,
 * });
 */
export function useScrollToBottom(options: { enabled?: boolean; containerRef?: React.RefObject<HTMLElement | null> } = {}) {
  const { enabled = true, containerRef } = options;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsNearBottom(false);
      return;
    }

    const container = containerRef?.current ?? window;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const handleScroll = () => {
      const scrollTop = container === window
        ? window.scrollY
        : (container as HTMLElement).scrollTop;
      const scrollHeight = container === window
        ? document.documentElement.scrollHeight
        : (container as HTMLElement).scrollHeight;
      const clientHeight = container === window
        ? window.innerHeight
        : (container as HTMLElement).clientHeight;

      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setIsNearBottom(distanceFromBottom < 150);
    };

    const element = container === window ? window : container as HTMLElement;
    element.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // 初始化

    return () => element.removeEventListener('scroll', handleScroll);
  }, [enabled, containerRef]);

  return { sentinelRef, isNearBottom };
}
