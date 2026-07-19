'use client';

/**
 * 爬虫 Dashboard
 * 从 account/content/_views/spider/dashboard/ 迁移
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ArticleIcon from '@mui/icons-material/Article';
import LinkIcon from '@mui/icons-material/Link';
import StorageIcon from '@mui/icons-material/Storage';
import {
  getWorkerStats,
  getSiteSlotStats,
  getBatchStats,
  getProxyStats,
  getCrawlTimeseries,
  getRecentActivity,
  getHourlyStats,
  triggerHourlyRefresh,
} from '@/apis/spider';
import type {
  CrawlTimeseriesPoint,
  ActivityEvent,
  ActivitySeverity,
  ActivityType,
  Worker,
} from '@/beans/spider';
import { useSpiderWebSocket } from '@/hooks/useSpiderWebSocket';

const fmt = (n: number | undefined) => (n == null ? '—' : n.toLocaleString('zh-CN'));
const POLL_MS = 5000;

const SEV_COLORS: Record<ActivitySeverity, string> = {
  info: '#5B8DEF',
  success: '#22c55e',
  warning: 'warning.main',
  error: '#ef4444',
};
const SEV_ICONS: Record<ActivitySeverity, React.ReactNode> = {
  info: <InfoOutlinedIcon sx={{ fontSize: 14 }} />,
  success: <CheckCircleIcon sx={{ fontSize: 14 }} />,
  warning: <WarningAmberIcon sx={{ fontSize: 14 }} />,
  error: <ErrorIcon sx={{ fontSize: 14 }} />,
};
const TYPE_LABELS: Record<ActivityType, string> = {
  task: '任务', item: '条目', error: '错误', proxy: '代理', template: '模板', source: '源',
};

export default function SpiderDashboardPage() {
  // ── 实时 WebSocket 状态 ──
  const { health, stats } = useSpiderWebSocket();

  // ── 其他数据仍用 HTTP 轮询(5s) ──
  const common = { refetchInterval: POLL_MS, refetchIntervalInBackground: false } as const;
  const workers = useQuery({ queryKey: ['spider', 'worker-stats'], queryFn: () => getWorkerStats().then((r) => r.data), ...common });
  const sites = useQuery({ queryKey: ['spider', 'site-stats'], queryFn: () => getSiteSlotStats().then((r) => r.data), ...common });
  const batch = useQuery({ queryKey: ['spider', 'batch-stats'], queryFn: () => getBatchStats(0).then((r) => r.data), ...common });
  const proxies = useQuery({ queryKey: ['spider', 'proxy-stats'], queryFn: () => getProxyStats().then((r) => r.data), ...common });
  const timeseries = useQuery({ queryKey: ['spider', 'timeseries'], queryFn: () => getCrawlTimeseries().then((r) => r.data), ...common });
  const activity = useQuery({ queryKey: ['spider', 'activity'], queryFn: () => getRecentActivity().then((r) => r.data), ...common });
  const hourly = useQuery({ queryKey: ['spider', 'hourly-stats'], queryFn: () => getHourlyStats().then((r) => r.data), ...common });
  const allWorkers = useQuery<Worker[]>({
    queryKey: ['spider', 'workers-all'],
    queryFn: async () => {
      const { listWorkers } = await import('@/apis/spider');
      const res = await listWorkers();
      return res.list || [];
    },
    refetchInterval: 10000,
  });

  // 上次刷新时间
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const lastFetchAt = useMemo(() => {
    const ts = [
      health?.timestamp,
      timeseries.dataUpdatedAt,
      activity.dataUpdatedAt,
    ].filter(Boolean).map((t) => (typeof t === 'number' ? t : new Date(t!).getTime()));
    return ts.length ? Math.max(...ts) : 0;
  }, [health?.timestamp, timeseries.dataUpdatedAt, activity.dataUpdatedAt]);
  const secondsSinceFetch = lastFetchAt ? Math.max(0, Math.floor((now - lastFetchAt) / 1000)) : -1;

  const isRefreshing = timeseries.isFetching || activity.isFetching;

  const heroStats = [
    { label: '运行引擎', value: stats?.runningEngines, color: 'primary.main' },
    { label: '总抓取页', value: stats?.totalPages, color: '#8B5CF6' },
    { label: '总发现链接', value: stats?.totalLinks, color: 'secondary.main' },
    { label: '总抓取条目', value: stats?.totalItems, color: 'warning.main' },
  ];

  const isHealthy = health?.status === 'healthy';

  return (
    <Box>
      {/* 顶部标题 + 健康状态 + 实时指示 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h6">爬虫运行总览</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5, borderRadius: 2, bgcolor: isHealthy ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)' }}>
          <FiberManualRecordIcon
            sx={{
              fontSize: 12,
              color: isHealthy ? '#22c55e' : '#ef4444',
              animation: isHealthy ? 'pulse-dot 1.6s ease-in-out infinite' : 'none',
              '@keyframes pulse-dot': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
            }}
          />
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: isHealthy ? '#22c55e' : '#ef4444' }}>
            {isHealthy ? '服务健康' : '服务异常'}
          </Typography>
          {health && (
            <Typography sx={{ fontSize: 11, color: 'text.secondary', ml: 1 }}>
              · 运行 {Math.floor((health.uptime || 0) / 3600)}h · {health.engines} 引擎
            </Typography>
          )}
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5, borderRadius: 1.5, bgcolor: isRefreshing ? 'rgba(91, 141, 239, 0.12)' : 'action.hover' }}>
          <RefreshIcon sx={{ fontSize: 12, color: isRefreshing ? '#5B8DEF' : 'text.secondary', animation: isRefreshing ? 'spin 0.9s linear infinite' : 'none', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />
          <Typography sx={{ fontSize: 11, color: isRefreshing ? '#5B8DEF' : 'text.secondary' }}>
            {isRefreshing ? '刷新中…' : secondsSinceFetch >= 0 ? `${secondsSinceFetch}s 前刷新 · 每 ${POLL_MS / 1000}s` : '等待首次刷新'}
          </Typography>
        </Box>
      </Box>

      {/* 4 个 hero 数据卡 */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        {heroStats.map((s) => (
          <Box key={s.label} sx={{ width: { xs: 'calc(50% - 8px)', sm: 'calc(25% - 12px)' } }}>
            <Card sx={{ position: 'relative', overflow: 'hidden' }}>
              <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, bgcolor: s.color }} />
              <CardContent sx={{ pb: '12px !important' }}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>{s.label}</Typography>
                <Typography sx={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{fmt(s.value)}</Typography>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>

      {/* 24h 趋势线 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <TimeseriesChart hourly={timeseries.data?.hourly} loading={timeseries.isLoading} />
      </Paper>

      {/* 5 列 mini section */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' }, gap: 2, mb: 2 }}>
        {/* Worker 池 */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Worker 池</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mb: 1.5 }}>
            {[
              { l: '总数', v: workers.data?.totalWorkers, c: 'primary' },
              { l: '空闲', v: workers.data?.idleWorkers, c: 'success' },
              { l: '工作中', v: workers.data?.busyWorkers, c: 'info' },
              { l: '离线', v: workers.data?.offlineWorkers, c: 'default' },
            ].map((c) => (
              <Box key={c.l} sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: 20, fontWeight: 700 }} color={`${c.c}.main`}>{fmt(c.v)}</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{c.l}</Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>利用率</Typography>
            <LinearProgress variant="determinate" value={workers.data && workers.data.totalWorkers ? (workers.data.busyWorkers / workers.data.totalWorkers) * 100 : 0} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 600 }}>
              {workers.data && workers.data.totalWorkers ? `${Math.round((workers.data.busyWorkers / workers.data.totalWorkers) * 100)}%` : '0%'}
            </Typography>
          </Box>
          <Divider sx={{ my: 1.5 }} />
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1 }}>活跃 Top 5</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {(allWorkers.data || []).filter((w) => w.status === 'busy' || w.status === 'idle').sort((a, b) => b.processedCount - a.processedCount).slice(0, 5).map((w) => (
              <Box key={w.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 11 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: w.status === 'busy' ? '#5B8DEF' : '#22c55e' }} />
                <Typography sx={{ fontSize: 11, fontWeight: 500, minWidth: 70 }}>{w.name}</Typography>
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{w.status === 'busy' ? `Job ${w.currentJobId || '?'}` : '空闲'}</Typography>
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{fmt(w.processedCount)} 处理</Typography>
              </Box>
            ))}
            {(!allWorkers.data || allWorkers.data.length === 0) && <Typography sx={{ fontSize: 10, color: 'text.secondary', fontStyle: 'italic' }}>暂无数据</Typography>}
          </Box>
        </Paper>

        {/* 站点槽位 */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>站点槽位</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mb: 1.5 }}>
            {[
              { l: '总站点', v: sites.data?.totalSites, c: 'primary' },
              { l: '活跃', v: sites.data?.activeSites, c: 'success' },
              { l: '已用', v: sites.data?.usedSlots, c: 'warning' },
              { l: '可用', v: sites.data?.availableSlots, c: 'info' },
            ].map((c) => (
              <Box key={c.l} sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: 20, fontWeight: 700 }} color={`${c.c}.main`}>{fmt(c.v)}</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{c.l}</Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>总槽位</Typography>
            <LinearProgress variant="determinate" value={sites.data && sites.data.totalSlots ? (sites.data.usedSlots / sites.data.totalSlots) * 100 : 0} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 600 }}>
              {sites.data && sites.data.totalSlots ? `${Math.round((sites.data.usedSlots / sites.data.totalSlots) * 100)}%` : '0%'}
            </Typography>
          </Box>
        </Paper>

        {/* 批量任务 */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>批量任务</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
            {[
              { l: '总任务', v: batch.data?.total, c: 'primary' },
              { l: '运行中', v: batch.data?.running, c: 'info' },
              { l: '已暂停', v: batch.data?.paused, c: 'warning' },
              { l: '已完成', v: batch.data?.completed, c: 'success' },
              { l: '已取消', v: batch.data?.cancelled, c: 'default' },
              { l: '失败', v: batch.data?.failed, c: 'error' },
            ].map((c) => (
              <Box key={c.l} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1.5, py: 0.75, borderRadius: 1, bgcolor: 'action.hover' }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{c.l}</Typography>
                <Typography sx={{ fontSize: 16, fontWeight: 700 }} color={`${c.c}.main`}>{fmt(c.v)}</Typography>
              </Box>
            ))}
          </Box>
          <Divider sx={{ my: 1.5 }} />
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            今日: <strong>{fmt(batch.data?.todayProcessed)}</strong> 页 · 本周: <strong>{fmt(batch.data?.weekProcessed)}</strong> 页
          </Typography>
        </Paper>

        {/* 代理池 */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>代理池</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5, mb: 1.5 }}>
            {[
              { l: '总数', v: proxies.data?.total, c: 'primary' },
              { l: '活跃', v: proxies.data?.active, c: 'success' },
              { l: '失败次数', v: proxies.data?.failCount, c: 'error' },
            ].map((c) => (
              <Box key={c.l} sx={{ textAlign: 'center', px: 1.5, py: 0.75, borderRadius: 1, bgcolor: 'action.hover' }}>
                <Typography sx={{ fontSize: 20, fontWeight: 700 }} color={`${c.c}.main`}>{fmt(c.v)}</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{c.l}</Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>成功率</Typography>
            <LinearProgress variant="determinate" value={proxies.data ? proxies.data.successRate * 100 : 0} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 600 }}>{proxies.data ? `${(proxies.data.successRate * 100).toFixed(1)}%` : '—'}</Typography>
          </Box>
        </Paper>

        {/* 小时调度 */}
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="subtitle2">小时调度</Typography>
            <Chip label={hourly.data?.enabled ? '已启用' : '已禁用'} size="small" color={hourly.data?.enabled ? 'success' : 'default'} />
          </Box>
          {hourly.data?.enabled ? (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mb: 1.5 }}>
                {[
                  { l: '间隔', v: `${(hourly.data.intervalSec / 60).toFixed(0)}分钟`, c: 'primary' },
                  { l: '源数', v: hourly.data.sourceCount, c: 'info' },
                  { l: '健康源', v: hourly.data.healthySources, c: 'success' },
                  { l: '冷却中', v: hourly.data.skippedSources, c: 'warning' },
                ].map((c) => (
                  <Box key={c.l} sx={{ textAlign: 'center', px: 1, py: 0.5, borderRadius: 1, bgcolor: 'action.hover' }}>
                    <Typography sx={{ fontSize: 18, fontWeight: 700 }} color={`${c.c}.main`}>{c.v}</Typography>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{c.l}</Typography>
                  </Box>
                ))}
              </Box>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>上次: {hourly.data.lastTickUtc ? new Date(hourly.data.lastTickUtc).toLocaleString() : '从未'}</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>下次: {hourly.data.nextTickUtc ? new Date(hourly.data.nextTickUtc).toLocaleString() : '—'}</Typography>
              <Box sx={{ mt: 1.5 }}>
                <TriggerRefreshButton />
              </Box>
            </>
          ) : (
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>小时调度已禁用</Typography>
          )}
        </Paper>
      </Box>

      {/* 最近活动 feed */}
      <Paper sx={{ p: 2 }}>
        <ActivityFeedView events={activity.data?.events} loading={activity.isLoading} />
      </Paper>
    </Box>
  );
}

