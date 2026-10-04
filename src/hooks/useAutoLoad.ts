'use client';

import { useEffect, useRef, useState } from 'react';
import { findScrollRoot, PREFETCH_MARGIN } from './useInfiniteScroll';

/**
 * 滚动到底自动加载下一页:把返回的 ref 挂在列表尾部的 1px 哨兵上,站内列表一律这样,不放「加载更多」按钮。
 * root 取哨兵最近的滚动祖先(页面在内部 overflow 容器里滚时视口 rootMargin 不起作用),离底约一屏半就拉。
 * ref 是回调 ref:哨兵晚于 hook 挂载(先显示骨架、数据到了才渲染列表)也能接上。
 * 每页加载完 loading 翻回 false 会重建观察器,哨兵仍在可视区就接着拉,首屏填不满时不会卡住。
 */
export function useAutoLoad(hasMore: boolean, loading: boolean, loadMore: () => unknown) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const load = useRef(loadMore);
  useEffect(() => {
    load.current = loadMore;
  });
  useEffect(() => {
    if (!el || !hasMore || loading) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) load.current();
      },
      { root: findScrollRoot(el), rootMargin: PREFETCH_MARGIN },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [el, hasMore, loading]);
  return setEl;
}
