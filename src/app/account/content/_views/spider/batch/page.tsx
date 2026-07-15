'use client';

import React, { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import LinearProgress from '@mui/material/LinearProgress';
import { DataGridTable } from '@/components/tables/DataGridTable';
import {
  listBatch,
  createBatch,
  startBatch,
  pauseBatch,
  resumeBatch,
  cancelBatch,
} from '@/apis/spider';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ReplayIcon from '@mui/icons-material/Replay';
import CancelIcon from '@mui/icons-material/Cancel';
import type { GridColDef } from '@mui/x-data-grid';
import type { BatchJob } from '@/beans/spider';

const LIST_KEY = ['spider', 'batch'];

const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  pending: 'default',
  running: 'info',
  paused: 'warning',
  completed: 'success',
  cancelled: 'error',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '等待中',
  running: '运行中',
  paused: '已暂停',
  completed: '已完成',
  cancelled: '已取消',
};

export default function SpiderBatchPage() {
  const qc = useQueryClient();
  const [writeVisible, setWriteVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<BatchJob | null>(null);
  const [formValues, setFormValues] = useState({ name: '', domain: '', url: '', type: 'html' });
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showMessage = useCallback((message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: LIST_KEY }), [qc]);

  const createMutation = useMutation({
    mutationFn: (vals: typeof formValues) => createBatch(vals),
    onSuccess: () => { showMessage('创建成功'); setWriteVisible(false); invalidate(); },
    onError: (err: any) => showMessage(err.message || '创建失败', 'error'),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, record }: { action: string; record: BatchJob }) => {
      switch (action) {
        case 'start':
          await startBatch(record.id!);
          return '已启动';
        case 'pause':
          await pauseBatch(record.id!);
          return '已暂停';
        case 'resume':
          await resumeBatch(record.id!);
          return '已恢复';
        case 'cancel':
          if (!confirm('确定要取消该任务吗？')) throw new Error('__CANCELLED__');
          await cancelBatch(record.id!);
          return '已取消';
        default:
          throw new Error('未知操作');
      }
    },
    onSuccess: (msg) => { showMessage(msg); invalidate(); },
    onError: (err: any) => {
      if (err?.message === '__CANCELLED__') return;
      showMessage(err.message || '操作失败', 'error');
    },
  });

  const handleCreate = () => {
    setSelectedRecord(null);
    setFormValues({ name: '', domain: '', url: '', type: 'html' });
    setWriteVisible(true);
  };

  const handleFormChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = () => {
    createMutation.mutate(formValues);
  };

  const handleAction = (action: string, record: BatchJob) => {
    actionMutation.mutate({ action, record });
  };

  const isSubmitting = createMutation.isPending;

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'name', headerName: '任务名称', width: 180 },
    { field: 'domain', headerName: '域名', width: 150 },
    { field: 'url', headerName: '起始URL', width: 250 },
    { field: 'type', headerName: '类型', width: 100 },
    {
      field: 'status',
      headerName: '状态',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={STATUS_LABELS[params.value] || params.value}
          color={STATUS_COLORS[params.value] || 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'progress',
      headerName: '进度',
      width: 150,
      renderCell: (params) => {
        const progress = params.value ?? 0;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
            <LinearProgress variant="determinate" value={progress} sx={{ flex: 1 }} />
            <Typography variant="caption">{progress}%</Typography>
          </Box>
        );
      },
    },
    {
      field: 'stats',
      headerName: '已处理/总数',
      width: 140,
      valueGetter: (value, row) => `${row.processedUrls ?? 0}/${row.totalUrls ?? 0}`,
    },
    { field: 'createTime', headerName: '创建时间', width: 180, valueFormatter: (value) => value ? new Date(value).toLocaleString() : '-' },
    {
      field: 'actions',
      headerName: '操作',
      width: 220,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => {
        const record = params.row as BatchJob;
        const status = record.status;
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {status === 'pending' && (
              <>
                <Tooltip title="启动">
                  <IconButton size="small" color="success" onClick={() => handleAction('start', record)}>
                    <PlayArrowIcon />
                  </IconButton>
                </Tooltip>
              </>
            )}
            {status === 'running' && (
              <Tooltip title="暂停">
                <IconButton size="small" color="warning" onClick={() => handleAction('pause', record)}>
                  <PauseIcon />
                </IconButton>
              </Tooltip>
            )}
            {status === 'paused' && (
              <>
                <Tooltip title="恢复">
                  <IconButton size="small" color="primary" onClick={() => handleAction('resume', record)}>
                    <ReplayIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="取消">
                  <IconButton size="small" color="error" onClick={() => handleAction('cancel', record)}>
                    <CancelIcon />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        );
      },
    },
  ];

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Typography variant="h5" sx={{ mb: 2 }}>爬虫任务管理</Typography>
      <DataGridTable
        columns={columns}
        fetchData={async (params) => {
          const res = await listBatch({ page: params.pageNumber, pageSize: params.pageSize });
          return {
            data: { records: res.list || [], totalRow: res.total || 0 },
            success: true,
          };
        }}
        toolBarRender={() => (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
            新建任务
          </Button>
        )}
      />

      <Dialog open={writeVisible} onClose={() => setWriteVisible(false)} maxWidth="md" fullWidth>
        <DialogTitle>新建爬虫任务</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="任务名称"
              value={formValues.name}
              onChange={handleFormChange('name')}
              fullWidth
              required
              placeholder="例如：我的爬虫任务"
            />
            <TextField
              label="域名"
              value={formValues.domain}
              onChange={handleFormChange('domain')}
              fullWidth
              required
              placeholder="例如：example.com"
            />
            <TextField
              label="起始URL"
              value={formValues.url}
              onChange={handleFormChange('url')}
              fullWidth
              required
              placeholder="例如：http://example.com"
            />
            <TextField
              label="爬虫类型"
              value={formValues.type}
              onChange={handleFormChange('type')}
              fullWidth
              placeholder="例如：html"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWriteVisible(false)}>取消</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={isSubmitting}>
            创建
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}