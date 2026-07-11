'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
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
import { getHotBounties, type Bounty } from '@/apis/dashboard';
import BountyDetailDialog from './BountyDetailDialog';
import BountyListDialog from './BountyListDialog';

const CATEGORY_ICON: Record<string, React.ReactElement> = {
  video: <VideoLibraryIcon sx={{ fontSize: 14 }} />,
  image: <PhotoLibraryIcon sx={{ fontSize: 14 }} />,
  novel: <MenuBookIcon sx={{ fontSize: 14 }} />,
  art: <BrushIcon sx={{ fontSize: 14 }} />,
  music: <MusicNoteIcon sx={{ fontSize: 14 }} />,
  film: <MovieIcon sx={{ fontSize: 14 }} />,
  script: <MovieIcon sx={{ fontSize: 14 }} />,
};

const CATEGORY_LABEL: Record<string, string> = {
  video: '短视频',
  image: '图文',
  novel: '小说',
  art: '画作',
  music: '音乐',
  film: '短剧',
  script: '剧本',
};

const CATEGORY_COLOR: Record<string, string> = {
  video: 'primary.main',
  image: 'warning.main',
  novel: 'secondary.main',
  art: '#8B5CF6',
  music: 'success.main',
  film: '#F59E0B',
  script: '#FFB400',
};

export default function RewardHotGrid({
  search = '',
  order = 'reward',
  filter = '全部',
}: {
  search?: string;
  order?: 'reward' | 'deadline' | 'hot' | 'newest';
  filter?: string;
} = {}) {
  // 详情/全部都在页内弹层打开,不跳转路由(悬赏中心是纯客户端 tab 体系)
  const [detailId, setDetailId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);

  // 真接口:热门悬赏(支持 keyword 搜索 + category 过滤 + order 排序)
  const hotQuery = useQuery({
    queryKey: ['reward-bounty-hot', { search, order, filter }],
    queryFn: () => getHotBounties({
      page: 1,
      size: 6,
      keyword: search || undefined,
      category: filter !== '全部' ? filter : undefined,
      order,
    }),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });
  const HOT_BOUNTIES: Bounty[] = ((hotQuery.data?.records ?? hotQuery.data?.list ?? []) as any[]).map((b) => ({
    id: b.id,
    title: b.title,
    category: (b.category as Bounty['category']) ?? 'video',
    reward: b.reward / 100,
    applicants: b.applicants,
    daysLeft: b.daysLeft,
    sponsor: b.sponsor,
    gradient: b.gradient || gradient2('#FE2C55', '#FF6B8A'),
  }));

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
          onClick={() => setListOpen(true)}
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

      {hotQuery.isLoading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={160} sx={{ bgcolor: 'action.hover' }} />
          ))}
        </Box>
      ) : HOT_BOUNTIES.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center', color: 'text.disabled' }}>
          <Typography sx={{ fontSize: 12 }}>
            {search || (filter && filter !== '全部') ? '当前筛选条件下暂无悬赏' : '暂无热门悬赏'}
          </Typography>
        </Box>
      ) : (
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
            onClick={() => setDetailId(b.id)}
            sx={{
              position: 'relative',
              borderRadius: 1.5,
              overflow: 'hidden',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
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
      )}

      <BountyListDialog
        open={listOpen}
        onClose={() => setListOpen(false)}
        onSelect={(id) => setDetailId(id)}
        search={search}
        order={order}
        filter={filter}
      />
      <BountyDetailDialog
        open={!!detailId}
        bountyId={detailId}
        onClose={() => setDetailId(null)}
      />
    </Box>
  );
}
