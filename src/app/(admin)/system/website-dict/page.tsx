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
import { page, remove, save, update } from '@/apis/system-website-dict';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import type { GridColDef } from '@mui/x-data-grid';

const LIST_KEY = ['system', 'website-dict'];

interface WebsiteDictRecord {
  id?: number;
  sitename?: string;
  dictTypeName?: string;
  dictDataValue?: string;
  updateTime?: string;
}

export default function SystemWebsiteDictPage() {
  const qc = useQueryClient();
  const [writeVisible, setWriteVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<WebsiteDictRecord | null>(null);
  const [formValues, setFormValues] = useState<WebsiteDictRecord>({});
  const [filterValues, setFilterValues] = useState<Record<string, string | number | undefined>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });

  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => remove(ids),
    onSuccess: () => { showMessage('删除成功'); invalidate(); },
    onError: (err: unknown) => showMessage(err instanceof Error ? err.message : '删除失败', 'error'),
  });

  const saveMutation = useMutation({
    mutationFn: (vals: WebsiteDictRecord) => save(vals),
    onSuccess: () => { showMessage('创建成功'); setWriteVisible(false); invalidate(); },
    onError: (err: unknown) => showMessage(err instanceof Error ? err.message : '创建失败', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (vals: WebsiteDictRecord) => update(vals),
    onSuccess: () => { showMessage('更新成功'); setWriteVisible(false); invalidate(); },
    onError: (err: unknown) => showMessage(err instanceof Error ? err.message : '更新失败', 'error'),
  });

  const handleEdit = (record: WebsiteDictRecord) => {
    setSelectedRecord(record);
    setFormValues({
      sitename: record?.sitename || '',
      dictTypeName: record?.dictTypeName || '',
      dictDataValue: record?.dictDataValue || '',
    });
    setWriteVisible(true);
  };

  const handleDelete = (record: WebsiteDictRecord) => {
    if (!confirm('确定删除吗？')) return;
    if (record.id) deleteMutation.mutate([record.id]);
  };

  const handleSubmit = () => {
    if (selectedRecord?.id) {
      updateMutation.mutate({ ...formValues, id: selectedRecord.id });
    } else {
      saveMutation.mutate(formValues);
    }
  };

  const handleFormChange = (field: keyof WebsiteDictRecord, value: string) => {
    setFormValues((prev: WebsiteDictRecord) => ({ ...prev, [field]: value }));
  };

  const isSubmitting = saveMutation.isPending || updateMutation.isPending;

  const columns: GridColDef[] = [
    { field: 'sitename', headerName: '网站名称', width: 150 },
    { field: 'dictTypeName', headerName: '字典类型', width: 150 },
    { field: 'dictDataValue', headerName: '字典项', width: 150 },
    { field: 'updateTime', headerName: '最后更新时间', width: 180, valueFormatter: (value) => value ? new Date(value).toLocaleString() : '-' },
    {
      field: 'actions',
      headerName: '操作',
      width: 100,
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
      <Typography variant="h5" sx={{ mb: 2 }}>网站字典</Typography>
      <DataGridTable
        columns={columns}
        fetchData={async (params) => {
          const res = await page({ ...params, pageNumber: params.pageNumber });
          const list = res.data?.records || res.data?.list || [];
          const total = res.data?.totalRow || res.data?.total || 0;
          return { data: { records: list, totalRow: total }, success: true };
        }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        filters={{
          fields: [
            { key: 'name', label: '名称', type: 'text' },
            { key: 'type', label: '类型', type: 'text' },
          ],
          values: filterValues,
          onChange: setFilterValues,
          onReset: () => setFilterValues({}),
        }}
        toolBarRender={() => (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleEdit({})}>新建</Button>
        )}
      />

      <Dialog open={writeVisible} onClose={() => setWriteVisible(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedRecord?.id ? '编辑网站字典' : '新建网站字典'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="网站名称"
              value={formValues.sitename || ''}
              onChange={(e) => handleFormChange('sitename', e.target.value)}
              fullWidth
            />
            <TextField
              label="字典类型"
              value={formValues.dictTypeName || ''}
              onChange={(e) => handleFormChange('dictTypeName', e.target.value)}
              fullWidth
            />
            <TextField
              label="字典项"
              value={formValues.dictDataValue || ''}
              onChange={(e) => handleFormChange('dictDataValue', e.target.value)}
              fullWidth
            />
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
