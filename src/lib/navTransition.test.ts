import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getNavBusy, installRouterTransitions, isAdminHop, setRenderedPath } from './navTransition';

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
