'use client';

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';

import { fetchLeaderboard, fetchLeaderboardCatalog } from '@/apis/leaderboard';
import { CoverImage } from '@/components/common/CoverImage';
import { useContentNavigate } from '@/lib/contentRoute';
import { DeltaBadge, RankNumber, formatBuiltAt } from './shared';

// 首页 section → 内容类型的映射搬去了 lib/homeSections(频道由用户自己管,
// 这里再留一张表只会和它对不上);调用方传 parseSectionId(section)?.contentType。

interface Props {
  /** 默认类型;不在目录里(或没有内容)时回退总榜 */
  defaultType?: string;
  limit?: number;
  /** 嵌在别的卡片里时不画外框和标题 */
  embedded?: boolean;
  title?: string;
}

/**
 * 侧栏小榜:热度日榜前 N,可切类型,一键跳完整榜单(/home/recommend?tab=rank)。
 */
export default function LeaderboardMini({ defaultType = 'ALL', limit = 10, embedded = false, title = '排行榜' }: Props) {
  const router = useRouter();
  const navigate = useContentNavigate();
  const [picked, setPicked] = useState<string | null>(null);

  // 首页切了 section,就跟着切到对应类型。
  useEffect(() => setPicked(null), [defaultType]);

  const { data: catalog } = useQuery({
    queryKey: ['leaderboard', 'catalog'],
    queryFn: fetchLeaderboardCatalog,
    staleTime: 5 * 60_000,
  });
  const types = catalog?.types ?? [];
  const wanted = (picked ?? defaultType).toUpperCase();
  const type = catalog ? (types.some((t) => t.code === wanted) ? wanted : 'ALL') : wanted;

  const { data: board, isLoading } = useQuery({
    queryKey: ['leaderboard', 'mini', type, limit],
    queryFn: () => fetchLeaderboard({ type, metric: 'hot', period: 'day', limit }),
    staleTime: 60_000,
  });
  const list = board?.list ?? [];

  const openFull = () => router.push(`/home/recommend?tab=rank${type !== 'ALL' ? `&type=${type}` : ''}`);

  const body = (
    <>
      {types.length > 1 && (
        <Box
          sx={{
            display: 'flex',
            gap: 0.5,
            overflowX: 'auto',
            pb: 0.75,
            mb: 0.5,
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {types.map((t) => (
            <Chip
              key={t.code}
              size="small"
              label={t.name}
              color={t.code === type ? 'primary' : 'default'}
              variant={t.code === type ? 'filled' : 'outlined'}
              onClick={() => setPicked(t.code)}
              sx={{ height: 22, fontSize: 11, flexShrink: 0 }}
            />
          ))}
        </Box>
      )}

      {isLoading ? (
        <Box sx={{ display: 'grid', gap: 0.75 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={34} sx={{ bgcolor: 'action.hover' }} />
          ))}
        </Box>
      ) : list.length === 0 ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', py: 1, display: 'block' }}>
          暂无榜单数据
        </Typography>
      ) : (
        <Box sx={{ display: 'grid', gap: 0.25 }}>
          {list.map((e) => (
            <Box
              key={e.id}
              onClick={() => navigate(e.contentType, e.id)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 0.75,
                py: 0.5,
                borderRadius: 1.25,
                cursor: 'pointer',
                transition: 'background 0.15s',
                '&:hover': { bgcolor: 'var(--bg-hover, transparent)' },
                overflow: 'hidden',
              }}
            >
              <RankNumber rank={e.rank} small />
              <CoverImage src={e.cover} alt="" sx={{ width: 34, height: 24, borderRadius: 0.5, flexShrink: 0 }} />
              <Typography
                noWrap
                sx={{ fontSize: 12, lineHeight: 1.2, flex: 1, minWidth: 0, color: 'var(--text-primary, currentColor)' }}
              >
                {e.title}
              </Typography>
              <DeltaBadge entry={e} compared={!!board?.compared} />
            </Box>
          ))}
        </Box>
      )}

      <Box
        component="button"
        onClick={openFull}
        sx={{
          all: 'unset',
          mt: 1,
          width: '100%',
          boxSizing: 'border-box',
          py: 0.75,
          borderRadius: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.25,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          color: 'primary.main',
          bgcolor: 'var(--bg-hover, rgba(127,127,127,0.08))',
          '&:hover': { filter: 'brightness(1.15)' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
        }}
      >
        查看完整榜单
        <ChevronRightRoundedIcon sx={{ fontSize: 16 }} />
      </Box>
    </>
  );

  if (embedded) return body;

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
        <EmojiEventsRoundedIcon sx={{ fontSize: 17, color: 'warning.main', mr: 0.75 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, currentColor)', flex: 1 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'var(--text-muted, currentColor)' }}>
          热度日榜{board?.builtAt ? ` · ${formatBuiltAt(board.builtAt)}` : ''}
        </Typography>
      </Box>
      {body}
    </Box>
  );
}
