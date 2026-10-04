'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import ShareTaskList from '@/components/share/ShareTaskList';
import { useResponsive } from '@/hooks/useResponsive';
import ShareTaskListMobile from './ShareTaskListMobile';

const PLATFORM_FILTERS = [
  { value: '', label: '全部' },
  { value: 'douyin', label: '抖音' },
  { value: 'kuaishou', label: '快手' },
];

export default function SharePage() {
  const [platform, setPlatform] = useState('');
  const { isMobile } = useResponsive();

  // 手机版:不重复页名和说明(顶部页签已写着「分发记录」),平台筛选是一行小胶囊。
  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Box sx={{ display: 'flex', gap: 0.75, px: 0.5 }}>
          {PLATFORM_FILTERS.map((p) => {
            const active = platform === p.value;
            return (
              <Box
                key={p.value || 'all'}
                component="button"
                type="button"
                onClick={() => setPlatform(p.value)}
                sx={{
                  all: 'unset',
                  cursor: 'pointer',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? 'primary.main' : 'text.secondary',
                  bgcolor: active ? 'action.selected' : 'background.paper',
                  border: '1px solid',
                  borderColor: active ? 'primary.main' : 'divider',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {p.label}
              </Box>
            );
          })}
        </Box>
        <ShareTaskListMobile platform={platform || undefined} limit={50} />
      </Box>
    );
  }

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
          {PLATFORM_FILTERS.map((p) => (
            <MenuItem key={p.value || 'all'} value={p.value}>
              {p.label}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <ShareTaskList platform={platform || undefined} limit={50} />
    </Box>
  );
}
