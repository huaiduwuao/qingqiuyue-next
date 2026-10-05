'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import type { HdStats } from './hdPublishModel';

/** VIDEO 类型顶部统计卡片:今日上传 / 极速通道剩余。 */
export const HdStatCards = React.memo(function HdStatCards({ stats }: { stats: HdStats }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        gap: 2,
      }}
    >
      {[
        { label: '今日上传', value: String(stats.todayUploads), suffix: '个', icon: <CloudUploadRoundedIcon />, color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)' },
        { label: '极速通道剩余', value: `${stats.fastChannelQuota}`, suffix: `/${stats.fastChannelMonthly} 次`, icon: <RocketLaunchRoundedIcon />, color: 'var(--fg-amber)', bg: 'rgba(255, 180, 0, 0.12)' },
      ].map((s) => (
        <Box
          key={s.label}
          sx={{
            p: 2.5,
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: -20,
              right: -20,
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: s.bg,
              filter: 'blur(20px)',
            }}
          />
          <Box sx={{ position: 'relative' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1,
                  bgcolor: s.bg,
                  color: s.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {s.icon}
              </Box>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s.label}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Typography sx={{ fontSize: 26, fontWeight: 700, color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
                {s.value}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>{s.suffix}</Typography>
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
});
