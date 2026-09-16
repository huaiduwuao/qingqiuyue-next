/**
 * 读取 iOS/Android 全面屏的安全区(env(safe-area-inset-*))。
 *
 * JS 拿不到 env() 的值(getComputedStyle 对自定义属性只返回原样的 calc 字符串),
 * 所以塞一个隐藏的 fixed 探针,四边贴着安全区,量它的矩形就是四个 inset。
 * 只创建一次,后续每次调用只做一次 getBoundingClientRect。
 */
export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

let probe: HTMLDivElement | null = null;

export function getSafeAreaInsets(): SafeAreaInsets {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  if (!probe || !probe.isConnected) {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.setAttribute('data-safe-area-probe', '');
    Object.assign(probe.style, {
      position: 'fixed',
      top: 'env(safe-area-inset-top, 0px)',
      right: 'env(safe-area-inset-right, 0px)',
      bottom: 'env(safe-area-inset-bottom, 0px)',
      left: 'env(safe-area-inset-left, 0px)',
      pointerEvents: 'none',
      visibility: 'hidden',
      zIndex: '-1',
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(probe);
  }
  const r = probe.getBoundingClientRect();
  return {
    top: Math.max(0, r.top),
    right: Math.max(0, window.innerWidth - r.right),
    bottom: Math.max(0, window.innerHeight - r.bottom),
    left: Math.max(0, r.left),
  };
}
