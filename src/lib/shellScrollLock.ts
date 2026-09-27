'use client';

import { useEffect } from 'react';

/**
 * 整页锁滚动(首页 / 账号 / 用户页这类「外壳固定、里面的 main 自己滚」的布局)。
 *
 * 以前三个 layout 各自往 body 上写行内 overflow:hidden,卸载时再还原成「挂载时看到的值」。这和 MUI 的
 * Modal(侧边栏抽屉、⋮ 菜单、弹窗)抢的是同一个行内样式:Modal 打开时记下 body 的 overflow(= 外壳写的
 * hidden),关闭时再写回去。在抽屉 / 菜单还开着(或正在收起)的时候点进详情页,外壳先卸载把 hidden 去掉,
 * Modal 随后关闭又把 hidden 写了回来 —— 详情页 body 永远 overflow:hidden,整页滑不动(安卓真机
 * scroll_stuck 诊断:bodyOverflow "hidden|hidden",html 已还原)。
 *
 * 现在外壳只在 <html> 上打 data-shell-lock(计数,允许两个外壳交替挂载),样式在 globals.css;
 * body 的行内 overflow 只归 MUI Modal 管。installScrollLockGuard 再兜一层:没有打开的 Modal 时
 * body 上出现的行内 overflow:hidden 一律视为残留,清掉。
 */

let lockCount = 0;
let fixedCount = 0;

function apply() {
  const html = document.documentElement;
  if (lockCount > 0) html.setAttribute('data-shell-lock', '');
  else html.removeAttribute('data-shell-lock');
  // body 钉成一屏高。账号页不要(MUI Dialog 在客户端 WebView 里会按被钉死的 body 算错定位容器)
  if (fixedCount > 0) html.setAttribute('data-shell-fixed', '');
  else html.removeAttribute('data-shell-fixed');
}

export function useShellScrollLock({ fixedHeight = true }: { fixedHeight?: boolean } = {}) {
  useEffect(() => {
    lockCount++;
    if (fixedHeight) fixedCount++;
    apply();
    return () => {
      lockCount--;
      if (fixedHeight) fixedCount--;
      apply();
      sweepStaleBodyLock();
    };
  }, [fixedHeight]);
}

/** 当前有没有打开着的 MUI Modal(Drawer / Dialog / Menu / Popover 都是 Modal)。keepMounted 收起后带 MuiModal-hidden */
function hasOpenModal() {
  return !!document.querySelector('.MuiModal-root:not(.MuiModal-hidden)');
}

function sweepStaleBodyLock() {
  const body = document.body;
  if (body.style.overflow !== 'hidden' || hasOpenModal()) return;
  body.style.overflow = '';
  // Modal 锁滚动时顺手加的滚动条补偿
  body.style.paddingRight = '';
}

let guardInstalled = false;

/** 全站装一次:body 的 style 一变就检查一遍残留锁 */
export function installScrollLockGuard() {
  if (guardInstalled || typeof MutationObserver === 'undefined') return;
  guardInstalled = true;
  let queued = false;
  const check = () => {
    queued = false;
    sweepStaleBodyLock();
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    // Modal 关闭时先改 body 样式、再从 DOM 里拿掉自己,等这一轮都做完再看
    setTimeout(check, 0);
  };
  new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['style'] });
  // Modal 卸载(拿掉 portal 节点)那一刻 body 样式不一定再变,子节点变化也看一眼
  new MutationObserver(schedule).observe(document.body, { childList: true });
  schedule();
}
