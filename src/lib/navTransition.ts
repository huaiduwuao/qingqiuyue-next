/**
 * 客户端页面切换转场(View Transitions API)。见 components/client/NativeTransitions 的说明;
 * 这里是不依赖 React 的部分,程序化导航(lib/contentRoute 的 useContentNavigate)也用它。
 */

import { isDesktopClient } from '@/lib/clientAuth';

type Dir = 'forward' | 'back';

type DocWithVT = Document & { startViewTransition?: (cb: () => Promise<void> | void) => { finished: Promise<void> } };

function canAnimate(): boolean {
  if (typeof document === 'undefined' || !isDesktopClient()) return false;
  if (!(document as DocWithVT).startViewTransition) return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

let running = false;
/** React 当前真正渲染出来的路径(popstate 时 location 已经变了,页面还没变,不能拿 location 判断) */
let renderedPath = '';

/** 客户端构建开了 trailingSlash:usePathname 与 location.pathname 可能差一个结尾斜杠 */
export const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);

/**
 * 「算不算换了一页」的键:路径 + 查询串。详情页之间只差 ?id=(视频详情 → 相关视频),也要有转场;
 * 首页壳(/home/…)里的 ?tab= / ?section= 是页内切换,不算。
 */
export function routeKey(pathname: string, search: string): string {
  const p = norm(pathname);
  if (p === '/home' || p.startsWith('/home/')) return p;
  const q = search.startsWith('?') ? search.slice(1) : search;
  return q ? `${p}?${q}` : p;
}

/** NativeTransitions 在每次路由渲染后调用,传 routeKey */
export function setRenderedPath(key: string): void {
  renderedPath = key;
}

export function getRenderedPath(): string {
  return renderedPath;
}

/** 等到渲染出来的路径变了、新页面画出来(最多等 maxMs,慢网络下不把界面冻住太久) */
function waitForRoute(from: string, maxMs = 700): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      if (renderedPath !== from) {
        // 再等两帧,让新页面完成首次渲染
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        return;
      }
      if (performance.now() - t0 > maxMs) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

/**
 * 带转场地执行一次导航。navigate 负责真正跳转(router.push 等);不支持转场时直接调用它。
 */
export function navTransition(dir: Dir, navigate?: () => void): void {
  if (!canAnimate() || running) {
    navigate?.();
    return;
  }
  running = true;
  const html = document.documentElement;
  const from = renderedPath || routeKey(location.pathname, location.search);
  html.dataset.vt = dir;
  const vt = (document as DocWithVT).startViewTransition!(() => {
    navigate?.();
    return waitForRoute(from);
  });
  vt.finished.finally(() => {
    delete html.dataset.vt;
    running = false;
  });
}