// ─── 趋势图(纯 SVG) ───
type Metric = 'pages' | 'items' | 'links' | 'errors';
const METRIC_META: Record<Metric, { label: string; color: string; icon: React.ReactNode }> = {
  pages: { label: '抓取页', color: '#8B5CF6', icon: <ArticleIcon sx={{ fontSize: 13 }} /> },
  items: { label: '入库条目', color: 'primary.main', icon: <StorageIcon sx={{ fontSize: 13 }} /> },
  links: { label: '发现链接', color: 'secondary.main', icon: <LinkIcon sx={{ fontSize: 13 }} /> },
  errors: { label: '错误数', color: '#ef4444', icon: <ErrorIcon sx={{ fontSize: 13 }} /> },
};

function TimeseriesChart({ hourly, loading }: { hourly?: CrawlTimeseriesPoint[]; loading?: boolean }) {
  const [metric, setMetric] = useState<Metric>('pages');
  const W = 1000;
  const H = 200;
  const PAD_L = 40;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 28;
  const data = hourly || [];

  const max = useMemo(() => {
    if (!data.length) return 1;
    return Math.max(1, ...data.map((d) => d[metric]));
  }, [data, metric]);

  const xStep = data.length > 1 ? (W - PAD_L - PAD_R) / (data.length - 1) : 0;
  const points = useMemo(() => {
    return data.map((d, i) => {
      const x = PAD_L + i * xStep;
      const y = PAD_T + (H - PAD_T - PAD_B) * (1 - d[metric] / max);
      return { x, y, raw: d };
    });
  }, [data, max, xStep, metric]);

  const pathD = useMemo(() => {
    if (!points.length) return '';
    return points.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(' ');
  }, [points]);

  const areaD = useMemo(() => {
    if (!points.length) return '';
    const last = points[points.length - 1];
    return `M ${points[0].x},${H - PAD_B} L ${pathD.replace(/^M\s/, '').replace(/L/g, 'L')} L ${last.x},${H - PAD_B} Z`;
  }, [points, pathD]);

  const meta = METRIC_META[metric];
  const total = useMemo(() => data.reduce((s, d) => s + d[metric], 0), [data, metric]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2">24 小时抓取趋势</Typography>
        <Chip label={`合计 ${fmt(total)}`} size="small" sx={{ height: 20, fontSize: 10, bgcolor: 'action.hover' }} />
        <Box sx={{ flex: 1 }} />
        {(['pages', 'items', 'links', 'errors'] as Metric[]).map((m) => (
          <Chip key={m} icon={METRIC_META[m].icon as any} label={METRIC_META[m].label} size="small" clickable onClick={() => setMetric(m)} variant={metric === m ? 'filled' : 'outlined'}
            sx={{ height: 24, fontSize: 11, ...(metric === m ? { bgcolor: METRIC_META[m].color, color: '#fff', '& .MuiChip-icon': { color: '#fff' } } : {}) }} />
        ))}
      </Box>
      {loading ? (
        <Box sx={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Typography sx={{ color: 'text.secondary', fontSize: 12 }}>加载中…</Typography></Box>
      ) : data.length === 0 ? (
        <Box sx={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Typography sx={{ color: 'text.secondary', fontSize: 12 }}>暂无数据</Typography></Box>
      ) : (
        <Box sx={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block' }}>
            <defs>
              <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={meta.color} stopOpacity="0.32" />
                <stop offset="100%" stopColor={meta.color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
              const y = PAD_T + (H - PAD_T - PAD_B) * p;
              return (
                <g key={i}>
                  <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="2,3" />
                  <text x={PAD_L - 6} y={y + 3} fontSize="10" fill="rgba(255,255,255,0.4)" textAnchor="end">{fmt(Math.round(max * (1 - p)))}</text>
                </g>
              );
            })}
            <path d={areaD} fill="url(#area-gradient)" />
            <path d={pathD} fill="none" stroke={meta.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={2.5} fill={meta.color} stroke="background.default" strokeWidth="1" />
                <title>{`${p.raw.hour}:00 · ${fmt(p.raw[metric])}`}</title>
              </g>
            ))}
            {points.map((p, i) => (i % 4 === 0 ? (
              <text key={`x${i}`} x={p.x} y={H - 8} fontSize="10" fill="rgba(255,255,255,0.4)" textAnchor="middle">{p.raw.hour}:00</text>
            ) : null))}
          </svg>
        </Box>
      )}
    </Box>
  );
}

