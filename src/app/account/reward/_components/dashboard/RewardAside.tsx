'use client';

import React from 'react';
import Box from '@mui/material/Box';
import RewardRanking from './RewardRanking';
import RewardActivity from './RewardActivity';

/**
 * 赏金广场的右侧固定栏:悬赏达人榜 + 最近动态。
 *
 * 以前这两块跟悬赏列表挤在同一个 CSS Grid 里(左列表 + 右 360px),整页一起滚 ——
 * 悬赏翻到第 8 页时侧栏早不知道滚到哪去了。现在交给 WorkspaceShell 的 aside 槽,
 * 跟左侧导航一样钉在视口里,各自独立滚动,只有中间列表滚。
 */
export default function RewardAside() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: { lg: 360 } }}>
      <RewardRanking />
      <RewardActivity />
    </Box>
  );
}
