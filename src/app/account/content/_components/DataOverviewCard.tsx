'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ModeCommentIcon from '@mui/icons-material/ModeComment';
import VideoLibraryRoundedIcon from '@mui/icons-material/VideoLibraryRounded';
import Chip from '@mui/material/Chip';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { accountClient, isAuthError } from '@/lib/api/client';
import { AsyncState } from '@/components/common/AsyncState';

type DataOverview = {
  totalWorks: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  // 7 日 delta = 本周累加 - 上周累加(后端计算,绝对增量)
  viewsDelta: number;
  likesDelta: number;
  commentsDelta: number;
  sharesDelta: number;
  todayViews: number;
  weekViews: number;
  monthViews: number;
  // 统计周期(本地时区 7 天窗口,后端 Date 序列化为 ISO 字符串)
  periodStart: string;
  periodEnd: string;
};

function formatPeriod(start: string, end: string): string {
  // 后端给的是完整 ISO 时间戳,只要 MM.DD 部分
  const fmt = (s: string) => {
    if (!s) return '';
    // 直接取 "YYYY-MM-DD" 前 10 段,转 "YYYY.MM.DD"
    const d = s.substring(0, 10);
    return d.replace(/-/g, '.');
  };
  const s = fmt(start);
  const e = fmt(end);
  if (!s || !e) return '';
  return `${s} - ${e}`;
}

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

// 401/未登录 fallback 用 —— label/icon 与下方 live 数组保持一致,刷新后布局不跳
const METRICS: Metric[] = [
  { id: 'play', label: '播放量', value: 0, delta: 0, icon: <VisibilityIcon sx={{ fontSize: 20 }} />, color: 'primary.main' },
  { id: 'work', label: '作品', value: 0, delta: 0, icon: <VideoLibraryRoundedIcon sx={{ fontSize: 20 }} />, color: '#8B5CF6' },
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

function DataOverviewShell({ children, totalWorks, periodText }: { children: React.ReactNode; totalWorks?: number; periodText: string }) {
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
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 600, color: 'text.primary' }}>
          数据中心
        </Typography>
        {typeof totalWorks === 'number' && (
          <Chip
            size="small"
            label={`共 ${totalWorks} 件作品`}
            sx={{
              ml: 1,
              height: 22,
              bgcolor: 'action.hover',
              color: 'text.secondary',
              fontSize: 11,
              fontWeight: 600,
            }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          统计周期:{periodText}
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
      <DataOverviewShell periodText="登录后查看">
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
        // 真实数据:delta、totalWorks、统计周期全部来自后端聚合。
        // 字段全 `?? 0` 兜底:旧后端没重编时只返老字段,新字段为 undefined,
        // 直接喂 .toLocaleString() 会炸;归 0 让 UI 正常显示。
        const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
        const live: Metric[] = [
          { id: 'play', label: '播放量', value: n(data.totalViews), delta: n(data.viewsDelta), icon: <VisibilityIcon sx={{ fontSize: 20 }} />, color: 'primary.main' },
          { id: 'work', label: '作品', value: n(data.totalWorks), delta: 0, icon: <VideoLibraryRoundedIcon sx={{ fontSize: 20 }} />, color: '#8B5CF6' },
          { id: 'comment', label: '作品评论', value: n(data.totalComments), delta: n(data.commentsDelta), icon: <ModeCommentIcon sx={{ fontSize: 20 }} />, color: 'warning.main' },
        ];
        const totalWorks = n(data.totalWorks);
        return (
          <DataOverviewShell
            totalWorks={totalWorks}
            periodText={formatPeriod(data.periodStart, data.periodEnd) || '近 7 日'}
          >
            {live.map((m) => (
              <MetricCard
                key={m.id}
                m={m}
                valueText={m.value.toLocaleString()}
                // 作品卡展示累计数即可,环比意义不大(作品数是离散值)
                showDelta={m.id !== 'work'}
              />
            ))}
          </DataOverviewShell>
        );
      }}
    </AsyncState>
  );
}
