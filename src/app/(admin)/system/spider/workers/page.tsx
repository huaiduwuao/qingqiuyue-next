'use client';

/**
 * Worker 池
 *
 * 规则任务(单任务 / 批量任务 / 站点调度的「立即抓取」)都进 crawl_job 队列,由 Worker 认领执行
 * (后端 internal/crawler/dispatch.go)。这里列出所有进程的 Worker(crawl_worker 表):
 *   - 抓取 Worker:spider-api 内嵌的一个 + 后台拉起的 Worker 容器,可以改槽位、排空;
 *   - 常驻循环 / BrowserWorker:只显示状态,不认领队列任务。
 * 超级管理员可以在这里拉起 / 移除 Worker 容器(core-api /ops/spider-workers)。
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Skeleton from '@mui/material/Skeleton';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutlined';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import Link from 'next/link';
import {
  listWorkers,
  getWorkerStats,
  updateWorker,
  deleteWorker,
  listWorkerContainers,
  launchWorkerContainer,
  removeWorkerContainer,
} from '@/apis/spider';
import { useAuthority } from '@/contexts/AuthContext';
import type { Worker, WorkerState } from '@/beans/spider';

const POLL_MS = 5000;

const STATE_META: Record<WorkerState, { label: string; color: 'success' | 'info' | 'warning' | 'default' }> = {
  idle: { label: '空闲', color: 'success' },
  busy: { label: '工作中', color: 'info' },
  draining: { label: '排空中', color: 'warning' },
  offline: { label: '离线', color: 'default' },
};

const LAUNCHER_LABEL: Record<string, string> = {
  embedded: '内嵌于 spider-api',
  container: 'Worker 容器',
  manual: '手动启动',
};

const PHASE_LABELS: Record<string, string> = {
  queued: '排队', discovering: '发现分类', categories: '分类翻页', home: '首页链接',
  incremental: '增量更新', done: '完成', stopped: '停止', failed: '失败',
};

function fmtAgo(sec: number) {
  if (sec < 60) return `${sec}s 前`;
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小时前`;
  return `${Math.floor(sec / 86400)} 天前`;
}

export default function SpiderWorkersPage() {
  const qc = useQueryClient();
  const { isSuperAdmin } = useAuthority();
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [launchOpen, setLaunchOpen] = useState(false);
  const [launchSlots, setLaunchSlots] = useState('2');
  const showMsg = (message: string, severity: 'success' | 'error' = 'success') => setSnack({ open: true, message, severity });

  const workersQ = useQuery({ queryKey: ['spider', 'workers'], queryFn: listWorkers, refetchInterval: POLL_MS });
  const statsQ = useQuery({ queryKey: ['spider', 'worker-stats'], queryFn: getWorkerStats, refetchInterval: POLL_MS });
  const containersQ = useQuery({
    queryKey: ['spider', 'worker-containers'],
    queryFn: listWorkerContainers,
    enabled: isSuperAdmin,
    refetchInterval: POLL_MS * 2,
    retry: false,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['spider', 'workers'] });
    qc.invalidateQueries({ queryKey: ['spider', 'worker-stats'] });
    qc.invalidateQueries({ queryKey: ['spider', 'worker-containers'] });
  };

  const updateM = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { slots?: number; desired?: 'active' | 'draining' } }) => updateWorker(id, data),
    onSuccess: () => { showMsg('已保存,Worker 下一次心跳(≤10 秒)生效'); invalidate(); },
    onError: (e: any) => showMsg(e?.message || '保存失败', 'error'),
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => deleteWorker(id),
    onSuccess: () => { showMsg('已清理'); invalidate(); },
    onError: (e: any) => showMsg(e?.message || '清理失败', 'error'),
  });
  const launchM = useMutation({
    mutationFn: (slots: number) => launchWorkerContainer(slots),
    onSuccess: (r) => { showMsg(`已拉起 ${r?.name ?? 'Worker 容器'},启动后自动注册`); setLaunchOpen(false); invalidate(); },
    onError: (e: any) => showMsg(e?.message || '拉起失败', 'error'),
  });
  const removeM = useMutation({
    mutationFn: (name: string) => removeWorkerContainer(name),
    onSuccess: () => { showMsg('已移除,它手上的任务已放回队列'); invalidate(); },
    onError: (e: any) => showMsg(e?.message || '移除失败', 'error'),
  });

  const all = workersQ.data?.list || [];
  const crawlWorkers = all.filter((w) => w.kind === 'crawl');
  const others = all.filter((w) => w.kind !== 'crawl');
  const stats = statsQ.data;
  const containers = containersQ.data?.list || [];
  const containerByWorker = new Map(containers.map((c) => [c.workerId, c]));
  const onlineCrawl = crawlWorkers.filter((w) => w.state !== 'offline');
  const noCapacity = !workersQ.isLoading && (onlineCrawl.length === 0 || onlineCrawl.every((w) => w.slots === 0 || w.state === 'draining'));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h6">Worker 池</Typography>
          <Typography variant="body2" color="text.secondary">
            规则任务进队列后由 Worker 认领执行;每个槽位同时跑一个站点任务,站点自身的并发上限在「站点调度」里设。
          </Typography>
        </Box>
        {isSuperAdmin && (
          <Button variant="contained" startIcon={<RocketLaunchOutlinedIcon />} onClick={() => setLaunchOpen(true)}
            disabled={containersQ.data ? containers.length >= containersQ.data.max : false}>
            拉起 Worker 容器
          </Button>
        )}
      </Box>

      {/* 汇总 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
        <StatCard label="在线 Worker" value={stats?.totalWorkers} hint={stats ? `${stats.busyWorkers} 忙 · ${stats.idleWorkers} 闲 · ${stats.offlineWorkers} 离线` : undefined} />
        <StatCard label="抓取槽位" value={stats ? `${stats.usedSlots} / ${stats.totalSlots}` : undefined}
          bar={stats && stats.totalSlots > 0 ? (stats.usedSlots / stats.totalSlots) * 100 : 0} />
        <StatCard label="排队任务" value={stats?.queued} hint={stats?.paused ? `另有 ${stats.paused} 个随批量任务挂起` : undefined} href="/system/spider/tasks" />
        <StatCard label="运行中任务" value={stats?.running} href="/system/spider/tasks" />
      </Box>

      {noCapacity && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          当前没有可认领任务的抓取 Worker(都离线、排空或槽位为 0),新任务会一直排队。
          {isSuperAdmin ? '调大下面 Worker 的槽位,或拉起一个 Worker 容器。' : '请联系超级管理员拉起 Worker。'}
        </Alert>
      )}

      {/* 抓取 Worker */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>抓取 Worker</Typography>
      {workersQ.isLoading ? (
        <Skeleton variant="rounded" height={160} sx={{ mb: 2 }} />
      ) : crawlWorkers.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, mb: 2, textAlign: 'center' }}>
          <Typography color="text.secondary">还没有抓取 Worker 注册。spider-api 启动后内嵌 Worker 会自动出现在这里。</Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 1.5, mb: 2 }}>
          {crawlWorkers.map((w) => (
            <CrawlWorkerCard
              key={w.id}
              w={w}
              container={containerByWorker.get(w.id)}
              canRemoveContainer={isSuperAdmin}
              busy={updateM.isPending || removeM.isPending || deleteM.isPending}
              onSlots={(slots) => updateM.mutate({ id: w.id, data: { slots } })}
              onDesired={(desired) => updateM.mutate({ id: w.id, data: { desired } })}
              onRemoveContainer={(name) => { if (confirm(`移除 ${name}?它手上的任务会放回队列,由其他 Worker 接着跑。`)) removeM.mutate(name); }}
              onDelete={() => deleteM.mutate(w.id)}
            />
          ))}
        </Box>
      )}

      {/* 超管:没对上 Worker 行的容器(刚拉起还没注册 / 起不来) */}
      {isSuperAdmin && containers.filter((c) => !crawlWorkers.some((w) => w.id === c.workerId)).length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>尚未注册的 Worker 容器</Typography>
          {containers.filter((c) => !crawlWorkers.some((w) => w.id === c.workerId)).map((c) => (
            <Box key={c.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
              <Typography sx={{ fontFamily: 'monospace', fontSize: 13 }}>{c.name}</Typography>
              <Chip size="small" label={c.state} color={c.state === 'running' ? 'info' : 'default'} />
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>{c.status}{c.state === 'running' ? ' · 正在启动,通常 10 秒内注册' : ' · 没在运行,可到「运维控制台」看日志'}</Typography>
              <Button size="small" color="error" onClick={() => removeM.mutate(c.name)}>移除</Button>
            </Box>
          ))}
        </Paper>
      )}
      {containersQ.isError && isSuperAdmin && (
        <Alert severity="info" sx={{ mb: 2 }}>读不到 Worker 容器列表(core-api 连不上 podman),拉起 / 移除容器暂不可用;抓取 Worker 本身不受影响。</Alert>
      )}

      {/* 常驻循环 / BrowserWorker */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>常驻循环 · 渲染服务</Typography>
      <Paper variant="outlined" sx={{ mb: 2 }}>
        {others.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 2 }}>暂无</Typography>
        ) : others.map((w, i) => (
          <Box key={w.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, borderTop: i ? '1px solid' : 'none', borderColor: 'divider', flexWrap: 'wrap' }}>
            <Chip size="small" label={STATE_META[w.state]?.label ?? w.state} color={STATE_META[w.state]?.color ?? 'default'} />
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{w.name || w.id}</Typography>
              <Typography variant="caption" color="text.secondary">
                {w.kind === 'browser' ? '浏览器渲染服务(只探活)' : '进程内常驻循环(不认领队列任务)'}
                {w.processed ? ` · 累计 ${w.processed.toLocaleString('zh-CN')}` : ''}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">心跳 {fmtAgo(w.since_beat)}</Typography>
            {w.state === 'offline' && (
              <Tooltip title="清理这条离线记录"><IconButton size="small" onClick={() => deleteM.mutate(w.id)}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
            )}
          </Box>
        ))}
      </Paper>

      <Typography variant="caption" color="text.secondary" component="div">
        Worker 容器 = spider-api 同一个镜像以 SPIDER_ROLE=worker 运行:只从队列认领任务,不对外提供接口、不跑整点刷新。
        它和沙盒不是一回事 —— 沙盒只跑一次性的代码片段,超时即删,连不到数据库。
        spider-api 发版后已有的 Worker 容器还跑旧镜像,卡片上会标「版本落后」,移除再拉起即可。
      </Typography>

      <Dialog open={launchOpen} onClose={() => setLaunchOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>拉起 Worker 容器</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            照 spider-api 当前的镜像和配置起一个只抓取的容器,几秒后自动注册到这里。
            {containersQ.data && ` 已有 ${containers.length} / ${containersQ.data.max} 个。`}
          </Typography>
          <TextField label="槽位数" type="number" size="small" fullWidth value={launchSlots}
            onChange={(e) => setLaunchSlots(e.target.value)} slotProps={{ htmlInput: { min: 1, max: 16 } }}
            helperText="同时跑几个站点任务;之后随时可以改" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLaunchOpen(false)}>取消</Button>
          <Button variant="contained" disabled={launchM.isPending}
            onClick={() => launchM.mutate(Math.min(16, Math.max(1, Number(launchSlots) || 2)))}>
            {launchM.isPending ? '启动中…' : '拉起'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snack.severity}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}

