'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupIcon from '@mui/icons-material/Group';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import BrushIcon from '@mui/icons-material/Brush';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import MovieIcon from '@mui/icons-material/Movie';
import { gradient2 } from '@/constants/gradients';
import { alpha } from '@mui/material/styles';

interface Bounty {
  id: string;
  title: string;
  category: 'video' | 'image' | 'novel' | 'art' | 'music' | 'film';
  reward: number;
  applicants: number;
  daysLeft: number;
  sponsor: string;
  gradient: string;
}

const HOT_BOUNTIES: Bounty[] = [
  {
    id: 'b1',
    title: '征集《夏日海岛》15秒竖屏短视频',
    category: 'video',
    reward: 5000,
    applicants: 128,
    daysLeft: 3,
    sponsor: '文旅中国',
    gradient: gradient2('#FE2C55', '#FF6B8A'),
  },
  {
    id: 'b2',
    title: '国风小说《长安月》同人插画征集',
    category: 'art',
    reward: 8000,
    applicants: 86,
    daysLeft: 7,
    sponsor: '起点中文网',
    gradient: gradient2('#8B5CF6', '#C084FC'),
  },
  {
    id: 'b3',
    title: '校园主题BGM原创音乐征集',
    category: 'music',
    reward: 3200,
    applicants: 54,
    daysLeft: 5,
    sponsor: '校园音乐计划',
    gradient: gradient2('#5DDB96', '#25F4EE'),
  },
  {
    id: 'b4',
    title: '《江南雨巷》30秒竖屏微短剧剧本',
    category: 'film',
    reward: 6500,
    applicants: 42,
    daysLeft: 10,
    sponsor: '东方卫视',
    gradient: gradient2('#FFB400', '#F59E0B'),
  },
  {
    id: 'b5',
    title: '城市夜景摄影九宫格挑战',
    category: 'image',
    reward: 1800,
    applicants: 96,
    daysLeft: 2,
    sponsor: '摄影之友',
    gradient: gradient2('#25F4EE', '#5DF7F2'),
  },
  {
    id: 'b6',
    title: '《云端恋人》长篇言情小说连载',
    category: 'novel',
    reward: 12000,
    applicants: 28,
    daysLeft: 14,
    sponsor: '番茄小说',
    gradient: gradient2('#FE2C55', '#8B5CF6'),
  },
];

const CATEGORY_ICON: Record<string, React.ReactElement> = {
  video: <VideoLibraryIcon sx={{ fontSize: 14 }} />,
  image: <PhotoLibraryIcon sx={{ fontSize: 14 }} />,
  novel: <MenuBookIcon sx={{ fontSize: 14 }} />,
  art: <BrushIcon sx={{ fontSize: 14 }} />,
  music: <MusicNoteIcon sx={{ fontSize: 14 }} />,
  film: <MovieIcon sx={{ fontSize: 14 }} />,
};

const CATEGORY_LABEL: Record<string, string> = {
  video: '短视频',
  image: '图文',
  novel: '小说',
  art: '画作',
  music: '音乐',
  film: '短剧',
};

const CATEGORY_COLOR: Record<string, string> = {
  video: 'primary.main',
  image: 'warning.main',
  novel: 'secondary.main',
  art: '#8B5CF6',
  music: 'success.main',
  film: '#F59E0B',
};

export default function RewardHotGrid() {
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1 }}>
          <WhatshotIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>热门悬赏</Typography>
          <Box
            sx={{
              px: 0.75,
              py: 0.125,
              borderRadius: 0.5,
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.15),
              color: 'primary.main',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            HOT
          </Box>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: 'pointer',
            color: 'text.secondary',
            '&:hover': { color: 'primary.main' },
          }}
        >
          <Typography sx={{ fontSize: 11 }}>查看全部</Typography>
          <ArrowForwardIosIcon sx={{ fontSize: 9 }} />
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 1.5,
        }}
      >
        {HOT_BOUNTIES.map((b) => (
          <Box
            key={b.id}
            sx={{
              position: 'relative',
              borderRadius: 1.5,
              overflow: 'hidden',
              bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF',
              border: '1px solid',
              borderColor: (theme) => theme.palette.mode === 'dark' ? '#252836' : '#E5E7EB',
              cursor: 'pointer',
              transition: 'all 0.25s',
              '&:hover': {
                transform: 'translateY(-3px)',
                borderColor: 'primary.main',
                boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
              },
            }}
          >
            <Box
              sx={{
                position: 'relative',
                aspectRatio: '16 / 9',
                background: b.gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.primary',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2), transparent 50%)',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 0.5,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(4px)',
                  color: 'text.primary',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                {CATEGORY_ICON[b.category]}
                {CATEGORY_LABEL[b.category]}
              </Box>
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 0.5,
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.9),
                  backdropFilter: 'blur(4px)',
                  color: (theme) => theme.palette.primary.contrastText,
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                }}
              >
                ¥{b.reward.toLocaleString('zh-CN')}
              </Box>
            </Box>

            <Box sx={{ p: 1.5 }}>
              <Typography
                sx={{
                  fontSize: 13,
                  color: 'text.primary',
                  fontWeight: 500,
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  minHeight: 36,
                }}
              >
                {b.title}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1, color: 'text.secondary' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <GroupIcon sx={{ fontSize: 12 }} />
                  <Typography sx={{ fontSize: 11 }}>{b.applicants}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <AccessTimeIcon sx={{ fontSize: 12 }} />
                  <Typography sx={{ fontSize: 11 }}>剩 {b.daysLeft} 天</Typography>
                </Box>
                <Box
                  sx={{
                    ml: 'auto',
                    px: 0.75,
                    py: 0.125,
                    borderRadius: 0.5,
                    bgcolor: `${CATEGORY_COLOR[b.category]}1F`,
                    color: CATEGORY_COLOR[b.category],
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {b.sponsor}
                </Box>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
