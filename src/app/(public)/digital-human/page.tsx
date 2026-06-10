'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import DigitalHumanStage from '@/digital-human/DigitalHumanStage';

export default function DigitalHumanPage() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary' }}>数字人助理</Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
          语音/文字对话 · 可调用系统接口与跳转路由 · 动作/表情/口型驱动
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <DigitalHumanStage />
      </Box>
    </Box>
  );
}
