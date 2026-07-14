'use client';

import React from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Skeleton,
  Alert,
  LinearProgress,
} from '@mui/material';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import { useQuery } from '@tanstack/react-query';
import { adminClient } from '@/lib/api/client';
import { alpha } from '@mui/material/styles';

interface ActiveStats {
  dau: number;
  wau: number;
  mau: number;
  dauTrend: { date: string; uv: number }[];
  newUsers: { date: string; count: number }[];
  retention: { nextDay: number; day7: number; day30: number };
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return (n / 10_000).toFixed(1) + '万';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

function TrendChart({ data, height = 160 }: { data: { date: string; uv: number }[]; height?: number }) {
  const max = Math.max(...data.map(d => d.uv), 1);
  const stepX = 600 / (data.length - 1 || 1);
  const w = 600;
  const pts = data.map((d, i) => `${i * stepX},${height - (d.uv / max) * (height - 8) - 4}`).join(' ');
  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <svg width="100%" height={height + 24} viewBox={`0 0 ${w} ${height + 24}`} style={{ display: 'block' }}>
        <linearGradient id="gr" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#5DDB96" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#5DDB96" stopOpacity={0} />
        </linearGradient>
        <polygon points={`0,${height} ${pts} ${(data.length - 1) * stepX},${height}`} fill="url(#gr)" />
        <polyline points={pts} fill="none" stroke="#5DDB96" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <text key={i} x={i * stepX} y={height + 18} textAnchor="middle" fontSize={9} fill="#888">{d.date}</text>
        ))}
      </svg>
    </Box>
  );
}

function useActiveStats() {
  return useQuery<ActiveStats>({
    queryKey: ['stats', 'active'],
    queryFn: async () => {
      const r: any = await adminClient('/admin/dashboard/stats/active');
      return (r?.data?.data ?? r?.data ?? r) as ActiveStats;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export default function ActiveStatsPage() {
  const stats = useActiveStats();

  if (stats.isError && !stats.isLoading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <Alert severity="error">数据加载失败,请确认后端 API 已启动</Alert>
        </Box>
      </Container>
    );
  }

  const s = stats.data;

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: { xs: 2, md: 3 } }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>用户活跃</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            DAU / WAU / MAU / 新增用户趋势 / 留存率
          </Typography>
        </Box>

        {/* 核心指标 */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'DAU', value: fmt(s?.dau ?? 0), sub: '日活跃用户', color: '#5DDB96' },
            { label: 'WAU', value: fmt(s?.wau ?? 0), sub: '周活跃用户', color: '#5B8DEF' },
            { label: 'MAU', value: fmt(s?.mau ?? 0), sub: '月活跃用户', color: '#FE2C55' },
          ].map((card) => (
            <Grid key={card.label} size={{ xs: 4 }}>
              {stats.isLoading ? <Skeleton variant="rounded" height={100} /> : (
                <Card>
                  <CardContent sx={{ textAlign: 'center', pb: '12px !important' }}>
                    <PeopleRoundedIcon sx={{ color: card.color, fontSize: 20, mb: 0.5 }} />
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{card.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{card.sub}</Typography>
                  </CardContent>
                </Card>
              )}
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={2}>
          {/* DAU 趋势 */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>日活趋势 (7天)</Typography>
                {stats.isLoading ? <Skeleton variant="rounded" height={200} /> : (
                  <TrendChart data={s?.dauTrend || []} />
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* 留存率 */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <EmojiEventsRoundedIcon sx={{ color: '#FFB400', fontSize: 20 }} />
                  <Typography variant="h6">留存率</Typography>
                </Box>
                {stats.isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rounded" height={48} sx={{ mb: 1.5 }} />)
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[
                      { label: '次日留存', pct: s?.retention?.nextDay ?? 0, color: '#5DDB96' },
                      { label: '7日留存', pct: s?.retention?.day7 ?? 0, color: '#5B8DEF' },
                      { label: '30日留存', pct: s?.retention?.day30 ?? 0, color: '#8B5CF6' },
                    ].map((r) => (
                      <Box key={r.label}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2">{r.label}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: r.color }}>
                            {r.pct > 0 ? r.pct.toFixed(1) + '%' : '-'}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(r.pct, 100)}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            bgcolor: alpha(r.color, 0.1),
                            '& .MuiLinearProgress-bar': { bgcolor: r.color, borderRadius: 4 },
                          }}
                        />
                      </Box>
                    ))}
                    {(!s?.retention?.nextDay && !s?.retention?.day7) && (
                      <Typography variant="caption" color="text.secondary">数据不足,无法计算留存</Typography>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* 新增用户趋势 */}
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <TrendingUpRoundedIcon sx={{ color: '#FE2C55', fontSize: 20 }} />
                  <Typography variant="h6">新增用户趋势 (7天)</Typography>
                </Box>
                {stats.isLoading ? <Skeleton variant="rounded" height={100} /> : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {(s?.newUsers || []).map((n, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2" sx={{ width: 50, color: 'text.secondary', fontSize: 12 }}>{n.date}</Typography>
                        <Box sx={{ flex: 1, bgcolor: alpha('#FE2C55', 0.1), borderRadius: 1, height: 24, position: 'relative' }}>
                          <Box sx={{
                            height: '100%',
                            width: `${Math.min((n.count / (Math.max(...(s?.newUsers || []).map(u => u.count) || [1]))) * 100, 100)}%`,
                            bgcolor: '#FE2C55',
                            borderRadius: 1,
                            opacity: 0.7,
                          }} />
                          <Typography variant="caption" sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontWeight: 600 }}>
                            {fmt(n.count)}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                    {(!s?.newUsers || s.newUsers.length === 0) && (
                      <Typography variant="body2" color="text.secondary">暂无数据</Typography>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}
