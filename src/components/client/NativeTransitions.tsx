'use client';

import { useEffect, useLayoutEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { isDesktopClient } from '@/lib/clientAuth';
import { getRenderedPath, navTransition, routeKey, setRenderedPath } from '@/lib/navTransition';
import { reportDiag } from '@/lib/clientDiag';

/**
 * 客户端里的原生手感(网页里什么都不做):
 *
 * 1. 页面切换动画 —— 用浏览器的 View Transitions API:前进(点站内链接 / navTransition('forward'))
 *    新页从右边推进来,返回(系统返回键 / 手势 / router.back → popstate)当前页往右滑走。
 *    动画作用在新旧两页的快照上,不改页面自己的布局,吸顶栏 / 底栏 / 固定元素都不受影响。
 *    只在路径变化时做(同页 ?tab= 切换不算);系统开了「减少动态效果」时不做。
 *    动画样式在 globals.css(html[data-vt])。
 *
 * 2. 滑不动诊断 —— 安卓上手指竖着划了一大段、页面和任何滚动容器都没动,就把手指下面那一串元素的
 *    overflow / touch-action / pointer-events 报给服务器(见 lib/clientDiag)。
 *    这类问题只在真机上出现,模拟环境复现不了,拿现场数据定位。
 */

function isInternalNavClick(e: MouseEvent): string | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return null;
  let url: URL;
  try {
    url = new URL(a.href, location.href);
  } catch {
    return null;
  }
  if (url.origin !== location.origin) return null;
  const key = routeKey(url.pathname, url.search);
  return key === routeKey(location.pathname, location.search) ? null : key;
}

export default function NativeTransitions() {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? '';
  useLayoutEffect(() => {
    setRenderedPath(routeKey(pathname ?? '', search));
  }, [pathname, search]);

  useEffect(() => {
    if (!isDesktopClient()) return;

    // 站内链接:在 Next 的 <Link> 处理之前(捕获阶段)开始转场,快照拍的是旧页面
    const onClick = (e: MouseEvent) => {
      if (!isInternalNavClick(e)) return;
      navTransition('forward');
    };
    // 返回:popstate 触发时 Next 还没渲染上一页,这时开始转场。只改了查询参数(首页 ?tab= 之间)不做
    const onPop = () => {
      if (routeKey(location.pathname, location.search) !== getRenderedPath()) navTransition('back');
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPop, true);

    // 滑不动诊断(只看触屏)
    let startY = 0;
    let startX = 0;
    let startScroll = 0;
    let moved = false;
    let target: Element | null = null;
    let prevented = false;
    const onScrollAny = () => {
      moved = true;
    };
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      startY = t.clientY;
      startX = t.clientX;
      startScroll = scrollY;
      moved = false;
      prevented = false;
      target = e.target as Element;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.defaultPrevented) prevented = true;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!t || !target) return;
      const dy = t.clientY - startY;
      const dx = t.clientX - startX;
      if (Math.abs(dy) < 80 || Math.abs(dy) < Math.abs(dx) * 2) return;
      // 给惯性滚动一点时间
      setTimeout(() => {
        if (moved || scrollY !== startScroll) return;
        // 推荐流本来就不滚(它自己翻页),只看它以外的地方
        if (target?.closest?.('[data-fill-main]')) return;
        const chain: string[] = [];
        let el: Element | null = target;
        for (let i = 0; el && i < 8; i++, el = el.parentElement) {
          const cs = getComputedStyle(el);
          chain.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${(typeof el.className === 'string' ? el.className : '').replace(/\b(mui|css)-[a-z0-9]+/g, '').trim().slice(0, 40)} oy=${cs.overflowY} ta=${cs.touchAction} pe=${cs.pointerEvents} h=${Math.round(el.getBoundingClientRect().height)}/${el.scrollHeight}`);
        }
        const html = document.documentElement;
        const body = document.body;
        reportDiag('scroll_stuck', location.pathname, {
          dy: Math.round(dy),
          prevented,
          scrollY,
          docH: html.scrollHeight,
          innerH: innerHeight,
          vvH: Math.round(window.visualViewport?.height ?? 0),
          htmlOverflow: `${html.style.overflow}|${getComputedStyle(html).overflowY}`,
          bodyOverflow: `${body.style.overflow}|${getComputedStyle(body).overflowY}|h=${body.style.height}`,
          chain,
        });
      }, 250);
    };
    document.addEventListener('scroll', onScrollAny, { capture: true, passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPop, true);
      document.removeEventListener('scroll', onScrollAny, true);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);
  return null;
}
