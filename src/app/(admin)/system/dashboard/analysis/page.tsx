'use client';

import React from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Avatar,
  AvatarGroup,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Skeleton,
  Alert,
  Tooltip,
  IconButton,
  Button,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import AttachMoneyRoundedIcon from '@mui/icons-material/AttachMoneyRounded';
import ShoppingCartRoundedIcon from '@mui/icons-material/ShoppingCartRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import { useQuery } from '@tanstack/react-query';
import { adminClient } from '@/lib/api/client';
import { alpha } from '@mui/material/styles';

// ── 类型 ──
interface TrendPoint {
  date: string;
  users: number;
  content: number;
  revenue: number;
  orders: number;
  activeUsers: number;
}

interface ContentDist {
  type: string;
  count: number;
  percent: number;
  color: string;
}

interface TopCreator {
  rank: number;
  id: number;
  name: string;
  avatar: string;
  fans: number;
  works: number;
  totalViews: number;
  growth: number;
}

interface Activity {
  id: number;
  user: string;
  avatar: string;
  action: string;
  target: string;
  time: string;
}

interface DashboardStats {
  totalUsers: number;
  totalUsersGrowth: number;
  totalContent: number;
  totalContentGrowth: number;
  todayRevenue: number;
  todayRevenueGrowth: number;
  totalOrders: number;
  totalOrdersGrowth: number;
  newUsersToday: number;
  activeUsersToday: number;
  conversionRate: number;
}

function useDashboard() {
  const stats = useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const r: any = await adminClient('/admin/dashboard/stats');
      return (r?.data?.data ?? r?.data ?? r) as DashboardStats;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const trend = useQuery<TrendPoint[]>({
    queryKey: ['dashboard', 'trend'],
    queryFn: async () => {
      const r: any = await adminClient('/admin/dashboard/trend', { params: { days: 30 } });
      const list = (r?.data?.data?.list ?? r?.data?.list ?? r?.list ?? []) as Array<{
        statDate: string; users: number; content: number; revenue: number; orders: number; activeUsers: number;
      }>;
      return list.map((p) => ({
        date: p.statDate,
        users: p.users,
        content: p.content,
        revenue: p.revenue,
        orders: p.orders,
        activeUsers: p.activeUsers,
      }));
    },
    staleTime: 60_000,
  });
  const contentDist = useQuery<ContentDist[]>({
    queryKey: ['dashboard', 'content-distribution'],
    queryFn: async () => {
      const r: any = await adminClient('/admin/dashboard/content-distribution');
      const list = (r?.data?.data?.list ?? r?.data?.list ?? r?.list ?? []) as Array<{
        type: string; count: number; percent: number; color: string;
      }>;
      return list.map((d) => ({ type: d.type, count: d.count, percent: d.percent, color: d.color }));
    },
    staleTime: 60_000,
  });
  const topCreators = useQuery<TopCreator[]>({
    queryKey: ['dashboard', 'top-creators'],
    queryFn: async () => [
      { rank: 1, id: 1, name: '风月无边', avatar: '', fans: 128000, works: 245, totalViews: 12500000, growth: 15.3 },
      { rank: 2, id: 2, name: '青云直上', avatar: '', fans: 96000, works: 180, totalViews: 8900000, growth: 22.1 },
      { rank: 3, id: 3, name: '墨染青衣', avatar: '', fans: 82000, works: 312, totalViews: 7600000, growth: 8.7 },
      { rank: 4, id: 4, name: '听雨轩主', avatar: '', fans: 75000, works: 156, totalViews: 6200000, growth: -2.1 },
      { rank: 5, id: 5, name: '落笔惊风', avatar: '', fans: 68000, works: 203, totalViews: 5800000, growth: 11.5 },
      { rank: 6, id: 6, name: '半盏流年', avatar: '', fans: 61000, works: 178, totalViews: 5100000, growth: 5.8 },
      { rank: 7, id: 7, name: '月下独酌', avatar: '', fans: 55000, works: 132, totalViews: 4500000, growth: 18.2 },
      { rank: 8, id: 8, name: '清风徐来', avatar: '', fans: 48000, works: 198, totalViews: 3900000, growth: -0.5 },
      { rank: 9, id: 9, name: '星河万里', avatar: '', fans: 42000, works: 165, totalViews: 3400000, growth: 9.4 },
      { rank: 10, id: 10, name: '雨后初晴', avatar: '', fans: 38000, works: 140, totalViews: 2800000, growth: 14.6 },
    ],
    staleTime: Infinity,
  });
  const activities = useQuery<Activity[]>({
    queryKey: ['dashboard', 'recent-activities'],
    queryFn: async () => [
      { id: 1, user: '风月无边', avatar: '', action: '发布了新文章', target: '《AI 绘画实战指南》', time: '2026-07-03T10:30:00' },
      { id: 2, user: '青云直上', avatar: '', action: '更新了视频', target: '《Go 微服务架构》第12集', time: '2026-07-03T09:45:00' },
      { id: 3, user: '墨染青衣', avatar: '', action: '上传了音频', target: '《夜的第七章》翻唱', time: '2026-07-03T08:20:00' },
      { id: 4, user: '听雨轩主', avatar: '', action: '创建了合集', target: '「古典诗词鉴赏」', time: '2026-07-03T07:15:00' },
      { id: 5, user: '落笔惊风', avatar: '', action: '回复了评论', target: '在《前端工程化》下', time: '2026-07-02T22:50:00' },
      { id: 6, user: '半盏流年', avatar: '', action: '发布了小说章节', target: '《长安十二时辰》第28章', time: '2026-07-02T21:30:00' },
      { id: 7, user: '月下独酌', avatar: '', action: '获得成就', target: '「万赞作者」勋章', time: '2026-07-02T20:00:00' },
      { id: 8, user: '清风徐来', avatar: '', action: '分享了帖子', target: '「数字人技术展望」', time: '2026-07-02T18:40:00' },
      { id: 9, user: '星河万里', avatar: '', action: '完成了认证', target: '「原创作者」认证', time: '2026-07-02T17:20:00' },
      { id: 10, user: '雨后初晴', avatar: '', action: '更新了专栏', target: '《摄影后期处理》系列', time: '2026-07-02T16:00:00' },
      { id: 11, user: '李前端', avatar: '', action: '提交了代码', target: 'dashboard v2 重构 PR', time: '2026-07-02T15:30:00' },
      { id: 12, user: '王后端', avatar: '', action: '部署了服务', target: 'Hermes 实例管理上线', time: '2026-07-02T14:00:00' },
      { id: 13, user: '陈设计', avatar: '', action: '上传了设计稿', target: '「首页改版 v3」', time: '2026-07-02T13:20:00' },
      { id: 14, user: '赵运维', avatar: '', action: '完成数据库迁移', target: 'PostgreSQL 向量索引', time: '2026-07-02T11:00:00' },
      { id: 15, user: '刘产品', avatar: '', action: '更新了需求文档', target: '「创作者中心 MVP」', time: '2026-07-02T10:00:00' },
    ],
    staleTime: 60_000,
  });
  return { stats, trend, contentDist, topCreators, activities };
}

