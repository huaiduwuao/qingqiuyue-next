'use client';

import React from 'react';
import Box from '@mui/material/Box';
import DataOverviewCard from '../../_components/DataOverviewCard';
import TrendChart from '../../_components/TrendChart';
import FanPortrait from '../../_components/FanPortrait';
import ContentDistributionChart from '../../_components/ContentDistributionChart';
import TopPerformingContent from '../../_components/TopPerformingContent';
import { useResponsive } from '@/hooks/useResponsive';
import DataCenterMobile from './DataCenterMobile';

/** 数据中心:总览 → 趋势与粉丝 → 内容分布与表现最好的作品。 */
export default function DataCenterPage() {
  const { isMobile } = useResponsive();
  // 手机:四个数一行 + 一张紧凑趋势图 + 列表,单独设计,见 DataCenterMobile
  if (isMobile) return <DataCenterMobile />;

  return (
    <>
      <DataOverviewCard />

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' } }}>
        <TrendChart />
        <FanPortrait />
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <ContentDistributionChart />
        <TopPerformingContent />
      </Box>
    </>
  );
}
