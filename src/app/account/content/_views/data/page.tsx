'use client';

import React from 'react';
import Box from '@mui/material/Box';
import DataOverviewCard from '../../_components/DataOverviewCard';
import TrendChart from '../../_components/TrendChart';
import FanPortrait from '../../_components/FanPortrait';
import ContentDistributionChart from '../../_components/ContentDistributionChart';

export default function DataCenterPage() {
  return (
    <>
      <DataOverviewCard />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
        }}
      >
        <TrendChart />
        <FanPortrait />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
        }}
      >
        <ContentDistributionChart />
        <FanPortrait />
      </Box>
    </>
  );
}
