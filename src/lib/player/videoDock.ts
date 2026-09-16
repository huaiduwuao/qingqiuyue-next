'use client';

/**
 * 视频小窗(全站唯一一个)。
 *
 * VideoPlayer 自己 createElement 出 <video>(不交给 React 渲染),所以同一个元素
 * 可以在页面和小窗之间搬来搬去,不重新加载、不断流,原生画中画也不会被打断:
 *
 *  - float:页面还在,只是播放器滚出了视口 → 元素搬进小窗;滚回来再搬回去。
 *    owner 就是那个播放器,生命周期仍归它管。
 *  - orphan:页面离开了(路由切走) → 播放器卸载时把元素和 hls 实例整个交给小窗,
 *    小窗负责后续销毁。回到同一个页面时 VideoPlayer 用 take(key) 把它接回去。
 */
import { create } from 'zustand';

export interface StreamInfo {
  quality: string;
  resolution: string;
  url: string;
  needPay: boolean;
  format: string;
  /** 浏览器能不能直连(后端 streamaccess:direct / referer_required / cors_blocked / unreachable) */
  access?: string;
}

export interface DockEntry {
  el: HTMLVideoElement;
  title: string;
  /** 原页面地址 */
  href: string;
  poster?: string;
  /** 仍挂着的播放器;null = 页面已离开,由小窗接管 */
  owner: object | null;
  /** owner 在时:「回到原位」 */
  onReturn?: () => void;
  /** owner 在时:关掉小窗(暂停并放回页面) */
  onClose?: () => void;
  // ---- orphan 才有:接回去时恢复播放器状态 ----
  key?: string;
  hls?: any;
  streams?: StreamInfo[];
  currentStream?: number;
  platformName?: string;
  expiresAt?: number;
}

export const useVideoDock = create<{ entry: DockEntry | null }>(() => ({ entry: null }));

const get = () => useVideoDock.getState().entry;
const set = (entry: DockEntry | null) => useVideoDock.setState({ entry });

/**
 * 元素离开 DOM 超过一个任务浏览器就会暂停它。小窗组件要到下一次渲染才挂出来,
 * 这之间先把元素挪到这个常驻的屏外容器里。
 */
let lot: HTMLDivElement | null = null;
export function park(v: HTMLVideoElement) {
  if (!lot) {
    lot = document.createElement('div');
    lot.setAttribute('aria-hidden', 'true');
    lot.style.cssText = 'position:fixed;left:-10000px;top:0;width:2px;height:2px;overflow:hidden;pointer-events:none;';
    document.body.appendChild(lot);
  }
  if (v.parentNode !== lot) lot.appendChild(v);
}

export function destroyVideo(v: HTMLVideoElement, hls?: any) {
  releaseMediaSession(v);
  if (document.pictureInPictureElement === v) document.exitPictureInPicture().catch(() => {});
  v.pause();
  try {
    hls?.destroy();
  } catch {
    /* ignore */
  }
  v.removeAttribute('src');
  v.load();
  v.remove();
}

function dropCurrent(except?: HTMLVideoElement) {
  const cur = get();
  if (!cur || cur.el === except) return;
  // 先清掉,owner 的 onClose 里才能把元素放回页面(它会检查自己是否还在小窗里)
  set(null);
  if (cur.owner) cur.onClose?.();
  else destroyVideo(cur.el, cur.hls);
}

/** 挂着的、允许进小窗的播放器(按页面路径) —— 用来识别"同页换集"而不是"离开页面" */
const mounted = new Map<object, string>();

export const videoDock = {
  register(owner: object) {
    mounted.set(owner, location.pathname);
  },
  unregister(owner: object) {
    mounted.delete(owner);
  },

  float(entry: Omit<DockEntry, 'owner'> & { owner: object }) {
    dropCurrent(entry.el);
    park(entry.el);
    set(entry);
  },

  /** owner 要把元素收回页面(调用方随后自己 appendChild) */
  unfloat(owner: object) {
    if (get()?.owner === owner) set(null);
  },

  isFloating(owner: object) {
    return get()?.owner === owner;
  },

  /** 播放器卸载:元素交给小窗 */
  orphan(owner: object, entry: Omit<DockEntry, 'owner' | 'onReturn' | 'onClose'>) {
    const cur = get();
    if (cur && cur.el !== entry.el) dropCurrent();
    // 已经在小窗里(滚出视口时浮出来的)就不用挪;还在页面里的必须先挪走,页面马上要被卸载
    if (cur?.el !== entry.el) park(entry.el);
    set({ ...entry, owner: null });
    const path = location.pathname;
    // 同一次提交里同页面又挂上了新的播放器(换集 / key 变了) → 这不是离开页面,
    // 旧的直接销毁,别在角落里接着响。
    queueMicrotask(() => {
      const e = get();
      if (e?.el !== entry.el) return;
      for (const [o, p] of mounted) {
        if (o !== owner && p === path && location.pathname === path) {
          videoDock.close();
          return;
        }
      }
    });
  },

  /** 回到原页面:按 key 把元素要回去 */
  take(key: string): DockEntry | null {
    const cur = get();
    if (!cur || cur.owner || !key || cur.key !== key) return null;
    set(null);
    return cur;
  },

  close() {
    dropCurrent();
  },
};

