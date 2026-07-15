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
 * 适用于任何滚动容器（窗口、内部滚动容器均可）
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
      observerRef.current?.disconnect();
      return;
    }

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    observerRef.current?.disconnect();

    // 找到可滚动的祖先容器
    let root: Element | null = null;
    if (containerRef?.current) {
      root = containerRef.current;
    } else {
      // 查找可滚动的祖先元素（从 sentinel 向上查找）
      let el = sentinel.parentElement;
      while (el) {
        const style = window.getComputedStyle(el);
        if (el.scrollHeight > el.clientHeight && (style.overflow === 'auto' || style.overflow === 'scroll' || style.overflowY === 'auto' || style.overflowY === 'scroll')) {
          root = el;
          break;
        }
        el = el.parentElement;
      }
      // 如果没找到可滚动容器，使用窗口
      if (!root) {
        root = document.documentElement;
      }
    }

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
 * 适用于需要精确控制滚动检测的场景
 * 自动查找可滚动的祖先容器
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

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const handleScroll = () => {
      // 查找可滚动的祖先容器
      let scrollEl: Element = document.documentElement;

      if (containerRef?.current) {
        const el = containerRef.current;
        // 检查指定容器是否可以滚动
        if (el.scrollHeight > el.clientHeight + 10) {
          scrollEl = el;
        } else {
          // 容器不可滚动，向上查找
          let parent = el.parentElement;
          while (parent) {
            const style = window.getComputedStyle(parent);
            if (parent.scrollHeight > parent.clientHeight + 10 &&
                (style.overflow === 'auto' || style.overflow === 'scroll' || style.overflowY === 'auto' || style.overflowY === 'scroll')) {
              scrollEl = parent;
              break;
            }
            parent = parent.parentElement;
          }
        }
      } else {
        // 没有指定容器，向上查找
        let el = sentinel.parentElement;
        while (el) {
          const style = window.getComputedStyle(el);
          if (el.scrollHeight > el.clientHeight + 10 &&
              (style.overflow === 'auto' || style.overflow === 'scroll' || style.overflowY === 'auto' || style.overflowY === 'scroll')) {
            scrollEl = el;
            break;
          }
          el = el.parentElement;
        }
      }

      const scrollTop = scrollEl === document.documentElement ? window.scrollY : (scrollEl as HTMLElement).scrollTop;
      const scrollHeight = scrollEl === document.documentElement ? document.documentElement.scrollHeight : (scrollEl as HTMLElement).scrollHeight;
      const clientHeight = scrollEl === document.documentElement ? window.innerHeight : (scrollEl as HTMLElement).clientHeight;

      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setIsNearBottom(distanceFromBottom < 150);
    };

    // 监听找到的滚动容器
    const scrollHandler = () => handleScroll();
    window.addEventListener('scroll', scrollHandler, { passive: true });
    handleScroll(); // 初始化

    return () => window.removeEventListener('scroll', scrollHandler);
  }, [enabled, containerRef]);

  return { sentinelRef, isNearBottom };
}
