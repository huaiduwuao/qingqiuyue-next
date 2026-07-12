'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/**
 * KpiCard — 活动页头部的 4 个统计小卡(图标 + 标签 + 数值 + 单位)。
 * 通用性足够,可被其他页面复用。
 */
export function KpiCard({
  icon,
  label,
  value,
  suffix,
  color,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  color: string;
  bg: string;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1,
          bgcolor: bg,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          '& .MuiSvgIcon-root': { fontSize: 20 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 10, color: 'text.disabled', mb: 0.25 }}>{label}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary', lineHeight: 1 }}>
            {value}
          </Typography>
          {suffix && (
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{suffix}</Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}
