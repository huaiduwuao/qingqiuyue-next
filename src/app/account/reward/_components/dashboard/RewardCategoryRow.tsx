'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import BrushIcon from '@mui/icons-material/Brush';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import MicIcon from '@mui/icons-material/Mic';
import MovieIcon from '@mui/icons-material/Movie';
import CodeIcon from '@mui/icons-material/Code';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import { useQuery } from '@tanstack/react-query';
import { getRewardCategories, type RewardCategory } from '@/apis/dashboard';

const ICON_MAP: Record<string, React.ReactNode> = {
  VideoLibrary: <VideoLibraryIcon sx={{ fontSize: 22 }} />,
  PhotoLibrary: <PhotoLibraryIcon sx={{ fontSize: 22 }} />,
  MenuBook: <MenuBookIcon sx={{ fontSize: 22 }} />,
  Brush: <BrushIcon sx={{ fontSize: 22 }} />,
  MusicNote: <MusicNoteIcon sx={{ fontSize: 22 }} />,
  Mic: <MicIcon sx={{ fontSize: 22 }} />,
  Movie: <MovieIcon sx={{ fontSize: 22 }} />,
  Code: <CodeIcon sx={{ fontSize: 22 }} />,
  LiveTv: <LiveTvIcon sx={{ fontSize: 22 }} />,
};

export default function RewardCategoryRow({ onSelect }: { onSelect?: (id: string) => void }) {
  const query = useQuery({
    queryKey: ['reward-categories'],
    queryFn: () => getRewardCategories(),
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
  });

  const categories = ((query.data?.records ?? query.data?.list ?? []) as RewardCategory[]);
  const totalCount = categories.reduce((a, b) => a + b.count, 0);

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', flex: 1 }}>
          悬赏分类
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>共 {totalCount} 个进行中</Typography>
      </Box>

      {query.isLoading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(4, 1fr)', sm: 'repeat(5, 1fr)', md: 'repeat(9, 1fr)' }, gap: 1 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={70} sx={{ bgcolor: 'action.hover' }} />
          ))}
        </Box>
      ) : query.isError ? (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>分类加载失败</Typography>
        </Box>
      ) : categories.length === 0 ? (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>暂无悬赏分类</Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(4, 1fr)', sm: 'repeat(5, 1fr)', md: 'repeat(9, 1fr)' },
            gap: 1,
          }}
        >
          {categories.map((c) => (
            <Box
              key={c.code}
              onClick={() => onSelect?.(c.code)}
              sx={{
                cursor: 'pointer',
                textAlign: 'center',
                p: 1,
                borderRadius: 1.5,
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: 'action.hover',
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
                {ICON_MAP[c.icon] ?? <VideoLibraryIcon sx={{ fontSize: 22 }} />}
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
      )}
    </Box>
  );
}