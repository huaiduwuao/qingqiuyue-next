'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { alpha } from '@mui/material/styles';

const ORDERS = [
  { id: 'reward', label: '赏金最高', icon: <ArrowUpwardIcon sx={{ fontSize: 12 }} /> },
  { id: 'deadline', label: '即将截止', icon: <ArrowDownwardIcon sx={{ fontSize: 12 }} /> },
  { id: 'hot', label: '最热门', icon: <ArrowUpwardIcon sx={{ fontSize: 12 }} /> },
  { id: 'newest', label: '最新发布', icon: <ArrowDownwardIcon sx={{ fontSize: 12 }} /> },
];

const FILTERS = ['全部', '短视频', '图文', '小说', '画作', '音乐', '短剧', '直播', '配音'];

export default function RewardFilterBar({
  search,
  onSearchChange,
  order,
  onOrderChange,
  filter,
  onFilterChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  order: string;
  onOrderChange: (v: string) => void;
  filter: string;
  onFilterChange: (v: string) => void;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: (theme) => theme.palette.mode === 'dark' ? '#252836' : '#E5E7EB',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 1.5,
        alignItems: { md: 'center' },
      }}
    >
      <TextField
        size="small"
        placeholder="搜索悬赏关键词..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{
          minWidth: { md: 240 },
          '& .MuiOutlinedInput-root': {
            bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF',
            color: 'text.primary',
            fontSize: 12,
            '& fieldset': { borderColor: 'divider' },
            '&:hover fieldset': { borderColor: 'primary.main' },
            '&.Mui-focused fieldset': { borderColor: 'primary.main' },
          },
        }}
      />

      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', flex: 1 }}>
        {FILTERS.map((f) => (
          <Box
            key={f}
            onClick={() => onFilterChange(f)}
            sx={{
              px: 1.25,
              py: 0.5,
              borderRadius: 1.5,
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              bgcolor: filter === f
                ? (theme) => alpha(theme.palette.primary.main, 0.15)
                : 'transparent',
              color: filter === f ? 'primary.main' : 'text.secondary',
              border: '1px solid',
              borderColor: filter === f
                ? (theme) => alpha(theme.palette.primary.main, 0.3)
                : 'divider',
              '&:hover': {
                color: 'text.primary',
                borderColor: 'primary.main',
              },
            }}
          >
            {f}
          </Box>
        ))}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <FilterListIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>排序:</Typography>
        {ORDERS.map((o) => (
          <Box
            key={o.id}
            onClick={() => onOrderChange(o.id)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
              px: 1,
              py: 0.5,
              borderRadius: 1,
              fontSize: 11,
              cursor: 'pointer',
              bgcolor: order === o.id ? 'rgba(37, 244, 238, 0.12)' : 'transparent',
              color: order === o.id ? 'secondary.main' : 'text.secondary',
              '&:hover': { color: 'text.primary' },
            }}
          >
            {o.icon}
            {o.label}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
