'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import BrushIcon from '@mui/icons-material/Brush';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import MicIcon from '@mui/icons-material/Mic';
import MovieIcon from '@mui/icons-material/Movie';
import CodeIcon from '@mui/icons-material/Code';
import LiveTvIcon from '@mui/icons-material/LiveTv';

const CATEGORIES = [
  { id: 'video', label: '短视频', icon: <VideoLibraryIcon sx={{ fontSize: 22 }} />, color: 'primary.main', count: 128 },
  { id: 'image', label: '图文', icon: <PhotoLibraryIcon sx={{ fontSize: 22 }} />, color: 'warning.main', count: 86 },
  { id: 'novel', label: '小说', icon: <MenuBookIcon sx={{ fontSize: 22 }} />, color: 'secondary.main', count: 64 },
  { id: 'art', label: '画作', icon: <BrushIcon sx={{ fontSize: 22 }} />, color: '#8B5CF6', count: 42 },
  { id: 'music', label: '音乐', icon: <MusicNoteIcon sx={{ fontSize: 22 }} />, color: 'success.main', count: 31 },
  { id: 'voice', label: '配音', icon: <MicIcon sx={{ fontSize: 22 }} />, color: '#FF6B8A', count: 24 },
  { id: 'film', label: '短剧', icon: <MovieIcon sx={{ fontSize: 22 }} />, color: 'secondary.light', count: 19 },
  { id: 'live', label: '直播', icon: <LiveTvIcon sx={{ fontSize: 22 }} />, color: '#F59E0B', count: 12 },
  { id: 'code', label: '代码', icon: <CodeIcon sx={{ fontSize: 22 }} />, color: '#A78BFA', count: 8 },
];

export default function RewardCategoryRow({ onSelect }: { onSelect?: (id: string) => void }) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: (theme) => theme.palette.mode === 'dark' ? '#252836' : '#E5E7EB',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', flex: 1 }}>
          悬赏分类
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>共 {CATEGORIES.reduce((a, b) => a + b.count, 0)} 个进行中</Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(4, 1fr)', sm: 'repeat(5, 1fr)', md: 'repeat(9, 1fr)' },
          gap: 1,
        }}
      >
        {CATEGORIES.map((c) => (
          <Box
            key={c.id}
            onClick={() => onSelect?.(c.id)}
            sx={{
              cursor: 'pointer',
              textAlign: 'center',
              p: 1,
              borderRadius: 1.5,
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'action.hover',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                mx: 'auto',
                borderRadius: 1.5,
                bgcolor: `${c.color}1F`,
                color: c.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 0.75,
                position: 'relative',
              }}
            >
              {c.icon}
              {c.count > 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    bgcolor: 'primary.main',
                    color: 'text.primary',
                    fontSize: 9,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: 0.5,
                  }}
                >
                  {c.count > 99 ? '99+' : c.count}
                </Box>
              )}
            </Box>
            <Typography sx={{ fontSize: 11, color: 'text.tertiary', lineHeight: 1.2 }}>{c.label}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
