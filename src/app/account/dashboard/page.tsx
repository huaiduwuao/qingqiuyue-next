'use client';

export const dynamic = "force-dynamic";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import LinearProgress from '@mui/material/LinearProgress';
import { LoginGate } from '@/components/auth/LoginGate';
import {
  getDashboardOverview,
  getTrendData,
  getContentStats,
  getFanProfile,
  formatCount,
  formatMoney,
  type DashboardOverview,
  type TrendData,
  type ContentStats,
  type FanProfile,
} from '@/apis/dashboard';

// 统计卡片行
function StatRow({ stats }: { stats?: DashboardOverview['stats'] }) {
  const items = [
    { label: '总阅读', value: formatCount(stats?.totalViews || 0), color: '#5B8DEF' },
    { label: '总点赞', value: formatCount(stats?.totalLikes || 0), color: '#FE2C55' },
    { label: '总收藏', value: formatCount(stats?.totalFavorites || 0), color: '#FFB400' },
    { label: '总分享', value: formatCount(stats?.totalShares || 0), color: '#5DDB96' },
    { label: '总收益', value: `¥${formatMoney(stats?.totalEarnings || 0)}`, color: '#9C27B0' },
  ];

  return (
    <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1, mb: 2 }}>
      {items.map(item => (
        <Paper
          key={item.label}
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: 'background.paper',
            minWidth: 120,
            flexShrink: 0,
          }}
        >
          <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.5 }}>{item.label}</Typography>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: item.color }}>{item.value}</Typography>
        </Paper>
      ))}
    </Box>
  );
}

// 趋势图表（简化版）
function TrendChart({ data }: { data: TrendData[] }) {
  if (!data?.length) return null;

  const maxViews = Math.max(...data.map(d => d.views), 1);

  return (
    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper', mb: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>📈 趋势概览</Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 100 }}>
        {data.map((d, i) => (
          <Box key={i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box
              sx={{
                width: '100%',
                height: `${Math.max((d.views / maxViews) * 100, 2)}%`,
                bgcolor: 'primary.main',
                borderRadius: '4px 4px 0 0',
                transition: 'height 0.3s',
              }}
            />
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
        {data.map((d, i) => (
          <Typography key={i} sx={{ flex: 1, fontSize: 9, color: 'text.disabled', textAlign: 'center' }}>
            {d.date.slice(5)}
          </Typography>
        ))}
      </Box>
    </Paper>
  );
}

// 内容排行
function ContentRanking({ contents }: { contents: ContentStats[] }) {
  return (
    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>🏆 内容表现 TOP10</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {contents?.slice(0, 10).map((c, i) => (
          <Box
            key={c.contentId}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.5,
              borderRadius: 1,
              bgcolor: i < 3 ? `${['#FFD700', '#C0C0C0', '#CD7F32'][i]}15` : 'action.hover',
            }}
          >
            <Box
              sx={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                bgcolor: i < 3 ? ['#FFD700', '#C0C0C0', '#CD7F32'][i] : 'action.disabled',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {i + 1}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.title || `内容 #${c.contentId}`}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, mt: 0.25 }}>
                <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>👁 {formatCount(c.views)}</Typography>
                <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>❤️ {formatCount(c.likes)}</Typography>
                <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>📤 {formatCount(c.shares)}</Typography>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

// 粉丝画像
function FanPortrait({ profile }: { profile?: FanProfile }) {
  const genderData = [
    { label: '男性', emoji: '👨', ratio: profile?.genderRatio?.male || 0.55 },
    { label: '女性', emoji: '👩', ratio: profile?.genderRatio?.female || 0.40 },
  ];

  return (
    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>👥 粉丝画像</Typography>

      {/* 核心数据 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 3 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: 28, fontWeight: 700, color: 'primary.main' }}>
            {formatCount(profile?.totalFans || 0)}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>总粉丝</Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: 28, fontWeight: 700, color: '#5DDB96' }}>
            {formatCount(profile?.activeFans || 0)}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>活跃粉丝</Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: 28, fontWeight: 700, color: '#FFB400' }}>
            {profile?.totalFans ? Math.round((profile.activeFans / profile.totalFans) * 100) : 0}%
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>活跃率</Typography>
        </Box>
      </Box>

      {/* 性别分布 */}
      <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 1 }}>性别分布</Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        {genderData.map(g => (
          <Box key={g.label} sx={{ flex: 1, textAlign: 'center', p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
            <Typography sx={{ fontSize: 28 }}>{g.emoji}</Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{Math.round(g.ratio * 100)}%</Typography>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{g.label}</Typography>
          </Box>
        ))}
      </Box>

      {/* 年龄分布 */}
      <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 1 }}>年龄分布</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {Object.entries(profile?.ageDist || {}).map(([age, ratio]) => (
          <Box key={age} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 11, width: 50 }}>{age}</Typography>
            <LinearProgress
              variant="determinate"
              value={(ratio as number) * 100}
              sx={{ flex: 1, height: 8, borderRadius: 4 }}
            />
            <Typography sx={{ fontSize: 10, width: 30, textAlign: 'right' }}>
              {Math.round((ratio as number) * 100)}%
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

// 概览 Tab
function OverviewTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: getDashboardOverview,
    staleTime: 60 * 1000,
  });

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}>加载中...</Box>;

  return (
    <>
      <StatRow stats={data?.stats} />
      <TrendChart data={data?.trend || []} />
      <Box sx={{ mt: 2 }} />
      <FanPortrait profile={data?.fans} />
    </>
  );
}

// 内容 Tab
function ContentTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['content-stats'],
    queryFn: () => getContentStats(20),
    staleTime: 60 * 1000,
  });

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}>加载中...</Box>;

  return <ContentRanking contents={data?.contents || []} />;
}

