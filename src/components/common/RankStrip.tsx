'use client';

import type { ReactNode } from 'react';
import Box from '@mui/material/Box';

/**
 * 频道页的 TOP 10 榜单条:一行横滑的小海报。
 *
 * 以前放映厅/短剧的榜单是 5 列(手机 2 列)的大海报网格,10 张卡在手机上
 * 要占 5 屏,真正的片库被挤到很下面。榜单只是个"看一眼"的入口,一行就够。
 */
export function RankStrip({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridAutoFlow: 'column',
        gridAutoColumns: { xs: 100, sm: 112, md: 124 },
        gap: 1,
        overflowX: 'auto',
        overscrollBehaviorX: 'contain',
        scrollSnapType: 'x proximity',
        pb: 0.5,
        '& > *': { scrollSnapAlign: 'start' },
        // 桌面端鼠标没法横滑,留一条细滚动条当提示和把手。
        scrollbarWidth: 'thin',
      }}
    >
      {children}
    </Box>
  );
}
