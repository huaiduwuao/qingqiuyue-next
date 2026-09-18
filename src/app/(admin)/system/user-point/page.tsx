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
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { adjustUserPoint, listPointRecords } from '@/apis/system-user-point';
import type { GridColDef } from '@mui/x-data-grid';

const LIST_KEY = ['system', 'user-point'];

/**
 * 用户积分管理:积分流水只读(账本不允许改删),余额变动只能通过「调整积分」,
 * 每次调整都会记一条 admin_adjust 流水。
 */
export default function SystemUserPointPage() {
  const qc = useQueryClient();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [form, setForm] = useState({ userId: '', point: '', info: '' });
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });

  const adjustMutation = useMutation({
    mutationFn: () =>
      adjustUserPoint({ userId: Number(form.userId), point: Number(form.point), info: form.info.trim() || undefined }),
    onSuccess: (res: any) => {
      showMessage(`已调整,当前余额 ${res?.data?.point ?? '-'}`);
      setAdjustOpen(false);
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (err: any) => showMessage(err?.message || '调整失败', 'error'),
  });

  const submitAdjust = () => {
    const userId = Number(form.userId);
    const point = Number(form.point);
    if (!Number.isInteger(userId) || userId <= 0) return showMessage('请填写正确的用户 ID', 'error');
    if (!Number.isInteger(point) || point === 0) return showMessage('调整数量需为非零整数,负数表示扣减', 'error');
    adjustMutation.mutate();
  };

  const columns: GridColDef[] = [
    { field: 'id', headerName: '流水ID', width: 90 },
    { field: 'userId', headerName: '用户ID', width: 100 },
    {
      field: 'point',
      headerName: '积分变动',
      width: 110,
      renderCell: (p) => (
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: p.value < 0 ? 'error.main' : 'success.main' }}>
          {p.value > 0 ? `+${p.value}` : p.value}
        </Typography>
      ),
    },
    { field: 'type', headerName: '类型', width: 130 },
    { field: 'info', headerName: '说明', flex: 1, minWidth: 200 },
    { field: 'sourceType', headerName: '来源', width: 120 },
    {
      field: 'createTime',
      headerName: '时间',
      width: 180,
      valueFormatter: (value) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'),
    },
  ];

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Typography variant="h5" sx={{ mb: 2 }}>用户积分</Typography>
      <DataGridTable
        columns={columns}
        fetchData={async (params: any) => {
          const userId = Number(filterValues.userId) || undefined;
          const res: any = await listPointRecords({ ...params, pageNumber: params.pageNumber, userId });
          const list = res?.data?.records || res?.data?.list || [];
          const total = res?.data?.totalRow || res?.data?.total || 0;
          return { records: list, totalRow: total };
        }}
        filters={{
          fields: [{ key: 'userId', label: '用户ID', type: 'text' }],
          values: filterValues,
          onChange: setFilterValues,
          onReset: () => setFilterValues({}),
        }}
        toolBarRender={() => (
          <Button
            variant="contained"
            startIcon={<TuneRoundedIcon />}
            onClick={() => {
              setForm({ userId: filterValues.userId ?? '', point: '', info: '' });
              setAdjustOpen(true);
            }}
          >
            调整积分
          </Button>
        )}
      />

      <Dialog open={adjustOpen} onClose={() => !adjustMutation.isPending && setAdjustOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>调整用户积分</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="用户ID" value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))} fullWidth />
            <TextField
              label="调整数量"
              type="number"
              value={form.point}
              onChange={(e) => setForm((f) => ({ ...f, point: e.target.value }))}
              helperText="正数发放,负数扣减;不能扣到负数"
              fullWidth
            />
            <TextField
              label="说明"
              value={form.info}
              onChange={(e) => setForm((f) => ({ ...f, info: e.target.value }))}
              placeholder="用户会在积分明细里看到这条说明"
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustOpen(false)} disabled={adjustMutation.isPending}>取消</Button>
          <Button variant="contained" onClick={submitAdjust} disabled={adjustMutation.isPending}>确认调整</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
