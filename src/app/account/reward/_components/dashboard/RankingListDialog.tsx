'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import { getRewardRanking, type RewardRanker } from '@/apis/dashboard';
import { RANK_PILL } from '@/constants/gradients';

/**
 * 完整达人榜弹层 —— 页内展示,不跳转 /account/reward/ranking(该路由不存在)。
 */
export default function RankingListDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ['reward-ranking', 'all', 50],
    queryFn: () => getRewardRanking({ pageSize: 50 }),
    staleTime: 60 * 1000,
    enabled: open,
  });
  const rankers = (query.data?.list ?? []) as RewardRanker[];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 2, bgcolor: 'background.paper' } } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.5 }}>
        <EmojiEventsIcon sx={{ fontSize: 18, color: 'warning.main', mr: 0.75 }} />
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary', flex: 1 }}>悬赏达人榜 · 完整榜单</Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }} aria-label="关闭">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ pt: 1 }}>
        {query.isLoading ? (
          <Box sx={{ py: 2 }}>
            <LinearProgress sx={{ borderRadius: 1 }} />
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
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  p: 1,
                  borderRadius: 1.5,
                  bgcolor: r.rank <= 3 ? 'rgba(255, 180, 0, 0.05)' : 'transparent',
                  border: '1px solid',
                  borderColor: r.rank <= 3 ? 'rgba(255, 180, 0, 0.15)' : 'transparent',
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: 'success.main' }}>
                  <WhatshotIcon sx={{ fontSize: 10 }} />
                  <Typography sx={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>
                    ¥{(r.income / 1000).toFixed(1)}k
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
