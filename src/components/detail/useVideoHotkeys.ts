'use client';

import { useEffect, type RefObject } from 'react';
import { typingTarget } from './videoPlayerUtils';

/**
 * 键盘快捷键归哪个播放器:最近点过 / 最近开播的那个。一页可能有多个播放器(详情页 + 推荐卡片),
 * 按键只给一个,不然按一下 ← 所有视频一起退。
 */
export const hotkeyOwner: { current: object | null } = { current: null };

export type VideoHotkeyActions = {
  seek: (delta: number) => void;
  togglePlay: () => void;
  goFullscreen: () => Promise<void> | void;
  toggleMute: () => void;
};

/**
 * 键盘:← / → 退进 5 秒,空格 / K 播放暂停,M 静音,F 全屏。
 * fill(推荐流)不接:RecommendVideoFeed 自己在 window 上管按键(含 ↑↓ 切条),两边都接会退两次。
 * 挂在 window 上而不是容器上:点过播放器之后焦点多半落在控制条按钮或 body 上,
 * 只认容器焦点的话"点一下再按 →"经常没反应。归属见 hotkeyOwner。
 * actions 是每次渲染都刷新的 ref,按键时取最新的回调。
 */
export function useVideoHotkeys(fill: boolean, owner: object, videoRef: RefObject<HTMLVideoElement | null>, actions: RefObject<VideoHotkeyActions>) {
  useEffect(() => {
    if (fill) return;
    if (!hotkeyOwner.current) hotkeyOwner.current = owner;
    const onKey = (e: KeyboardEvent) => {
      if (hotkeyOwner.current !== owner || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!videoRef.current || typingTarget(e.target)) return;
      const k = actions.current;
      switch (e.key) {
        case 'ArrowLeft':
          k.seek(-5);
          break;
        case 'ArrowRight':
          k.seek(5);
          break;
        case ' ':
        case 'k':
        case 'K':
          k.togglePlay();
          break;
        case 'm':
        case 'M':
          k.toggleMute();
          break;
        case 'f':
        case 'F':
          void k.goFullscreen();
          break;
        default:
          return;
      }
      // 空格默认会滚页面,还会再"点"一次聚焦着的控制条按钮(刚暂停又被按钮切回播放)
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (hotkeyOwner.current === owner) hotkeyOwner.current = null;
    };
    // videoRef / actions 是 ref,和原来一样只随 fill / owner 重新挂
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fill, owner]);
}
