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
import { formatApiError } from '@/lib/api/client';
import { page, remove, save, update } from '@/apis/system-user-level';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import type { GridColDef } from '@mui/x-data-grid';

const LIST_KEY = ['system', 'user-level'];

/** user_level 一行 = 授予某个用户的一个等级;start/end 是有效期(Unix 秒,0 = 不限)。 */
interface UserLevelRow {
  id?: number;
  userId?: number;
  name?: string;
  type?: string;
  level?: number;
  start?: number;
  end?: number;
  updateTime?: string;
}

interface FormValues {
  userId: string;
  name: string;
  type: string;
  level: string;
  start: string; // datetime-local
  end: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (sec?: number) => {
  if (!sec) return '';
  const d = new Date(sec * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? Math.floor(new Date(v).getTime() / 1000) : 0);
const formatSec = (sec?: number) => (sec ? new Date(sec * 1000).toLocaleString('zh-CN', { hour12: false }) : '不限');

const EMPTY: FormValues = { userId: '', name: '', type: '', level: '', start: '', end: '' };

export default function SystemUserLevelPage() {
  const qc = useQueryClient();
  const [writeVisible, setWriteVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<UserLevelRow | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(EMPTY);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });
  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => remove(ids),
    onSuccess: () => { showMessage('删除成功'); invalidate(); },
    onError: (err: any) => showMessage(formatApiError(err), 'error'),
  });

  const saveMutation = useMutation({
    mutationFn: (vals: Record<string, unknown>) => save(vals),
    onSuccess: () => { showMessage('创建成功'); setWriteVisible(false); invalidate(); },
    onError: (err: any) => showMessage(formatApiError(err), 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (vals: Record<string, unknown>) => update(vals),
    onSuccess: () => { showMessage('更新成功'); setWriteVisible(false); invalidate(); },
    onError: (err: any) => showMessage(formatApiError(err), 'error'),
  });

  const isSubmitting = saveMutation.isPending || updateMutation.isPending;

  const handleEdit = (record: UserLevelRow) => {
    setSelectedRecord(record);
    setFormValues({
      userId: record?.userId ? String(record.userId) : '',
      name: record?.name || '',
      type: record?.type || '',
      level: record?.level ? String(record.level) : '',
      start: toLocalInput(record?.start),
      end: toLocalInput(record?.end),
    });
    setWriteVisible(true);
  };

  const handleDelete = (record: UserLevelRow) => {
    if (!record.id || !confirm('确定收回该用户的这个等级吗？')) return;
    deleteMutation.mutate([record.id]);
  };

  const handleSubmit = () => {
    const userId = Number(formValues.userId);
    const level = Number(formValues.level);
    if (!Number.isInteger(userId) || userId <= 0) return showMessage('请填写正确的用户 ID', 'error');
    if (!Number.isInteger(level) || level <= 0) return showMessage('等级需为正整数', 'error');
    const body = {
      userId,
      level,
      name: formValues.name.trim(),
      type: formValues.type.trim(),
      start: fromLocalInput(formValues.start),
      end: fromLocalInput(formValues.end),
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
    { field: 'userId', headerName: '用户ID', width: 110 },
    { field: 'name', headerName: '等级名称', width: 150 },
    { field: 'level', headerName: '等级', width: 80 },
    { field: 'type', headerName: '类型', width: 110 },
    { field: 'start', headerName: '生效时间', width: 170, valueFormatter: (value) => formatSec(value as number) },
    { field: 'end', headerName: '到期时间', width: 170, valueFormatter: (value) => formatSec(value as number) },
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
          <Tooltip title="收回">
            <IconButton size="small" color="error" onClick={() => handleDelete(params.row)}><DeleteIcon /></IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Typography variant="h5" sx={{ mb: 2 }}>用户等级</Typography>
      <DataGridTable
        columns={columns}
        fetchData={(params) => page(params)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        filters={{
          fields: [
            { key: 'userId', label: '用户ID', type: 'text' },
            { key: 'name', label: '等级名称', type: 'text' },
          ],
          values: filterValues,
          onChange: setFilterValues,
          onReset: () => setFilterValues({}),
        }}
        toolBarRender={() => (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleEdit({})}>授予等级</Button>
        )}
      />

      <Dialog open={writeVisible} onClose={() => !isSubmitting && setWriteVisible(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedRecord?.id ? '编辑用户等级' : '授予用户等级'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField label="用户ID" value={formValues.userId} onChange={(e) => handleFormChange('userId', e.target.value)} fullWidth required />
            <TextField label="等级" type="number" value={formValues.level} onChange={(e) => handleFormChange('level', e.target.value)} fullWidth required />
            <TextField label="等级名称" value={formValues.name} onChange={(e) => handleFormChange('name', e.target.value)} placeholder="如 VIP1、黄金会员" fullWidth />
            <TextField label="类型" value={formValues.type} onChange={(e) => handleFormChange('type', e.target.value)} placeholder="如 vip" fullWidth />
            <TextField
              label="生效时间"
              type="datetime-local"
              value={formValues.start}
              onChange={(e) => handleFormChange('start', e.target.value)}
              helperText="留空表示立即生效"
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              label="到期时间"
              type="datetime-local"
              value={formValues.end}
              onChange={(e) => handleFormChange('end', e.target.value)}
              helperText="留空表示长期有效"
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
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
