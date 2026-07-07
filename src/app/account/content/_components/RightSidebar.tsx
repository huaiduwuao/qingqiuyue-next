'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { useActiveTab } from '../ActiveTabContext';
import MiniCalendar from './MiniCalendar';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getContentActivityFeed, type Activity } from '@/apis/dashboard';

// 通知走站内消息系统;此处先显示空态,后端通知接口接入后接 getMessageList
const NOTIFICATIONS: { date: string; title: string; tag: string }[] = [];

const STATUS_TO_COLOR: Record<string, string> = {
  active: 'primary.main',
  signup: 'secondary.main',
  upcoming: 'warning.main',
  ended: 'text.disabled',
  judging: 'warning.main',
};
const STATUS_TO_TAG: Record<string, string> = {
  active: '进行中',
  signup: '报名中',
  upcoming: '即将开始',
  ended: '已结束',
  judging: '评审中',
};

export default function RightSidebar() {
  const router = useRouter();
  const { setActiveTab } = useActiveTab();
  const [timeRange, setTimeRange] = useState<'7d' | '30d'>('7d');

  // 真接口:内容侧栏活动 feed
  const { data: feed } = useQuery({
    queryKey: ['content-activity-feed'],
    queryFn: () => getContentActivityFeed({ limit: 5 }),
    staleTime: 60 * 1000,
  });
  const activitiesRaw = (feed?.records ?? feed?.list ?? []) as Activity[];
  const ACTIVITIES = activitiesRaw.map((a) => ({
    id: a.id,
    title: a.title,
    desc: a.subtitle,
    tag: STATUS_TO_TAG[a.status] ?? '进行中',
    color: STATUS_TO_COLOR[a.status] ?? 'primary.main',
  }));

  return (
    <Box sx={{ width: { xs: '100%', lg: 320 }, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Time filter */}
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 2,
          p: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', flex: 1 }}>
            时间筛选
          </Typography>
          <ButtonGroup size="small" sx={{ '& .MuiButton-root': { minWidth: 56, fontSize: 11, py: 0.25 } }}>
            <Button
              variant={timeRange === '7d' ? 'contained' : 'outlined'}
              onClick={() => setTimeRange('7d')}
              sx={{
                bgcolor: timeRange === '7d' ? 'primary.main' : 'transparent',
                borderColor: 'divider',
                color: timeRange === '7d' ? 'text.primary' : 'text.secondary',
                '&:hover': { bgcolor: timeRange === '7d' ? 'primary.dark' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover' },
              }}
            >
              近7日
            </Button>
            <Button
              variant={timeRange === '30d' ? 'contained' : 'outlined'}
              onClick={() => setTimeRange('30d')}
              sx={{
                bgcolor: timeRange === '30d' ? 'primary.main' : 'transparent',
                borderColor: 'divider',
                color: timeRange === '30d' ? 'text.primary' : 'text.secondary',
                '&:hover': { bgcolor: timeRange === '30d' ? 'primary.dark' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover' },
              }}
            >
              近30日
            </Button>
          </ButtonGroup>
        </Box>
      </Box>

      {/* Notifications */}
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 2,
          p: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
          <NotificationsNoneIcon sx={{ fontSize: 16, color: 'primary.main', mr: 1 }} />
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', flex: 1 }}>
            通知
          </Typography>
          <Typography
            onClick={() => setActiveTab('works')}
            sx={{ fontSize: 11, color: 'text.secondary', cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
          >
            查看更多
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {NOTIFICATIONS.map((n, i) => (
            <Box
              key={i}
              onClick={() => setActiveTab('works')}
              sx={{
                display: 'flex',
                gap: 1.5,
                p: 1,
                borderRadius: 1,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease-in-out',
                '&:hover': { bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'action.hover' },
              }}
            >
              <Typography sx={{ fontSize: 11, color: 'text.disabled', fontFamily: 'monospace', minWidth: 30 }}>
                {n.date}
              </Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                  <Box
                    sx={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: 'primary.main',
                      bgcolor: 'rgba(254, 44, 85, 0.12)',
                      px: 0.5,
                      py: 0.125,
                      borderRadius: 0.5,
                    }}
                  >
                    {n.tag}
                  </Box>
                </Box>
                <Typography
                  sx={{
                    fontSize: 12,
                    color: 'text.tertiary',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {n.title}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Activity Center */}
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 2,
          p: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
          <EmojiEventsOutlinedIcon sx={{ fontSize: 16, color: 'warning.main', mr: 1 }} />
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', flex: 1 }}>
            活动中心
          </Typography>
          <Box
            onClick={() => router.push('/account/reward')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              cursor: 'pointer',
              color: 'text.secondary',
              '&:hover': { color: 'primary.main' },
            }}
          >
            <Typography sx={{ fontSize: 11 }}>查看更多</Typography>
            <ArrowForwardIosIcon sx={{ fontSize: 9 }} />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {ACTIVITIES.map((a) => (
            <Box
              key={a.id}
              onClick={() => router.push('/account/reward')}
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF',
                border: '1px solid',
                borderColor: 'divider',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                '&:hover': { borderColor: a.color, transform: 'translateX(2px)' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', flex: 1 }}>
                  {a.title}
                </Typography>
                <Box
                  sx={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: a.color,
                    bgcolor: `${a.color}20`,
                    px: 0.5,
                    py: 0.125,
                    borderRadius: 0.5,
                  }}
                >
                  {a.tag}
                </Box>
              </Box>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{a.desc}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Interaction */}
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 2,
          p: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
          <ForumOutlinedIcon sx={{ fontSize: 16, color: 'secondary.main', mr: 1 }} />
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', flex: 1 }}>
            互动管理
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          <Box
            onClick={() => router.push('/account/msg')}
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF',
              border: '1px solid',
              borderColor: 'divider',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              '&:hover': { borderColor: 'secondary.main', transform: 'translateY(-2px)' },
            }}
          >
            <ForumOutlinedIcon sx={{ fontSize: 20, color: 'secondary.main', mb: 0.5 }} />
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary' }}>0</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>作品评论</Typography>
          </Box>
          <Box
            onClick={() => router.push('/account/msg')}
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF',
              border: '1px solid',
              borderColor: 'divider',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
            }}
          >
            <EmailOutlinedIcon sx={{ fontSize: 20, color: 'primary.main', mb: 0.5 }} />
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary' }}>0</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>私信消息</Typography>
          </Box>
        </Box>
      </Box>

      {/* Calendar */}
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 2,
          p: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <MiniCalendar highlightDays={[1, 2, 3, 4, 5, 6]} />
      </Box>
    </Box>
  );
}
