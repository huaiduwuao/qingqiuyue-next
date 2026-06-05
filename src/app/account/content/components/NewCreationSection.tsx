'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import VideocamIcon from '@mui/icons-material/Videocam';
import ImageIcon from '@mui/icons-material/Image';
import ThreeSixtyIcon from '@mui/icons-material/ThreeSixty';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { gradient2 } from '@/constants/gradients';

const CREATION_ITEMS = [
  {
    id: 'video',
    title: '发布视频',
    desc: '支持常用格式，推荐mp4、webm',
    icon: <VideocamIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#FE2C55', '#FF6B8A'),
  },
  {
    id: 'image',
    title: '发布图文',
    desc: '支持常用图片格式，png、jpg',
    icon: <ImageIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#25F4EE', '#5DF7F2'),
  },
  {
    id: 'panorama',
    title: '发布全景视频',
    desc: '推荐4K及以上分辨率',
    icon: <ThreeSixtyIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#FFB400', '#FFD566'),
  },
  {
    id: 'article',
    title: '发布文章',
    desc: '支持8000字文本和30个图片素材',
    icon: <DescriptionIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#8B5CF6', '#C4B5FD'),
  },
];

export default function NewCreationSection() {
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 2,
        p: 3,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 600, color: 'text.primary' }}>
          新的创作
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: 'pointer',
            color: 'text.secondary',
            fontSize: 12,
            '&:hover': { color: 'primary.main' },
          }}
        >
          <Typography sx={{ fontSize: 12 }}>查看全部</Typography>
          <ArrowForwardIosIcon sx={{ fontSize: 10 }} />
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
          gap: { xs: 1.5, md: 2 },
        }}
      >
        {CREATION_ITEMS.map((item) => (
          <Box
            key={item.id}
            sx={{
              p: 2.5,
              borderRadius: 2,
              bgcolor: '#1E2030',
              border: '1px solid',
              borderColor: 'divider',
              cursor: 'pointer',
              transition: 'all 0.25s ease-in-out',
              position: 'relative',
              overflow: 'hidden',
              '&:hover': {
                transform: 'translateY(-4px)',
                borderColor: 'primary.main',
                boxShadow: '0 8px 24px rgba(254, 44, 85, 0.15)',
                '& .creation-icon': {
                  transform: 'scale(1.1) rotate(-5deg)',
                },
              },
            }}
          >
            <Box
              className="creation-icon"
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                background: item.gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.primary',
                mb: 1.5,
                transition: 'transform 0.3s ease-in-out',
              }}
            >
              {item.icon}
            </Box>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
              {item.title}
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.5 }}>
              {item.desc}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
