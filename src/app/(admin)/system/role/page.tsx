'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
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
import { page, remove, save, update } from '@/apis/system-role';
import type { GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SettingsIcon from '@mui/icons-material/Settings';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useAuthority } from '@/contexts/AuthContext';
import { PERMISSIONS } from '@/lib/permissions';

const LIST_KEY = ['system', 'role'];

// 与后端 service.roleCodeRe 一致
const ROLE_CODE_RE = /^[A-Z][A-Z0-9_]{1,49}$/;

export default function SystemRolePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [writeVisible, setWriteVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const { can, isSuperAdmin } = useAuthority();
  const [formValues, setFormValues] = useState<any>({});
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
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

  const isSubmitting = saveMutation.isPending || updateMutation.isPending;

  // 内置角色(超级管理员)只有超级管理员能改,后端同样校验。
  const canEditRole = (row: any) => can(PERMISSIONS.SYSTEM_ROLE.UPDATE) && (!row?.system || isSuperAdmin);

  const handleEdit = (record: any) => {
    setSelectedRecord(record);
    setFormValues({
      name: record?.name || '',
      code: record?.code || '',
      info: record?.info || '',
    });
    setWriteVisible(true);
  };

  const handleDelete = (record: any) => {
    if (record.system) return;
    if (!confirm(`确定删除角色「${record.name}」吗?它的成员会失去这个角色的全部权限。`)) return;
    deleteMutation.mutate([record.id]);
  };

  const codeError = formValues.code && !ROLE_CODE_RE.test(formValues.code)
    ? '大写字母开头,只含大写字母、数字、下划线,2~50 位'
    : '';

  const handleSubmit = () => {
    if (!formValues.name?.trim()) { showMessage('请填写名称', 'error'); return; }
    if (!ROLE_CODE_RE.test(formValues.code || '')) { showMessage('请填写合法的角色编码', 'error'); return; }
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
    {
      field: 'code',
      headerName: '编码',
      width: 160,
      renderCell: (params) => params.value ? <Chip size="small" label={params.value} sx={{ fontFamily: 'monospace' }} /> : '-',
    },
    {
      field: 'system',
      headerName: '内置',
      width: 90,
      renderCell: (params) => params.value ? <Chip size="small" color="warning" label="内置" /> : '否',
    },
    { field: 'userCount', headerName: '成员数', width: 90 },
    { field: 'info', headerName: '描述', width: 220 },
    { field: 'updateTime', headerName: '最后更新时间', width: 180, valueFormatter: (value) => value ? new Date(value).toLocaleString() : '-' },
    {
      field: 'actions',
      headerName: '操作',
      width: 160,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {can(PERMISSIONS.SYSTEM_ROLE.VIEW) && (
            <Tooltip title="配置权限、菜单、成员">
              <IconButton size="small" onClick={() => router.push(`/system/role/detail?id=${params.row.id}`)}><SettingsIcon /></IconButton>
            </Tooltip>
          )}
          {canEditRole(params.row) && (
            <Tooltip title="编辑">
              <IconButton size="small" onClick={() => handleEdit(params.row)}><EditIcon /></IconButton>
            </Tooltip>
          )}
          {!params.row.system && can(PERMISSIONS.SYSTEM_ROLE.DELETE) && (
            <Tooltip title="删除">
              <IconButton size="small" color="error" onClick={() => handleDelete(params.row)}><DeleteIcon /></IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <DataGridTable
        columns={columns}
        hasPermission={can}
        fetchData={async (params) => {
          const res = await page({ ...params });
          const list = res?.records || res?.list || [];
          const total = res?.totalRow || res?.total || 0;
          return { records: list, totalRow: total };
        }}
        filters={{
          fields: [
            { key: 'name', label: '名称', type: 'text' },
            { key: 'code', label: '编码', type: 'text' },
          ],
          values: filterValues,
          onChange: setFilterValues,
          onReset: () => setFilterValues({}),
        }}
        toolBarRender={() => (
          <PermissionGuard need={PERMISSIONS.SYSTEM_ROLE.CREATE}>
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
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'background.paper',
              color: 'text.primary',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              backgroundImage: 'none',
              boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
            },
          },
        }}
      >
        <DialogTitle sx={{ color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider', fontSize: 14, fontWeight: 600, py: 1.5 }}>
          {selectedRecord?.id ? '编辑角色' : '新建角色'}
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="名称"
              required
              value={formValues.name || ''}
              onChange={(e) => handleFormChange('name', e.target.value)}
              fullWidth
              size="small"
              slotProps={{
                inputLabel: { sx: { color: 'text.secondary', fontSize: 13 } },
                htmlInput: { sx: { color: 'text.primary' } },
              }}
              sx={textFieldSx}
            />
            <TextField
              label="编码"
              required
              value={formValues.code || ''}
              onChange={(e) => handleFormChange('code', e.target.value.toUpperCase())}
              disabled={Boolean(selectedRecord?.system)}
              error={Boolean(codeError)}
              helperText={codeError || '英文编码,如 CONTENT_EDITOR。按角色的后台守卫认的是编码(ADMIN、OPERATOR、AUDITOR 等)'}
              fullWidth
              size="small"
              slotProps={{
                inputLabel: { sx: { color: 'text.secondary', fontSize: 13 } },
                htmlInput: { sx: { color: 'text.primary', fontFamily: 'monospace' } },
              }}
              sx={textFieldSx}
            />
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
        <DialogActions sx={{ borderTop: '1px solid', borderColor: 'divider', px: 2.5, py: 1.5, gap: 1 }}>
          <Button
            onClick={() => setWriteVisible(false)}
            sx={{
              color: 'text.secondary',
              textTransform: 'none',
              fontSize: 12.5,
              px: 2,
              '&:hover': { color: 'text.tertiary', bgcolor: 'action.hover' },
            }}
          >取消</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSubmitting || (selectedRecord?.id ? !canEditRole(selectedRecord) : !can(PERMISSIONS.SYSTEM_ROLE.CREATE))}
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
    bgcolor: 'background.default',
    borderRadius: 1.5,
    '& fieldset': { borderColor: 'divider' },
    '&:hover fieldset': { borderColor: 'text.disabled' },
    '&.Mui-focused': { bgcolor: 'rgba(254, 44, 85, 0.05)' },
    '&.Mui-focused fieldset': { borderColor: 'primary.main' },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: 'primary.main' },
};
