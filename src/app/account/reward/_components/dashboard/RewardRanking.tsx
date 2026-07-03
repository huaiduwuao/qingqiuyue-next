'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import { RANK_PILL } from '@/constants/gradients';

const RANKERS = [
  { rank: 1, name: '青山墨客', avatar: 'primary.main', bounty: 42, income: 28600, color: 'primary.main' },
  { rank: 2, name: '云中孤鹤', avatar: 'warning.main', bounty: 38, income: 24100, color: 'warning.main' },
  { rank: 3, name: '江南烟雨', avatar: 'secondary.main', bounty: 35, income: 21800, color: 'secondary.main' },
  { rank: 4, name: '夜的第七章', avatar: '#8B5CF6', bounty: 31, income: 18900, color: '#8B5CF6' },
  { rank: 5, name: '风中的诗句', avatar: 'success.main', bounty: 28, income: 16400, color: 'success.main' },
  { rank: 6, name: '海边的卡夫卡', avatar: '#F59E0B', bounty: 24, income: 13800, color: '#F59E0B' },
  { rank: 7, name: '南方有暖阳', avatar: 'secondary.light', bounty: 22, income: 12200, color: 'secondary.light' },
  { rank: 8, name: '山有木兮', avatar: '#A78BFA', bounty: 19, income: 10800, color: '#A78BFA' },
];

export default function RewardRanking() {
  const router = useRouter();

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
        <EmojiEventsIcon sx={{ fontSize: 18, color: 'warning.main', mr: 0.75 }} />
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', flex: 1 }}>
          悬赏达人榜
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>本周 · 周一更新</Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {RANKERS.map((r) => (
          <Box
            key={r.rank}
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
              '&:hover': { bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'action.hover' },
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
            <Avatar
              sx={{
                width: 28,
                height: 28,
                bgcolor: r.color,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {r.name.charAt(0)}
            </Avatar>
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

      <Box
        sx={{
          mt: 1.5,
          pt: 1.5,
          borderTop: '1px solid',
          borderColor: (theme) => theme.palette.mode === 'dark' ? '#252836' : '#E5E7EB',
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
