'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import ShareTaskList from '@/components/share/ShareTaskList';

export default function SharePage() {
  const [platform, setPlatform] = useState('');
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        发布记录
      </Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
        你把站内专题/作品分享到抖音/快手的发布历史;失败的可以重发。
      </Typography>

      <Box sx={{ mb: 2, maxWidth: 240 }}>
        <TextField
          select
          size="small"
          fullWidth
          label="平台筛选"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
        >
          <MenuItem value="">全部</MenuItem>
          <MenuItem value="douyin">抖音</MenuItem>
          <MenuItem value="kuaishou">快手</MenuItem>
        </TextField>
      </Box>

      <ShareTaskList platform={platform || undefined} limit={50} />
    </Box>
  );
}