function StatCard({ label, value, hint, bar, href }: { label: string; value?: number | string; hint?: string; bar?: number; href?: string }) {
  const body = (
    <Paper variant="outlined" sx={{ p: 1.5, height: '100%', ...(href ? { '&:hover': { borderColor: 'primary.main' } } : {}) }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.25 }}>{value ?? '—'}</Typography>
      {bar !== undefined && <LinearProgress variant="determinate" value={bar} sx={{ mt: 0.75, height: 6, borderRadius: 3 }} />}
      {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </Paper>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{body}</Link> : body;
}

function CrawlWorkerCard({
  w, container, canRemoveContainer, busy, onSlots, onDesired, onRemoveContainer, onDelete,
}: {
  w: Worker;
  container?: { name: string; stale: boolean; cpuPerc: number; memMB: number };
  canRemoveContainer: boolean;
  busy: boolean;
  onSlots: (n: number) => void;
  onDesired: (d: 'active' | 'draining') => void;
  onRemoveContainer: (name: string) => void;
  onDelete: () => void;
}) {
  const meta = STATE_META[w.state] ?? STATE_META.offline;
  const offline = w.state === 'offline';
  const pct = w.slots > 0 ? Math.min(100, (w.running / w.slots) * 100) : 0;
  return (
    <Paper variant="outlined" sx={{ p: 2, opacity: offline ? 0.65 : 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Chip size="small" label={meta.label} color={meta.color} />
        <Typography sx={{ fontWeight: 700 }}>{w.name || w.id}</Typography>
        <Chip size="small" variant="outlined" label={LAUNCHER_LABEL[w.launcher] ?? w.launcher} />
        {(w.stale || container?.stale) && (
          <Tooltip title="镜像和当前 spider-api 不一致:发版后没有重建。移除再拉起即可。">
            <Chip size="small" color="warning" icon={<WarningAmberRoundedIcon />} label="版本落后" />
          </Tooltip>
        )}
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">心跳 {fmtAgo(w.since_beat)}</Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5, fontFamily: 'monospace' }}>
        {w.id} · {w.host || '-'} · {w.version && w.version !== 'unknown' ? w.version.slice(0, 7) : '版本未知'}
        {container ? ` · CPU ${container.cpuPerc.toFixed(0)}% · 内存 ${container.memMB.toFixed(0)}MB` : ''}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5 }}>
        <Typography variant="body2" sx={{ minWidth: 56 }}>槽位</Typography>
        <IconButton size="small" disabled={busy || w.slots <= 0} onClick={() => onSlots(w.slots - 1)}><RemoveIcon fontSize="small" /></IconButton>
        <Typography sx={{ fontWeight: 700, minWidth: 18, textAlign: 'center' }}>{w.slots}</Typography>
        <IconButton size="small" disabled={busy || w.slots >= 32} onClick={() => onSlots(w.slots + 1)}><AddIcon fontSize="small" /></IconButton>
        <LinearProgress variant="determinate" value={pct} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
        <Typography variant="caption">{w.running} 在跑</Typography>
      </Box>
      <Typography variant="caption" color="text.secondary">
        完成 {w.processed.toLocaleString('zh-CN')} · 失败/停止 {w.failed.toLocaleString('zh-CN')}(本次启动以来)
      </Typography>

      {w.tasks.length > 0 && (
        <Box sx={{ mt: 1.25, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {w.tasks.map((t) => (
            <Link key={t.taskId} href={`/system/spider/task-monitor?id=${encodeURIComponent(t.taskId)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Box sx={{ px: 1.25, py: 0.75, borderRadius: 1, bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{t.source || '未登记站点'}</Typography>
                  <Chip size="small" label={PHASE_LABELS[t.phase] ?? (t.phase || '准备中')} sx={{ height: 18, fontSize: 11 }} />
                  <Box sx={{ flex: 1 }} />
                  <Typography variant="caption" color="text.secondary">{t.pages} 页 · 新增 {t.items}</Typography>
                </Box>
                <Typography sx={{ fontSize: 11, fontFamily: 'monospace', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.url}</Typography>
              </Box>
            </Link>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
        {!offline && (w.desired === 'draining' ? (
          <Button size="small" startIcon={<PlayCircleOutlineIcon />} disabled={busy} onClick={() => onDesired('active')}>恢复认领</Button>
        ) : (
          <Tooltip title="不再认领新任务,手上的跑完为止">
            <Button size="small" color="warning" startIcon={<PauseCircleOutlineIcon />} disabled={busy} onClick={() => onDesired('draining')}>排空</Button>
          </Tooltip>
        ))}
        {container && canRemoveContainer && (
          <Button size="small" color="error" disabled={busy} onClick={() => onRemoveContainer(container.name)}>移除容器</Button>
        )}
        {offline && !container && (
          <Button size="small" color="inherit" startIcon={<DeleteOutlineIcon />} disabled={busy} onClick={onDelete}>清理记录</Button>
        )}
      </Box>
    </Paper>
  );
}
