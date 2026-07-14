'use client';

import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Skeleton,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
} from '@mui/material';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { useQuery } from '@tanstack/react-query';
import { adminClient } from '@/lib/api/client';
import { alpha } from '@mui/material/styles';

interface VisitorStats {
  todayPv: number;
  todayUv: number;
  totalPv: number;
  totalUv: number;
  avgPvPerUser: number;
  topPages: { path: string; views: number }[];
  pvTrend: { date: string; pv: number; uv: number }[];
  dau: number;
  wau: number;
  mau: number;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return (n / 10_000).toFixed(1) + '万';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

function SmallBarChart({ data, height = 48, color = '#5B8DEF' }: { data: number[]; height?: number; color?: string }) {
  const max = Math.max(...data, 1);
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height }}>
      {data.map((v, i) => (
        <Box
          key={i}
          sx={{
            flex: 1,
            height: `${Math.max(2, (v / max) * height)}px`,
            bgcolor: color,
            borderRadius: '1px 1px 0 0',
            opacity: 0.75,
          }}
        />
      ))}
    </Box>
  );
}

function TrendChart({ data, height = 160, label }: { data: { date: string; pv: number; uv: number }[]; height?: number; label: string }) {
  const max = Math.max(...data.map(d => d.pv), 1);
  const stepX = 800 / (data.length - 1 || 1);
  const w = 800;

  const pvPoints = data.map((d, i) => `${i * stepX},${height - (d.pv / max) * (height - 8) - 4}`).join(' ');
  const uvPoints = data.map((d, i) => `${i * stepX},${height - (d.uv / max) * (height - 8) - 4}`).join(' ');

  const areaPv = `0,${height} ${pvPoints} ${(data.length - 1) * stepX},${height}`;
  const areaUv = `0,${height} ${uvPoints} ${(data.length - 1) * stepX},${height}`;

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <svg width="100%" height={height + 24} viewBox={`0 0 ${w} ${height + 24}`} style={{ display: 'block', maxWidth: 800 }}>
        <defs>
          <linearGradient id="gr-pv" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#5B8DEF" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#5B8DEF" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gr-uv" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#FE2C55" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#FE2C55" stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={areaPv} fill="url(#gr-pv)" />
        <polygon points={areaUv} fill="url(#gr-uv)" />
        <polyline points={pvPoints} fill="none" stroke="#5B8DEF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={uvPoints} fill="none" stroke="#FE2C55" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <text key={i} x={i * stepX} y={height + 18} textAnchor="middle" fontSize={9} fill="#888">{d.date}</text>
        ))}
      </svg>
      <Box sx={{ display: 'flex', gap: 3, mt: 1, justifyContent: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 2, bgcolor: '#5B8DEF', borderRadius: 1 }} />
          <Typography variant="caption" color="text.secondary">PV</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 2, bgcolor: '#FE2C55', borderRadius: 1 }} />
          <Typography variant="caption" color="text.secondary">UV</Typography>
        </Box>
      </Box>
    </Box>
  );
}

