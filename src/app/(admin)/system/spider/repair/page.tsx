'use client';

/**
 * 内容修复 —— 多源聚合,补缺 + 纠错。
 * 与「内容补全」的分工:补全只补缺、不判断已有内容对不对;修复会多源比对。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ContentRepairPanel from '@/components/spider/ContentRepairPanel';

export default function SpiderRepairPage() {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>内容修复</Typography>
      <ContentRepairPanel />
    </Box>
  );
}
