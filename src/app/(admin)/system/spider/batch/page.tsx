'use client';

/**
 * 批量任务
 *
 * 一次对多个站点各发一个整站规则任务:建站点清单 → 每站入队 → Worker 认领执行 → 按站点结果汇总。
 * 站点从已登记的源里选(按源的模板规则抓),也可以额外填未登记的 URL。
 * 暂停 = 还在排队的站点挂起、在跑的跑完当前任务;取消 = 排队的直接停、在跑的发取消。
 */

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Checkbox from '@mui/material/Checkbox';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Skeleton from '@mui/material/Skeleton';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ReplayIcon from '@mui/icons-material/Replay';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import Link from 'next/link';
import {
  listBatch, createBatch, startBatch, pauseBatch, resumeBatch, cancelBatch, deleteBatch, getBatchDetail, listSites,
} from '@/apis/spider';
import type { BatchJob, BatchStatus, SiteRow } from '@/beans/spider';

const POLL_MS = 5000;

const BATCH_STATUS: Record<BatchStatus, { label: string; color: 'default' | 'info' | 'warning' | 'success' | 'error' }> = {
  pending: { label: '未开始', color: 'default' },
  running: { label: '运行中', color: 'info' },
  paused: { label: '已暂停', color: 'warning' },
  completed: { label: '已完成', color: 'success' },
  cancelled: { label: '已取消', color: 'error' },
};

