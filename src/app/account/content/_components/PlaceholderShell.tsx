'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import HdRoundedIcon from '@mui/icons-material/Hd';

/**
 * PlaceholderShell — 6+ 个内容发布 placeholder view 复用的"开发中"骨架。
 *
 * 历史上 novel/news/music/comics/vshow/teleplay/image-mv 7 个 view 都是
 * placeholder,各自写一遍同样的"开发中"提示 + 2 个回退按钮代码重复。
 * 抽到 _components 统一渲染,view 只传 title/desc/icon/gradient。
 *
 * 后续每个 placeholder 升级成真实表单时,把这个 view 改成正常的 form UI,
 * PlaceholderShell 就不再被引用。
 */
export default function PlaceholderShell({
  title,
  subtitle,
  gradient,
  icon,
  desc,
  setActiveTab,
  fallbackTab = 'hd-publish',
  fallbackLabel = '去视频发布',
}: {
  title: string;
  subtitle: string;
  gradient: string;
  icon: React.ReactNode;
  desc: React.ReactNode;
  setActiveTab: (id: string, params?: Record<string, string>) => void;
  fallbackTab?: string;
  fallbackLabel?: string;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.paper',
        borderRadius: 2,
        border: '1px dashed',
        borderColor: 'divider',
        p: 6,
        minHeight: 480,
      }}
    >
      <Box
        sx={{
          width: 88,
          height: 88,
          borderRadius: '50%',
          background: gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0F172A',
          mb: 2.5,
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
        }}
      >
        {icon}
      </Box>

      <Typography sx={{ fontSize: 22, fontWeight: 700, color: 'text.primary', mb: 1 }}>
        {title}
      </Typography>

      <Chip
        label={subtitle}
        size="small"
        sx={{
          mb: 2,
          fontSize: 10,
          fontWeight: 600,
          bgcolor: 'action.hover',
          color: 'text.secondary',
        }}
      />

      <Typography
        sx={{
          fontSize: 13,
          color: 'text.secondary',
          textAlign: 'center',
          maxWidth: 460,
          lineHeight: 1.8,
          mb: 3.5,
        }}
      >
        {desc}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackRoundedIcon />}
          onClick={() => setActiveTab('content')}
          sx={{ textTransform: 'none', fontSize: 13 }}
        >
          返回工作台
        </Button>
        <Button
          variant="contained"
          startIcon={<HdRoundedIcon />}
          onClick={() => setActiveTab(fallbackTab, { type: 'video' })}
          sx={{
            textTransform: 'none',
            fontSize: 13,
            background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
            '&:hover': { filter: 'brightness(1.08)' },
          }}
        >
          {fallbackLabel}
        </Button>
      </Box>
    </Box>
  );
}
