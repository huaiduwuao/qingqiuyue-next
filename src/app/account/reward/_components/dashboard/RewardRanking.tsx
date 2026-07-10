'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getRewardRanking, type RewardRanker } from '@/apis/dashboard';
import { RANK_PILL } from '@/constants/gradients';

export default function RewardRanking() {
  const router = useRouter();

  const query = useQuery({
    queryKey: ['reward-ranking', 8],
    queryFn: () => getRewardRanking({ limit: 8 }),
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
  });

  const rankers = ((query.data?.records ?? query.data?.list ?? []) as RewardRanker[]);

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
        <EmojiEventsIcon sx={{ fontSize: 18, color: 'warning.main', mr: 0.75 }} />
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', flex: 1 }}>
          悬赏达人榜
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>本周 · 周一更新</Typography>
      </Box>

      {query.isLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={48} sx={{ bgcolor: 'action.hover' }} />
          ))}
        </Box>
      ) : query.isError ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>榜单加载失败</Typography>
        </Box>
      ) : rankers.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>本周暂无达人上榜</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {rankers.map((r) => (
            <Box
              key={r.id}
              onClick={() => router.push('/account/reward/ranking')}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                p: 1,
                borderRadius: 1.5,
                bgcolor: r.rank <= 3 ? 'rgba(255, 180, 0, 0.05)' : 'transparent',
                border: '1px solid',
                borderColor: r.rank <= 3 ? 'rgba(255, 180, 0, 0.15)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { bgcolor: 'action.hover'},
              }}
            >
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: 0.5,
                  background: RANK_PILL[r.rank] || 'divider',
                  color: 'text.primary',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                }}
              >
                {r.rank <= 3 ? <EmojiEventsIcon sx={{ fontSize: 13 }} /> : r.rank}
              </Box>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: r.avatarColor || r.color,
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                {r.initials || r.name.charAt(0)}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: 12,
                    color: 'text.primary',
                    fontWeight: r.rank <= 3 ? 600 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.name}
                </Typography>
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>已接 {r.bounty} 单</Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: 'success.main' }}>
                  <WhatshotIcon sx={{ fontSize: 10 }} />
                  <Typography sx={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>
                    ¥{(r.income / 1000).toFixed(1)}k
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <Box
        sx={{
          mt: 1.5,
          pt: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          textAlign: 'center',
        }}
      >
        <Typography
          onClick={() => router.push('/account/reward/ranking')}
          sx={{
            fontSize: 11,
            color: 'primary.main',
            cursor: 'pointer',
            fontWeight: 600,
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          查看完整榜单 →
        </Typography>
      </Box>
    </Box>
  );
}