'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
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

// 分类 chip:code 与后端/需求表 category 对齐;'' = 全部
const FILTERS: Array<{ code: string; label: string }> = [
  { code: '', label: '全部' },
  { code: 'video', label: '短视频' },
  { code: 'image', label: '图文' },
  { code: 'novel', label: '小说' },
  { code: 'art', label: '画作' },
  { code: 'music', label: '音乐' },
  { code: 'film', label: '短剧' },
  { code: 'live', label: '直播' },
  { code: 'voice', label: '配音' },
];

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
        borderColor: 'divider',
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
            bgcolor: 'background.paper',
            color: 'text.primary',
            fontSize: 12,
            '& fieldset': { borderColor: 'divider' },
            '&:hover fieldset': { borderColor: 'primary.main' },
            '&.Mui-focused fieldset': { borderColor: 'primary.main' },
          },
        }}
      />

      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', flex: 1 }}>
        {FILTERS.map((f) => {
          const selected = filter === f.code;
          return (
            <Box
              key={f.code}
              onClick={() => onFilterChange(f.code)}
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                bgcolor: selected ? 'primary.main' : 'transparent',
                color: selected ? '#fff' : 'text.secondary',
                border: '1px solid',
                borderColor: selected ? 'primary.main' : 'divider',
                boxShadow: selected
                  ? (theme) => `0 4px 12px ${alpha(theme.palette.primary.main, 0.35)}`
                  : 'none',
                '&:hover': selected
                  ? { filter: 'brightness(1.08)' }
                  : { color: 'text.primary', borderColor: 'primary.main', bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06) },
              }}
            >
              {f.label}
            </Box>
          );
        })}
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
