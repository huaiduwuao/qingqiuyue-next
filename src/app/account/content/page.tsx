'use client';

import React from 'react';
import Box from '@mui/material/Box';
import CreatorProfileHeader from './components/CreatorProfileHeader';
import NewCreationSection from './components/NewCreationSection';
import DataOverviewCard from './components/DataOverviewCard';
import ContentDistributionChart from './components/ContentDistributionChart';
import TrendChart from './components/TrendChart';
import FanPortrait from './components/FanPortrait';
import TopPerformingContent from './components/TopPerformingContent';
import HotTopicsCarousel from './components/HotTopicsCarousel';

export default function CreatorHomePage() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <CreatorProfileHeader />
      <NewCreationSection />

      {/* Data + Distribution row */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
        }}
      >
        <DataOverviewCard />
        <ContentDistributionChart />
      </Box>

      {/* Trend + Fan Portrait row */}
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

      {/* Top performing content */}
      <TopPerformingContent />

      {/* Hot topics */}
      <HotTopicsCarousel />
    </Box>
  );
}
