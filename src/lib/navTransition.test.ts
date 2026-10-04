import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTE_WAIT_MS, getNavBusy, installRouterTransitions, isAdminHop, navTransition, setRenderedPath } from './navTransition';

describe('view transition waits for the new route', () => {
  /** 像真浏览器那样:拍完旧页快照后(异步)才执行回调,回调的 promise 结束后转场才 finished */
  let skip: ReturnType<typeof vi.fn>;
  let callbackDone: Promise<void>;
  const startViewTransition = vi.fn((cb: () => Promise<void> | void) => {
    let finish!: () => void;
    const finished = new Promise<void>((r) => (finish = r));
    callbackDone = Promise.resolve().then(async () => {
      await cb();
      finish();
    });
    return { finished, skipTransition: skip };
  });

  beforeEach(() => {
    vi.useFakeTimers();
    skip = vi.fn();
    (document as unknown as { startViewTransition: typeof startViewTransition }).startViewTransition = startViewTransition;
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    startViewTransition.mockClear();
    history.pushState(null, '', '/home/recommend');
    setRenderedPath('/home/recommend');
  });

  afterEach(async () => {
    // 让上一个转场收尾,running 才会放开
    await vi.runAllTimersAsync();
    await callbackDone;
    vi.useRealTimers();
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    setRenderedPath('__reset__');
  });

  it('finishes as soon as the new route is rendered, without skipping', async () => {
    const navigate = vi.fn(() => history.pushState(null, '', '/detail/teleplay-detail?id=1'));
    navTransition('forward', navigate);
    expect(getNavBusy()).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(navigate).toHaveBeenCalledTimes(1);

    // 新页面提交到 DOM(NativeTransitions 的 layout effect)
    await vi.advanceTimersByTimeAsync(50);
    setRenderedPath('/detail/teleplay-detail?id=1');
    await callbackDone;

    expect(skip).not.toHaveBeenCalled();
    expect(getNavBusy()).toBe(false);
    expect(document.documentElement.dataset.vt).toBeUndefined();
  });

  it('skips the animation when the route is not ready in time so the progress bar can paint', async () => {
    navTransition('forward', () => history.pushState(null, '', '/detail/film-detail?id=2'));
    await vi.advanceTimersByTimeAsync(ROUTE_WAIT_MS + 5);
    await callbackDone;

    // 动画放弃了,但「正在跳转」还挂着 —— 进度条 / 遮罩继续显示到新页面真的画出来
    expect(skip).toHaveBeenCalledTimes(1);
    expect(getNavBusy()).toBe(true);

    setRenderedPath('/detail/film-detail?id=2');
    expect(getNavBusy()).toBe(false);
  });

  it('does not poll requestAnimationFrame (paused while a transition is pending)', async () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    navTransition('forward', () => history.pushState(null, '', '/detail/video-detail?id=3'));
    await vi.advanceTimersByTimeAsync(ROUTE_WAIT_MS + 5);
    await callbackDone;
    expect(raf).not.toHaveBeenCalled();
    raf.mockRestore();
  });
});

describe('admin shell navigation', () => {
  const startViewTransition = vi.fn((cb: () => unknown) => {
    void cb();
    return { finished: Promise.resolve() };
  });

  beforeEach(() => {
    (document as unknown as { startViewTransition: typeof startViewTransition }).startViewTransition = startViewTransition;
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    startViewTransition.mockClear();
  });

  afterEach(() => {
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    setRenderedPath('__reset__');
  });

  it('recognises hops that stay inside /system', () => {
    expect(isAdminHop('/system/menu', '/system/role')).toBe(true);
    expect(isAdminHop('/system', '/system/role/')).toBe(true);
    expect(isAdminHop('/home/recommend', '/system/role')).toBe(false);
    expect(isAdminHop('/system/role', '/home/recommend')).toBe(false);
    expect(isAdminHop('/systemx', '/system/role')).toBe(false);
  });

  it('switches admin menus without a view transition or the busy mask', () => {
    history.pushState(null, '', '/system/role');
    const push = vi.fn();
    const router = { push };
    installRouterTransitions(router);

    router.push('/system/menu');
    expect(push).toHaveBeenCalledWith('/system/menu', undefined);
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(getNavBusy()).toBe(false);

    // 离开后台照常转场
    router.push('/home/recommend');
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(getNavBusy()).toBe(true);
  });
});
