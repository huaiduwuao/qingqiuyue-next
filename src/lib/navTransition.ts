/**
 * 页面切换转场(View Transitions API)+「正在跳转」信号。见 components/client/NativeTransitions 的说明;
 * 这里是不依赖组件的部分,程序化导航(router.push 经 installRouterTransitions 包过、
 * lib/contentRoute 的 useContentNavigate)也用它。
 *
 * 网页和客户端都做(以前只在客户端里做)。宽屏上的样式是轻量的淡入 + 小位移,
 * 窄屏是原生应用那种整页推入 / 滑出,见 globals.css 的 html[data-vt]。
 */

import { flushSync } from 'react-dom';

type Dir = 'forward' | 'back';

type ViewTransitionLike = { finished: Promise<void>; skipTransition?: () => void };
type DocWithVT = Document & { startViewTransition?: (cb: () => Promise<void> | void) => ViewTransitionLike };

/**
 * 转场最多等新页面这么久。startViewTransition 的回调没结束前浏览器停在旧页快照上、什么都不画
 * (NavProgress 的进度条 setState 了也看不见),所以等不到就放弃动画(skipTransition),
 * 让旧页面连同进度条 / 遮罩重新活过来,新页面到了直接切换。
 * 预取过的详情路由几十毫秒就能画出来,能赶上动画;冷加载 chunk 的赶不上,那就先给反馈。
 */
export const ROUTE_WAIT_MS = 350;

function canAnimate(): boolean {
  if (typeof document === 'undefined') return false;
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

/**
 * 后台壳(/system)里的换页不做转场、不挂「正在跳转」。后台是侧栏 + 内容区的应用壳,换的只是
 * 内容区:整页快照淡入会把侧栏一起晃一下,而且 startViewTransition 的回调期间浏览器停在旧页快照上、
 * 不画任何东西(最多 700ms,见 waitForRoute),再叠上 NavProgress 600ms 后的全屏遮罩 ——
 * 切菜单就是「冻住 → 跳一下」。后台 layout 有自己的进度条和即时高亮。
 */
const isAdminPath = (p: string) => norm(p) === '/system' || p.startsWith('/system/');

/** from → to 两头都在后台里 */
export function isAdminHop(toPathname: string, fromPathname: string = typeof location === 'undefined' ? '' : location.pathname): boolean {
  return isAdminPath(fromPathname) && isAdminPath(toPathname);
}

/** href 是不是一次站内换页(同源、routeKey 不同) */
export function isRouteChange(href: string): boolean {
  if (typeof location === 'undefined') return false;
  try {
    const url = new URL(href, location.href);
    return url.origin === location.origin && routeKey(url.pathname, url.search) !== routeKey(location.pathname, location.search);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 「正在跳转」:点下去到新页面画出来之间的状态,components/client/NavProgress 据此出进度条 / 遮罩
// ---------------------------------------------------------------------------

let busy = false;
let busyTimer: ReturnType<typeof setTimeout> | undefined;
const busyListeners = new Set<() => void>();

function setBusy(b: boolean): void {
  if (busy === b) return;
  busy = b;
  busyListeners.forEach((l) => l());
}

/** 开始一次换页。新页面渲染出来(setRenderedPath 换了值)时结束;最多 10 秒,别让遮罩卡死 */
export function markNavStart(): void {
  setBusy(true);
  clearTimeout(busyTimer);
  busyTimer = setTimeout(() => setBusy(false), 10_000);
}

export function subscribeNavBusy(l: () => void): () => void {
  busyListeners.add(l);
  return () => busyListeners.delete(l);
}

export function getNavBusy(): boolean {
  return busy;
}

const renderedListeners = new Set<() => void>();

/** NativeTransitions 在每次路由渲染后调用,传 routeKey */
export function setRenderedPath(key: string): void {
  const changed = key !== renderedPath;
  renderedPath = key;
  if (changed) {
    clearTimeout(busyTimer);
    setBusy(false);
    renderedListeners.forEach((l) => l());
  }
}

export function getRenderedPath(): string {
  return renderedPath;
}

/**
 * 等到渲染出来的路径变了(新页面已经提交到 DOM)。maxMs 内没等到返回 false。
 *
 * 不能用 requestAnimationFrame 轮询:转场回调期间浏览器暂停渲染,rAF 跟着停(后台标签页里
 * 更是一秒才来一次),轮询永远走不到超时,只能等浏览器 4 秒后强行放弃转场 —— 表现就是
 * 点一下卡住好几秒。setRenderedPath 在 layout effect 里调用,那时 DOM 已经是新页面,
 * 直接结束回调,转场拍到的就是新页(通常是它的骨架屏)。
 */
function waitForRoute(from: string, maxMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (renderedPath !== from) {
      resolve(true);
      return;
    }
    const onRendered = () => {
      if (renderedPath === from) return;
      renderedListeners.delete(onRendered);
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      renderedListeners.delete(onRendered);
      resolve(false);
    }, maxMs);
    renderedListeners.add(onRendered);
  });
}

