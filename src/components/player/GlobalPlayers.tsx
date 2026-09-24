'use client';

import React, { Suspense, useEffect } from 'react';
import GlobalMusicBar from './GlobalMusicBar';
import FloatingVideoDock from './FloatingVideoDock';
import { installMediaCoordinator } from '@/lib/player/musicPlayer';
import PlayerBottomPad from './PlayerBottomPad';
import MusicNotice from './MusicNotice';

/** 挂在 Providers 里、跨路由常驻的播放器:音乐底栏 + 视频小窗 + 底部占位 */
export default function GlobalPlayers() {
  useEffect(() => installMediaCoordinator(), []);
  return (
    <>
      {/* useSearchParams 在静态导出下需要 Suspense 边界 */}
      <Suspense fallback={null}>
        <GlobalMusicBar />
      </Suspense>
      <MusicNotice />
      <FloatingVideoDock />
      {/* 页面底部留白,别让底栏盖住内容;渲染进 body 而不占 Providers 的盒子 */}
      <PlayerBottomPad />
    </>
  );
}
