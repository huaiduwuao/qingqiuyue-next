'use client';

/**
 * 单任务管理
 * 从 account/content/_views/spider/tasks/ 迁移
 *
 * 进度:REST 列表只在任务增减 / 状态变化时重拉(DataGridTable 会随 extraParams 回到第一页,
 * 不能每 3 秒触发一次),运行中的阶段 / 分类 / 当前 URL / 页数 / 错误数由 WS 推送叠加到行上。
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import LinearProgress from '@mui/material/LinearProgress';
import StopIcon from '@mui/icons-material/Stop';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AddIcon from '@mui/icons-material/Add';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { listTasks, createTask, createRuleTask, stopTask as apiStopTask, deleteTask as apiDeleteTask, getTaskDetail, getTaskItems, getTaskLinks, listSources } from '@/apis/spider';
import { useSpiderWebSocket, type CrawlTaskFromWS } from '@/hooks/useSpiderWebSocket';
import type { GridColDef } from '@mui/x-data-grid';
import type { CrawlTask, SpiderSource } from '@/beans/spider';

const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  pending: 'default', running: 'info', stopping: 'warning', stopped: 'warning', completed: 'success', failed: 'error',
};
const STATUS_LABELS: Record<string, string> = {
  pending: '等待中', running: '运行中', stopping: '停止中', stopped: '已停止', completed: '已完成', failed: '失败',
};
const PHASE_LABELS: Record<string, string> = {
  queued: '排队中', discovering: '发现分类', categories: '分类翻页', home: '首页链接',
  incremental: '增量更新', done: '已完成', stopped: '已停止', failed: '失败',
};
const EMPTY_FORM = { sourceId: '', startUrl: '', maxDepth: '2', maxPages: '100' };

const isActive = (status?: string) => status === 'running' || status === 'stopping' || status === 'pending';

/** 后端 REST 是 snake_case(CrawlTask json),GetTask 另加了 camelCase 字段 —— 两种都认 */
function normalizeTask(raw: any): CrawlTask {
  return {
    ...raw,
    sourceName: raw.sourceName ?? raw.source_name,
    startUrl: raw.startUrl ?? raw.start_url ?? '',
    maxDepth: raw.maxDepth ?? raw.max_depth ?? 0,
    maxPages: raw.maxPages ?? raw.max_pages ?? 0,
    pagesCrawled: raw.pagesCrawled ?? raw.pages_crawled ?? 0,
    linksFound: raw.linksFound ?? raw.links_found ?? 0,
    itemsSaved: raw.itemsSaved ?? raw.items_saved ?? 0,
    errorMsg: raw.errorMsg ?? raw.error_msg,
    progress: raw.progress,
    createdAt: raw.createdAt ?? raw.created_at,
    updatedAt: raw.updatedAt ?? raw.updated_at,
  };
}

/** 行数据叠加 WS 实时推送 */
function mergeLive(row: CrawlTask, live?: CrawlTaskFromWS): CrawlTask {
  if (!live) return row;
  return {
    ...row,
    status: (live.status as CrawlTask['status']) ?? row.status,
    pagesCrawled: live.pagesCrawled ?? live.pages_crawled ?? row.pagesCrawled,
    linksFound: live.linksFound ?? live.links_found ?? row.linksFound,
    itemsSaved: live.itemsSaved ?? live.items_saved ?? row.itemsSaved,
    errorMsg: live.errorMsg ?? live.error_msg ?? row.errorMsg,
    progress: live.progress ?? row.progress,
  };
}