const SITE_STATUS: Record<string, { label: string; color: 'default' | 'info' | 'warning' | 'success' | 'error' }> = {
  pending: { label: '未开始', color: 'default' },
  queued: { label: '排队中', color: 'default' },
  paused: { label: '已挂起', color: 'warning' },
  running: { label: '运行中', color: 'info' },
  completed: { label: '完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
  stopped: { label: '已停止', color: 'warning' },
};

const EMPTY_FORM = { name: '', description: '', sites: [] as SiteRow[], extraUrls: '', maxPages: '100', incremental: true, start: true };

function fmtUnix(sec?: number) {
  if (!sec) return '-';
  return new Date(sec * 1000).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function SpiderBatchPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const showMsg = (message: string, severity: 'success' | 'error' = 'success') => setSnack({ open: true, message, severity });

  const listQ = useQuery({
    queryKey: ['spider', 'batch', page, pageSize],
    queryFn: () => listBatch({ page: page + 1, pageSize }),
    refetchInterval: POLL_MS,
  });
  const sitesQ = useQuery({ queryKey: ['spider', 'sites'], queryFn: () => listSites(), enabled: createOpen });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['spider', 'batch'] });

  const createM = useMutation({
    mutationFn: () => {
      const urls = form.extraUrls.split(/\s+/).map((u) => u.trim()).filter(Boolean);
      return createBatch({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        source_ids: form.sites.map((s) => String(s.source_id)),
        sources: urls.map((url) => ({ url })),
        max_pages: Number(form.maxPages) || 0,
        incremental: form.incremental,
        start: form.start,
      });
    },
    onSuccess: () => { showMsg(form.start ? '已创建并入队' : '已创建,点「开始」后入队'); setCreateOpen(false); setForm(EMPTY_FORM); invalidate(); },
    onError: (e: any) => showMsg(e?.message || '创建失败', 'error'),
  });

  const actionM = useMutation({
    mutationFn: async ({ action, id }: { action: 'start' | 'pause' | 'resume' | 'cancel' | 'delete'; id: number }) => {
      switch (action) {
        case 'start': await startBatch(id); return '已入队';
        case 'pause': await pauseBatch(id); return '已暂停:排队的站点挂起,在跑的跑完当前任务';
        case 'resume': await resumeBatch(id); return '已恢复';
        case 'cancel': await cancelBatch(id); return '已取消';
        case 'delete': await deleteBatch(id); return '已删除(站点任务记录仍在「抓取任务」里)';
      }
    },
    onSuccess: (msg) => { showMsg(msg || '完成'); invalidate(); qc.invalidateQueries({ queryKey: ['spider', 'batch-detail'] }); },
    onError: (e: any) => showMsg(e?.message || '操作失败', 'error'),
  });
  const act = (action: 'start' | 'pause' | 'resume' | 'cancel' | 'delete', b: BatchJob) => {
    if (action === 'cancel' && !confirm(`取消「${b.name}」?排队的站点直接停,在跑的会收到停止。`)) return;
    if (action === 'delete' && !confirm(`删除「${b.name}」?`)) return;
    actionM.mutate({ action, id: b.id });
  };

  const rows = listQ.data?.list || [];
  const canSubmit = form.name.trim() && (form.sites.length > 0 || form.extraUrls.trim());

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h6">批量任务</Typography>
          <Typography variant="body2" color="text.secondary">一次对多个站点各发一个整站任务;任务进队列由 Worker 执行,每个站点受「站点调度」里的并发上限约束。</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true); }}>新建批量任务</Button>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow sx={{ '& th': { whiteSpace: 'nowrap' } }}>
              <TableCell>任务</TableCell>
              <TableCell>状态</TableCell>
              <TableCell sx={{ width: 220 }}>站点进度</TableCell>
              <TableCell align="center">成功 / 失败</TableCell>
              <TableCell align="center">运行 / 排队</TableCell>
              <TableCell align="right">抓取页 · 新增</TableCell>
              <TableCell>时间</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {listQ.isLoading && [0, 1, 2].map((i) => <TableRow key={i}><TableCell colSpan={8}><Skeleton height={28} /></TableCell></TableRow>)}
            {!listQ.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                还没有批量任务。点右上角「新建批量任务」选几个站点试试;单个站点也可以在「站点调度」里直接「立即抓取」。
              </TableCell></TableRow>
            )}
            {rows.map((b) => {
              const st = BATCH_STATUS[b.status] ?? { label: b.status, color: 'default' as const };
              const done = b.success_site + b.failed_site;
              return (
                <TableRow key={b.id} hover>
                  <TableCell sx={{ minWidth: 200 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14, wordBreak: 'break-all' }}>{b.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      #{b.id} · {b.total_sites} 个站点 · 每站 {b.max_pages || 100} 页{b.incremental ? ' · 增量' : ''}
                    </Typography>
                  </TableCell>
                  <TableCell><Chip size="small" label={st.label} color={st.color} /></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress variant="determinate" value={b.progress} sx={{ flex: 1, height: 6, borderRadius: 3 }}
                        color={b.failed_site > 0 && b.status === 'completed' ? 'warning' : 'primary'} />
                      <Typography variant="caption">{done}/{b.total_sites}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Typography component="span" color="success.main" sx={{ fontWeight: 600 }}>{b.success_site}</Typography>
                    <Typography component="span" color="text.secondary"> / </Typography>
                    <Typography component="span" color={b.failed_site ? 'error.main' : 'text.secondary'} sx={{ fontWeight: 600 }}>{b.failed_site}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    {b.running_sites} / {b.queued_sites}{b.paused_sites ? <Typography component="span" variant="caption" color="warning.main"> (+{b.paused_sites} 挂起)</Typography> : null}
                  </TableCell>
                  <TableCell align="right">{b.pages_crawled.toLocaleString('zh-CN')} · {b.items_saved.toLocaleString('zh-CN')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Typography variant="caption" component="div">建 {fmtUnix(b.created_at)}</Typography>
                    {b.completed_at ? <Typography variant="caption" color="text.secondary">完 {fmtUnix(b.completed_at)}</Typography> : null}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {b.status === 'pending' && <Tooltip title="开始"><IconButton size="small" color="success" onClick={() => act('start', b)}><PlayArrowIcon fontSize="small" /></IconButton></Tooltip>}
                    {(b.status === 'completed' || b.status === 'cancelled') && b.failed_site > 0 && (
                      <Tooltip title="重跑失败 / 停止的站点"><IconButton size="small" color="primary" onClick={() => act('start', b)}><ReplayIcon fontSize="small" /></IconButton></Tooltip>
                    )}
                    {b.status === 'running' && <Tooltip title="暂停"><IconButton size="small" color="warning" onClick={() => act('pause', b)}><PauseIcon fontSize="small" /></IconButton></Tooltip>}
                    {b.status === 'paused' && <Tooltip title="恢复"><IconButton size="small" color="primary" onClick={() => act('resume', b)}><PlayArrowIcon fontSize="small" /></IconButton></Tooltip>}
                    {(b.status === 'running' || b.status === 'paused' || b.status === 'pending') && (
                      <Tooltip title="取消"><IconButton size="small" color="error" onClick={() => act('cancel', b)}><CancelIcon fontSize="small" /></IconButton></Tooltip>
                    )}
                    <Tooltip title="站点明细"><IconButton size="small" onClick={() => setDetailId(b.id)}><VisibilityOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                    {(b.status === 'completed' || b.status === 'cancelled' || b.status === 'pending') && (
                      <Tooltip title="删除"><IconButton size="small" onClick={() => act('delete', b)}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination component="div" count={listQ.data?.total || 0} page={page} rowsPerPage={pageSize}
          onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]} labelRowsPerPage="每页" />
      </TableContainer>

      {/* 新建 */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>新建批量任务</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="任务名称" size="small" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如:短剧站点周更" />
            <Autocomplete
              multiple
              disableCloseOnSelect
              size="small"
              loading={sitesQ.isLoading}
              options={sitesQ.data?.list || []}
              value={form.sites}
              onChange={(_, v) => setForm({ ...form, sites: v })}
              getOptionLabel={(s) => `${s.name} · ${s.domain}`}
              isOptionEqualToValue={(a, b) => a.domain === b.domain}
              groupBy={(s) => s.category || '未分类'}
              renderOption={(props, s, { selected }) => {
                const { key, ...rest } = props as any;
                return (
                  <li key={key} {...rest}>
                    <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">{s.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.domain}{s.paused ? ' · 调度已暂停' : ''}{!s.enabled ? ' · 源停用' : ''}</Typography>
                    </Box>
                  </li>
                );
              }}
              renderInput={(params) => <TextField {...params} label="已登记的站点" placeholder="搜索名称 / 域名" helperText="按该站点的源与模板抓取;暂停调度的站点会排队到恢复为止" />}
            />
            <TextField label="其他 URL(可选)" size="small" multiline minRows={2} value={form.extraUrls}
              onChange={(e) => setForm({ ...form, extraUrls: e.target.value })}
              placeholder={'每行一个起始 URL\nhttps://example.com/list'}
              helperText="没登记成源的站点按域名找源,找不到就用通用规则抓" />
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField label="每站页数上限" type="number" size="small" value={form.maxPages} onChange={(e) => setForm({ ...form, maxPages: e.target.value })} sx={{ width: 160 }} />
              <FormControlLabel control={<Switch checked={form.incremental} onChange={(e) => setForm({ ...form, incremental: e.target.checked })} />} label="增量" />
              <FormControlLabel control={<Switch checked={form.start} onChange={(e) => setForm({ ...form, start: e.target.checked })} />} label="创建后立即开始" />
            </Box>
            <TextField label="备注(可选)" size="small" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>取消</Button>
          <Button variant="contained" disabled={!canSubmit || createM.isPending} onClick={() => createM.mutate()}>
            {form.start ? '创建并开始' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>

      <BatchDetailDialog id={detailId} onClose={() => setDetailId(null)} />

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snack.severity}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}

function BatchDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['spider', 'batch-detail', id],
    queryFn: () => getBatchDetail(id!),
    enabled: id != null,
    refetchInterval: POLL_MS,
  });
  const d = q.data;
  const results = useMemo(() => d?.results || [], [d]);
  return (
    <Dialog open={id != null} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{d ? `${d.name} · 站点明细` : '站点明细'}</DialogTitle>
      <DialogContent>
        {q.isLoading ? <Skeleton height={160} /> : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>站点</TableCell>
                <TableCell>状态</TableCell>
                <TableCell align="right">请求页</TableCell>
                <TableCell align="right">发现 · 新增</TableCell>
                <TableCell>Worker</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((r) => {
                const st = SITE_STATUS[r.status] ?? { label: r.status, color: 'default' as const };
                return (
                  <TableRow key={r.site_id}>
                    <TableCell>
                      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{r.site_name}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{r.url}</Typography>
                      {r.error && <Typography variant="caption" color="error.main" component="div">{r.error}</Typography>}
                    </TableCell>
                    <TableCell><Chip size="small" label={st.label} color={st.color} /></TableCell>
                    <TableCell align="right">{r.pages_crawled}</TableCell>
                    <TableCell align="right">{r.items_found} · {r.items_saved}</TableCell>
                    <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{r.worker_id || '-'}</Typography></TableCell>
                    <TableCell align="right">
                      {r.task_id && (
                        <Link href={`/system/spider/task-monitor?id=${encodeURIComponent(r.task_id)}`}>
                          <Button size="small">实时进度</Button>
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>关闭</Button></DialogActions>
    </Dialog>
  );
}
