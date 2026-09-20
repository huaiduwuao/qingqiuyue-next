'use client';

/**
 * 通用爬虫分析面板 —— 站点无关。
 *
 * 顶部:累计统计(stats / enhanced stats)
 * 24h 趋势:hourly bucket chart
 * 近期活动:活动流
 * Per-source 健康度:hourly source-health 列表 + 可选 sourceId 过滤
 * 内容分布:categoryCounts 饼/条
 *
 * 全部数据来自已经存在的 spider-api 端点;无任何 yfsp 字面量,
 * 通用,新增任何站点都能直接展示。
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import {
  getCrawlStats,
  getCrawlTimeseries,
  getRecentActivity,
  getHourlyStats,
  getHourlySourceHealth,
  getEnhancedStats,
  getContentTrend,
} from '@/apis/spider';
import type {
  ActivityFeed,
  ActivityEvent,
  CrawlTimeseries,
  CrawlStats,
} from '@/beans/spider';

// HourlyStatsResponse / HourlySourceHealth / ContentStatsEnhanced / ContentTrend
// 这些类型不在 beans/spider.d.ts 里,直接用 apis/spider.ts 暴露的类型。后端返回
// 字段对齐在后端端点里写清楚,前端不强类型;接口失败也只是卡片显示 '-',不会
// 让整页报错。
type HourlyStatsResponse = Awaited<ReturnType<typeof getHourlyStats>>;
type HourlySourceHealth = Awaited<ReturnType<typeof getHourlySourceHealth>>;
type ContentTrendItem = NonNullable<Awaited<ReturnType<typeof getContentTrend>>['items']>[number];
type ContentTrend = ContentTrendItem[];
type ContentStatsEnhanced = Awaited<ReturnType<typeof getEnhancedStats>>;

const EVENT_SEVERITY_COLOR: Record<string, 'default' | 'info' | 'warning' | 'error' | 'success'> = {
  info: 'info', success: 'success', warning: 'warning', error: 'error',
};

export default function SpiderAnalyticsPage() {
  const [filterSourceId, setFilterSourceId] = useState<number | ''>('');

  const statsQ = useQuery({ queryKey: ['spider', 'analytics', 'stats'], queryFn: getCrawlStats, refetchInterval: 30_000 });
  const enhancedQ = useQuery({ queryKey: ['spider', 'analytics', 'enhanced'], queryFn: getEnhancedStats, refetchInterval: 60_000 });
  const timeseriesQ = useQuery<CrawlTimeseries>({
    queryKey: ['spider', 'analytics', 'timeseries'],
    queryFn: getCrawlTimeseries as unknown as () => Promise<CrawlTimeseries>,
    refetchInterval: 60_000,
  });
  const hourlyQ = useQuery({ queryKey: ['spider', 'analytics', 'hourly'], queryFn: getHourlyStats, refetchInterval: 30_000 });
  const activityQ = useQuery<ActivityFeed>({
    queryKey: ['spider', 'analytics', 'activity'],
    queryFn: getRecentActivity as unknown as () => Promise<ActivityFeed>,
    refetchInterval: 30_000,
  });
  const trendQ = useQuery({ queryKey: ['spider', 'analytics', 'content-trend'], queryFn: getContentTrend, refetchInterval: 60_000 });
  const sourceHealthQ = useQuery({
    queryKey: ['spider', 'analytics', 'source-health', filterSourceId],
    queryFn: () => (filterSourceId !== '' ? getHourlySourceHealth(Number(filterSourceId)) : null),
    enabled: filterSourceId !== '',
    refetchInterval: 30_000,
  });

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h5">通用爬虫 — 分析面板</Typography>
      <Typography variant="body2" color="text.secondary">
        跨所有 module_source 的累计 / 24h 趋势 / 活动 / 内容分布;无任何具体站点字面量。
      </Typography>

      <SummaryCards stats={statsQ.data} enhanced={enhancedQ.data} />

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1">最近 24 小时抓取趋势</Typography>
        <Divider sx={{ my: 1 }} />
        <HourlyChart data={timeseriesQ.data?.hourly ?? []} />
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1">每小时刷新调度器</Typography>
        <Divider sx={{ my: 1 }} />
        <HourlySchedulerView data={hourlyQ.data} loading={hourlyQ.isLoading} error={hourlyQ.isError} />
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1">单源健康度</Typography>
          <TextField
            select
            size="small"
            label="过滤 source_id"
            value={filterSourceId === '' ? '' : String(filterSourceId)}
            onChange={(e) => setFilterSourceId(e.target.value === '' ? '' : Number(e.target.value))}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">(不过滤)</MenuItem>
            {(hourlyQ.data?.sources ?? []).map((s) => (
              <MenuItem key={s.sourceId} value={String(s.sourceId)}>
                {s.sourceId} · {s.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <Divider sx={{ my: 1 }} />
        {filterSourceId === '' ? (
          <SourcesTable sources={hourlyQ.data?.sources ?? []} />
        ) : (
          <SourceDetail loading={sourceHealthQ.isLoading} data={sourceHealthQ.data as any} error={sourceHealthQ.isError} />
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1">近期活动</Typography>
        <Divider sx={{ my: 1 }} />
        <ActivityList items={activityQ.data?.events ?? []} />
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1">内容增长趋势</Typography>
        <Divider sx={{ my: 1 }} />
        <ContentTrendView items={trendQ.data?.items ?? []} />
      </Paper>
    </Box>
  );
}

function SummaryCards({ stats, enhanced }: { stats?: CrawlStats; enhanced?: ContentStatsEnhanced }) {
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
      <Card label="运行中引擎" value={stats?.runningEngines ?? '-'} />
      <Card label="已抓页面" value={stats?.totalPages ?? '-'} />
      <Card label="已抓链接" value={stats?.totalLinks ?? '-'} />
      <Card label="已抓条目" value={stats?.totalItems ?? '-'} />
      <Card label="源数" value={enhanced?.totalSources ?? '-'} />
      <Card label="内容项" value={enhanced?.totalItems ?? '-'} />
    </Box>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h5">{value}</Typography>
    </Paper>
  );
}

function HourlyChart({ data }: { data: NonNullable<CrawlTimeseries['hourly']> }) {
  if (!data.length) {
    return <Typography variant="body2" color="text.secondary">暂无数据。</Typography>;
  }
  const maxPages = Math.max(1, ...data.map((d) => d.pages));
  return (
    <Box>
      <Stack sx={{ gap: 0.5 }}>
        {data.map((d, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ width: 32, textAlign: 'right' }}>{d.hour}</Typography>
            <LinearProgress
              variant="determinate"
              value={Math.round((d.pages / maxPages) * 100)}
              sx={{ flex: 1, height: 12, borderRadius: 1 }}
            />
            <Typography variant="caption" sx={{ width: 60, textAlign: 'right' }}>
              {d.pages}p · {d.items}i · {d.errors}e
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function HourlySchedulerView({ data, loading, error }: { data?: HourlyStatsResponse; loading: boolean; error: boolean }) {
  if (loading) return <Typography variant="body2" color="text.secondary">加载中…</Typography>;
  if (error || !data) return <Alert severity="error">调度器状态不可用。</Alert>;
  return (
    <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
      <Field label="健康源数" value={data.healthySources} />
      <Field label="跳过源数" value={data.skippedSources} />
      <Field label="冷却源数" value={data.cooldownErrors} />
      <Field label="上次 tick" value={data.lastTickUtc} />
      <Field label="下次 tick" value={data.nextTickUtc} />
      <Field label="间隔" value={`${data.intervalSec} 秒`} />
      <Field label="每源并发上限" value={data.concurrency} />
      <Field label="分类并发上限" value={data.categoryConcurrency} />
      <Field label="冷却分钟" value={data.cooldownMinutes} />
    </Box>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <Paper variant="outlined" sx={{ p: 1 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body1">{value}</Typography>
    </Paper>
  );
}

function SourcesTable({ sources }: { sources: HourlySourceHealth[] }) {
  if (!sources.length) {
    return <Typography variant="body2" color="text.secondary">还没有源注册到 HourlyRefresh。</Typography>;
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>sourceId</TableCell>
          <TableCell>name</TableCell>
          <TableCell>category</TableCell>
          <TableCell>api</TableCell>
          <TableCell align="right">连续失败</TableCell>
          <TableCell align="right">总抓取</TableCell>
          <TableCell align="right">总新增</TableCell>
          <TableCell>上次成功</TableCell>
          <TableCell>上次错误</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {sources.map((s) => (
          <TableRow key={s.sourceId} hover>
            <TableCell>{s.sourceId}</TableCell>
            <TableCell>{s.name}</TableCell>
            <TableCell>{s.category}</TableCell>
            <TableCell>{s.apiName}</TableCell>
            <TableCell align="right">
              <Chip
                size="small"
                label={s.consecErrors}
                color={s.consecErrors > 0 ? 'error' : 'default'}
              />
            </TableCell>
            <TableCell align="right">{s.totalRuns}</TableCell>
            <TableCell align="right">{s.totalNewItems}</TableCell>
            <TableCell>{s.lastSuccessAt ?? '-'}</TableCell>
            <TableCell sx={{ maxWidth: 240 }}>
              <Typography variant="caption" color={s.lastError ? 'error' : 'text.secondary'} noWrap>
                {s.lastError ?? '-'}
              </Typography>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SourceDetail({ loading, data, error }: { loading: boolean; data: HourlySourceHealth | null; error: boolean }) {
  if (loading) return <Typography variant="body2" color="text.secondary">加载中…</Typography>;
  if (error || !data) return <Alert severity="error">单源健康度查询失败。</Alert>;
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
      <Field label="name" value={data.name} />
      <Field label="category" value={data.category} />
      <Field label="apiName" value={data.apiName} />
      <Field label="consecErrors" value={data.consecErrors} />
      <Field label="totalRuns" value={data.totalRuns} />
      <Field label="totalNewItems" value={data.totalNewItems} />
      <Field label="lastSuccessAt" value={data.lastSuccessAt ?? '-'} />
      <Field label="lastError" value={data.lastError ?? '-'} />
      <Field label="skippedCooldown" value={String(data.skippedCooldown)} />
    </Box>
  );
}

function ActivityList({ items }: { items: ActivityEvent[] }) {
  if (!items.length) {
    return <Typography variant="body2" color="text.secondary">暂无活动。</Typography>;
  }
  return (
    <Stack sx={{ gap: 0.5 }}>
      {items.map((e) => (
        <Stack key={e.id} direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ width: 130, color: 'text.secondary' }}>{e.time}</Typography>
          <Chip size="small" label={e.severity} color={EVENT_SEVERITY_COLOR[e.severity] ?? 'default'} />
          <Typography variant="body2" sx={{ flex: 1 }} noWrap>{e.title}</Typography>
          {e.detail && (
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }} noWrap>
              {e.detail}
            </Typography>
          )}
        </Stack>
      ))}
    </Stack>
  );
}

function ContentTrendView({ items }: { items: ContentTrendItem[] }) {
  if (!items.length) return <Typography variant="body2" color="text.secondary">暂无数据。</Typography>;
  const max = Math.max(1, ...items.map((d) => d.count));
  return (
    <Stack sx={{ gap: 0.5 }}>
      {items.map((d, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ width: 90, textAlign: 'right' }}>{d.bucket}</Typography>
          <LinearProgress variant="determinate" value={Math.round((d.count / max) * 100)} sx={{ flex: 1, height: 10, borderRadius: 1 }} />
          <Typography variant="caption" sx={{ width: 80, textAlign: 'right' }}>{d.count} 条</Typography>
        </Box>
      ))}
    </Stack>
  );
}
