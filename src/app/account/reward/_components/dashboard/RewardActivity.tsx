'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import HistoryIcon from '@mui/icons-material/History';
import { getCreatorActivities, type ActivityItem } from '@/apis/creator';

interface Activity {
  id: string;
  type: 'publish' | 'accept' | 'earn' | 'levelup';
  text: string;
  amount?: number;
  time: string;
}

const TYPE_ICON: Record<string, React.ReactElement> = {
  publish: <HistoryIcon sx={{ fontSize: 12 }} />,
  accept: <HistoryIcon sx={{ fontSize: 12 }} />,
  earn: <TrendingUpIcon sx={{ fontSize: 12 }} />,
  levelup: <TrendingUpIcon sx={{ fontSize: 12 }} />,
  recharge: <TrendingUpIcon sx={{ fontSize: 12 }} />,
  consume: <HistoryIcon sx={{ fontSize: 12 }} />,
};

const TYPE_COLOR: Record<string, string> = {
  publish: 'warning.main',
  accept: 'secondary.main',
  earn: 'success.main',
  levelup: 'primary.main',
  recharge: 'success.main',
  consume: 'warning.main',
};

function mapType(rawType: string): Activity['type'] {
  const t = (rawType || '').toLowerCase();
  if (t.includes('earn') || t.includes('reward') || t.includes('income')) return 'earn';
  if (t.includes('accept')) return 'accept';
  if (t.includes('publish') || t.includes('post')) return 'publish';
  if (t.includes('level')) return 'levelup';
  return 'publish';
}

function relativeTime(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1) return '刚刚';
  if (h < 1) return `${m} 分钟前`;
  if (d < 1) return `${h} 小时前`;
  if (d < 7) return `${d} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

export default function RewardActivity() {
  // 真接口:用户活动日志(后端 creatorCenterH.Activity)
  const { data } = useQuery({
    queryKey: ['creator-activity', 'reward'],
    queryFn: () => getCreatorActivities({ page: 1, pageSize: 10 }),
    staleTime: 30 * 1000,
  });
  const list = (data?.records ?? data?.list ?? []) as ActivityItem[];

  const ACTIVITIES: Activity[] = list.map((a, idx) => ({
    id: String(a.refId ?? idx),
    type: mapType(a.type),
    text: a.title || a.remark || '',
    amount: a.type?.includes('earn') ? undefined : undefined,
    time: relativeTime(a.time),
  }));

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
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', flex: 1 }}>
          最近动态
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>共 {ACTIVITIES.length} 条</Typography>
      </Box>
      {ACTIVITIES.length === 0 ? (
        <Typography sx={{ fontSize: 12, color: 'text.disabled', textAlign: 'center', py: 4 }}>暂无动态</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {ACTIVITIES.map((a) => (
            <Box
              key={a.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1,
                borderRadius: 1,
                transition: 'all 0.2s',
                '&:hover': { bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'action.hover' },
              }}
            >
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: 0.5,
                  bgcolor: `${TYPE_COLOR[a.type]}1F`,
                  color: TYPE_COLOR[a.type],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {TYPE_ICON[a.type]}
              </Box>
              <Typography sx={{ fontSize: 12, color: 'text.tertiary', flex: 1 }}>{a.text}</Typography>
              {a.amount !== undefined && (
                <Typography sx={{ fontSize: 12, color: 'success.main', fontWeight: 700, fontFamily: 'monospace' }}>
                  +¥{a.amount.toLocaleString('zh-CN')}
                </Typography>
              )}
              <Typography sx={{ fontSize: 10, color: 'text.disabled', minWidth: 60, textAlign: 'right' }}>
                {a.time}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
