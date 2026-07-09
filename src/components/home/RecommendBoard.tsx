'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { fetchRecommend, HotItem } from '@/apis/home-discover';
import { getDetailRoute } from '@/lib/contentRoute';
import { useRouter } from 'next/navigation';

interface Props {
  types?: string[];
  size?: number;
  title?: string;
}

export default function RecommendBoard({
  types = ['NEWS', 'ARTICLE', 'VIDEO', 'MUSIC'],
  size = 12,
  title = '为你推荐',
}: Props) {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['recommend-board', types.join(','), size],
    queryFn: () =>
      fetchRecommend({ types: types.join(','), size }).then((r: any) => (r?.data?.list ?? []) as HotItem[]),
    staleTime: 90_000,
  });

  const list = data ?? [];

  const handleClick = (item: HotItem) => {
    if (!item.id) return;
    const route = getDetailRoute((item.category || 'NOVEL').toUpperCase(), item.id);
    if (route) router.push(route);
  };

  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: 2,
        bgcolor: 'var(--bg-surface, transparent)',
        border: '1px solid var(--border-color, transparent)',
        p: 1.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, currentColor)', flex: 1 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'var(--text-muted, currentColor)' }}>
          {isLoading ? '加载中…' : `${list.length} 条`}
        </Typography>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" sx={{ aspectRatio: '3/4', bgcolor: 'action.hover' }} />
          ))}
        </Box>
      ) : list.length === 0 ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', py: 2, display: 'block', textAlign: 'center' }}>
          暂无推荐内容
        </Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
          {list.map((item) => (
            <Box
              key={item.id}
              onClick={() => handleClick(item)}
              sx={{
                position: 'relative',
                aspectRatio: '3/4',
                borderRadius: 1.5,
                overflow: 'hidden',
                cursor: item.id ? 'pointer' : 'default',
                background: 'var(--bg-cover, transparent)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': item.id
                  ? {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
                    }
                  : {},
              }}
            >
              {item.cover ? (
                <Box
                  component="img"
                  src={item.cover}
                  alt={item.title}
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                  onError={(e: any) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(135deg, rgba(254,44,85,0.4) 0%, rgba(45,27,78,0.5) 100%)',
                  }}
                />
              )}
              {item.views !== undefined && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.25,
                    px: 0.5,
                    py: 0.1,
                    borderRadius: 0.5,
                    bgcolor: 'rgba(0,0,0,0.55)',
                    color: 'text.primary',
                    fontSize: 9,
                    fontFamily: 'monospace',
                  }}
                >
                  <PlayArrowRoundedIcon sx={{ fontSize: 10 }} />
                  {item.views >= 10000 ? `${(item.views / 10000).toFixed(1)}w` : item.views}
                </Box>
              )}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  p: 0.75,
                  background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%)',
                }}
              >
                <Typography
                  sx={{
                    fontSize: 11,
                    color: 'text.primary',
                    fontWeight: 500,
                    lineHeight: 1.2,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    minHeight: 26,
                  }}
                >
                  {item.title}
                </Typography>
                <Typography
                  sx={{
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.6)',
                    mt: 0.25,
                  }}
                >
                  {item.category}
                  {item.author ? ` · ${item.author}` : ''}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
