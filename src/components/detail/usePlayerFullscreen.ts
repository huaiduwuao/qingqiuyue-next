'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useBackClose } from '@/lib/backStack';
import { authPlatform } from '@/lib/clientAuth';
import { nativeScreen } from './videoPlayerUtils';

/**
 * 全屏,按能用的顺序:
 *   1. 元素全屏(桌面、安卓 Chrome);横屏视频顺手把屏幕锁成横向
 *   2. iPhone Safari 只能让 <video> 自己全屏(系统播放器)
 *   3. 都不行 → 页内全屏:把 <video> 挪进 body 下的铺满浮层。安卓客户端一律走这条 ——
 *      WebView 的元素全屏要壳实现 onShowCustomView,wry 没有,按了没反应;这时还让原生壳横屏、藏系统栏
 */
export function usePlayerFullscreen(
  videoRef: RefObject<HTMLVideoElement | null>,
  containerRef: RefObject<HTMLDivElement | null>,
  hostRef: RefObject<HTMLDivElement | null>,
) {
  const [nativeFs, setNativeFs] = useState(false);
  const [pseudoFs, setPseudoFs] = useState(false);
  const fsHostRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const on = () => setNativeFs(!!document.fullscreenElement && document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
    // containerRef 是 ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const exitPseudoFs = useCallback(() => {
    // 先把 <video> 放回页面里的占位,再卸浮层:同一个任务里挪动不会打断播放
    const v = videoRef.current;
    if (v && hostRef.current && v.parentNode !== hostRef.current) hostRef.current.appendChild(v);
    nativeScreen()?.setFullscreen?.(false, false);
    setPseudoFs(false);
  }, [videoRef, hostRef]);
  const fsHostCallback = useCallback(
    (node: HTMLDivElement | null) => {
      fsHostRef.current = node;
      const v = videoRef.current;
      if (node && v && v.parentNode !== node) node.appendChild(v);
    },
    [videoRef],
  );
  useBackClose(pseudoFs, exitPseudoFs);
  const goFullscreen = useCallback(async () => {
    const isLandscapeVideo = () => {
      const v = videoRef.current;
      return !v || !v.videoWidth || v.videoWidth >= v.videoHeight;
    };
    if (pseudoFs) {
      exitPseudoFs();
      return;
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    const el = containerRef.current;
    const androidApp = authPlatform() === 'android';
    if (!androidApp && el?.requestFullscreen && document.fullscreenEnabled) {
      try {
        await el.requestFullscreen({ navigationUI: 'hide' });
        if (isLandscapeVideo()) {
          (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.('landscape')?.catch(() => {});
        }
        return;
      } catch {
        /* 走下面的退路 */
      }
    }
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!androidApp && !document.fullscreenEnabled && v?.webkitEnterFullscreen) {
      try {
        v.webkitEnterFullscreen();
        return;
      } catch {
        /* 走页内全屏 */
      }
    }
    nativeScreen()?.setFullscreen?.(true, isLandscapeVideo());
    setPseudoFs(true);
  }, [pseudoFs, exitPseudoFs, videoRef, containerRef]);
  const isFs = nativeFs || pseudoFs;
  return { pseudoFs, isFs, fsHostRef, fsHostCallback, exitPseudoFs, goFullscreen };
}
