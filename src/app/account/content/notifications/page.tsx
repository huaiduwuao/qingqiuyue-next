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

const MOCK_NOTICES: NoticeItem[] = [
  { id: 1, type: 'system', title: '系统升级完成', content: '视频上传服务已升级,新版本支持 4K HDR。', time: '10 分钟前', read: false },
  { id: 2, type: 'activity', title: '618 创作激励计划开启', content: '参与瓜分 ¥10w 现金池,详情请查看活动页。', time: '1 小时前', read: false },
  { id: 3, type: 'reward', title: '收益到账提醒', content: '昨日视频收益 ¥326.50 已到账,可提现。', time: '今天 09:15', read: false },
  { id: 4, type: 'interaction', title: '新增 1.2w 粉丝', content: '你的视频《夏日 vlog》受到大家喜爱,新增 12,341 粉丝。', time: '昨天 18:42', read: true },
  { id: 5, type: 'system', title: '原创保护升级', content: '新增 AI 查重功能,自动保护你的原创作品。', time: '昨天 12:00', read: true },
  { id: 6, type: 'activity', title: '夏日 vlog 挑战赛', content: '你参与的话题 #夏日vlog 登上热搜榜 Top 3。', time: '2 天前', read: true },
];

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

  const { data: notices = MOCK_NOTICES } = useQuery({
    queryKey: ['notifications', 'client'],
    queryFn: () => adminClient<{ list: NoticeItem[]; total: number }>('/notice/client/page', {
      params: { page: 1, pageSize: 20 },
    }).then((r: any) => r?.data?.list?.length ? r.data.list as NoticeItem[] : MOCK_NOTICES),
    placeholderData: MOCK_NOTICES,
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

      <Box sx={{ borderRadius: 2, bgcolor: 'background.paper', border: '1px solid #252836', overflow: 'hidden' }}>
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
                  borderBottom: idx < visible.length - 1 ? '1px solid #252836' : 'none',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
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