// ─── Activity Feed ───
function ActivityFeedView({ events, loading }: { events?: ActivityEvent[]; loading?: boolean }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant="subtitle2">最近活动</Typography>
        <Chip label={`${(events || []).length} 条`} size="small" sx={{ height: 20, fontSize: 10, bgcolor: 'action.hover' }} />
      </Box>
      {loading ? (
        <Typography sx={{ color: 'text.secondary', fontSize: 12, p: 2, textAlign: 'center' }}>加载中…</Typography>
      ) : !events || events.length === 0 ? (
        <Typography sx={{ color: 'text.secondary', fontSize: 12, p: 2, textAlign: 'center' }}>暂无活动</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 320, overflow: 'auto', pr: 1 }}>
          {events.map((ev, i) => {
            const color = SEV_COLORS[ev.severity];
            const isFirst = i === 0;
            return (
              <Tooltip key={ev.id} title={new Date(ev.time).toLocaleString()}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1, borderRadius: 1, bgcolor: isFirst ? 'action.hover' : 'transparent', borderLeft: '2px solid', borderColor: color, '&:hover': { bgcolor: 'action.hover' } }}>
                  <Box sx={{ color, display: 'flex', alignItems: 'center' }}>{SEV_ICONS[ev.severity]}</Box>
                  <Chip label={TYPE_LABELS[ev.type]} size="small" sx={{ height: 18, fontSize: 9, fontWeight: 600, bgcolor: 'action.hover' }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: isFirst ? 600 : 500 }}>{ev.title}</Typography>
                    {ev.detail && <Typography sx={{ fontSize: 10, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.detail}</Typography>}
                  </Box>
                  <Typography sx={{ fontSize: 10, color: 'text.secondary', whiteSpace: 'nowrap' }}>{formatRelativeTime(ev.time)}</Typography>
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s 前`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m 前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h 前`;
  return `${Math.floor(diff / 86_400_000)}d 前`;
}

// 触发爬取按钮
function TriggerRefreshButton() {
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const qc = useQueryClient();

  const handleTrigger = async () => {
    if (loading) return;
    setLoading(true);
    setMsg(null);
    try {
      await triggerHourlyRefresh();
      setMsg({ type: 'success', text: '✅ 爬取已触发，请关注源健康状态' });
      // 5秒后刷新数据
      setTimeout(() => qc.invalidateQueries({ queryKey: ['spider', 'hourly-stats'] }), 3000);
    } catch (e: any) {
      setMsg({ type: 'error', text: `❌ 触发失败: ${e?.message || e}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          size="small"
          variant="contained"
          color="primary"
          disabled={loading}
          onClick={handleTrigger}
          sx={{ fontSize: 12, py: 0.75 }}
        >
          {loading ? '触发中…' : '🚀 立即爬取全网内容'}
        </Button>
        <Button
          size="small"
          variant="outlined"
          disabled={loading}
          onClick={() => qc.invalidateQueries({ queryKey: ['spider', 'hourly-stats'] })}
          sx={{ fontSize: 12, py: 0.75 }}
        >
          刷新状态
        </Button>
      </Box>
      {msg && (
        <Typography sx={{ fontSize: 11, color: msg.type === 'success' ? 'success.main' : 'error.main' }}>
          {msg.text}
        </Typography>
      )}
    </Box>
  );
}

// 导入需要的 hooks 和组件
import { useQueryClient } from '@tanstack/react-query';
import Button from '@mui/material/Button';
