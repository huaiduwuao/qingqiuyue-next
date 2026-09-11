'use client';

import React from 'react';
import Box from '@mui/material/Box';
import DataOverviewCard from '../../_components/DataOverviewCard';
import TrendChart from '../../_components/TrendChart';
import FanPortrait from '../../_components/FanPortrait';
import ContentDistributionChart from '../../_components/ContentDistributionChart';
import TopPerformingContent from '../../_components/TopPerformingContent';

/** 数据中心:总览 → 趋势与粉丝 → 内容分布与表现最好的作品。 */
export default function DataCenterPage() {
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
