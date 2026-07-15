'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { useRouter } from 'next/navigation';
import { getDetailRoute } from '@/lib/contentRoute';
import { CTA_GRADIENT } from '@/constants/gradients';
import { getTopPerformingContent, type TopPerformingItem as ApiItem } from '@/apis/dashboard';

type Item = ApiItem;

const TypeIcon = ({ type }: { type: Item['type'] }) => {
  if (type === 'video') return <VideocamIcon sx={{ fontSize: 12 }} />;
  if (type === 'image') return <ImageIcon sx={{ fontSize: 12 }} />;
  return <MovieIcon sx={{ fontSize: 12 }} />;
};

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  return n.toString();
}

const typeToContentType = (type: Item['type']): string => {
  if (type === 'video') return 'VIDEO';
  if (type === 'image') return 'ARTICLE';
  return 'LIVE';
};

const RANK_COLORS = ['primary.main', '#FF6B8A', 'warning.main', 'secondary.light', 'text.disabled'];

export default function TopPerformingContent() {
  const router = useRouter();
  const [expanded, setExpanded] = useState<number | null>(1);

  // 优质作品榜 — 真接口
  const itemsQuery = useQuery({
    queryKey: ['creator-content-top-performing', 7],
    queryFn: () => getTopPerformingContent({ days: 7, pageSize: 5 }).then((r) => r.list || []),
    placeholderData: [],
  });
  const ITEMS: Item[] = (itemsQuery.data ?? []) as Item[];

  const handleClick = (item: Item) => {
    const route = getDetailRoute(typeToContentType(item.type), item.id);
    if (route) router.push(route);
    else setExpanded(expanded === item.id ? null : item.id);
  };

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

      {ITEMS.length === 0 ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>
            {itemsQuery.isLoading ? '加载中…' : '暂无作品数据'}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
        {ITEMS.map((item) => {
          const isOpen = expanded === item.id;
          const deltaUp = item.delta > 0;
          return (
            <Box
              key={item.id}
              onClick={() => handleClick(item)}
              sx={{
                display: 'flex',
                gap: 1.5,
                p: 1,
                borderRadius: 1.5,
                bgcolor: isOpen ? 'action.hover' : 'transparent',
                border: '1px solid',
                borderColor: isOpen ? 'rgba(254, 44, 85, 0.4)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  bgcolor: 'action.hover',
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
      )}
    </Box>
  );
}
