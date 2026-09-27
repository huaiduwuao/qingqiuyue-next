'use client';

import { useEffect, useRef } from 'react';

/**
 * 返回键 / 返回手势先关弹层,不换页(手机上的原生应用都是这样)。
 *
 * 「弹层」有两种:
 *   1. MUI 的 Modal(Dialog / Drawer / Menu / Popover / 底部弹层):打开时是 body 下的 .MuiModal-root,
 *      不用登记,这里直接从 DOM 里认
 *   2. 不是 Modal 的自绘浮层(推荐流的评论栏、播放器的页内全屏……):用 useBackClose 登记
 *
 * 用在两处:
 *   - 安卓客户端:MainActivity 的返回回调问 window.__qqBack(见 components/client/BackKeyBridge),
 *     那边调 closeTopOverlay()
 *   - 手机浏览器(没有原生返回回调):installOverlayHistoryGuard —— 有弹层时往历史里垫一条同地址的记录,
 *     返回手势退掉的是这条垫的记录,我们借 popstate 关弹层;弹层是点 × / 遮罩关的,就把垫的记录退掉。
 */

type Entry = { id: number; close: () => void };
const stack: Entry[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

/** 登记一个自绘浮层:open 期间按返回会调 onClose */
export function useBackClose(open: boolean, onClose: () => void) {
  const cb = useRef(onClose);
  useEffect(() => {
    cb.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const entry: Entry = { id: ++seq, close: () => cb.current() };
    stack.push(entry);
    notify();
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      notify();
    };
  }, [open]);
}

function openModals(): HTMLElement[] {
  // 关上后移除,或者 keepMounted 的带 MuiModal-hidden;被上层 Modal 盖住的会被 MUI 设 aria-hidden
  return [...document.querySelectorAll<HTMLElement>('body > .MuiModal-root')].filter(
    (el) => !el.classList.contains('MuiModal-hidden'),
  );
}

export function openOverlayCount(): number {
  return openModals().length + stack.length;
}

/**
 * 关掉最上面的弹层。MUI Modal 优先(它们总是叠在自绘浮层上面,比如评论栏里点开的举报弹窗)。
 * 返回 false = 没有弹层可关。
 */
export function closeTopOverlay(): boolean {
  const modals = openModals().filter((el) => el.getAttribute('aria-hidden') !== 'true');
  const modal = modals[modals.length - 1];
  if (modal) {
    // MUI Modal 自己处理 Escape(onClose reason = 'escapeKeyDown');禁了 Escape 的弹窗退而点遮罩
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    modal.dispatchEvent(esc);
    setTimeout(() => {
      if (modal.isConnected && !modal.classList.contains('MuiModal-hidden')) {
        modal.querySelector<HTMLElement>(':scope > .MuiBackdrop-root')?.click();
      }
    }, 0);
    return true;
  }
  const top = stack[stack.length - 1];
  if (top) {
    top.close();
    return true;
  }
  return false;
}

const MARK = '__qqOverlay';

/** 手机浏览器:返回手势关弹层。只装一次;客户端里不装(那边走原生返回回调) */
export function installOverlayHistoryGuard() {
  const w = window as Window & { __qqOverlayGuard?: boolean };
  if (w.__qqOverlayGuard) return;
  w.__qqOverlayGuard = true;

  /** 当前是否垫了一条记录,垫的时候在哪个地址 */
  let armedHref = '';
  /** 我们自己调的 history.back(),popstate 不交给路由 */
  let ignorePops = 0;
  let queued = false;

  const sync = () => {
    queued = false;
    const n = openOverlayCount();
    if (n > 0 && !armedHref) {
      // 带上 Next 自己的 state(__NA / 路由树),退回这条记录时它当成同一页,不重新加载
      history.pushState({ ...(history.state ?? {}), [MARK]: true }, '', location.href);
      armedHref = location.href;
    } else if (n === 0 && armedHref) {
      const same = location.href === armedHref;
      armedHref = '';
      // 弹层是点 × / 遮罩关的,还在原地:把垫的那条退掉。已经跳到别的页(弹层里点了链接)就不动
      if (same && history.state?.[MARK]) {
        ignorePops++;
        history.back();
      }
    }
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    // Modal 关闭有收起动画,节点晚一点才拿掉;这里只是去抖,真正的判断看 DOM
    setTimeout(sync, 0);
  };

  window.addEventListener(
    'popstate',
    (e) => {
      if (ignorePops > 0) {
        ignorePops--;
        e.stopImmediatePropagation();
        return;
      }
      if (armedHref) {
        // 返回手势退掉的是垫的记录:关弹层,不换页。还有别的弹层开着,sync 会再垫一条
        armedHref = '';
        e.stopImmediatePropagation();
        closeTopOverlay();
        setTimeout(schedule, 400);
        return;
      }
      if ((e.state as Record<string, unknown> | null)?.[MARK] && openOverlayCount() === 0) {
        // 弹层里点链接跳走后留下的垫记录:落在这里等于原页面,再退一步,免得「按了一次返回没反应」
        setTimeout(() => history.back(), 0);
      }
    },
    // 捕获阶段:先于 Next 的路由监听
    true,
  );

  const mo = new MutationObserver(schedule);
  mo.observe(document.body, { childList: true });
  // keepMounted 的 Modal 开合只切 class
  mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  listeners.add(schedule);
  schedule();
}
