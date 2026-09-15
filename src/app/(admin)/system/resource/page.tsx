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
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { page, remove, save, update, type ResourceRecord } from '@/apis/system-resource';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import type { GridColDef } from '@mui/x-data-grid';

const LIST_KEY = ['system', 'resource'];
const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

interface FormValues {
  name: string;
  url: string;
  method: string;
  serviceId: string;
  pid: string;
}

const EMPTY: FormValues = { name: '', url: '', method: 'GET', serviceId: '', pid: '' };

/** 接口资源:字段与 resource 表一致(name / url / method / serviceId / pid)。 */
export default function SystemResourcePage() {
  const qc = useQueryClient();
  const [writeVisible, setWriteVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ResourceRecord | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(EMPTY);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });
  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => remove(ids),
    onSuccess: () => { showMessage('删除成功'); invalidate(); },
    onError: (err: any) => showMessage(err?.message || '删除失败', 'error'),
  });

  const saveMutation = useMutation({
    mutationFn: (vals: ResourceRecord) => save(vals),
    onSuccess: () => { showMessage('创建成功'); setWriteVisible(false); invalidate(); },
    onError: (err: any) => showMessage(err?.message || '创建失败', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (vals: ResourceRecord) => update(vals),
    onSuccess: () => { showMessage('更新成功'); setWriteVisible(false); invalidate(); },
    onError: (err: any) => showMessage(err?.message || '更新失败', 'error'),
  });

  const isSubmitting = saveMutation.isPending || updateMutation.isPending;

  const handleEdit = (record: ResourceRecord) => {
    setSelectedRecord(record);
    setFormValues({
      name: record?.name || '',
      url: record?.url || '',
      method: record?.method || 'GET',
      serviceId: record?.serviceId ? String(record.serviceId) : '',
      pid: record?.pid ? String(record.pid) : '',
    });
    setWriteVisible(true);
  };

  const handleDelete = (record: ResourceRecord) => {
    if (!record.id || !confirm('确定删除吗？')) return;
    deleteMutation.mutate([record.id]);
  };

  const handleSubmit = () => {
    if (!formValues.name.trim() || !formValues.url.trim()) return showMessage('名称和 URL 必填', 'error');
    const body: ResourceRecord = {
      name: formValues.name.trim(),
      url: formValues.url.trim(),
      method: formValues.method,
      serviceId: Number(formValues.serviceId) || 0,
      pid: Number(formValues.pid) || 0,
    };
    if (selectedRecord?.id) {
      updateMutation.mutate({ ...body, id: selectedRecord.id });
    } else {
      saveMutation.mutate(body);
    }
  };

  const handleFormChange = (field: keyof FormValues, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'name', headerName: '名称', width: 160 },
    { field: 'method', headerName: '方法', width: 90 },
    { field: 'url', headerName: 'URL', flex: 1, minWidth: 240 },
    { field: 'serviceId', headerName: '服务ID', width: 100 },
    { field: 'pid', headerName: '父级ID', width: 100 },
    { field: 'updateTime', headerName: '最后更新时间', width: 180, valueFormatter: (value) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-') },
    {
      field: 'actions',
      headerName: '操作',
      width: 110,
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
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Typography variant="h5" sx={{ mb: 2 }}>资源管理</Typography>
      <DataGridTable
        columns={columns}
        fetchData={async (params) => {
          const res: any = await page({ ...params });
          const list = res?.data?.records || res?.data?.list || [];
          const total = res?.data?.totalRow || res?.data?.total || 0;
          return { data: { records: list, totalRow: total }, success: true };
        }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        filters={{
          fields: [
            { key: 'serviceId', label: '服务ID', type: 'text' },
            { key: 'pid', label: '父级ID', type: 'text' },
          ],
          values: filterValues,
          onChange: setFilterValues,
          onReset: () => setFilterValues({}),
        }}
        toolBarRender={() => (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleEdit({})}>新建</Button>
        )}
      />

      <Dialog open={writeVisible} onClose={() => !isSubmitting && setWriteVisible(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedRecord?.id ? '编辑资源' : '新建资源'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField label="名称" value={formValues.name} onChange={(e) => handleFormChange('name', e.target.value)} fullWidth required />
            <TextField label="URL" value={formValues.url} onChange={(e) => handleFormChange('url', e.target.value)} placeholder="/api/core/xxx" fullWidth required />
            <TextField select label="方法" value={formValues.method} onChange={(e) => handleFormChange('method', e.target.value)} fullWidth>
              {METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </TextField>
            <TextField label="服务ID" value={formValues.serviceId} onChange={(e) => handleFormChange('serviceId', e.target.value)} fullWidth />
            <TextField label="父级ID" value={formValues.pid} onChange={(e) => handleFormChange('pid', e.target.value)} fullWidth />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWriteVisible(false)} disabled={isSubmitting}>取消</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={isSubmitting}>提交</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
