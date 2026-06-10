'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import DigitalHumanStudio from '@/digital-human/DigitalHumanStudio';

export default function SystemDigitalHumanPage() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary' }}>数字人工作台</Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
          素材 · 训练 · 发布全生命周期 · 训练资源 / 调度 / 模型服务管理
        </Typography>
      </Box>
      <DigitalHumanStudio />
    </Box>
  );
}