// ---------------------------------------------------------------------------
// 画中画 + 系统媒体控制
// ---------------------------------------------------------------------------

export function pipSupported(v?: HTMLVideoElement | null): boolean {
  if (typeof document === 'undefined') return false;
  if (document.pictureInPictureEnabled && !v?.disablePictureInPicture) return true;
  const w = v as any;
  return typeof w?.webkitSupportsPresentationMode === 'function' && w.webkitSupportsPresentationMode('picture-in-picture');
}

export function inPip(v: HTMLVideoElement | null): boolean {
  if (!v) return false;
  return document.pictureInPictureElement === v || (v as any).webkitPresentationMode === 'picture-in-picture';
}

export async function togglePip(v: HTMLVideoElement | null) {
  if (!v) return;
  const w = v as any;
  try {
    if (document.pictureInPictureElement === v) {
      await document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled) {
      await v.requestPictureInPicture();
    } else if (typeof w.webkitSetPresentationMode === 'function') {
      w.webkitSetPresentationMode(w.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
    }
  } catch (e) {
    console.warn('[pip]', e);
  }
}

/** 当前占着系统媒体控制的视频 */
let sessionEl: HTMLVideoElement | null = null;

/** 视频暂停:系统媒体控制显示为暂停(仍归它,锁屏上还能点播放) */
export function mediaSessionPaused(v: HTMLVideoElement) {
  if (sessionEl !== v || !('mediaSession' in navigator)) return;
  navigator.mediaSession.playbackState = 'paused';
}

/** 视频销毁:别让锁屏/系统控制上还挂着一个已经没了的视频 */
export function releaseMediaSession(v: HTMLVideoElement) {
  if (sessionEl !== v || !('mediaSession' in navigator)) return;
  sessionEl = null;
  const ms = navigator.mediaSession;
  ms.metadata = null;
  ms.playbackState = 'none';
  for (const action of ['play', 'pause', 'seekto', 'seekbackward', 'seekforward', 'stop', 'enterpictureinpicture']) {
    try {
      ms.setActionHandler(action as MediaSessionAction, null);
    } catch {
      /* ignore */
    }
  }
}

/** 视频开播时接管系统媒体控制;Chrome 切走标签页时会据此自动进画中画 */
export function claimMediaSession(v: HTMLVideoElement, title: string, poster?: string) {
  if (!('mediaSession' in navigator)) return;
  sessionEl = v;
  const ms = navigator.mediaSession;
  try {
    ms.metadata = new MediaMetadata({
      title: title || '清秋月',
      artist: '清秋月',
      artwork: poster ? [{ src: new URL(poster, location.href).href, sizes: '512x512' }] : [],
    });
    ms.playbackState = 'playing';
  } catch {
    /* ignore */
  }
  const handlers: Array<[string, MediaSessionActionHandler | null]> = [
    ['play', () => v.play().catch(() => {})],
    ['pause', () => v.pause()],
    ['seekto', (d) => { if (d.seekTime != null) v.currentTime = d.seekTime; }],
    ['seekbackward', () => { v.currentTime = Math.max(0, v.currentTime - 10); }],
    ['seekforward', () => { v.currentTime = v.currentTime + 10; }],
    ['previoustrack', null],
    ['nexttrack', null],
    ['stop', () => v.pause()],
    ['enterpictureinpicture', () => togglePip(v)],
  ];
  for (const [action, handler] of handlers) {
    try {
      ms.setActionHandler(action as MediaSessionAction, handler);
    } catch {
      /* 不支持的 action */
    }
  }
}
