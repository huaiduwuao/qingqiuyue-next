'use client';

/**
 * 单任务管理
 * 从 account/content/_views/spider/tasks/ 迁移
 */

import React, { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import StopIcon from '@mui/icons-material/Stop';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AddIcon from '@mui/icons-material/Add';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { listTasks, createTask, createRuleTask, stopTask as apiStopTask, deleteTask as apiDeleteTask, getTaskDetail, getTaskItems, getTaskLinks, listSources } from '@/apis/spider';
import { useSpiderWebSocket } from '@/hooks/useSpiderWebSocket';
import type { GridColDef } from '@mui/x-data-grid';
import type { CrawlTask, CrawlTaskDetail, SpiderSource } from '@/beans/spider';

const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  pending: 'default', running: 'info', stopped: 'warning', completed: 'success', failed: 'error',
};
const STATUS_LABELS: Record<string, string> = {
  pending: '等待中', running: '运行中', stopped: '已停止', completed: '已完成', failed: '失败',
};

const LIST_KEY = ['spider', 'tasks'];

export default function SpiderTasksPage() {
  const qc = useQueryClient();
  const { revision } = useSpiderWebSocket();
  const [writeVisible, setWriteVisible] = useState(false);
  const [viewing, setViewing] = useState<CrawlTaskDetail | null>(null);
  const [form, setForm] = useState({ sourceId: '', startUrl: '', maxDepth: '2', maxPages: '100' });
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const showMsg = useCallback((message: string, severity: 'success' | 'error' = 'success') => setSnack({ open: true, message, severity }), []);
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: LIST_KEY }), [qc]);
  const sourcesQuery = useQuery({ queryKey: ['spider', 'sources-list'], queryFn: () => listSources().then((r) => r.list || []) });

  const createMutation = useMutation({
    mutationFn: (vals: any) => createTask(vals),
    onSuccess: () => { showMsg('任务已创建'); setWriteVisible(false); setForm({ sourceId: '', startUrl: '', maxDepth: '2', maxPages: '100' }); refresh(); },
    onError: (err: any) => showMsg(err.message || '创建失败', 'error'),
  });

  const createRuleMutation = useMutation({
    mutationFn: (vals: any) => createRuleTask(vals),
    onSuccess: () => { showMsg('规则任务已创建'); setWriteVisible(false); setForm({ sourceId: '', startUrl: '', maxDepth: '2', maxPages: '100' }); refresh(); },
    onError: (err: any) => showMsg(err.message || '创建规则任务失败', 'error'),
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => apiStopTask(id),
    onSuccess: () => { showMsg('已停止'); refresh(); },
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
      createRuleMutation.mutate({ source_id: Number(form.sourceId), start_url: form.startUrl, max_pages: Number(form.maxPages) || 100 });
    } else {
      createMutation.mutate({ source_id: undefined, start_url: form.startUrl, max_depth: Number(form.maxDepth) || 2, max_pages: Number(form.maxPages) || 100 });
    }
  };

  const handleView = async (id: string) => {
    try {
      const res = await getTaskDetail(id);
      setViewing(res.data);
    } catch (err: any) {
      showMsg(err.message || '获取详情失败', 'error');
    }
  };

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 100 },
    { field: 'sourceName', headerName: '来源', width: 120 },
    { field: 'startUrl', headerName: '起始 URL', width: 300, renderCell: (p) => <Tooltip title={p.value}><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{(p.value || '').slice(0, 40)}…</span></Tooltip> },
    { field: 'status', headerName: '状态', width: 100, renderCell: (p) => <Chip label={STATUS_LABELS[p.value] || p.value} color={STATUS_COLORS[p.value] || 'default'} size="small" /> },
    { field: 'maxDepth', headerName: '深度', width: 70, type: 'number' },
    { field: 'maxPages', headerName: '目标页', width: 90, type: 'number' },
    { field: 'pagesCrawled', headerName: '已抓取', width: 90, type: 'number' },
    { field: 'linksFound', headerName: '已发现链接', width: 110, type: 'number' },
    { field: 'itemsSaved', headerName: '已入库', width: 90, type: 'number' },
    { field: 'createdAt', headerName: '创建时间', width: 160, valueFormatter: (v) => v ? new Date(v).toLocaleString() : '-' },
    {
      field: 'actions', headerName: '操作', width: 180, sortable: false,
      renderCell: (p) => {
        const t = p.row as CrawlTask;
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {(t.status === 'running' || t.status === 'pending') && (
              <Tooltip title="停止"><IconButton size="small" color="warning" onClick={() => stopMutation.mutate(t.id)}><StopIcon fontSize="small" /></IconButton></Tooltip>
            )}
            <Tooltip title="查看"><IconButton size="small" onClick={() => handleView(t.id)}><VisibilityOutlinedIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="删除"><IconButton size="small" color="error" onClick={() => { if (confirm('确定删除?')) deleteMutation.mutate(t.id); }}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
          </Box>
        );
      },
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">单任务</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setWriteVisible(true)}>新建任务</Button>
      </Box>

      <DataGridTable
        columns={columns}
        extraParams={{ wsRevision: revision }}
        fetchData={async (params) => {
          try {
            const res = await listTasks({ page: params.pageNumber, pageSize: params.pageSize });
            const sourceMap = new Map((sourcesQuery.data || []).map((s: SpiderSource) => [s.id, s.name]));
            const list = (res.list || []).map((task: any) => ({
              ...task,
              startUrl: task.start_url, maxDepth: task.max_depth, maxPages: task.max_pages,
              pagesCrawled: task.pages_crawled, linksFound: task.links_found, itemsSaved: task.items_saved,
              createdAt: task.created_at, updatedAt: task.updated_at,
              sourceName: task.source_name || sourceMap.get(task.source_id) || '-',
            }));
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
          <TextField select label="选择来源(可选)" value={form.sourceId} onChange={(e) => setForm({ ...form, sourceId: e.target.value })} fullWidth size="small" sx={{ mt: 1, mb: 1.5 }}>
            <MenuItem value="">不指定</MenuItem>
            {(sourcesQuery.data || []).map((s: SpiderSource) => <MenuItem key={s.id} value={s.id}>{s.name} ({s.domain})</MenuItem>)}
          </TextField>
          <TextField label="起始 URL" value={form.startUrl} onChange={(e) => setForm({ ...form, startUrl: e.target.value })} fullWidth size="small" sx={{ mb: 1.5 }} required />
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField label="最大深度" type="number" value={form.maxDepth} onChange={(e) => setForm({ ...form, maxDepth: e.target.value })} size="small" sx={{ flex: 1 }} />
            <TextField label="最大页数" type="number" value={form.maxPages} onChange={(e) => setForm({ ...form, maxPages: e.target.value })} size="small" sx={{ flex: 1 }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWriteVisible(false)}>取消</Button>
          <Button variant="contained" onClick={handleCreate}>创建</Button>
        </DialogActions>
      </Dialog>

      {/* 详情 */}
      <TaskDetailDialog viewing={viewing} onClose={() => setViewing(null)} />

      <Snackbar open={snack.open} autoHideDuration={2500} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
        <Alert severity={snack.severity} variant="filled">{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}

function TaskDetailDialog({ viewing, onClose }: { viewing: CrawlTaskDetail | null; onClose: () => void }) {
  const [tab, setTab] = useState(0);
  const open = !!viewing;
  const itemsQ = useQuery({
    queryKey: ['spider', 'task-items', viewing?.id],
    queryFn: () => getTaskItems(viewing!.id).then((r) => r.list || []),
    enabled: open && tab === 0,
  });
  const linksQ = useQuery({
    queryKey: ['spider', 'task-links', viewing?.id],
    queryFn: () => getTaskLinks(viewing!.id).then((r) => r.list || []),
    enabled: open && tab === 1,
  });

  React.useEffect(() => { if (open) setTab(0); }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">任务详情 · {viewing?.id}</Typography>
          {viewing && (
            <Chip icon={<FiberManualRecordIcon sx={{ fontSize: 10 }} />}
              label={viewing.isRunning ? '运行中' : STATUS_LABELS[viewing.status] || viewing.status}
              color={viewing.isRunning ? 'info' : STATUS_COLORS[viewing.status] || 'default'} size="small" />
          )}
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {viewing && (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5, mb: 2 }}>
              <Card variant="outlined"><CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>已抓取页</Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 700, color: 'info.main' }}>{viewing.stats.pagesCrawled}</Typography>
              </CardContent></Card>
              <Card variant="outlined"><CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>发现链接</Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 700, color: 'secondary.main' }}>{viewing.stats.linksFound}</Typography>
              </CardContent></Card>
              <Card variant="outlined"><CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>已入库</Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 700, color: 'success.main' }}>{viewing.stats.itemsSaved}</Typography>
              </CardContent></Card>
              <Card variant="outlined"><CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>抓取进度</Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 700, color: 'warning.main' }}>
                  {viewing.maxPages > 0 ? Math.round((viewing.stats.pagesCrawled / viewing.maxPages) * 100) : 0}%
                </Typography>
              </CardContent></Card>
            </Box>
            <Box sx={{ mb: 1.5, p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>起始 URL:</Typography>
              <Typography sx={{ fontSize: 12, fontFamily: 'monospace' }}>{viewing.startUrl}</Typography>
            </Box>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tab label={`Items (${viewing.stats.itemsSaved})`} />
              <Tab label={`Links (${viewing.stats.linksFound})`} />
            </Tabs>

            {tab === 0 && (
              <Box sx={{ mt: 1.5 }}>
                {itemsQ.isLoading ? <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>加载中…</Typography>
                  : itemsQ.data?.length === 0 ? <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>暂无抓取项</Typography>
                  : (
                    <Box sx={{ maxHeight: 360, overflow: 'auto' }}>
                      {itemsQ.data.map((it: any) => (
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
                      {linksQ.data.map((l: any) => (
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
      <DialogActions><Button onClick={onClose}>关闭</Button></DialogActions>
    </Dialog>
  );
}
