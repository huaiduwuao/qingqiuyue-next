'use client';

/**
 * 作品主档 —— 影视收录归并成「作品」的运行情况(后端 qingqiuyue-go internal/workcat)。
 *
 * 核心指标:热门前 500 部作品里能看的比例、近 7 天真实播放成功率、能看作品按来源等级的分布。
 * 归并每 6 小时自动跑一轮;这里可以手动重跑(约 1 分钟)。
 */

import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { spiderClient } from '@/lib/api/client';
import { ReviewQueue } from './ReviewQueue';

interface Metrics {
  works: number;
  mergedWorks: number;
  watchableWorks: number;
  withAuthority: number;
  byTier: Record<string, number>;
  hot500: number;
  hot500Watchable: number;
  playOk7d: number;
  playFail7d: number;
}

interface RunStats {
  startedAt: string;
  finishedAt: string;
  records: number;
  works: number;
  mergedWorks: number;
  mergedRows: number;
  byConfidence: Record<string, number>;
  withQid: number;
  watchableWorks: number;
  offers: number;
  titleLookups?: number;
  titleHits?: number;
  pendingReviews?: number;
  error?: string;
}

interface Stats {
  running: boolean;
  last: RunStats | null;
  metrics: Metrics;
}

const TIER_LABEL: Record<string, string> = {
  official_free: '官方免费',
  platform_ugc: '平台用户上传',
  third_party: '第三方来源',
  paid_platform: '正版平台',
  '': '未分级',
};

const CONF_LABEL: Record<string, string> = {
  authority: '权威编号一致',
  title_year: '同名同年',
  title: '同名(无年份)',
  single: '单条收录',
};

function pct(n: number, d: number): string {
  if (!d) return '—';
  return `${((n / d) * 100).toFixed(1)}%`;
}

function fmtTime(s?: string): string {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('zh-CN', { hour12: false });
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
      {hint && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{hint}</Typography>}
    </Paper>
  );
}

export default function WorkCatalogPage() {
  const query = useQuery({
    queryKey: ['spider', 'workcat', 'stats'],
    queryFn: () => spiderClient('/workcat/stats') as Promise<Stats>,
    refetchInterval: (q) => ((q.state.data as Stats | undefined)?.running ? 5000 : false),
  });
  const run = useMutation({
    mutationFn: () => spiderClient('/workcat/run', { method: 'POST' }),
    onSuccess: () => setTimeout(() => query.refetch(), 1500),
  });

  const s = query.data;
  const m = s?.metrics;
  const last = s?.last;
  const plays = (m?.playOk7d ?? 0) + (m?.playFail7d ?? 0);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 240 }}>
          <Typography variant="h6">作品主档</Typography>
          <Typography variant="body2" color="text.secondary">
            各数据源收录的同一部影视归并成一个作品:资料以维基数据 / Bangumi 为准,播放源汇总并标明等级,
            列表与搜索一部作品只出现一次。每 6 小时自动重跑。
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => run.mutate()}
          disabled={run.isPending || s?.running}
          startIcon={s?.running ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {s?.running ? '正在归并…' : '立即重跑'}
        </Button>
      </Box>

      {query.error && <Alert severity="error">{(query.error as Error).message}</Alert>}
      {run.error && <Alert severity="error">{(run.error as Error).message}</Alert>}
      {last?.error && <Alert severity="warning">上一轮出错:{last.error}</Alert>}

      {m && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
          <Stat label="热门前 500 能看率" value={pct(m.hot500Watchable, m.hot500)} hint={`${m.hot500Watchable} / ${m.hot500} 部`} />
          <Stat label="近 7 天播放成功率" value={pct(m.playOk7d, plays)} hint={plays ? `${m.playOk7d} 成功 / ${m.playFail7d} 失败` : '还没有播放上报'} />
          <Stat label="能看的作品" value={m.watchableWorks.toLocaleString()} hint={`共 ${m.works.toLocaleString()} 部作品`} />
          <Stat label="有权威出处" value={m.withAuthority.toLocaleString()} hint="维基数据或 Bangumi" />
          <Stat label="归并过的作品" value={m.mergedWorks.toLocaleString()} hint="由 2 条及以上收录合成" />
        </Box>
      )}

      {m && Object.keys(m.byTier || {}).length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography sx={{ fontWeight: 600, mb: 1 }}>能看的作品按最佳来源等级</Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {Object.entries(m.byTier).map(([k, v]) => (
              <Box key={k}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{TIER_LABEL[k] ?? k}</Typography>
                <Typography sx={{ fontSize: 20, fontWeight: 700 }}>{v.toLocaleString()}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      {last && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography sx={{ fontWeight: 600, mb: 1 }}>最近一轮</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {fmtTime(last.startedAt)} → {fmtTime(last.finishedAt)}
          </Typography>
          <Typography variant="body2">
            收录 {last.records.toLocaleString()} 条 → 作品 {last.works.toLocaleString()} 部;归并 {last.mergedWorks.toLocaleString()} 部
            (涉及 {last.mergedRows.toLocaleString()} 条);带维基数据 {last.withQid.toLocaleString()} 部;能看 {last.watchableWorks.toLocaleString()} 部;
            播放源 {last.offers.toLocaleString()} 个;按片名补维基数据编号 {last.titleHits ?? 0}/{last.titleLookups ?? 0};待审 {last.pendingReviews ?? 0} 条。
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
            {Object.entries(last.byConfidence || {}).map(([k, v]) => (
              <Typography key={k} variant="body2" color="text.secondary">
                {CONF_LABEL[k] ?? k}:{v.toLocaleString()}
              </Typography>
            ))}
          </Box>
        </Paper>
      )}
      {!last && !query.isLoading && <Alert severity="info">服务启动后约 5 分钟跑第一轮,也可以点「立即重跑」。</Alert>}

      <ReviewQueue />
    </Box>
  );
}
