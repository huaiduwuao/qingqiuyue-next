'use client';

/**
 * 任务管理页面
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { FilterBar, type FilterField } from '@/components/tables/FilterBar';
import { listTasks, createTask, getTask, getTaskLogs, getTaskStatus, cancelTask, listImages } from '@/apis/sandbox';
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS, type SandboxTaskResp, type SandboxImageResp } from '@/beans/sandbox';

const LIST_KEY = ['sandbox', 'tasks'];

export default function TasksPage() {
  const qc = useQueryClient();
  const [writeVisible, setWriteVisible] = useState(false);
  const [viewing, setViewing] = useState<SandboxTaskResp | null>(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});

  const showMsg = useCallback((message: string, severity: 'success' | 'error' = 'success') => setSnack({ open: true, message, severity }), []);
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: LIST_KEY }), [qc]);

  // 镜像列表（用于选择）
  const imagesQuery = useQuery({
    queryKey: ['sandbox', 'images-list'],
    queryFn: () => listImages().then((r) => r.data?.records || r.data?.list || []),
  });

  const filterFields: FilterField[] = [
    { key: 'status', label: '状态', type: 'select', options: [
      { label: '全部', value: '' },
      { label: '等待中', value: 'pending' },
      { label: '调度中', value: 'scheduling' },
      { label: '运行中', value: 'running' },
      { label: '已完成', value: 'completed' },
      { label: '失败', value: 'failed' },
      { label: '已取消', value: 'cancelled' },
      { label: '超时', value: 'timeout' },
    ]},
    { key: 'imageId', label: '镜像', type: 'select', options: [
      { label: '全部', value: '' },
      ...((imagesQuery.data || []) as SandboxImageResp[]).map((img) => ({ label: img.displayName || img.name, value: img.id })),
    ]},
  ];

  const createMutation = useMutation({
    mutationFn: (vals: any) => createTask(vals),
    onSuccess: (res) => {
      showMsg(`任务创建成功 (ID: ${res.data?.taskId?.slice(0, 8)}...)`);
      setWriteVisible(false);
      refresh();
    },
    onError: (err: any) => showMsg(err.message || '创建失败', 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: (taskId: string) => cancelTask(taskId),
    onSuccess: () => {
      showMsg('任务已取消');
      refresh();
    },
    onError: (err: any) => showMsg(err.message || '取消失败', 'error'),
  });

  const handleView = async (taskId: string) => {
    try {
      const res = await getTask(taskId);
      setViewing(res.data || null);
    } catch (err: any) {
      showMsg(err.message || '获取详情失败', 'error');
    }
  };

  const columns: import('@mui/x-data-grid').GridColDef[] = [
    { field: 'taskId', headerName: '任务 ID', width: 280, renderCell: (p) => (
      <Tooltip title={p.value}><Typography sx={{ fontFamily: 'monospace', fontSize: 11 }}>{String(p.value).slice(0, 16)}…</Typography></Tooltip>
    )},
    { field: 'title', headerName: '标题', width: 180 },
    { field: 'imageName', headerName: '镜像', width: 140, renderCell: (p) => (
      <Chip label={String(p.value).split(':')[0]} size="small" variant="outlined" />
    )},
    { field: 'language', headerName: '语言', width: 80 },
    { field: 'status', headerName: '状态', width: 100, renderCell: (p) => (
      <Chip label={TASK_STATUS_LABELS[p.value] || p.value} size="small" color={TASK_STATUS_COLORS[p.value] || 'default'} />
    )},
    { field: 'exitCode', headerName: '退出码', width: 80, type: 'number', renderCell: (p) => (
      <Typography sx={{ fontFamily: 'monospace', fontSize: 12, color: p.value === 0 ? 'success.main' : 'error.main' }}>
        {p.value != null ? p.value : '-'}
      </Typography>
    )},
    { field: 'durationMs', headerName: '耗时(ms)', width: 100, type: 'number', renderCell: (p) => (
      <Typography sx={{ fontSize: 12 }}>{p.value ? `${p.value}ms` : '-'}</Typography>
    )},
    { field: 'createdAt', headerName: '创建时间', width: 170, renderCell: (p) => p.value ? new Date(p.value).toLocaleString('zh-CN') : '-' },
    {
      field: 'actions', headerName: '操作', width: 150, sortable: false,
      renderCell: (p) => {
        const task = p.row as SandboxTaskResp;
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="查看详情">
              <IconButton size="small" onClick={() => handleView(task.taskId)}>
                <span style={{ fontSize: 11 }}>详情</span>
              </IconButton>
            </Tooltip>
            {task.status === 'pending' || task.status === 'scheduling' || task.status === 'running' ? (
              <Tooltip title="取消任务">
                <IconButton size="small" color="warning" onClick={() => { if (confirm('确定取消该任务?')) cancelMutation.mutate(task.taskId); }}>
                  <span style={{ fontSize: 11 }}>取消</span>
                </IconButton>
              </Tooltip>
            ) : null}
          </Box>
        );
      },
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">任务管理</Typography>
        <Button variant="contained" onClick={() => setWriteVisible(true)}>+ 新建任务</Button>
      </Box>

      <FilterBar fields={filterFields} values={filterValues} onChange={setFilterValues} onReset={() => setFilterValues({})} />

      <DataGridTable
        columns={columns}
        fetchData={async (params) => {
          try {
            const res = await listTasks({
              page: params.pageNumber,
              pageSize: params.pageSize,
              status: filterValues.status || undefined,
              imageId: filterValues.imageId || undefined,
            });
            return { data: { records: res.data?.records || res.data?.list || [], totalRow: res.data?.total || res.data?.totalRow || 0 }, success: true };
          } catch (err: any) {
            showMsg(err.message || '获取数据失败', 'error');
            return { data: { records: [], totalRow: 0 }, success: false };
          }
        }}
      />

      {/* 新建任务 */}
      <CreateTaskDialog
        open={writeVisible}
        onClose={() => setWriteVisible(false)}
        onSubmit={(vals) => createMutation.mutate(vals)}
        loading={createMutation.isPending}
        images={(imagesQuery.data || []) as SandboxImageResp[]}
      />

      {/* 任务详情 */}
      <TaskDetailDialog viewing={viewing} onClose={() => setViewing(null)} />

      <Snackbar open={snack.open} autoHideDuration={2500} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
        <Alert severity={snack.severity} variant="filled">{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}

