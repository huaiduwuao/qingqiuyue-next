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
import WhatshotIcon from '@mui/icons-material/Whatshot';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupIcon from '@mui/icons-material/Group';
import { alpha } from '@mui/material/styles';
import { getHotBounties, type Bounty } from '@/apis/dashboard';

/**
 * 「查看全部」悬赏列表弹层 —— 页内展示,不跳转 /account/reward/list(该路由不存在)。
 * 行点击交给父组件打开 BountyDetailDialog,URL 全程保持在 /account/reward。
 */
export default function BountyListDialog({
  open,
  onClose,
  onSelect,
  search = '',
  order = 'reward',
  filter = '全部',
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  search?: string;
  order?: 'reward' | 'deadline' | 'hot' | 'newest';
  filter?: string;
}) {
  const listQuery = useQuery({
    queryKey: ['reward-bounty-hot', 'all', { search, order, filter }],
    queryFn: () =>
      getHotBounties({
        page: 1,
        size: 50,
        keyword: search || undefined,
        category: filter !== '全部' ? filter : undefined,
        order,
      }),
    staleTime: 30 * 1000,
    enabled: open,
  });
  const list: Bounty[] = (listQuery.data?.records ?? listQuery.data?.list ?? []) as Bounty[];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 2, bgcolor: 'background.paper' } } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.5 }}>
        <WhatshotIcon sx={{ fontSize: 18, color: 'primary.main', mr: 0.75 }} />
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary', flex: 1 }}>全部悬赏</Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }} aria-label="关闭">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ pt: 1 }}>
        {listQuery.isLoading ? (
          <Box sx={{ py: 2 }}>
            <LinearProgress sx={{ borderRadius: 1 }} />
          </Box>
        ) : list.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center', color: 'text.disabled' }}>
            <Typography sx={{ fontSize: 12 }}>暂无悬赏</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {list.map((b) => (
              <Box
                key={b.id}
                onClick={() => onSelect(b.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  p: 1.25,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: 'primary.main', bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05) },
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    background: b.gradient,
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: 13,
                      color: 'text.primary',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {b.title}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5, color: 'text.secondary' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <GroupIcon sx={{ fontSize: 12 }} />
                      <Typography sx={{ fontSize: 11 }}>{b.applicants}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <AccessTimeIcon sx={{ fontSize: 12 }} />
                      <Typography sx={{ fontSize: 11 }}>剩 {b.daysLeft} 天</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{b.sponsor}</Typography>
                  </Box>
                </Box>
                <Typography
                  sx={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'primary.main',
                    fontFamily: 'monospace',
                    flexShrink: 0,
                  }}
                >
                  ¥{(b.reward / 100).toLocaleString('zh-CN')}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
