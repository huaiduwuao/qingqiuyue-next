'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
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
import { page, remove, save, update } from '@/apis/system-data-permission';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import type { GridColDef } from '@mui/x-data-grid';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useAuthority } from '@/contexts/AuthContext';
import { PERMISSIONS } from '@/lib/permissions';

const LIST_KEY = ['system', 'data-permission'];

export default function SystemDataPermissionPage() {
  const qc = useQueryClient();
  const [writeVisible, setWriteVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const { can } = useAuthority();
  const [formValues, setFormValues] = useState<any>({});
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => remove(ids),
    onSuccess: () => { showMessage('删除成功'); qc.invalidateQueries({ queryKey: LIST_KEY }); },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });

  const saveMutation = useMutation({
    mutationFn: (vals: any) => save(vals),
    onSuccess: () => { showMessage('创建成功'); setWriteVisible(false); qc.invalidateQueries({ queryKey: LIST_KEY }); },
    onError: (err: any) => showMessage(err.message || '创建失败', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (vals: any) => update(vals),
    onSuccess: () => { showMessage('更新成功'); setWriteVisible(false); qc.invalidateQueries({ queryKey: LIST_KEY }); },
    onError: (err: any) => showMessage(err.message || '更新失败', 'error'),
  });

  const isSubmitting = saveMutation.isPending || updateMutation.isPending;

  const handleEdit = (record: any) => {
    setSelectedRecord(record);
    setFormValues({
      name: record?.name || '',
      type: record?.type || '',
      info: record?.info || '',
    });
    setWriteVisible(true);
  };

  const handleDelete = (record: any) => {
    if (!confirm('确定删除吗？')) return;
    deleteMutation.mutate([record.id]);
  };

  const handleSubmit = () => {
    if (selectedRecord?.id) {
      updateMutation.mutate({ ...formValues, id: selectedRecord.id });
    } else {
      saveMutation.mutate(formValues);
    }
  };

  const handleFormChange = (field: string, value: any) => {
    setFormValues((prev: any) => ({ ...prev, [field]: value }));
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: '名称', width: 150 },
    { field: 'type', headerName: '类型', width: 120 },
    { field: 'info', headerName: '描述', width: 200 },
    { field: 'updateTime', headerName: '最后更新时间', width: 180, valueFormatter: (value) => value ? new Date(value).toLocaleString() : '-' },
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <DataGridTable
        columns={columns}
        actionPermissions={{ edit: PERMISSIONS.SYSTEM_DATA_PERMISSION.UPDATE, delete: PERMISSIONS.SYSTEM_DATA_PERMISSION.DELETE }}
        hasPermission={can}
        fetchData={async (params) => {
          const res = await page({ ...params, pageNumber: params.pageNumber });
          return { data: { records: res.data?.records || [], totalRow: res.data?.totalRow || 0 }, success: res.data?.success ?? true };
        }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        filters={{
          fields: [
            { key: 'name', label: '名称', type: 'text' },
            { key: 'code', label: '代码', type: 'text' },
          ],
          values: filterValues,
          onChange: setFilterValues,
          onReset: () => setFilterValues({}),
        }}
        toolBarRender={() => (
          <PermissionGuard need={PERMISSIONS.SYSTEM_DATA_PERMISSION.CREATE}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleEdit({})}
              sx={{
                bgcolor: 'primary.main',
                color: '#fff',
                textTransform: 'none',
                fontWeight: 500,
                fontSize: 12.5,
                borderRadius: 1.5,
                px: 1.75,
                py: 0.5,
                boxShadow: '0 2px 8px rgba(254, 44, 85, 0.3)',
                '&:hover': { bgcolor: '#E0274B', boxShadow: '0 4px 12px rgba(254, 44, 85, 0.4)' },
              }}
            >新建</Button>
          </PermissionGuard>
        )}
      />

      <Dialog
        open={writeVisible}
        onClose={() => setWriteVisible(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'background.paper',
              color: 'text.primary',
              border: '1px solid #252836',
              borderRadius: 2,
              backgroundImage: 'none',
              boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
            },
          },
        }}
      >
        <DialogTitle sx={{ color: 'text.primary', borderBottom: '1px solid #252836', fontSize: 14, fontWeight: 600, py: 1.5 }}>
          {selectedRecord?.id ? '编辑数据权限' : '新建数据权限'}
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {[
              { field: 'name', label: '名称' },
              { field: 'type', label: '类型' },
            ].map((f) => (
              <TextField
                key={f.field}
                label={f.label}
                value={formValues[f.field] ?? ''}
                onChange={(e) => handleFormChange(f.field, e.target.value)}
                fullWidth
                size="small"
                slotProps={{
                  inputLabel: { sx: { color: 'text.secondary', fontSize: 13 } },
                  htmlInput: { sx: { color: 'text.primary' } },
                }}
                sx={textFieldSx}
              />
            ))}
            <TextField
              label="描述"
              value={formValues.info || ''}
              onChange={(e) => handleFormChange('info', e.target.value)}
              fullWidth
              multiline
              rows={3}
              size="small"
              slotProps={{
                inputLabel: { sx: { color: 'text.secondary', fontSize: 13 } },
                htmlInput: { sx: { color: 'text.primary' } },
              }}
              sx={textFieldSx}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid #252836', px: 2.5, py: 1.5, gap: 1 }}>
          <Button
            onClick={() => setWriteVisible(false)}
            sx={{
              color: 'text.secondary',
              textTransform: 'none',
              fontSize: 12.5,
              px: 2,
              '&:hover': { color: 'text.tertiary', bgcolor: 'rgba(255,255,255,0.04)' },
            }}
          >取消</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSubmitting}
            sx={{
              bgcolor: 'primary.main',
              color: '#fff',
              textTransform: 'none',
              fontSize: 12.5,
              px: 2.5,
              borderRadius: 1.5,
              boxShadow: '0 2px 8px rgba(254, 44, 85, 0.3)',
              '&:hover': { bgcolor: '#E0274B' },
            }}
          >提交</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

const textFieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 1.5,
    '& fieldset': { borderColor: 'divider' },
    '&:hover fieldset': { borderColor: 'text.disabled' },
    '&.Mui-focused': { bgcolor: 'rgba(254, 44, 85, 0.05)' },
    '&.Mui-focused fieldset': { borderColor: 'primary.main' },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: 'primary.main' },
};