// 趋势 Tab
function TrendTab() {
  const [days, setDays] = useState(7);
  const { data, isLoading } = useQuery({
    queryKey: ['trend-data', days],
    queryFn: () => getTrendData(days),
    staleTime: 60 * 1000,
  });

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}>加载中...</Box>;

  const trend = data?.trend || [];
  const totalViews = trend.reduce((sum, d) => sum + d.views, 0);
  const totalLikes = trend.reduce((sum, d) => sum + d.likes, 0);
  const totalShares = trend.reduce((sum, d) => sum + d.share, 0);

  return (
    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>📈 数据趋势（{days}天）</Typography>
        <Tabs
          value={days}
          onChange={(_, v) => setDays(v as number)}
          sx={{ '& .MuiTab-root': { minHeight: 32, fontSize: 12 } }}
        >
          <Tab label="7天" value={7} />
          <Tab label="14天" value={14} />
          <Tab label="30天" value={30} />
        </Tabs>
      </Box>
      <TrendChart data={trend} />

      {/* 汇总 */}
      <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
        <Box sx={{ flex: 1, p: 2, borderRadius: 1, bgcolor: 'action.hover', textAlign: 'center' }}>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'primary.main' }}>{formatCount(totalViews)}</Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>总阅读</Typography>
        </Box>
        <Box sx={{ flex: 1, p: 2, borderRadius: 1, bgcolor: 'action.hover', textAlign: 'center' }}>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#FE2C55' }}>{formatCount(totalLikes)}</Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>总点赞</Typography>
        </Box>
        <Box sx={{ flex: 1, p: 2, borderRadius: 1, bgcolor: 'action.hover', textAlign: 'center' }}>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#5DDB96' }}>{formatCount(totalShares)}</Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>总分享</Typography>
        </Box>
      </Box>
    </Paper>
  );
}

// 粉丝 Tab
function FansTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['fan-profile'],
    queryFn: getFanProfile,
    staleTime: 60 * 1000,
  });

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}>加载中...</Box>;

  return <FanPortrait profile={data} />;
}

export default function CreatorDashboardPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 66px))', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
        <LoginGate mode="replace" message="登录后查看数据大盘">
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>📊 创作者数据大盘</Typography>

          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ mb: 2, '& .MuiTab-root': { minWidth: 'auto', px: 2 } }}
          >
            <Tab label="概览" />
            <Tab label="内容" />
            <Tab label="趋势" />
            <Tab label="粉丝" />
          </Tabs>

          {tab === 0 && <OverviewTab />}
          {tab === 1 && <ContentTab />}
          {tab === 2 && <TrendTab />}
          {tab === 3 && <FansTab />}
        </LoginGate>
      </Box>
    </Box>
  );
}
