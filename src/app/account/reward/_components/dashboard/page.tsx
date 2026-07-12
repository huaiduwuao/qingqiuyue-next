'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import { userPointMe } from '@/apis/global';
import RewardHero from './RewardHero';
import RewardCategoryRow from './RewardCategoryRow';
import RewardFilterBar from './RewardFilterBar';
import RewardHotGrid from './RewardHotGrid';
import RewardRanking from './RewardRanking';
import RewardActivity from './RewardActivity';

interface DashboardProps {
  groupId: any;
  groupData: any;
}

export default function DashboardPage({ groupId, groupData }: DashboardProps) {
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState('reward');
  // 分类过滤统一用 code('' = 全部);分类行点击直接驱动同一状态
  const [filter, setFilter] = useState('');

  const pointQuery = useQuery({
    queryKey: ['user-point', 'me', 'reward'],
    queryFn: () => userPointMe({ type: 'reward' }).then((r: any) => r.data || {}),
    placeholderData: {},
  });
  const myPoint: any = pointQuery.data || {};

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <RewardHero
        totalPoint={myPoint.totalPoint}
        level={myPoint.level}
        levelName={myPoint.levelName}
        needPoint={myPoint.needPoint}
      />
      <RewardCategoryRow onSelect={(code) => setFilter(code)} selectedCode={filter} />
      <RewardFilterBar
        search={search}
        onSearchChange={setSearch}
        order={order}
        onOrderChange={setOrder}
        filter={filter}
        onFilterChange={setFilter}
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' },
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <RewardHotGrid search={search} order={order as any} filter={filter} />
          <RewardActivity />
        </Box>
        <Box sx={{ display: { xs: 'none', lg: 'block' }, width: 360, minWidth: 0 }}>
          <RewardRanking />
        </Box>
      </Box>
    </Box>
  );
}
