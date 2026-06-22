'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ThumbUpAltIcon from '@mui/icons-material/ThumbUpAlt';
import ModeCommentIcon from '@mui/icons-material/ModeComment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import MovieIcon from '@mui/icons-material/Movie';
import ImageIcon from '@mui/icons-material/Image';
import VideocamIcon from '@mui/icons-material/Videocam';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { gradient2, gradient3, CTA_GRADIENT } from '@/constants/gradients';

interface Item {
  id: number;
  rank: number;
  type: 'video' | 'image' | 'live';
  title: string;
  thumbnail: string;
  views: number;
  likes: number;
  comments: number;
  completion: number;
  delta: number;
  publishedAt: string;
  duration?: string;
}

const ITEMS: Item[] = [
  {
    id: 1,
    rank: 1,
    type: 'video',
    title: '夏日海边vlog｜这个夏天最治愈的5个瞬间',
    thumbnail: gradient3('#FE2C55', '#FF6B8A', '#FFB400'),
    views: 1284932,
    likes: 89432,
    comments: 3211,
    completion: 78.4,
    delta: 312,
    publishedAt: '5/30',
    duration: '02:34',
  },
  {
    id: 2,
    rank: 2,
    type: 'image',
    title: '小红书同款｜夏日穿搭合集',
    thumbnail: gradient3('#25F4EE', '#5DF7F2', '#8B5CF6'),
    views: 423891,
    likes: 32104,
    comments: 1287,
    completion: 92.1,
    delta: 89,
    publishedAt: '5/28',
  },
  {
    id: 3,
    rank: 3,
    type: 'video',
    title: '挑战全网最辣螺蛳粉！结果我输了…',
    thumbnail: gradient3('#FFB400', '#FE2C55', '#8B5CF6'),
    views: 287432,
    likes: 21890,
    comments: 2143,
    completion: 65.8,
    delta: -12,
    publishedAt: '5/26',
    duration: '04:12',
  },
  {
    id: 4,
    rank: 4,
    type: 'video',
    title: '10分钟学会 3 道快手早餐｜上班族必看',
    thumbnail: gradient2('#5DDB96', '#25F4EE'),
    views: 198234,
    likes: 15672,
    comments: 876,
    completion: 81.2,
    delta: 42,
    publishedAt: '5/24',
    duration: '10:08',
  },
  {
    id: 5,
    rank: 5,
    type: 'live',
    title: '直播回放｜深夜电台·聊聊最近的生活',
    thumbnail: gradient2('#8B5CF6', '#FE2C55'),
    views: 87432,
    likes: 12340,
    comments: 4532,
    completion: 0,
    delta: 18,
    publishedAt: '5/22',
    duration: '01:23:45',
  },
];

const TypeIcon = ({ type }: { type: Item['type'] }) => {
  if (type === 'video') return <VideocamIcon sx={{ fontSize: 12 }} />;
  if (type === 'image') return <ImageIcon sx={{ fontSize: 12 }} />;
  return <MovieIcon sx={{ fontSize: 12 }} />;
};

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  return n.toString();
}

const RANK_COLORS = ['primary.main', '#FF6B8A', 'warning.main', 'secondary.light', 'text.disabled'];

export default function TopPerformingContent() {
  const [expanded, setExpanded] = useState<number | null>(1);

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 2,
        p: 3,
        border: '1px solid',
        borderColor: 'divider',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary', flex: 1 }}>
          优质作品榜
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>近 7 日</Typography>
      </Box>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 2 }}>
        表现最好的 5 个作品及关键指标
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
        {ITEMS.map((item) => {
          const isOpen = expanded === item.id;
          const deltaUp = item.delta > 0;
          return (
            <Box
              key={item.id}
              onClick={() => setExpanded(isOpen ? null : item.id)}
              sx={{
                display: 'flex',
                gap: 1.5,
                p: 1,
                borderRadius: 1.5,
                bgcolor: isOpen
                  ? (theme) => (theme.palette.mode === 'dark' ? '#1E2030' : 'action.hover')
                  : 'transparent',
                border: '1px solid',
                borderColor: isOpen ? 'rgba(254, 44, 85, 0.4)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover',
                },
              }}
            >
              {/* Rank */}
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: 0.5,
                  bgcolor: RANK_COLORS[item.rank - 1] || 'text.disabled',
                  color: item.rank <= 3 ? 'text.primary' : 'background.default',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {item.rank}
              </Box>

              {/* Thumbnail */}
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 1,
                  background: item.thumbnail,
                  flexShrink: 0,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'text.primary',
                }}
              >
                <TypeIcon type={item.type} />
                {item.duration && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 2,
                      right: 2,
                      px: 0.5,
                      py: 0.125,
                      borderRadius: 0.5,
                      bgcolor: 'rgba(0, 0, 0, 0.6)',
                      color: 'text.primary',
                      fontSize: 9,
                      fontFamily: 'monospace',
                    }}
                  >
                    {item.duration}
                  </Box>
                )}
              </Box>

              {/* Info */}
              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography
                  sx={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'text.primary',
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {item.title}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: 'text.secondary' }}>
                    <VisibilityIcon sx={{ fontSize: 11 }} />
                    <Typography sx={{ fontSize: 10, fontFamily: 'monospace' }}>{formatCount(item.views)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: 'text.secondary' }}>
                    <ThumbUpAltIcon sx={{ fontSize: 11 }} />
                    <Typography sx={{ fontSize: 10, fontFamily: 'monospace' }}>{formatCount(item.likes)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: 'text.secondary' }}>
                    <ModeCommentIcon sx={{ fontSize: 11 }} />
                    <Typography sx={{ fontSize: 10, fontFamily: 'monospace' }}>{formatCount(item.comments)}</Typography>
                  </Box>
                  <Box sx={{ flex: 1 }} />
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.25,
                      color: deltaUp ? 'success.main' : 'primary.main',
                    }}
                  >
                    {deltaUp ? <TrendingUpIcon sx={{ fontSize: 11 }} /> : <TrendingDownIcon sx={{ fontSize: 11 }} />}
                    <Typography sx={{ fontSize: 10, fontWeight: 600, fontFamily: 'monospace' }}>
                      {deltaUp ? '+' : ''}
                      {item.delta}%
                    </Typography>
                  </Box>
                </Box>

                {isOpen && item.completion > 0 && (
                  <Box sx={{ mt: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
                      <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>完播率</Typography>
                      <Typography sx={{ fontSize: 9, color: 'warning.main', fontFamily: 'monospace' }}>
                        {item.completion}%
                      </Typography>
                    </Box>
                    <Box sx={{ height: 3, bgcolor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                      <Box
                        sx={{
                          width: `${item.completion}%`,
                          height: '100%',
                          background: CTA_GRADIENT.YELLOW_RED,
                          borderRadius: 1,
                        }}
                      />
                    </Box>
                  </Box>
                )}
              </Box>

              <MoreHorizIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0, alignSelf: 'flex-start' }} />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
