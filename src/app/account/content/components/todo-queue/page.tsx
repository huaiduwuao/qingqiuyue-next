'use client';

import React, { useState } from 'react';
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
import { DataGridTable } from '@/components/tables/DataGridTable';
import { page, remove, save, update } from '@/apis/content-todo-queue';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import type { GridColDef } from '@mui/x-data-grid';

const LIST_KEY = ['content', 'todo-queue'];

export default function TodoQueueContentPage() {
  const qc = useQueryClient();
  const [writeVisible, setWriteVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [formValues, setFormValues] = useState({ title: '', author: '', order: '', urgent: '' });
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });

  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => remove(ids),
    onSuccess: () => { showMessage('删除成功'); invalidate(); },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });

  const saveMutation = useMutation({
    mutationFn: (vals: any) => save(vals),
    onSuccess: () => { showMessage('创建成功'); setWriteVisible(false); invalidate(); },
    onError: (err: any) => showMessage(err.message || '创建失败', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (vals: any) => update(vals),
    onSuccess: () => { showMessage('更新成功'); setWriteVisible(false); invalidate(); },
    onError: (err: any) => showMessage(err.message || '更新失败', 'error'),
  });

  const handleEdit = (record: any) => {
    setSelectedRecord(record);
    setFormValues({ title: record?.title || '', author: record?.author || '', order: record?.order || '', urgent: record?.urgent || '' });
    setWriteVisible(true);
  };

  const handleFormChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = () => {
    if (selectedRecord?.id) {
      updateMutation.mutate({ ...selectedRecord, ...formValues });
    } else {
      saveMutation.mutate(formValues);
    }
  };

  const handleDelete = (record: any) => {
    if (!confirm('确定删除吗？')) return;
    deleteMutation.mutate([record.id]);
  };

  const isSubmitting = saveMutation.isPending || updateMutation.isPending;

  const columns: GridColDef[] = [
    { field: 'title', headerName: '标题', width: 200 },
    { field: 'author', headerName: '作者', width: 150 },
    { field: 'order', headerName: '排序', width: 100 },
    { field: 'urgent', headerName: '紧急排序', width: 100 },
    { field: 'updateTime', headerName: '更新时间', width: 180, valueFormatter: (value) => value ? new Date(value).toLocaleString() : '-' },
    {
      field: 'actions',
      headerName: '操作',
      width: 150,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="编辑">
            <IconButton size="small" onClick={() => handleEdit(params.row)}><EditIcon /></IconButton>
          </Tooltip>
          <Tooltip title="删除">
            <IconButton size="small" color="error" onClick={() => handleDelete(params.row)}><DeleteIcon /></IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ height: "100%", overflow: "hidden" }}>
      <Typography variant="h5" sx={{ mb: 2 }}>待办队列</Typography>
      <DataGridTable
        columns={columns}
        fetchData={async (params) => {
          const res = await page({ ...params, pageNumber: params.pageNumber });
          return { data: { records: res.data?.records || [], totalRow: res.data?.totalRow || 0 }, success: res.data?.success ?? true };
        }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        toolBarRender={() => (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleEdit({})}>新建</Button>
        )}
      />

      <Dialog open={writeVisible} onClose={() => setWriteVisible(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedRecord?.id ? '编辑' : '新建'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField label="标题" value={formValues.title} onChange={handleFormChange('title')} fullWidth />
            <TextField label="作者" value={formValues.author} onChange={handleFormChange('author')} fullWidth />
            <TextField label="排序" value={formValues.order} onChange={handleFormChange('order')} fullWidth type="number" />
            <TextField label="紧急排序" value={formValues.urgent} onChange={handleFormChange('urgent')} fullWidth type="number" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWriteVisible(false)}>取消</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={isSubmitting}>提交</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
