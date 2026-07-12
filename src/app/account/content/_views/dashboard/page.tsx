'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CreatorProfileHeader from '../../_components/CreatorProfileHeader';
import NewCreationSection from '../../_components/NewCreationSection';
import DataOverviewCard from '../../_components/DataOverviewCard';
import ContentDistributionChart from '../../_components/ContentDistributionChart';
import TrendChart from '../../_components/TrendChart';
import FanPortrait from '../../_components/FanPortrait';
import HotTopicsCarousel from '../../_components/HotTopicsCarousel';

function SectionHeader({
  step,
  title,
  subtitle,
  hint,
}: {
  step: number;
  title: string;
  subtitle?: string;
  hint?: string;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, mb: 1.5, mt: 1 }}>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: 1,
          bgcolor: 'rgba(254, 44, 85, 0.12)',
          color: 'primary.main',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {step}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 17, fontWeight: 700, color: 'text.primary' }}>{title}</Typography>
          {subtitle && (
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>· {subtitle}</Typography>
          )}
        </Box>
      </Box>
      {hint && (
        <Chip
          size="small"
          label={hint}
          sx={{
            height: 20,
            fontSize: 10,
            fontWeight: 600,
            bgcolor: 'action.hover',
            color: 'text.secondary',
          }}
        />
      )}
    </Box>
  );
}

export default function CreatorHomePage() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 1400, mx: 'auto', width: '100%', pb: 4 }}>
      {/* Hero — 创作者档案 */}
      <CreatorProfileHeader />

      {/* Step 1 · 灵感 → 选题 */}
      <Box>
        <SectionHeader step={1} title="灵感发现" subtitle="找到本周热点话题" hint="数据每 30 分钟更新" />
        <HotTopicsCarousel />
      </Box>

      {/* Step 2 · 创作开始 */}
      <Box>
        <SectionHeader step={2} title="开始创作" subtitle="发布短视频 / 图文 / 直播" hint="支持草稿暂存" />
        <NewCreationSection />
      </Box>

      {/* Step 3 · 数据洞察 */}
      <Box>
        <SectionHeader step={3} title="数据洞察" subtitle="作品表现 + 粉丝画像" />
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
            mb: 2,
          }}
        >
          <DataOverviewCard />
          <ContentDistributionChart />
        </Box>
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
      </Box>
    </Box>
  );
}
