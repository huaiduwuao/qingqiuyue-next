'use client';

/**
 * 站点调度
 *
 * 每个已登记的站点(module_source,同一域名的多个源合成一行)一行:
 *   - 调度策略(crawl_site):暂停 / 恢复、同时最多几个任务、认领优先级。
 *     暂停后队列里该站点的任务不再被认领,在跑的放回队列;整点刷新也跳过它。
 *   - 队列:该站点在跑 / 排队的规则任务数,最近一次任务。
 *   - 整点刷新的健康度(最近成功、连续失败、累计新增)。
 *   - 立即抓取:给该站点入队一个整站任务。
 */

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Skeleton from '@mui/material/Skeleton';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import Link from 'next/link';
import { listSites, getSiteStats, updateSite, crawlSiteNow } from '@/apis/spider';
import type { SiteRow } from '@/beans/spider';

const POLL_MS = 5000;

const TASK_STATUS: Record<string, { label: string; color: 'default' | 'info' | 'warning' | 'success' | 'error' }> = {
  queued: { label: '排队中', color: 'default' },
  paused: { label: '已挂起', color: 'default' },
  running: { label: '运行中', color: 'info' },
  completed: { label: '完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
  stopped: { label: '已停止', color: 'warning' },
};

const PRIORITIES = [-5, -2, 0, 2, 5, 10];

function fmtTime(v?: string) {
  if (!v || v.startsWith('0001')) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function SpiderSitesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);
  const [crawlTarget, setCrawlTarget] = useState<SiteRow | null>(null);
  const [crawlPages, setCrawlPages] = useState('100');
  const [crawlIncremental, setCrawlIncremental] = useState(true);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const showMsg = (message: string, severity: 'success' | 'error' = 'success') => setSnack({ open: true, message, severity });

  const sitesQ = useQuery({ queryKey: ['spider', 'sites'], queryFn: () => listSites(), refetchInterval: POLL_MS });
  const statsQ = useQuery({ queryKey: ['spider', 'site-stats'], queryFn: getSiteStats, refetchInterval: POLL_MS });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['spider', 'sites'] });
    qc.invalidateQueries({ queryKey: ['spider', 'site-stats'] });
  };

  const updateM = useMutation({
    mutationFn: ({ domain, data }: { domain: string; data: { paused?: boolean; max_concurrent?: number; priority?: number } }) => updateSite(domain, data),
    onSuccess: (r: any, vars) => {
      if (vars.data.paused === true) showMsg(r?.requeued ? `已暂停,${r.requeued} 个在跑任务放回队列` : '已暂停');
      else if (vars.data.paused === false) showMsg('已恢复调度');
      else showMsg('已保存');
      invalidate();
    },
    onError: (e: any) => showMsg(e?.message || '保存失败', 'error'),
  });
  const crawlM = useMutation({
    mutationFn: ({ domain, max_pages, incremental }: { domain: string; max_pages: number; incremental: boolean }) => crawlSiteNow(domain, { max_pages, incremental }),
    onSuccess: () => { showMsg('已入队,空闲 Worker 会认领它'); setCrawlTarget(null); invalidate(); },
    onError: (e: any) => showMsg(e?.message || '入队失败', 'error'),
  });

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return (sitesQ.data?.list || []).filter((s) => {
      if (onlyActive && s.running + s.queued === 0) return false;
      if (!kw) return true;
      return s.name.toLowerCase().includes(kw) || s.domain.includes(kw) || (s.category || '').toLowerCase().includes(kw);
    });
  }, [sitesQ.data, q, onlyActive]);
  const stats = statsQ.data;

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6">站点调度</Typography>
        <Typography variant="body2" color="text.secondary">
          按站点控制抓取:暂停后该站点的队列任务不再被认领、在跑的放回队列,整点刷新也跳过;并发上限默认 1,对单站礼貌是底线。
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, 1fr)' }, gap: 1.5, mb: 2 }}>
        {[
          { label: '站点', value: stats?.totalSites, hint: stats ? `${stats.enabledSites} 个源启用` : '' },
          { label: '暂停调度', value: stats?.pausedSites },
          { label: '正在抓取', value: stats?.activeSites, hint: stats ? `${stats.usedSlots} / ${stats.siteSlots} 站点并发` : '' },
          { label: '运行任务', value: stats?.running },
          { label: '排队任务', value: stats?.queued },
        ].map((c) => (
          <Paper key={c.label} variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">{c.label}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{c.value ?? '—'}</Typography>
            {c.hint && <Typography variant="caption" color="text.secondary">{c.hint}</Typography>}
          </Paper>
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1.5, flexWrap: 'wrap' }}>
        <TextField size="small" placeholder="按名称 / 域名 / 类型过滤" value={q} onChange={(e) => setQ(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          sx={{ minWidth: 260, flex: '1 1 260px', maxWidth: 420 }} />
        <FormControlLabel control={<Switch size="small" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />} label="只看有任务的" />
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" sx={{ minWidth: 980 }}>
          <TableHead>
            <TableRow sx={{ '& th': { whiteSpace: 'nowrap' } }}>
              <TableCell>站点</TableCell>
              <TableCell align="center">调度</TableCell>
              <TableCell align="center">并发上限</TableCell>
              <TableCell align="center">优先级</TableCell>
              <TableCell align="center">运行 / 排队</TableCell>
              <TableCell>最近任务</TableCell>
              <TableCell>整点刷新</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sitesQ.isLoading && [0, 1, 2].map((i) => (
              <TableRow key={i}><TableCell colSpan={8}><Skeleton height={28} /></TableCell></TableRow>
            ))}
            {!sitesQ.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                {sitesQ.data?.list?.length ? '没有符合条件的站点' : <>还没有登记站点,先去 <Link href="/system/spider/sources">源管理</Link> 添加</>}
              </TableCell></TableRow>
            )}
            {rows.map((s) => {
              const st = s.last_task_status ? TASK_STATUS[s.last_task_status] : undefined;
              const h = s.hourly;
              const lastOk = fmtTime(h?.lastSuccessAt);
              return (
                <TableRow key={s.domain} hover sx={{ opacity: s.enabled ? 1 : 0.6 }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{s.name}</Typography>
                      {s.category && <Chip size="small" label={s.category} sx={{ height: 18, fontSize: 11 }} />}
                      {!s.enabled && <Tooltip title="源已停用:整点刷新不会跑它,手动任务仍可入队"><Chip size="small" label="源停用" sx={{ height: 18, fontSize: 11 }} /></Tooltip>}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{s.domain}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={s.paused ? '已暂停:点一下恢复' : '调度中:点一下暂停'}>
                      <Switch size="small" checked={!s.paused} disabled={updateM.isPending}
                        onChange={(e) => updateM.mutate({ domain: s.domain, data: { paused: !e.target.checked } })} />
                    </Tooltip>
                  </TableCell>
                  <TableCell align="center">
                    <TextField select size="small" value={s.max_concurrent} disabled={updateM.isPending}
                      onChange={(e) => updateM.mutate({ domain: s.domain, data: { max_concurrent: Number(e.target.value) } })}
                      sx={{ width: 72 }}>
                      {[1, 2, 3, 4, 6, 8].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                    </TextField>
                  </TableCell>
                  <TableCell align="center">
                    <TextField select size="small" value={PRIORITIES.includes(s.priority) ? s.priority : 0} disabled={updateM.isPending}
                      onChange={(e) => updateM.mutate({ domain: s.domain, data: { priority: Number(e.target.value) } })}
                      sx={{ width: 80 }}>
                      {PRIORITIES.map((n) => <MenuItem key={n} value={n}>{n > 0 ? `+${n}` : n}</MenuItem>)}
                    </TextField>
                  </TableCell>
                  <TableCell align="center">
                    <Typography sx={{ fontWeight: 600, color: s.running ? 'info.main' : 'text.secondary' }} component="span">{s.running}</Typography>
                    <Typography color="text.secondary" component="span"> / {s.queued}</Typography>
                  </TableCell>
                  <TableCell sx={{ minWidth: 170 }}>
                    {s.last_task_id ? (
                      <Link href={`/system/spider/task-monitor?id=${encodeURIComponent(s.last_task_id)}`} style={{ textDecoration: 'none' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Chip size="small" label={st?.label ?? s.last_task_status} color={st?.color ?? 'default'} sx={{ height: 20 }} />
                          <Typography variant="caption" color="text.secondary">{fmtTime(s.last_task_at)} · 新增 {s.last_task_items}</Typography>
                        </Box>
                      </Link>
                    ) : <Typography variant="caption" color="text.secondary">没跑过规则任务</Typography>}
                  </TableCell>
                  <TableCell sx={{ minWidth: 130 }}>
                    {h && (h.totalRuns > 0) ? (
                      <Tooltip title={h.lastError ? `最近错误:${h.lastError}` : ''}>
                        <Box>
                          <Typography variant="caption" component="div" color={h.consecErrors > 0 ? 'error.main' : 'text.secondary'}>
                            {h.consecErrors > 0 ? `连续失败 ${h.consecErrors} 次` : lastOk ? `成功 ${lastOk}` : '尚未成功'}
                            {h.skippedCooldown ? ' · 冷却中' : ''}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">累计新增 {h.totalNewItems}</Typography>
                        </Box>
                      </Tooltip>
                    ) : <Typography variant="caption" color="text.secondary">—</Typography>}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Button size="small" startIcon={<BoltRoundedIcon />} onClick={() => { setCrawlTarget(s); setCrawlPages('100'); setCrawlIncremental(true); }}>
                      立即抓取
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={!!crawlTarget} onClose={() => setCrawlTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>立即抓取 · {crawlTarget?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            从 {crawlTarget?.link || crawlTarget?.domain} 起按该站点的模板做一次整站抓取。任务进队列,受该站点并发上限约束
            {crawlTarget?.paused ? ',但站点现在是暂停状态,恢复调度前不会开始' : ''}。
          </Typography>
          <TextField label="页数上限" type="number" size="small" fullWidth value={crawlPages} onChange={(e) => setCrawlPages(e.target.value)}
            helperText="本次最多发多少个页面请求(模板 crawl_policy.max_pages 更小时以模板为准)" sx={{ mb: 1 }} />
          <FormControlLabel control={<Switch checked={crawlIncremental} onChange={(e) => setCrawlIncremental(e.target.checked)} />} label="增量(已收录的作品只补新章节 / 分集)" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCrawlTarget(null)}>取消</Button>
          <Button variant="contained" disabled={crawlM.isPending}
            onClick={() => crawlTarget && crawlM.mutate({ domain: crawlTarget.domain, max_pages: Math.max(1, Number(crawlPages) || 100), incremental: crawlIncremental })}>
            入队
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snack.severity}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
