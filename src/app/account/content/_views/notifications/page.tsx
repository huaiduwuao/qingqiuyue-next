'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CampaignIcon from '@mui/icons-material/Campaign';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StarIcon from '@mui/icons-material/Star';
import { adminClient } from '@/lib/api/client';

interface NoticeItem {
  id: number;
  type: 'system' | 'activity' | 'reward' | 'interaction';
  title: string;
  content: string;
  time: string;
  read: boolean;
}

const TYPE_COLORS: Record<NoticeItem['type'], string> = {
  system: 'secondary.main',
  activity: 'primary.main',
  reward: 'warning.main',
  interaction: 'success.main',
};

const TYPE_LABELS: Record<NoticeItem['type'], string> = {
  system: '系统',
  activity: '活动',
  reward: '收益',
  interaction: '互动',
};

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const queryClient = useQueryClient();

  const { data: notices = [] } = useQuery({
    queryKey: ['notifications', 'client'],
    queryFn: () => adminClient<{ list: NoticeItem[]; total: number }>('/notice/client/page', {
      params: { page: 1, pageSize: 20 },
    }).then((r: any) => (r?.data?.list as NoticeItem[]) || []),
  });

  const visible = filter === 'unread' ? notices.filter((n) => !n.read) : notices;
  const unreadCount = notices.filter((n) => !n.read).length;

  const markAllRead = () => {
    queryClient.setQueryData(['notifications', 'client'], (prev: any) => {
      if (!prev) return prev;
      return prev.map((n: NoticeItem) => ({ ...n, read: true }));
    });
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <NotificationsIcon sx={{ color: 'primary.main', fontSize: 28 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
            通知中心
          </Typography>
          {unreadCount > 0 && (
            <Chip
              label={`${unreadCount} 条未读`}
              size="small"
              sx={{ bgcolor: 'primary.main', color: 'text.primary', fontWeight: 600 }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant={filter === 'all' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setFilter('all')}
            sx={{ textTransform: 'none', ...(filter === 'all' && { bgcolor: 'primary.main' }) }}
          >
            全部
          </Button>
          <Button
            variant={filter === 'unread' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setFilter('unread')}
            sx={{ textTransform: 'none', ...(filter === 'unread' && { bgcolor: 'primary.main' }) }}
          >
            未读
          </Button>
          {unreadCount > 0 && (
            <Button size="small" onClick={markAllRead} sx={{ textTransform: 'none', color: 'text.secondary' }}>
              全部已读
            </Button>
          )}
        </Box>
      </Box>

      <Box sx={{ borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: (theme) => theme.palette.mode === 'dark' ? '#252836' : '#E5E7EB', overflow: 'hidden' }}>
        {visible.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <NotificationsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography sx={{ color: 'text.secondary' }}>暂无{filter === 'unread' ? '未读' : ''}通知</Typography>
          </Box>
        ) : (
          visible.map((n, idx) => {
            const color = TYPE_COLORS[n.type];
            return (
              <Box
                key={n.id}
                sx={{
                  p: 2.5,
                  display: 'flex',
                  gap: 2,
                  borderBottom: idx < visible.length - 1 ? '1px solid' : 'none',
                  borderBottomColor: (theme) => theme.palette.mode === 'dark' ? '#252836' : '#E5E7EB',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover' },
                  ...(n.read ? {} : { borderLeft: '3px solid #FE2C55' }),
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    bgcolor: `${color}1A`,
                    color: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {n.type === 'system' ? <NotificationsIcon /> :
                    n.type === 'activity' ? <CampaignIcon /> :
                    n.type === 'reward' ? <StarIcon /> : <CheckCircleIcon />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Chip
                      label={TYPE_LABELS[n.type]}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: 10,
                        bgcolor: `${color}1A`,
                        color: color,
                        fontWeight: 600,
                      }}
                    />
                    <Typography sx={{ fontSize: 14, fontWeight: n.read ? 400 : 600, color: 'text.primary' }}>
                      {n.title}
                    </Typography>
                    {!n.read && (
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main' }} />
                    )}
                  </Box>
                  <Typography sx={{ fontSize: 13, color: 'text.tertiary', mb: 0.5 }}>{n.content}</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{n.time}</Typography>
                </Box>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
