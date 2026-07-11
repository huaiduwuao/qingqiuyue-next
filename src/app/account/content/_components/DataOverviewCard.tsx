'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import ModeCommentIcon from '@mui/icons-material/ModeComment';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { accountClient, isAuthError } from '@/lib/api/client';
import { AsyncState } from '@/components/common/AsyncState';

type DataOverview = {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  todayViews: number;
  weekViews: number;
  monthViews: number;
};

function DeltaIndicator({ delta }: { delta: number }) {
  const isUp = delta > 0;
  const isDown = delta < 0;
  const Icon = isUp ? TrendingUpIcon : isDown ? TrendingDownIcon : TrendingFlatIcon;
  const color = isUp ? 'success.main' : isDown ? 'primary.main' : 'text.secondary';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color }}>
      <Icon sx={{ fontSize: 12 }} />
      <Typography sx={{ fontSize: 11, color, fontWeight: 500 }}>
        较前7日{isUp ? `+${delta}` : delta}
      </Typography>
    </Box>
  );
}

type Metric = { id: string; label: string; value: number; delta: number; icon: React.ReactNode; color: string };

const METRICS: Metric[] = [
  { id: 'play', label: '播放量', value: 0, delta: 0, icon: <VisibilityIcon sx={{ fontSize: 20 }} />, color: 'primary.main' },
  { id: 'share', label: '作品分享', value: 0, delta: 0, icon: <ShareOutlinedIcon sx={{ fontSize: 20 }} />, color: 'secondary.main' },
  { id: 'comment', label: '作品评论', value: 0, delta: 0, icon: <ModeCommentIcon sx={{ fontSize: 20 }} />, color: 'warning.main' },
];

function MetricCard({ m, valueText, showDelta }: { m: Metric; valueText: React.ReactNode; showDelta: boolean }) {
  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.2s ease-in-out',
        '&:hover': { borderColor: m.color, transform: 'translateY(-2px)' },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          right: 0,
          width: 60,
          height: 60,
          background: `radial-gradient(circle at top right, ${m.color}20 0%, transparent 70%)`,
          pointerEvents: 'none',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1,
            bgcolor: `${m.color}15`,
            color: m.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {m.icon}
        </Box>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{m.label}</Typography>
      </Box>
      <Typography sx={{ fontSize: 32, fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
        {valueText}
      </Typography>
      {showDelta && (
        <Box sx={{ mt: 1 }}>
          <DeltaIndicator delta={m.delta} />
        </Box>
      )}
    </Box>
  );
}

function DataOverviewShell({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 2,
        p: 3,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 600, color: 'text.primary' }}>
          数据中心
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          统计周期:2026.05.25 - 2026.05.31
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: { xs: 1.5, md: 2 },
        }}
      >
        {children}
      </Box>
      <Box
        sx={{
          mt: 2,
          pt: 2,
          borderTop: '1px dashed',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: 'success.main',
            animation: 'pulse 2s infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.4 },
            },
          }}
        />
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
          每天 12:00 自动更新最新数据
        </Typography>
      </Box>
    </Box>
  );
}

export default function DataOverviewCard() {
  const query = useQuery({
    queryKey: ['account', 'data', 'overview'],
    queryFn: () => accountClient.get<DataOverview>('/data/overview').then((r) => r.data),
  });

  // 401 静默兜底:KPI 卡片布局不变,数值位置显示「登录后查看」,不显示红色 alert
  if (query.isError && isAuthError(query.error)) {
    return (
      <DataOverviewShell>
        {METRICS.map((m) => (
          <MetricCard
            key={m.id}
            m={m}
            valueText={
              <Typography component="span" sx={{ fontSize: 13, color: 'text.disabled', fontWeight: 500 }}>
                登录后查看
              </Typography>
            }
            showDelta={false}
          />
        ))}
      </DataOverviewShell>
    );
  }

  return (
    <AsyncState query={query} skeletonCount={1} skeletonHeight={220}>
      {(data) => {
        const live: Metric[] = [
          { id: 'play', label: '播放量', value: data.totalViews, delta: 12, icon: <VisibilityIcon sx={{ fontSize: 20 }} />, color: 'primary.main' },
          { id: 'share', label: '作品分享', value: data.totalShares, delta: 8, icon: <ShareOutlinedIcon sx={{ fontSize: 20 }} />, color: 'secondary.main' },
          { id: 'comment', label: '作品评论', value: data.totalComments, delta: -3, icon: <ModeCommentIcon sx={{ fontSize: 20 }} />, color: 'warning.main' },
        ];
        return (
          <DataOverviewShell>
            {live.map((m) => (
              <MetricCard
                key={m.id}
                m={m}
                valueText={m.value.toLocaleString()}
                showDelta
              />
            ))}
          </DataOverviewShell>
        );
      }}
    </AsyncState>
  );
}
