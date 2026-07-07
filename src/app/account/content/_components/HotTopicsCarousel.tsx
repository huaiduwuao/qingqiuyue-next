'use client';

import React, { useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CampaignIcon from '@mui/icons-material/Campaign';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getCreatorHotTopics, type HotTopic } from '@/apis/dashboard';

type TopicTag = '活动' | '热点' | '挑战' | '话题';

const TAG_COLORS: Record<TopicTag, string> = {
  活动: 'primary.main',
  热点: 'warning.main',
  挑战: 'secondary.main',
  话题: '#8B5CF6',
};

const TagIcon = ({ tag }: { tag: TopicTag }) => {
  if (tag === '活动') return <EmojiEventsIcon sx={{ fontSize: 12 }} />;
  if (tag === '热点') return <LocalFireDepartmentIcon sx={{ fontSize: 12 }} />;
  return <CampaignIcon sx={{ fontSize: 12 }} />;
};

export default function HotTopicsCarousel() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ['creator-hot-topics'],
    queryFn: () => getCreatorHotTopics({ limit: 10 }),
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
  });

  const topics = ((query.data?.records ?? query.data?.list ?? []) as HotTopic[]);

  const scroll = (dir: 1 | -1) => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollBy({ left: dir * 280, behavior: 'smooth' });
  };

  const handleTopicClick = (title: string) => {
    router.push(`/search?q=${encodeURIComponent(title)}`);
  };

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 2,
        p: 3,
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
        <LocalFireDepartmentIcon sx={{ fontSize: 18, color: 'primary.main', mr: 1 }} />
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary', flex: 1 }}>
          实时热点
        </Typography>
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => scroll(-1)}
            sx={{
              color: 'text.secondary',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 0.5,
              '&:hover': { color: 'primary.main', borderColor: 'primary.main' },
            }}
          >
            <ArrowBackIosNewIcon sx={{ fontSize: 12 }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => scroll(1)}
            sx={{
              color: 'text.secondary',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 0.5,
              '&:hover': { color: 'primary.main', borderColor: 'primary.main' },
            }}
          >
            <ArrowForwardIosIcon sx={{ fontSize: 12 }} />
          </IconButton>
        </Box>
      </Box>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 2 }}>热门活动与话题,助你获取更多流量</Typography>

      {query.isLoading ? (
        <Box sx={{ display: 'flex', gap: 1.5, mx: -3, px: 3, overflow: 'hidden' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton
              key={i}
              variant="rounded"
              height={180}
              sx={{ flex: '0 0 240px', minWidth: 240, bgcolor: 'rgba(255,255,255,0.04)' }}
            />
          ))}
        </Box>
      ) : query.isError ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>热点加载失败,请稍后重试</Typography>
        </Box>
      ) : topics.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>暂无热点话题</Typography>
        </Box>
      ) : (
        <Box
          ref={scrollRef}
          sx={{
            display: 'flex',
            gap: 1.5,
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            pb: 1,
            mx: -3,
            px: 3,
            '&::-webkit-scrollbar': { height: 4 },
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
          }}
        >
          {topics.map((t) => {
            const tag = (t.tag as TopicTag) in TAG_COLORS ? (t.tag as TopicTag) : '话题';
            const tagColor = TAG_COLORS[tag];
            return (
              <Box
                key={t.id}
                onClick={() => handleTopicClick(t.title)}
                sx={{
                  flex: '0 0 240px',
                  minWidth: 240,
                  scrollSnapAlign: 'start',
                  borderRadius: 2,
                  bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF'),
                  border: '1px solid',
                  borderColor: 'divider',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    borderColor: t.color,
                    boxShadow: `0 8px 24px ${t.color}33`,
                  },
                }}
              >
                <Box
                  sx={{
                    height: 80,
                    background: t.gradient,
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'flex-end',
                    p: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 0.75,
                      bgcolor: 'rgba(0, 0, 0, 0.4)',
                      color: 'text.primary',
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    <LocalFireDepartmentIcon sx={{ fontSize: 11, color: 'warning.main' }} />
                    <span style={{ fontFamily: 'monospace' }}>{t.heat.toLocaleString()}</span>
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 0.75,
                      bgcolor: 'rgba(255, 255, 255, 0.95)',
                      color: tagColor,
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    <TagIcon tag={tag} />
                    {tag}
                  </Box>
                </Box>
                <Box sx={{ p: 1.5 }}>
                  <Typography
                    sx={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'text.primary',
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {t.title}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 11,
                      color: 'text.secondary',
                      mt: 0.25,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {t.desc}
                  </Typography>
                  <Box
                    sx={{
                      mt: 1,
                      pt: 1,
                      borderTop: '1px dashed',
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Typography sx={{ fontSize: 10, color: t.color, fontWeight: 600 }}>
                      {t.reward}
                    </Typography>
                    <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>{t.participants}</Typography>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}