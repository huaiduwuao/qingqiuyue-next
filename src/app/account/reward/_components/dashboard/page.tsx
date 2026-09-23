'use client';

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import { userPointMe } from '@/apis/global';
import { getMyStats, type MyStats } from '@/apis/dashboard';
import RewardHero from './RewardHero';
import RewardCategoryRow from './RewardCategoryRow';
import RewardHotGrid from './RewardHotGrid';
import BountyDetailDialog from './BountyDetailDialog';

interface DashboardProps {
  groupId: any;
  groupData: any;
}

// 赏金广场不依赖 groupId/groupData(赏金是公共数据,跨团队共享),
// 仅保留 props 接口以便父组件(AccountRewardPage)用同一 componentMap 装载 8 个 tab。
export default function DashboardPage(_props: DashboardProps) {
  // 首页右栏「社区悬赏」点过来带 ?tab=square&demand=<id>:直接弹开那张悬赏的详情。
  // 读完就从地址栏抹掉,刷新 / 分享都不会重复弹。
  const [demandId, setDemandId] = useState<string | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get('demand');
    if (!id) return;
    setDemandId(id);
    url.searchParams.delete('demand');
    window.history.replaceState(window.history.state, '', url.toString());
  }, []);

  const pointQuery = useQuery({
    queryKey: ['user-point', 'me', 'reward'],
    queryFn: () => userPointMe({ type: 'reward' }).then((r: any) => r || {}),
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

      {/* 全部悬赏(分页 + 无限滚动)。
          右侧的达人榜 / 最近动态搬去了 WorkspaceShell 的 aside 槽(见 RewardAside),
          这样左导航和右栏各自钉住、只滚中间列表;以前挤在一个 grid 里整页一起滚。 */}
      <RewardHotGrid mode='all' />

      {/* 深链打开的悬赏详情(社区悬赏点过来) */}
      <BountyDetailDialog open={!!demandId} bountyId={demandId} onClose={() => setDemandId(null)} />
    </Box>
  );
}