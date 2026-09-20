'use client';

/**
 * 实时任务监控页面 —— 用 WebSocket 订阅 /ws/spider 上的 task 推送。
 *
 * 站点无关:任何 crawl_job / crawl_rule_task 都能在这里看实时进度。
 * 路由 /admin/system/spider/task-monitor/[id],id 是 crawl_job.external_task_id。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import { useSpiderWebSocket } from '@/hooks/useSpiderWebSocket';
import { getTaskDetail, type ProgressSnapshot } from '@/apis/spider';

const PHASE_LABELS: Record<string, string> = {
  queued: '排队中',
  discovering: '正在发现分类',
  categories: '正在扫描分类',
  home: '正在抓首页链接',
  incremental: '增量更新',
  done: '已完成',
  stopped: '已停止',
  failed: '已失败',
};

const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  pending: 'default',
  running: 'info',
  paused: 'warning',
  completed: 'success',
  cancelled: 'error',
  failed: 'error',
  stopped: 'warning',
};

export default function TaskMonitorPage() {
  const params = useParams<{ id: string }>();
  const taskId = String(params.id ?? '');
  const ws = useSpiderWebSocket();
  const [snapshotFallback, setSnapshotFallback] = useState<ProgressSnapshot | null>(null);

  const taskQuery = useQuery({
    queryKey: ['spider', 'task', taskId],
    queryFn: () => getTaskDetail(taskId),
    refetchInterval: 5 * 1000,
    enabled: !!taskId,
  });

  // 让 WS 推送保持连接(其他页面有数据流,这里只是订阅)。Revision 每次更新就 rerender。
  useEffect(() => {
    setSnapshotFallback(null);
    const t = setTimeout(() => {
      const rawTask = ws.tasks.find((t) => t.id === taskId);
      if (rawTask && (rawTask as any).progress) {
        setSnapshotFallback((rawTask as any).progress as ProgressSnapshot);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [ws.revision, ws.tasks, taskId]);

  const liveTask = useMemo(() => ws.tasks.find((t) => t.id === taskId), [ws.tasks, taskId]);

  const detail = taskQuery.data as any;
  // 实时 snapshot 来源优先级:WS → 详情里的 progress → null
  const snapshot: ProgressSnapshot | null = (liveTask as any)?.progress ?? detail?.progress ?? snapshotFallback;

  const progress: ProgressSnapshot | null = snapshot;

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography variant="h5">实时任务监控</Typography>
        <Typography variant="body2" color="text.secondary">
          task external_id = <code>{taskId}</code>;订阅 <code>/ws/spider</code> 实时进度。
          任务结束或浏览器关闭 WS 时,本页自动回落到轮询 <code>GET /tasks/&#123;id&#125;</code>(每 5s)。
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip
          label={ws.connected ? 'WS 已连接' : 'WS 断开,降级轮询'}
          color={ws.connected ? 'success' : 'warning'}
          size="small"
        />
        {detail && (
          <Chip
            label={`status = ${detail.status ?? 'unknown'}`}
            color={STATUS_COLORS[detail.status ?? 'pending'] ?? 'default'}
            size="small"
          />
        )}
        {liveTask && (
          <Chip label="WS 推送:live" color="info" size="small" />
        )}
        {taskQuery.isFetching && <Chip label="轮询中…" color="default" size="small" />}
      </Box>

      {!progress && (
        <Alert severity="info">还没有进度数据 — 等待 WS 推送或轮询命中 first tick。</Alert>
      )}

      {progress && (
        <Stack sx={{ gap: 2 }}>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1">
                阶段:{PHASE_LABELS[progress.phase] ?? progress.phase}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                最近更新:{progress.updatedAt}
              </Typography>
            </Stack>
            <Box sx={{ mt: 1 }}>
              <LinearProgress
                variant={progress.pageBudget > 0 ? 'determinate' : 'indeterminate'}
                value={progress.percent < 0 ? 0 : progress.percent}
                sx={{ height: 8, borderRadius: 1 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {progress.percent < 0 ? '进度尚未确定' : `进度 ${progress.percent}%`}
                {progress.pageBudget > 0 && ` · 页面预算 ${progress.pagesCrawled} / ${progress.pageBudget}`}
              </Typography>
            </Box>
            {progress.lastError && (
              <Alert severity="warning" sx={{ mt: 2 }}>最近错误:{progress.lastError}</Alert>
            )}
            {progress.currentUrl && (
              <Typography variant="body2" sx={{ mt: 1, wordBreak: 'break-all' }}>
                当前 URL:<code>{progress.currentUrl}</code>
              </Typography>
            )}
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1">指标</Typography>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              <Metric label="已抓取页数" value={progress.pagesCrawled} />
              <Metric label="已发现条目" value={progress.itemsFound} />
              <Metric label="已入库新条目" value={progress.itemsNew} />
              <Metric label="已入库章节/分集" value={progress.chaptersNew} />
              <Metric label="错误数" value={progress.errors} color={progress.errors > 0 ? 'error' : undefined} />
              <Metric label="分类进度" value={`${progress.categoriesDone} / ${progress.categoriesTotal || '-'}`} />
              <Metric label="页预算" value={progress.pageBudget || '不限'} />
              <Metric label="已运行" value={`${progress.elapsedSec} 秒`} />
            </Box>
          </Paper>

          {liveTask && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1">WS 帧上的字段(snake/camel 双形态)</Typography>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                <Metric label="source_id" value={String(liveTask.source_id ?? '-')} />
                <Metric label="source_name" value={liveTask.source_name ?? '-'} />
                <Metric label="type" value={liveTask.type ?? '-'} />
                <Metric label="max_pages" value={String(liveTask.max_pages ?? '-')} />
                <Metric label="pages_crawled" value={String(liveTask.pages_crawled ?? '-')} />
                <Metric label="items_saved" value={String(liveTask.items_saved ?? '-')} />
                <Metric label="error_msg" value={liveTask.error_msg ?? '-'} />
              </Box>
            </Paper>
          )}
        </Stack>
      )}
    </Box>
  );
}

interface MetricProps {
  label: string;
  value: string | number;
  color?: 'error' | 'warning' | 'success';
}
function Metric({ label, value, color }: MetricProps) {
  return (
    <Paper variant="outlined" sx={{ p: 1 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6" color={color}>{value}</Typography>
    </Paper>
  );
}
