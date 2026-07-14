'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import { userPointMe } from '@/apis/global';
import { getMyStats, type MyStats } from '@/apis/dashboard';
import RewardHero from './RewardHero';
import RewardCategoryRow from './RewardCategoryRow';
import RewardHotGrid from './RewardHotGrid';
import RewardRanking from './RewardRanking';
import RewardActivity from './RewardActivity';

interface DashboardProps {
  groupId: any;
  groupData: any;
}

// 赏金广场不依赖 groupId/groupData(赏金是公共数据,跨团队共享),
// 仅保留 props 接口以便父组件(AccountRewardPage)用同一 componentMap 装载 8 个 tab。
export default function DashboardPage(_props: DashboardProps) {
  const pointQuery = useQuery({
    queryKey: ['user-point', 'me', 'reward'],
    queryFn: () => userPointMe({ type: 'reward' }).then((r: any) => r.data || {}),
    placeholderData: {},
  });
  const myPoint: any = pointQuery.data || {};

  // 我的赏金统计(真实数据,替代硬编码)
  const myStatsQuery = useQuery({
    queryKey: ['reward', 'my-stats', 'dashboard'],
    queryFn: () => getMyStats(),
    placeholderData: {} as MyStats,
    staleTime: 30 * 1000,
  });
  const myStats: Partial<MyStats> = myStatsQuery.data || {};

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <RewardHero
        totalPoint={myPoint.totalPoint}
        level={myPoint.level}
        levelName={myPoint.levelName}
        needPoint={myPoint.needPoint}
        // 真实 KPI 数据
        todayRewardYuan={myStats.todayRewardYuan}
        adoptedCount={myStats.adoptedCount}
        rankingPosition={myStats.rankingPosition}
        totalIncomeYuan={myStats.totalIncomeYuan}
      />
      <RewardCategoryRow />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' },
          gap: 2,
        }}
      >
        {/* 左侧:全部悬赏(分页,无「查看全部」跳转) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <RewardHotGrid mode='all' />
        </Box>

        {/* 右侧:达人榜 + 最近动态 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <RewardRanking />
          <RewardActivity />
        </Box>
      </Box>
    </Box>
  );
}