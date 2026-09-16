'use client';

import React, { Suspense, useEffect } from 'react';
import GlobalMusicBar from './GlobalMusicBar';
import FloatingVideoDock from './FloatingVideoDock';
import { installMediaCoordinator } from '@/lib/player/musicPlayer';

/** 挂在 Providers 里、跨路由常驻的播放器:音乐底栏 + 视频小窗 */
export default function GlobalPlayers() {
  useEffect(() => installMediaCoordinator(), []);
  return (
    <>
      {/* useSearchParams 在静态导出下需要 Suspense 边界 */}
      <Suspense fallback={null}>
        <GlobalMusicBar />
      </Suspense>
      <FloatingVideoDock />
    </>
  );
}
