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
  Stack,
  Divider,
} from '@mui/material';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import { useQuery } from '@tanstack/react-query';
import { adminClient } from '@/lib/api/client';
import { alpha } from '@mui/material/styles';

interface ActiveStats {
  dau: number;
  wau: number;
  mau: number;
  /** 真人活跃 */
  dauReal: number;
  dauBot: number;
  wauReal: number;
  wauBot: number;
  mauReal: number;
  mauBot: number;
  dauTrend: { date: string; uv: number; uvReal: number; uvBot: number }[];
  newUsers: { date: string; count: number; countReal: number; countBot: number }[];
  retention: {
    nextDay: number;
    day7: number;
    day30: number;
    nextDayReal: number;
    day7Real: number;
    day30Real: number;
    nextDayBot: number;
    day7Bot: number;
    day30Bot: number;
  };
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
      return r as ActiveStats;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/** 一组数字:大号主值 + 小号副标题(真人/机器人分拆) */
function SplitValue({ value, real, bot, sub, color }: { value: number; real: number; bot: number; sub: string; color: string }) {
  return (
    <CardContent sx={{ textAlign: 'center', pb: '12px !important' }}>
      <Typography variant="caption" color="text.secondary">{sub}</Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, color }}>{fmt(value)}</Typography>
      <Stack direction="row" spacing={0.5} sx={{ mt: 0.25, fontSize: 11, justifyContent: 'center' }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: '#5DDB96' }}>
          <PeopleRoundedIcon sx={{ fontSize: 12 }} />
          <span>{fmt(real)}</span>
        </Box>
        <Box sx={{ color: 'text.disabled' }}>/</Box>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: '#8B5CF6' }}>
          <SmartToyRoundedIcon sx={{ fontSize: 12 }} />
          <span>{fmt(bot)}</span>
        </Box>
      </Stack>
    </CardContent>
  );
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
  // 兼容老后端:缺字段时按 0/总和兜底,前端不至于整页空白
  const safe = (v?: number) => v ?? 0;
  const sDauReal = safe(s?.dauReal) || safe(s?.dau);
  const sDauBot = safe(s?.dauBot);
  const sWauReal = safe(s?.wauReal) || safe(s?.wau);
  const sWauBot = safe(s?.wauBot);
  const sMauReal = safe(s?.mauReal) || safe(s?.mau);
  const sMauBot = safe(s?.mauBot);

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: { xs: 2, md: 3 } }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>用户活跃</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            DAU / WAU / MAU / 新增用户趋势 / 留存率 — 真人和机器人分开
          </Typography>
        </Box>

        {/* 核心指标:每个卡片内部展示 真人/机器人 两个数 */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'DAU', value: fmt(sDauReal + sDauBot), real: sDauReal, bot: sDauBot, sub: '日活跃用户', color: '#5DDB96' },
            { label: 'WAU', value: fmt(sWauReal + sWauBot), real: sWauReal, bot: sWauBot, sub: '周活跃用户', color: '#5B8DEF' },
            { label: 'MAU', value: fmt(sMauReal + sMauBot), real: sMauReal, bot: sMauBot, sub: '月活跃用户', color: '#FE2C55' },
          ].map((card) => (
            <Grid key={card.label} size={{ xs: 4 }}>
              {stats.isLoading ? <Skeleton variant="rounded" height={120} /> : (
                <Card>
                  <SplitValue value={card.real + card.bot} real={card.real} bot={card.bot} sub={card.sub} color={card.color} />
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
                <Typography variant="h6" sx={{ mb: 1 }}>日活趋势 (7天)</Typography>
                {stats.isLoading ? <Skeleton variant="rounded" height={200} /> : (
                  <>
                    <TrendChart data={s?.dauTrend || []} />
                    {/* 真人/机器人堆叠条:7 天每天一行,真人一段 + 机器人一段 */}
                    <Stack spacing={0.5} sx={{ mt: 1.5 }}>
                      {(s?.dauTrend || []).map((d, i) => {
                        const total = Math.max(d.uv, 1);
                        const realPct = (d.uvReal / total) * 100;
                        const botPct = (d.uvBot / total) * 100;
                        return (
                          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 11 }}>
                            <Typography variant="caption" sx={{ width: 40, color: 'text.secondary' }}>{d.date}</Typography>
                            <Box sx={{ flex: 1, height: 12, borderRadius: 1, overflow: 'hidden', display: 'flex', bgcolor: alpha('#5DDB96', 0.1) }}>
                              <Box sx={{ width: `${realPct}%`, bgcolor: '#5DDB96' }} title={`真人 ${d.uvReal}`} />
                              <Box sx={{ width: `${botPct}%`, bgcolor: '#8B5CF6' }} title={`机器人 ${d.uvBot}`} />
                            </Box>
                            <Typography variant="caption" sx={{ width: 60, textAlign: 'right' }}>
                              <span style={{ color: '#5DDB96' }}>{fmt(d.uvReal)}</span>
                              <span style={{ color: '#bbb' }}> / </span>
                              <span style={{ color: '#8B5CF6' }}>{fmt(d.uvBot)}</span>
                            </Typography>
                          </Box>
                        );
                      })}
                      <Stack direction="row" spacing={2} sx={{ pt: 1, justifyContent: 'center' }}>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 11 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: '#5DDB96' }} />
                          <Typography variant="caption">真人</Typography>
                        </Box>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 11 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: '#8B5CF6' }} />
                          <Typography variant="caption">机器人</Typography>
                        </Box>
                      </Stack>
                    </Stack>
                  </>
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
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rounded" height={56} sx={{ mb: 1.5 }} />)
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[
                      { label: '次日留存', total: s?.retention?.nextDay ?? 0, real: s?.retention?.nextDayReal ?? 0, bot: s?.retention?.nextDayBot ?? 0 },
                      { label: '7日留存', total: s?.retention?.day7 ?? 0, real: s?.retention?.day7Real ?? 0, bot: s?.retention?.day7Bot ?? 0 },
                      { label: '30日留存', total: s?.retention?.day30 ?? 0, real: s?.retention?.day30Real ?? 0, bot: s?.retention?.day30Bot ?? 0 },
                    ].map((r) => (
                      <Box key={r.label}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
                          <Typography variant="body2">{r.label}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#5DDB96' }}>
                            {r.total > 0 ? r.total.toFixed(1) + '%' : '-'}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(r.total, 100)}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            bgcolor: alpha('#5DDB96', 0.1),
                            '& .MuiLinearProgress-bar': { bgcolor: '#5DDB96', borderRadius: 3 },
                          }}
                        />
                        <Stack direction="row" spacing={1.5} sx={{ mt: 0.5, fontSize: 11 }}>
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                            <PeopleRoundedIcon sx={{ fontSize: 12, color: '#5DDB96' }} />
                            <Typography variant="caption">真人 {r.real > 0 ? r.real.toFixed(1) + '%' : '-'}</Typography>
                          </Box>
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                            <SmartToyRoundedIcon sx={{ fontSize: 12, color: '#8B5CF6' }} />
                            <Typography variant="caption">机器人 {r.bot > 0 ? r.bot.toFixed(1) + '%' : '-'}</Typography>
                          </Box>
                        </Stack>
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
                  <Stack direction="row" spacing={2} sx={{ ml: 'auto' }}>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 12 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: '#FE2C55' }} />
                      <Typography variant="caption">真人</Typography>
                    </Box>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 12 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: '#8B5CF6' }} />
                      <Typography variant="caption">机器人</Typography>
                    </Box>
                  </Stack>
                </Box>
                {stats.isLoading ? <Skeleton variant="rounded" height={100} /> : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {(s?.newUsers || []).map((n, i) => {
                      const maxCount = Math.max(...(s?.newUsers || []).map(u => u.count), 1);
                      const realPct = (n.countReal / maxCount) * 100;
                      const botPct = (n.countBot / maxCount) * 100;
                      return (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Typography variant="body2" sx={{ width: 50, color: 'text.secondary', fontSize: 12 }}>{n.date}</Typography>
                          <Box sx={{ flex: 1, bgcolor: alpha('#FE2C55', 0.08), borderRadius: 1, height: 24, position: 'relative', overflow: 'hidden' }}>
                            <Box sx={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${realPct}%`, bgcolor: '#FE2C55', opacity: 0.85 }} />
                            <Box sx={{ position: 'absolute', left: `${realPct}%`, top: 0, height: '100%', width: `${botPct}%`, bgcolor: '#8B5CF6', opacity: 0.85 }} />
                            <Typography variant="caption" sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontWeight: 600 }}>
                              <span style={{ color: '#FE2C55' }}>{fmt(n.countReal)}</span>
                              <span style={{ color: '#bbb' }}> / </span>
                              <span style={{ color: '#8B5CF6' }}>{fmt(n.countBot)}</span>
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                    {(!s?.newUsers || s.newUsers.length === 0) && (
                      <Typography variant="body2" color="text.secondary">暂无数据</Typography>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />
        <Stack direction="row" spacing={2} sx={{ color: 'text.secondary', fontSize: 12 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <PeopleRoundedIcon sx={{ fontSize: 14, color: '#5DDB96' }} />
            <Typography variant="caption">真人 = user.is_bot = 0</Typography>
          </Box>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <SmartToyRoundedIcon sx={{ fontSize: 14, color: '#8B5CF6' }} />
            <Typography variant="caption">机器人 = user.is_bot = 1</Typography>
          </Box>
        </Stack>
      </Box>
    </Container>
  );
}
