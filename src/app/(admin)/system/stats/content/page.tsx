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
  Chip,
  Divider,
  ImageList,
  ImageListItem,
} from '@mui/material';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import { useQuery } from '@tanstack/react-query';
import { adminClient } from '@/lib/api/client';
import { alpha } from '@mui/material/styles';

interface ContentStats {
  categories: { type: string; label: string; pv: number; uv: number; color: string }[];
  hotContent: { id: number; title: string; cover: string; author: string; category: string; pv: number; score: number }[];
  hourlyDist: { hour: number; pv: number }[];
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return (n / 10_000).toFixed(1) + '万';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

function useContentStats() {
  return useQuery<ContentStats>({
    queryKey: ['stats', 'content'],
    queryFn: async () => {
      const r: any = await adminClient('/admin/dashboard/stats/content');
      return (r?.data?.data ?? r?.data ?? r) as ContentStats;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export default function ContentStatsPage() {
  const stats = useContentStats();

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
  const maxPv = Math.max(...(s?.categories || []).map(c => c.pv), 1);
  const maxHour = Math.max(...(s?.hourlyDist || []).map(h => h.pv), 1);

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: { xs: 2, md: 3 } }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>内容热度</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            各分类访问量 / 热门内容 / 访问时段分布
          </Typography>
        </Box>

        <Grid container spacing={2}>
          {/* 分类热度柱状图 */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <BarChartRoundedIcon sx={{ color: '#FE2C55', fontSize: 20 }} />
                  <Typography variant="h6">分类访问量</Typography>
                </Box>
                {stats.isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="rounded" height={32} sx={{ mb: 1 }} />)
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {(s?.categories || []).map((cat) => (
                      <Box key={cat.type}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: cat.color }} />
                            <Typography variant="body2">{cat.label || cat.type}</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: cat.color }}>
                            PV {fmt(cat.pv)} / UV {fmt(cat.uv)}
                          </Typography>
                        </Box>
                        <Box sx={{ height: 6, borderRadius: 3, bgcolor: alpha(cat.color, 0.08) }}>
                          <Box sx={{
                            height: '100%',
                            width: `${(cat.pv / maxPv) * 100}%`,
                            bgcolor: cat.color,
                            borderRadius: 3,
                            transition: 'width 0.4s',
                          }} />
                        </Box>
                      </Box>
                    ))}
                    {(!s?.categories || s.categories.length === 0) && (
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                        暂无数据
                      </Typography>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* 时段分布 */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <AccessTimeRoundedIcon sx={{ color: '#FFB400', fontSize: 20 }} />
                  <Typography variant="h6">访问时段分布 (24h)</Typography>
                </Box>
                {stats.isLoading ? <Skeleton variant="rounded" height={200} /> : (
                  <Box>
                    {/* 迷你柱状图 */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: 100 }}>
                      {(s?.hourlyDist || []).map((h) => (
                        <Box
                          key={h.hour}
                          sx={{
                            flex: 1,
                            height: `${Math.max(2, (h.pv / maxHour) * 100)}px`,
                            bgcolor: '#FFB400',
                            borderRadius: '1px 1px 0 0',
                            opacity: 0.7,
                            minWidth: 4,
                          }}
                          title={`${h.hour}:00 - ${fmt(h.pv)}`}
                        />
                      ))}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                      {['0h', '6h', '12h', '18h', '24h'].map((t) => (
                        <Typography key={t} variant="caption" color="text.secondary">{t}</Typography>
                      ))}
                    </Box>
                    {/* 高峰时段标注 */}
                    {s?.hourlyDist && (
                      <Box sx={{ mt: 1.5 }}>
                        {(() => {
                          const peak = (s.hourlyDist || []).reduce((max, h) => h.pv > max.pv ? h : max, { hour: 0, pv: 0 });
                          if (peak.pv === 0) return null;
                          return (
                            <Chip
                              label={`高峰: ${peak.hour}:00 - ${fmt(peak.pv)} PV`}
                              size="small"
                              sx={{ bgcolor: alpha('#FFB400', 0.15), color: '#FFB400', fontWeight: 600 }}
                            />
                          );
                        })()}
                      </Box>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* 热门内容 */}
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <TrendingUpRoundedIcon sx={{ color: '#8B5CF6', fontSize: 20 }} />
                  <Typography variant="h6">热门内容 Top10</Typography>
                </Box>
                {stats.isLoading ? (
                  <Grid container spacing={2}>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                        <Skeleton variant="rounded" height={80} />
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Grid container spacing={2}>
                    {(s?.hotContent || []).map((item, i) => (
                      <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                          <Typography sx={{
                            width: 20,
                            fontWeight: 700,
                            fontSize: 14,
                            color: i < 3 ? ['#FFB400', '#A0A0A0', '#CD7F32'][i] : 'text.secondary',
                            textAlign: 'center',
                          }}>
                            {i + 1}
                          </Typography>
                          {item.cover ? (
                            <Box
                              component="img"
                              src={item.cover}
                              alt={item.title}
                              sx={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <Skeleton variant="rounded" width={64} height={48} />
                          )}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                              {item.title || '(无标题)'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {item.author || ''} {item.category ? `· ${item.category}` : ''}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.3 }}>
                              <Typography variant="caption" sx={{ color: '#FE2C55', fontWeight: 600 }}>
                                {fmt(item.pv)} PV
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                热度 {item.score.toFixed(0)}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                        {i < ((s?.hotContent || []).length - 1) && <Divider sx={{ mt: 1.5 }} />}
                      </Grid>
                    ))}
                    {(!s?.hotContent || s.hotContent.length === 0) && (
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                          暂无数据
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}
