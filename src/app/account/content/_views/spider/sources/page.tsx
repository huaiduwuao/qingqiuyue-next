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
import { DataGridTable } from '@/components/tables/DataGridTable';
import {
  listSources,
  createSource,
  updateSource,
  deleteSource,
} from '@/apis/spider';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import type { GridColDef } from '@mui/x-data-grid';

const LIST_KEY = ['spider', 'sources'];

const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  active: 'success',
  inactive: 'default',
  paused: 'warning',
};

const STATUS_LABELS: Record<string, string> = {
  active: '启用',
  inactive: '停用',
  paused: '暂停',
};

interface SourceFormData {
  name: string;
  domain: string;
  url: string;
  type: string;
}

export default function SourcesPage() {
  const qc = useQueryClient();
  const [writeVisible, setWriteVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [formValues, setFormValues] = useState<SourceFormData>({ name: '', domain: '', url: '', type: 'html' });
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showMessage = useCallback((message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: LIST_KEY }), [qc]);

  const saveMutation = useMutation({
    mutationFn: (vals: SourceFormData) => createSource(vals),
    onSuccess: () => { showMessage('创建成功'); setWriteVisible(false); invalidate(); },
    onError: (err: any) => showMessage(err.message || '创建失败', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: number; vals: SourceFormData }) => updateSource(vars.id, vars.vals),
    onSuccess: () => { showMessage('更新成功'); setWriteVisible(false); invalidate(); },
    onError: (err: any) => showMessage(err.message || '更新失败', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSource(id),
    onSuccess: () => { showMessage('删除成功'); invalidate(); },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });

  const handleCreate = () => {
    setSelectedRecord(null);
    setFormValues({ name: '', domain: '', url: '', type: 'html' });
    setWriteVisible(true);
  };

  const handleEdit = (record: any) => {
    setSelectedRecord(record);
    setFormValues({
      name: record.name,
      domain: record.domain,
      url: record.url,
      type: record.type,
    });
    setWriteVisible(true);
  };

  const handleFormChange = (field: keyof SourceFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = () => {
    if (selectedRecord) {
      updateMutation.mutate({ id: selectedRecord.id, vals: formValues });
    } else {
      saveMutation.mutate(formValues);
    }
  };

  const handleDelete = (record: any) => {
    if (!confirm(`确定要删除源 "${record.name}" 吗？`)) return;
    deleteMutation.mutate(record.id);
  };

  const isSubmitting = saveMutation.isPending || updateMutation.isPending;

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'name', headerName: '名称', width: 120 },
    { field: 'domain', headerName: '域名', width: 150 },
    { field: 'url', headerName: 'URL', width: 250 },
    { field: 'type', headerName: '类型', width: 100 },
    {
      field: 'status',
      headerName: '状态',
      width: 100,
      renderCell: (params) => (
        <Chip
          label={STATUS_LABELS[params.value] || params.value}
          color={STATUS_COLORS[params.value] || 'default'}
          size="small"
        />
      ),
    },
    { field: 'itemCount', headerName: '条目数', width: 100 },
    { field: 'createTime', headerName: '创建时间', width: 180, valueFormatter: (value) => value ? new Date(value).toLocaleString() : '-' },
    {
      field: 'actions',
      headerName: '操作',
      width: 160,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => {
        const record = params.row;
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="编辑">
              <IconButton size="small" color="primary" onClick={() => handleEdit(record)}>
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="删除">
              <IconButton size="small" color="error" onClick={() => handleDelete(record)}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>
        );
      },
    },
  ];

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Typography variant="h6" sx={{ mb: 2 }}>源管理</Typography>
      <DataGridTable
        columns={columns}
        fetchData={async (params) => {
          return listSources({
            page: params.page + 1,
            pageSize: params.pageSize,
          }).then((r) => {
            return {
              data: { records: r.list || [], totalRow: r.total || 0 },
              success: true,
            };
          });
        }}
        toolBarRender={() => (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
            新建源
          </Button>
        )}
      />

      <Dialog open={writeVisible} onClose={() => setWriteVisible(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedRecord ? '编辑源' : '新建源'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="名称"
              value={formValues.name}
              onChange={handleFormChange('name')}
              fullWidth
              required
            />
            <TextField
              label="域名"
              value={formValues.domain}
              onChange={handleFormChange('domain')}
              fullWidth
              required
            />
            <TextField
              label="URL"
              value={formValues.url}
              onChange={handleFormChange('url')}
              fullWidth
              required
            />
            <TextField
              label="类型"
              value={formValues.type}
              onChange={handleFormChange('type')}
              fullWidth
              placeholder="例如：novel, video, news"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWriteVisible(false)}>取消</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={isSubmitting}>
            {selectedRecord ? '更新' : '创建'}
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