// ── 数字格式化 ──
function fmt(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function fmtMoney(n: number): string {
  if (n >= 10000) return '¥' + (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return '¥' + n.toLocaleString();
  return '¥' + n;
}

// ── 简易趋势柱子 ──
function MiniBarChart({ data, height = 60, color = '#FE2C55' }: { data: number[]; height?: number; color?: string }) {
  const max = Math.max(...data, 1);
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '1px', height, mt: 1 }}>
      {data.map((v, i) => (
        <Box
          key={i}
          sx={{
            flex: 1,
            height: `${Math.max(2, (v / max) * height)}px`,
            bgcolor: color,
            borderRadius: '1px 1px 0 0',
            opacity: 0.8,
            transition: 'height 0.3s',
          }}
        />
      ))}
    </Box>
  );
}

// ── 简易趋势折线(48 小时内) ──
function SmallTrendLine({ data, width = 200, height = 36, color = '#FE2C55', negative }: { data: number[]; width?: number; height?: number; color?: string; negative?: boolean }) {
  const c = negative ? '#22C55E' : color;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = width / (data.length - 1 || 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={c}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <linearGradient id={`gr-${color.replace('#','')}`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor={c} stopOpacity="0.2" />
        <stop offset="100%" stopColor={c} stopOpacity="0" />
      </linearGradient>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#gr-${color.replace('#','')})`}
      />
    </svg>
  );
}

const StatCard = ({
  label, value, growth, icon, color, chartData,
}: {
  label: string;
  value: string;
  growth: number;
  icon: React.ReactNode;
  color: string;
  chartData: number[];
}) => (
  <Card sx={{ height: '100%' }}>
    <CardContent sx={{ pb: '8px !important' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {label}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
            {value}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
            <Chip
              icon={growth >= 0 ? <TrendingUpRoundedIcon /> : <TrendingDownRoundedIcon />}
              label={`${growth >= 0 ? '+' : ''}${growth}%`}
              size="small"
              color={growth >= 0 ? 'success' : 'error'}
              variant="outlined"
              sx={{ height: 22, fontSize: 11, '& .MuiChip-icon': { fontSize: 14 } }}
            />
            <Typography variant="caption" color="text.secondary">较上周</Typography>
          </Box>
        </Box>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            bgcolor: alpha(color, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
          }}
        >
          {icon}
        </Box>
      </Box>
      <SmallTrendLine data={chartData} color={growth < 0 ? '#22C55E' : color} negative={growth < 0} />
    </CardContent>
  </Card>
);

export default function DashboardAnalysisPage() {
  const { stats, trend, contentDist, topCreators, activities } = useDashboard();
  const [trendKey, setTrendKey] = React.useState<'users' | 'content' | 'revenue'>('users');

  const s = stats.data;
  const loading = stats.isLoading;

  // 为趋势图生成模拟数据点(30 个)
  const trendData = (trend.data || []).map((p: TrendPoint) => p[trendKey]);
  const trendMax = Math.max(...trendData, 1);

  if (stats.isError && !loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Alert severity="error">数据加载失败,请确认后端 API 已启动</Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: { xs: 2, md: 3 } }}>
        {/* ── 顶部 ── */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>数据分析</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              实时监控平台核心运营数据
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => { stats.refetch(); trend.refetch(); contentDist.refetch(); topCreators.refetch(); activities.refetch(); }}>
              刷新
            </Button>
          </Box>
        </Box>

        {/* ── 统计卡片 ── */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            {loading ? (
              <Skeleton variant="rounded" height={180} />
            ) : (
              <StatCard
                label="用户总数"
                value={fmt(s?.totalUsers || 0)}
                growth={s?.totalUsersGrowth || 0}
                icon={<PeopleRoundedIcon />}
                color="#5B8DEF"
                chartData={trend.data?.map((p: TrendPoint) => p.users) || Array(30).fill(0)}
              />
            )}
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            {loading ? (
              <Skeleton variant="rounded" height={180} />
            ) : (
              <StatCard
                label="内容总量"
                value={fmt(s?.totalContent || 0)}
                growth={s?.totalContentGrowth || 0}
                icon={<ArticleRoundedIcon />}
                color="#FE2C55"
                chartData={trend.data?.map((p: TrendPoint) => p.content) || Array(30).fill(0)}
              />
            )}
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            {loading ? (
              <Skeleton variant="rounded" height={180} />
            ) : (
              <StatCard
                label="今日收入"
                value={fmtMoney(s?.todayRevenue || 0)}
                growth={s?.todayRevenueGrowth || 0}
                icon={<AttachMoneyRoundedIcon />}
                color="#FFB400"
                chartData={trend.data?.map((p: TrendPoint) => p.revenue) || Array(30).fill(0)}
              />
            )}
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            {loading ? (
              <Skeleton variant="rounded" height={180} />
            ) : (
              <StatCard
                label="订单总量"
                value={fmt(s?.totalOrders || 0)}
                growth={s?.totalOrdersGrowth || 0}
                icon={<ShoppingCartRoundedIcon />}
                color="#5DDB96"
                chartData={trend.data?.map((p: TrendPoint) => p.orders) || Array(30).fill(0)}
              />
            )}
          </Grid>
        </Grid>

        {/* ── 实时快照 ── */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="overline" color="text.secondary">今日新增用户</Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#5B8DEF' }}>{loading ? <Skeleton width={60} sx={{ display: 'inline-block' }} /> : fmt(s?.newUsersToday || 0)}</Typography>
                <Typography variant="caption" color="text.secondary">实时</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="overline" color="text.secondary">活跃用户</Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#FE2C55' }}>{loading ? <Skeleton width={60} sx={{ display: 'inline-block' }} /> : fmt(s?.activeUsersToday || 0)}</Typography>
                <Typography variant="caption" color="text.secondary">今日</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="overline" color="text.secondary">转化率</Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#FFB400' }}>{loading ? <Skeleton width={60} sx={{ display: 'inline-block' }} /> : `${s?.conversionRate || 0}%`}</Typography>
                <Typography variant="caption" color="text.secondary">用户→付费</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* ── 30天趋势 + 内容分布 ── */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {/* 趋势图 */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">30 天趋势</Typography>
                  <ToggleButtonGroup
                    size="small"
                    value={trendKey}
                    exclusive
                    onChange={(_, v) => v && setTrendKey(v)}
                  >
                    <ToggleButton value="users" sx={{ fontSize: 11, px: 1.5 }}>用户</ToggleButton>
                    <ToggleButton value="content" sx={{ fontSize: 11, px: 1.5 }}>内容</ToggleButton>
                    <ToggleButton value="revenue" sx={{ fontSize: 11, px: 1.5 }}>收入</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                {trend.isLoading ? (
                  <Skeleton variant="rounded" height={220} />
                ) : (
                  <Box sx={{ position: 'relative', height: 240 }}>
                    {/* Y 轴标签 */}
                    <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 50, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      {[4, 3, 2, 1, 0].map((i) => (
                        <Typography key={i} variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                          {trendKey === 'revenue' ? `¥${Math.round(trendMax * i / 4 / 1000)}k` : Math.round(trendMax * i / 4)}
                        </Typography>
                      ))}
                    </Box>
                    {/* 简易柱状图 */}
                    <Box sx={{ ml: 6, height: '100%', display: 'flex', alignItems: 'flex-end', gap: '2px' }}>
                      {trendData.map((v: number, i: number) => (
                        <Tooltip
                          key={i}
                          title={`${trend.data?.[i]?.date}: ${trendKey === 'revenue' ? '¥' + v : v}`}
                          placement="top"
                        >
                          <Box
                            sx={{
                              flex: 1,
                              height: `${Math.max(2, (v / trendMax) * 200)}px`,
                              bgcolor: trendKey === 'revenue' ? '#FFB400' : trendKey === 'users' ? '#5B8DEF' : '#FE2C55',
                              borderRadius: '2px 2px 0 0',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              '&:hover': { opacity: 0.7, transform: 'scaleY(1.05)', transformOrigin: 'bottom' },
                            }}
                          />
                        </Tooltip>
                      ))}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* 内容分布 */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>内容类型分布</Typography>
                {contentDist.isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="rounded" height={24} sx={{ mb: 1 }} />)
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {(contentDist.data || []).map((item: ContentDist) => (
                      <Box key={item.type}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color }} />
                            <Typography variant="body2">{item.type}</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.percent}%</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={item.percent}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            bgcolor: alpha(item.color, 0.1),
                            '& .MuiLinearProgress-bar': { bgcolor: item.color, borderRadius: 3 },
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">{fmt(item.count)} 条</Typography>
                      </Box>
                    ))}
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mt: 1 }}>
                      {(contentDist.data || []).map((item: ContentDist, i: number) => (
                        <Box key={i} sx={{ width: `${item.percent}%`, height: 4, borderRadius: 2, bgcolor: item.color, minWidth: 4 }} />
                      ))}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* ── 创作者排行 + 最近活动 ── */}
        <Grid container spacing={2}>
          {/* Top 创作者 */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">创作者排行</Typography>
                  <Chip label="本月" size="small" />
                </Box>
                {topCreators.isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="rounded" height={48} sx={{ mb: 1 }} />)
                ) : (
                  <List disablePadding>
                    {(topCreators.data || []).slice(0, 8).map((c: TopCreator) => (
                      <React.Fragment key={c.id}>
                        <ListItem sx={{ px: 0, py: 1 }}>
                          <Typography
                            sx={{
                              width: 24,
                              fontWeight: 700,
                              fontSize: 14,
                              color: c.rank <= 3 ? (['#FFB400', '#A0A0A0', '#CD7F32'][c.rank - 1]) : 'text.secondary',
                            }}
                          >
                            {c.rank}
                          </Typography>
                          <ListItemAvatar sx={{ minWidth: 40 }}>
                            <Avatar src={c.avatar} sx={{ width: 32, height: 32 }} />
                          </ListItemAvatar>
                          <ListItemText
                            primary={c.name}
                            secondary={`${fmt(c.fans)} 粉丝 · ${c.works} 作品`}
                            slotProps={{ primary: { sx: { fontSize: 14, fontWeight: 500 } }, secondary: { sx: { fontSize: 12 } } }}
                          />
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13 }}>{fmt(c.totalViews)} 播放</Typography>
                            <Chip
                              icon={c.growth >= 0 ? <TrendingUpRoundedIcon /> : <TrendingDownRoundedIcon />}
                              label={`${c.growth >= 0 ? '+' : ''}${c.growth}%`}
                              size="small"
                              color={c.growth >= 0 ? 'success' : 'error'}
                              variant="outlined"
                              sx={{ height: 18, fontSize: 10, mt: 0.3 }}
                            />
                          </Box>
                        </ListItem>
                        <Divider component="li" />
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* 最近活动 */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>最近动态</Typography>
                {activities.isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} variant="rounded" height={40} sx={{ mb: 1 }} />)
                ) : (
                  <List dense disablePadding sx={{ maxHeight: 460, overflow: 'auto' }}>
                    {(activities.data || []).map((a: Activity, i: number) => (
                      <React.Fragment key={a.id}>
                        <ListItem sx={{ px: 0, py: 0.8 }}>
                          <ListItemAvatar sx={{ minWidth: 36 }}>
                            <Avatar src={a.avatar} sx={{ width: 28, height: 28 }} />
                          </ListItemAvatar>
                          <ListItemText
                            primary={<Typography variant="body2" sx={{ fontSize: 13 }}><b>{a.user}</b> {a.action} <b>{a.target}</b></Typography>}
                            secondary={new Date(a.time).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            slotProps={{ secondary: { sx: { fontSize: 11 } } }}
                          />
                        </ListItem>
                        {i < (activities.data || []).length - 1 && <Divider component="li" />}
                      </React.Fragment>
                    ))}
                    {(activities.data || []).length === 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>暂无动态</Typography>
                    )}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}