function fmtDuration(sec?: number): string {
  if (sec === undefined || sec < 0) return '-';
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${s}s`;
}

/** 运行中按 startedAt 现算,结束后用后端定格的 elapsedSec */
function elapsedOf(t: CrawlTask): number | undefined {
  const p = t.progress;
  if (!p) return undefined;
  if (isActive(t.status) && p.startedAt) return (Date.now() - new Date(p.startedAt).getTime()) / 1000;
  return p.elapsedSec;
}

function barColor(status: string): 'primary' | 'success' | 'warning' | 'error' {
  if (status === 'failed') return 'error';
  if (status === 'stopped' || status === 'stopping') return 'warning';
  if (status === 'completed') return 'success';
  return 'primary';
}

/** 进度百分比:规则任务用后端估算,colly 任务退回 已抓/目标页 */
function percentOf(t: CrawlTask): number {
  if (t.status === 'completed') return 100;
  if (t.progress) return t.progress.percent;
  return t.maxPages > 0 ? Math.min(100, Math.round((t.pagesCrawled / t.maxPages) * 100)) : -1;
}

function ProgressBar({ t, dense = true }: { t: CrawlTask; dense?: boolean }) {
  const pct = percentOf(t);
  const p = t.progress;
  const parts = [pct >= 0 ? `${pct}%` : isActive(t.status) ? '估算中' : '-'];
  if (p && p.categoriesTotal > 0) parts.push(`分类 ${p.categoriesDone}/${p.categoriesTotal}`);
  return (
    <Box sx={{ width: '100%' }}>
      <LinearProgress
        variant={pct < 0 && isActive(t.status) ? 'indeterminate' : 'determinate'}
        value={Math.max(0, pct)}
        color={barColor(t.status)}
        sx={{ height: dense ? 6 : 10, borderRadius: 3 }}
      />
      <Typography sx={{ fontSize: dense ? 11 : 12, color: 'text.secondary', mt: 0.25 }}>{parts.join(' · ')}</Typography>
    </Box>
  );
}

function PhaseCell({ t }: { t: CrawlTask }) {
  const p = t.progress;
  if (!p) {
    return <Typography sx={{ fontSize: 12, color: t.errorMsg ? 'error.main' : 'text.secondary' }} noWrap>{t.errorMsg || '-'}</Typography>;
  }
  const detail = isActive(t.status) ? p.currentUrl : p.lastError || t.errorMsg || '';
  const isError = !isActive(t.status) && !!detail;
  return (
    <Box sx={{ minWidth: 0, width: '100%' }}>
      <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{PHASE_LABELS[p.phase] || p.phase}</Typography>
      {detail && (
        <Tooltip title={detail}>
          <Typography noWrap sx={{ fontSize: 11, fontFamily: 'monospace', color: isError ? 'error.main' : 'text.secondary' }}>{detail}</Typography>
        </Tooltip>
      )}
    </Box>
  );
}

export default function SpiderTasksPage() {
  const { tasks: liveTasks, connected } = useSpiderWebSocket();
  const [writeVisible, setWriteVisible] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [reloadTick, setReloadTick] = useState(0);

  const liveById = useMemo(() => new Map(liveTasks.map((t) => [t.id, t])), [liveTasks]);
  // 只在任务增减 / 状态变化时重拉列表;进度字段走 liveById 叠加
  const statusKey = useMemo(() => liveTasks.map((t) => `${t.id}:${t.status}`).sort().join('|'), [liveTasks]);

  const showMsg = useCallback((message: string, severity: 'success' | 'error' = 'success') => setSnack({ open: true, message, severity }), []);
  const refresh = useCallback(() => setReloadTick((x) => x + 1), []);
  const sourcesQuery = useQuery({ queryKey: ['spider', 'sources-list'], queryFn: () => listSources().then((r) => r.list || []) });

  const createMutation = useMutation({
    mutationFn: (vals: any) => createTask(vals),
    onSuccess: () => { showMsg('任务已创建'); setWriteVisible(false); setForm(EMPTY_FORM); refresh(); },
    onError: (err: any) => showMsg(err.message || '创建失败', 'error'),
  });

  const createRuleMutation = useMutation({
    mutationFn: (vals: any) => createRuleTask(vals),
    onSuccess: () => { showMsg('规则任务已创建'); setWriteVisible(false); setForm(EMPTY_FORM); refresh(); },
    onError: (err: any) => showMsg(err.message || '创建规则任务失败', 'error'),
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => apiStopTask(id),
    onSuccess: () => { showMsg('已发送停止,当前请求结束后退出'); refresh(); },
    onError: (err: any) => showMsg(err.message || '停止失败', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDeleteTask(id),
    onSuccess: () => { showMsg('已删除'); refresh(); },
    onError: (err: any) => showMsg(err.message || '删除失败', 'error'),
  });

  const handleCreate = () => {
    if (!form.startUrl) return showMsg('起始 URL 必填', 'error');
    if (form.sourceId) {
      createRuleMutation.mutate({ source_id: String(form.sourceId).trim(), start_url: form.startUrl, max_pages: Number(form.maxPages) || 100 });
    } else {
      createMutation.mutate({ source_id: undefined, start_url: form.startUrl, max_depth: Number(form.maxDepth) || 2, max_pages: Number(form.maxPages) || 100 });
    }
  };

  const view = (row: CrawlTask) => mergeLive(row, liveById.get(row.id));

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 96, renderCell: (p) => <Tooltip title={p.value}><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{String(p.value).slice(0, 8)}</span></Tooltip> },
    { field: 'sourceName', headerName: '来源', width: 120 },
    { field: 'startUrl', headerName: '起始 URL', width: 200, renderCell: (p) => <Tooltip title={p.value}><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{(p.value || '').slice(0, 32)}…</span></Tooltip> },
    { field: 'status', headerName: '状态', width: 90, renderCell: (p) => { const t = view(p.row); return <Chip label={STATUS_LABELS[t.status] || t.status} color={STATUS_COLORS[t.status] || 'default'} size="small" />; } },
    { field: 'progress', headerName: '进度', width: 190, sortable: false, renderCell: (p) => <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}><ProgressBar t={view(p.row)} /></Box> },
    { field: 'phase', headerName: '阶段 / 当前', width: 240, sortable: false, renderCell: (p) => <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}><PhaseCell t={view(p.row)} /></Box> },
    {
      field: 'pagesCrawled', headerName: '请求页 / 上限', width: 110, sortable: false,
      renderCell: (p) => { const t = view(p.row); const budget = t.progress?.pageBudget || t.maxPages; return <span>{t.pagesCrawled}{budget ? ` / ${budget}` : ''}</span>; },
    },
    { field: 'itemsSaved', headerName: '新入库', width: 80, type: 'number', renderCell: (p) => view(p.row).itemsSaved },
    {
      field: 'errors', headerName: '错误', width: 70, sortable: false,
      renderCell: (p) => { const n = view(p.row).progress?.errors ?? 0; return n > 0 ? <Chip label={n} color="error" size="small" variant="outlined" /> : <span style={{ color: '#999' }}>0</span>; },
    },
    { field: 'elapsed', headerName: '耗时', width: 80, sortable: false, renderCell: (p) => fmtDuration(elapsedOf(view(p.row))) },
    { field: 'createdAt', headerName: '创建时间', width: 160, valueFormatter: (v) => v ? new Date(v).toLocaleString() : '-' },
    {
      field: 'actions', headerName: '操作', width: 130, sortable: false,
      renderCell: (p) => {
        const t = view(p.row);
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {(t.status === 'running' || t.status === 'pending') && (
              <Tooltip title="停止"><IconButton size="small" color="warning" onClick={() => stopMutation.mutate(t.id)}><StopIcon fontSize="small" /></IconButton></Tooltip>
            )}
            <Tooltip title="查看"><IconButton size="small" onClick={() => setViewingId(t.id)}><VisibilityOutlinedIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="删除"><IconButton size="small" color="error" onClick={() => { if (confirm('确定删除?')) deleteMutation.mutate(t.id); }}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
          </Box>
        );
      },
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">单任务</Typography>
          <Chip
            icon={<FiberManualRecordIcon sx={{ fontSize: 10 }} />}
            label={connected ? '实时进度已连接' : '实时进度未连接'}
            color={connected ? 'success' : 'default'}
            size="small"
            variant="outlined"
          />
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setWriteVisible(true)}>新建任务</Button>
      </Box>

      <DataGridTable
        columns={columns}
        extraParams={{ statusKey, reloadTick }}
        fetchData={async (params) => {
          try {
            const res = await listTasks({ page: params.pageNumber, pageSize: params.pageSize });
            const sourceMap = new Map((sourcesQuery.data || []).map((s: SpiderSource) => [s.id, s.name]));
            const list = (res.list || []).map((raw: any) => {
              const task = normalizeTask(raw);
              return { ...task, sourceName: task.sourceName || sourceMap.get(raw.source_id) || '-' };
            });
            return { data: { records: list, totalRow: res.total || 0 }, success: true };
          } catch (err: any) {
            showMsg(err.message || '获取数据失败', 'error');
            return { data: { records: [], totalRow: 0 }, success: false };
          }
        }}
      />

      {/* 新建任务 */}
      <Dialog open={writeVisible} onClose={() => setWriteVisible(false)} maxWidth="sm" fullWidth>
        <DialogTitle>新建单任务</DialogTitle>
        <DialogContent>
          <TextField select label="选择来源(可选)" value={form.sourceId} onChange={(e) => setForm({ ...form, sourceId: e.target.value })} fullWidth size="small" sx={{ mt: 1, mb: 1.5 }}
            helperText="选了来源即按该源的模板规则抓取;模板里的 crawl_policy 控制同站请求间隔和页数上限">
            <MenuItem value="">不指定</MenuItem>
            {(sourcesQuery.data || []).map((s: SpiderSource) => <MenuItem key={s.id} value={s.id}>{s.name} ({s.domain})</MenuItem>)}
          </TextField>
          <TextField label="起始 URL" value={form.startUrl} onChange={(e) => setForm({ ...form, startUrl: e.target.value })} fullWidth size="small" sx={{ mb: 1.5 }} required />
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField label="最大深度" type="number" value={form.maxDepth} onChange={(e) => setForm({ ...form, maxDepth: e.target.value })} size="small" sx={{ flex: 1 }} disabled={!!form.sourceId} />
            <TextField label="最大请求页数" type="number" value={form.maxPages} onChange={(e) => setForm({ ...form, maxPages: e.target.value })} size="small" sx={{ flex: 1 }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWriteVisible(false)}>取消</Button>
          <Button variant="contained" onClick={handleCreate}>创建</Button>
        </DialogActions>
      </Dialog>

      {/* 详情 */}
      {/* key:换任务时重建,标签页等内部状态随之复位 */}
      <TaskDetailDialog
        key={viewingId ?? 'closed'}
        taskId={viewingId}
        live={viewingId ? liveById.get(viewingId) : undefined}
        onStop={(id) => stopMutation.mutate(id)}
        onClose={() => setViewingId(null)}
      />

      <Snackbar open={snack.open} autoHideDuration={2500} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
        <Alert severity={snack.severity} variant="filled">{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}

function StatCard({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <Card variant="outlined"><CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 700, color: color || 'text.primary' }}>{value}</Typography>
    </CardContent></Card>
  );
}

function TaskDetailDialog({ taskId, live, onStop, onClose }: {
  taskId: string | null;
  live?: CrawlTaskFromWS;
  onStop: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState(0);
  const open = !!taskId;
  const liveActive = isActive(live?.status);

  const detailQ = useQuery({
    queryKey: ['spider', 'task-detail', taskId],
    queryFn: () => getTaskDetail(taskId!).then((r: any) => normalizeTask(r?.data ?? r)),
    enabled: open,
    // WS 断开时兜底轮询;WS 在线时进度直接叠加 live
    refetchInterval: liveActive ? 5000 : false,
  });
  const itemsQ = useQuery({
    queryKey: ['spider', 'task-items', taskId],
    queryFn: () => getTaskItems(taskId!).then((r) => r.list || []),
    enabled: open && tab === 0,
  });
  const linksQ = useQuery({
    queryKey: ['spider', 'task-links', taskId],
    queryFn: () => getTaskLinks(taskId!).then((r) => r.list || []),
    enabled: open && tab === 1,
  });

  const t = detailQ.data ? mergeLive(detailQ.data, live) : undefined;
  const p = t?.progress;
  const elapsed = t ? elapsedOf(t) : undefined;
  const rate = p && elapsed && elapsed > 0 ? Math.round((p.pagesCrawled / elapsed) * 60) : undefined;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6">任务详情 · {taskId?.slice(0, 8)}</Typography>
          {t && <Chip icon={<FiberManualRecordIcon sx={{ fontSize: 10 }} />} label={STATUS_LABELS[t.status] || t.status} color={STATUS_COLORS[t.status] || 'default'} size="small" />}
          {p && <Chip label={PHASE_LABELS[p.phase] || p.phase} size="small" variant="outlined" />}
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {!t ? (
          <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>{detailQ.isError ? '获取详情失败' : '加载中…'}</Typography>
        ) : (
          <>
            <Box sx={{ mb: 2 }}><ProgressBar t={t} dense={false} /></Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 1.5, mb: 2 }}>
              <StatCard label="请求页 / 上限" value={`${t.pagesCrawled}${(p?.pageBudget || t.maxPages) ? ` / ${p?.pageBudget || t.maxPages}` : ''}`} color="info.main" />
              {p && <StatCard label="分类" value={p.categoriesTotal > 0 ? `${p.categoriesDone} / ${p.categoriesTotal}` : '-'} />}
              <StatCard label="发现条目" value={p?.itemsFound ?? t.linksFound} color="secondary.main" />
              <StatCard label="新入库" value={p ? p.itemsNew : t.itemsSaved} color="success.main" />
              {p && <StatCard label="新章节" value={p.chaptersNew} color="success.main" />}
              {p && <StatCard label="错误" value={p.errors} color={p.errors > 0 ? 'error.main' : undefined} />}
              <StatCard label="耗时" value={fmtDuration(elapsed)} />
              {rate !== undefined && <StatCard label="速度" value={`${rate} 页/分`} />}
            </Box>

            <Box sx={{ mb: 1, p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>起始 URL:</Typography>
              <Typography sx={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>{t.startUrl}</Typography>
            </Box>
            {p?.currentUrl && (
              <Box sx={{ mb: 1, p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>正在抓取:</Typography>
                <Typography sx={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>{p.currentUrl}</Typography>
              </Box>
            )}
            {(p?.lastError || t.errorMsg) && (
              <Alert severity={t.status === 'failed' ? 'error' : 'warning'} sx={{ mb: 1.5, '& .MuiAlert-message': { wordBreak: 'break-all' } }}>
                {t.errorMsg ? `任务失败:${t.errorMsg}` : `最近一次错误:${p?.lastError}`}
              </Alert>
            )}

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tab label={`Items (${t.itemsSaved})`} />
              <Tab label={`Links (${t.linksFound})`} />
            </Tabs>

            {tab === 0 && (
              <Box sx={{ mt: 1.5 }}>
                {itemsQ.isLoading ? <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>加载中…</Typography>
                  : itemsQ.data?.length === 0 ? <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>暂无抓取项</Typography>
                  : (
                    <Box sx={{ maxHeight: 360, overflow: 'auto' }}>
                      {itemsQ.data!.map((it: any) => (
                        <Box key={it.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: '1px dashed', borderBottomColor: 'divider' }}>
                          {it.cover && <img src={it.cover} alt="" style={{ width: 40, height: 24, objectFit: 'cover', borderRadius: 4 }} />}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</Typography>
                            <Typography sx={{ fontSize: 10, color: 'text.secondary', fontFamily: 'monospace' }}>{it.url}</Typography>
                          </Box>
                          {it.source && <Chip label={it.source} size="small" sx={{ height: 18, fontSize: 10 }} />}
                        </Box>
                      ))}
                    </Box>
                  )}
              </Box>
            )}

            {tab === 1 && (
              <Box sx={{ mt: 1.5 }}>
                {linksQ.isLoading ? <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>加载中…</Typography>
                  : linksQ.data?.length === 0 ? <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>暂无链接</Typography>
                  : (
                    <Box sx={{ maxHeight: 360, overflow: 'auto' }}>
                      {linksQ.data!.map((l: any) => (
                        <Box key={l.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: '1px dashed', borderBottomColor: 'divider' }}>
                          <Chip label={`D${l.depth}`} size="small" sx={{ height: 18, fontSize: 10 }} color="default" />
                          <Typography sx={{ fontSize: 11, fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.url}</Typography>
                          {l.source && <Chip label={l.source} size="small" sx={{ height: 18, fontSize: 10 }} variant="outlined" />}
                        </Box>
                      ))}
                    </Box>
                  )}
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        {t && (t.status === 'running' || t.status === 'pending') && (
          <Button color="warning" startIcon={<StopIcon />} onClick={() => onStop(t.id)}>停止</Button>
        )}
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}