interface CreateTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (vals: any) => void;
  loading: boolean;
  images: SandboxImageResp[];
}

function CreateTaskDialog({ open, onClose, onSubmit, loading, images }: CreateTaskDialogProps) {
  const [form, setForm] = useState({
    title: '',
    imageId: '',
    code: '#!/usr/bin/env python3\nprint("Hello, Sandbox!")',
    args: '',
    timeoutSec: 300,
    memoryLimit: '512m',
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!form.title || !form.imageId || !form.code) return;
    onSubmit({
      title: form.title,
      imageId: Number(form.imageId),
      code: form.code,
      args: form.args || undefined,
      timeoutSec: form.timeoutSec || undefined,
      memoryLimit: form.memoryLimit || undefined,
    });
  };

  useEffect(() => {
    if (open) setForm({
      title: '',
      imageId: images[0]?.id?.toString() || '',
      code: '#!/usr/bin/env python3\nprint("Hello, Sandbox!")',
      args: '',
      timeoutSec: 300,
      memoryLimit: '512m',
    });
  }, [open, images]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>新建任务</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 1 }}>
          <TextField
            label="任务标题 *"
            value={form.title}
            onChange={handleChange('title')}
            placeholder="如: Python 数据分析测试"
            required
            fullWidth
          />
          <TextField
            select
            label="选择镜像 *"
            value={form.imageId}
            onChange={handleChange('imageId')}
            required
            fullWidth
          >
            {images.map((img) => (
              <MenuItem key={img.id} value={img.id}>
                {img.displayName || img.name} {img.baseImage ? `(${img.baseImage})` : ''}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="代码 *"
            value={form.code}
            onChange={handleChange('code')}
            multiline
            rows={12}
            placeholder="# 输入你的代码"
            required
            fullWidth
            helperText="支持 Python, Node.js, Go 等语言"
          />
          <TextField
            label="命令行参数"
            value={form.args}
            onChange={handleChange('args')}
            placeholder="如: --input data.json --output result.json"
            fullWidth
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="超时(秒)"
              type="number"
              value={form.timeoutSec}
              onChange={handleChange('timeoutSec')}
              slotProps={{ htmlInput: { min: 10, max: 3600 } }}
              sx={{ flex: 1 }}
            />
            <TextField
              label="内存限制"
              value={form.memoryLimit}
              onChange={handleChange('memoryLimit')}
              placeholder="如: 512m, 1g"
              sx={{ flex: 1 }}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading || !form.title || !form.imageId || !form.code}>
          {loading ? '提交中…' : '创建并执行'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TaskDetailDialog({ viewing, onClose }: { viewing: SandboxTaskResp | null; onClose: () => void }) {
  const [logs, setLogs] = useState<string>('');
  const [activeTab, setActiveTab] = useState(0);
  const open = !!viewing;

  // 加载日志
  const logsQuery = useQuery({
    queryKey: ['sandbox', 'task-logs', viewing?.taskId],
    queryFn: async () => {
      if (!viewing?.taskId) return '';
      const res = await getTaskLogs(viewing.taskId);
      return res.data?.logs || '';
    },
    enabled: open,
  });

  // 实时状态轮询
  const statusQuery = useQuery({
    queryKey: ['sandbox', 'task-status', viewing?.taskId],
    queryFn: async () => {
      if (!viewing?.taskId) return null;
      return getTaskStatus(viewing.taskId);
    },
    enabled: open && (viewing?.status === 'pending' || viewing?.status === 'scheduling' || viewing?.status === 'running'),
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (open) setActiveTab(0);
  }, [open]);

  if (!viewing) return null;

  const durationDisplay = viewing.durationMs ? `${(viewing.durationMs / 1000).toFixed(2)}s` : '-';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">任务详情</Typography>
          <Chip label={TASK_STATUS_LABELS[viewing.status] || viewing.status} size="small" color={TASK_STATUS_COLORS[viewing.status] || 'default'} />
          {statusQuery.data?.data?.status && (
            <Typography variant="caption" color="text.secondary">(实时: {TASK_STATUS_LABELS[statusQuery.data.data.status] || statusQuery.data.data.status})</Typography>
          )}
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {/* 统计卡片 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5, mb: 2 }}>
          <Card variant="outlined"><CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>任务 ID</Typography>
            <Typography sx={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>{viewing.taskId?.slice(0, 8)}…</Typography>
          </CardContent></Card>
          <Card variant="outlined"><CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>退出码</Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 700, color: viewing.exitCode === 0 ? 'success.main' : 'error.main' }}>{viewing.exitCode ?? '-'}</Typography>
          </CardContent></Card>
          <Card variant="outlined"><CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>耗时</Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 700 }}>{durationDisplay}</Typography>
          </CardContent></Card>
          <Card variant="outlined"><CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>超时时间</Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 700 }}>{viewing.timeoutSec}s</Typography>
          </CardContent></Card>
        </Box>

        {/* 基本信息 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 2 }}>
          <Box><Typography variant="caption" color="text.secondary">标题</Typography><Typography>{viewing.title || '-'}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">镜像</Typography><Typography sx={{ fontFamily: 'monospace' }}>{viewing.imageName || '-'}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">语言</Typography><Typography>{viewing.language || '-'}</Typography></Box>
        </Box>

        {/* Tab 切换 */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button size="small" variant={activeTab === 0 ? 'contained' : 'text'} onClick={() => setActiveTab(0)}>日志</Button>
            <Button size="small" variant={activeTab === 1 ? 'contained' : 'text'} onClick={() => setActiveTab(1)}>输出文件</Button>
            <Button size="small" variant={activeTab === 2 ? 'contained' : 'text'} onClick={() => setActiveTab(2)}>执行代码</Button>
          </Box>
        </Box>

        {/* 日志 */}
        {activeTab === 0 && (
          <Box>
            {logsQuery.isLoading ? (
              <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>加载中…</Typography>
            ) : (
              <Box component="pre" sx={{
                bgcolor: 'action.hover',
                p: 2,
                borderRadius: 1,
                fontSize: 12,
                fontFamily: 'monospace',
                overflow: 'auto',
                maxHeight: 400,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
                {logsQuery.data || viewing.stdout || '暂无日志输出'}
              </Box>
            )}
            {viewing.stderr && (
              <Box component="pre" sx={{
                bgcolor: 'error.light',
                p: 2,
                borderRadius: 1,
                fontSize: 12,
                fontFamily: 'monospace',
                overflow: 'auto',
                maxHeight: 200,
                whiteSpace: 'pre-wrap',
                mt: 1,
                color: 'error.contrastText',
              }}>
                {viewing.stderr}
              </Box>
            )}
          </Box>
        )}

        {/* 输出文件 */}
        {activeTab === 1 && (
          <Box>
            {viewing.outputFiles && viewing.outputFiles.length > 0 ? (
              <List dense>
                {viewing.outputFiles.map((file, idx) => (
                  <ListItem key={idx} divider>
                    <ListItemText
                      primary={file.name}
                      secondary={`${(file.size / 1024).toFixed(2)} KB · ${file.mimeType || 'unknown'}`}
                    />
                    <Button size="small" href={file.url} target="_blank" rel="noopener">下载</Button>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>暂无输出文件</Typography>
            )}
          </Box>
        )}

        {/* 执行代码 */}
        {activeTab === 2 && (
          <Box component="pre" sx={{
            bgcolor: 'action.hover',
            p: 2,
            borderRadius: 1,
            fontSize: 12,
            fontFamily: 'monospace',
            overflow: 'auto',
            maxHeight: 300,
            whiteSpace: 'pre-wrap',
          }}>
            {viewing.stdout || viewing.code || '暂无代码记录'}
          </Box>
        )}

        {/* 错误信息 */}
        {viewing.errorMsg && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light', borderRadius: 1, color: 'error.contrastText' }}>
            <Typography variant="caption">错误信息</Typography>
            <Typography sx={{ fontFamily: 'monospace', fontSize: 12 }}>{viewing.errorMsg}</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>关闭</Button></DialogActions>
    </Dialog>
  );
}