function begin(dir: Dir, update: (vt: () => ViewTransitionLike | undefined) => Promise<void> | void): void {
  running = true;
  const html = document.documentElement;
  html.dataset.vt = dir;
  // 回调在拍完旧页快照后才执行(异步),那时 vt 已经赋值;getVT 只在回调的 promise 链里被调用
  const vt: ViewTransitionLike = (document as DocWithVT).startViewTransition!(() => update(() => vt));
  // 放弃转场(skipTransition / 页面切到后台)时 Chrome 会把 finished 也拒掉(AbortError: Transition was skipped),
  // 不接住就是一条 unhandled rejection;这里只关心收尾
  vt.finished
    .catch(() => {})
    .finally(() => {
      delete html.dataset.vt;
      running = false;
    });
}

/**
 * 带转场地执行一次导航。navigate 负责真正跳转(router.push 等);不支持转场时直接调用它。
 */
export function navTransition(dir: Dir, navigate?: () => void): void {
  markNavStart();
  if (!canAnimate() || running) {
    navigate?.();
    return;
  }
  const from = renderedPath || routeKey(location.pathname, location.search);
  begin(dir, (getVT) => {
    navigate?.();
    return waitForRoute(from, ROUTE_WAIT_MS).then((rendered) => {
      // 没赶上:放弃动画,把渲染还给页面 —— 进度条 / 遮罩这时才画得出来
      if (!rendered) getVT()?.skipTransition?.();
    });
  });
}

/**
 * 同一路由里的「换一屏」(小说详情 ⇄ 阅读器之类),也用前进 / 返回转场。
 * update 里做 setState,会被 flushSync 同步提交,快照拍到的就是新界面。
 */
export function stateTransition(dir: Dir, update: () => void): void {
  if (!canAnimate() || running) {
    update();
    return;
  }
  begin(dir, () => {
    flushSync(update);
  });
}

type PushFn = (href: string, options?: { scroll?: boolean }) => void;

/**
 * 给 Next 的 router 实例(useRouter() 拿到的是全站同一个对象)的 push 包一层转场:
 * 站里大部分跳转是 onClick → router.push,不是 <a>,只拦链接点击的话它们都没有动画。
 * 同页 ?tab= 切换(routeKey 不变)原样放行。
 */
export function installRouterTransitions(router: { push: PushFn }): void {
  const r = router as { push: PushFn; __qqVT?: boolean };
  if (r.__qqVT) return;
  r.__qqVT = true;
  const push = r.push.bind(r);
  r.push = (href, options) => {
    if (!isRouteChange(href) || isAdminHop(new URL(href, location.href).pathname)) {
      push(href, options);
      return;
    }
    navTransition('forward', () => push(href, options));
  };
}