function useVisitorStats() {
  return useQuery<VisitorStats>({
    queryKey: ['stats', 'visitor'],
    queryFn: async () => {
      const r: any = await adminClient('/admin/dashboard/stats/visitor');
      return (r?.data?.data ?? r?.data ?? r) as VisitorStats;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export default function VisitorStatsPage() {
  const stats = useVisitorStats();
  const [range, setRange] = useState<'7d' | '30d'>('7d');

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
  const pvData = (s?.pvTrend || []).map((p) => p.pv);
  const uvData = (s?.pvTrend || []).map((p) => p.uv);

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>站点流量</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              PV / UV / 人均访问次数 / 热门页面
            </Typography>
          </Box>
          <ToggleButtonGroup size="small" value={range} exclusive onChange={(_, v) => v && setRange(v)}>
            <ToggleButton value="7d" sx={{ fontSize: 12, px: 2 }}>近7天</ToggleButton>
            <ToggleButton value="30d" sx={{ fontSize: 12, px: 2 }}>近30天</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* 核心指标卡片 */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            {stats.isLoading ? <Skeleton variant="rounded" height={100} /> : (
              <Card>
                <CardContent sx={{ textAlign: 'center', pb: '12px !important' }}>
                  <VisibilityRoundedIcon sx={{ color: '#5B8DEF', fontSize: 20, mb: 0.5 }} />
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{fmt(s?.todayPv ?? 0)}</Typography>
                  <Typography variant="caption" color="text.secondary">今日 PV</Typography>
                </CardContent>
              </Card>
            )}
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            {stats.isLoading ? <Skeleton variant="rounded" height={100} /> : (
              <Card>
                <CardContent sx={{ textAlign: 'center', pb: '12px !important' }}>
                  <PeopleRoundedIcon sx={{ color: '#FE2C55', fontSize: 20, mb: 0.5 }} />
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{fmt(s?.todayUv ?? 0)}</Typography>
                  <Typography variant="caption" color="text.secondary">今日 UV</Typography>
                </CardContent>
              </Card>
            )}
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            {stats.isLoading ? <Skeleton variant="rounded" height={100} /> : (
              <Card>
                <CardContent sx={{ textAlign: 'center', pb: '12px !important' }}>
                  <TrendingUpRoundedIcon sx={{ color: '#FFB400', fontSize: 20, mb: 0.5 }} />
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{((s?.avgPvPerUser ?? 0)).toFixed(1)}</Typography>
                  <Typography variant="caption" color="text.secondary">人均 PV</Typography>
                </CardContent>
              </Card>
            )}
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            {stats.isLoading ? <Skeleton variant="rounded" height={100} /> : (
              <Card>
                <CardContent sx={{ textAlign: 'center', pb: '12px !important' }}>
                  <PeopleRoundedIcon sx={{ color: '#8B5CF6', fontSize: 20, mb: 0.5 }} />
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{fmt(s?.dau ?? 0)}</Typography>
                  <Typography variant="caption" color="text.secondary">DAU</Typography>
                </CardContent>
              </Card>
            )}
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            {stats.isLoading ? <Skeleton variant="rounded" height={100} /> : (
              <Card>
                <CardContent sx={{ textAlign: 'center', pb: '12px !important' }}>
                  <ShowChartRoundedIcon sx={{ color: '#5DDB96', fontSize: 20, mb: 0.5 }} />
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{fmt(s?.wau ?? 0)}</Typography>
                  <Typography variant="caption" color="text.secondary">WAU</Typography>
                </CardContent>
              </Card>
            )}
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            {stats.isLoading ? <Skeleton variant="rounded" height={100} /> : (
              <Card>
                <CardContent sx={{ textAlign: 'center', pb: '12px !important' }}>
                  <ShowChartRoundedIcon sx={{ color: '#25F4EE', fontSize: 20, mb: 0.5 }} />
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{fmt(s?.mau ?? 0)}</Typography>
                  <Typography variant="caption" color="text.secondary">MAU</Typography>
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>

        {/* 趋势图 */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>PV / UV 趋势</Typography>
            {stats.isLoading ? <Skeleton variant="rounded" height={200} /> : (
              <TrendChart data={s?.pvTrend || []} label="PV/UV" />
            )}
          </CardContent>
        </Card>

        <Grid container spacing={2}>
          {/* 热门页面 */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>热门页面 Top10</Typography>
                {stats.isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} variant="rounded" height={32} sx={{ mb: 1 }} />)
                ) : (
                  <Box>
                    {(s?.topPages || []).map((p, i) => (
                      <Box key={i}>
                        <Box sx={{ display: 'flex', alignItems: 'center', py: 0.75, gap: 1 }}>
                          <Typography sx={{ width: 20, fontWeight: 700, fontSize: 13,
                            color: i < 3 ? ['#FFB400', '#A0A0A0', '#CD7F32'][i] : 'text.secondary' }}>
                            {i + 1}
                          </Typography>
                          <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }} noWrap>
                            {p.path || '/'}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12 }}>
                            {fmt(p.views)}
                          </Typography>
                        </Box>
                        {i < ((s?.topPages || []).length - 1) && <Divider />}
                      </Box>
                    ))}
                    {(!s?.topPages || s.topPages.length === 0) && (
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                        暂无数据
                      </Typography>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* 累计统计 */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>累计统计</Typography>
                {stats.isLoading ? <Skeleton variant="rounded" height={200} /> : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[
                      { label: '累计 PV', value: fmt(s?.totalPv ?? 0), color: '#5B8DEF' },
                      { label: '累计 UV', value: fmt(s?.totalUv ?? 0), color: '#FE2C55' },
                    ].map((item) => (
                      <Box key={item.label}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2">{item.label}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.value}</Typography>
                        </Box>
                        <Box sx={{ height: 6, borderRadius: 3, bgcolor: alpha(item.color, 0.1) }} />
                      </Box>
                    ))}
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
