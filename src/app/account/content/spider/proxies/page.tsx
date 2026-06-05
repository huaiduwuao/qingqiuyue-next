'use client';

import React, { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Paper from '@mui/material/Paper';
import LinearProgress from '@mui/material/LinearProgress';
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
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { listProxies, addProxy, deleteProxy, toggleProxy, getProxyStats } from '@/apis/spider';
import type { GridColDef } from '@mui/x-data-grid';
import type { Proxy } from '@/beans/spider';

const LIST_KEY = ['spider', 'proxies'];

const TYPE_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
  http: 'info',
  https: 'success',
  socks5: 'warning',
};

export default function SpiderProxiesPage() {
  const qc = useQueryClient();
  const [writeVisible, setWriteVisible] = useState(false);
  const [form, setForm] = useState({ url: '', type: 'http' as 'http' | 'https' | 'socks5' });
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [stats, setStats] = useState<{ total: number; active: number; successRate: number; failCount: number } | null>(null);

  const showMsg = useCallback((m: string, s: 'success' | 'error' = 'success') => setSnack({ open: true, message: m, severity: s }), []);
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: LIST_KEY }), [qc]);

  const addMutation = useMutation({
    mutationFn: (vals: typeof form) => addProxy(vals),
    onSuccess: () => { showMsg('已新增'); setWriteVisible(false); setForm({ url: '', type: 'http' }); refresh(); },
    onError: (err: any) => showMsg(err.message || '新增失败', 'error'),
  });

  const toggleMutation = useMutation({
    mutationFn: (p: Proxy) => toggleProxy(p.id, !p.active),
    onSuccess: () => { refresh(); },
    onError: (err: any) => showMsg(err.message || '切换失败', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProxy(id),
    onSuccess: () => { showMsg('已删除'); refresh(); },
    onError: (err: any) => showMsg(err.message || '删除失败', 'error'),
  });

  const handleAdd = () => {
    if (!form.url) return showMsg('URL 必填', 'error');
    addMutation.mutate(form);
  };

  const handleToggle = (p: Proxy) => {
    toggleMutation.mutate(p);
  };

  const handleDelete = (p: Proxy) => {
    if (!confirm(`确定要删除代理 ${p.url}?`)) return;
    deleteMutation.mutate(p.id);
  };

  const isSubmitting = addMutation.isPending;

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 100 },
    { field: 'url', headerName: '代理 URL', width: 280, renderCell: (p) => <Typography sx={{ fontFamily: 'monospace', fontSize: 11 }}>{p.value}</Typography> },
    {
      field: 'type',
      headerName: '类型',
      width: 100,
      renderCell: (p) => <Chip label={p.value.toUpperCase()} color={TYPE_COLORS[p.value] || 'default'} size="small" />,
    },
    {
      field: 'active',
      headerName: '启用',
      width: 80,
      renderCell: (p) => <Switch size="small" checked={!!p.value} onChange={() => handleToggle(p.row as Proxy)} />,
    },
    { field: 'successCount', headerName: '成功', width: 90, type: 'number' },
    { field: 'failCount', headerName: '失败', width: 90, type: 'number' },
    {
      field: 'successRate',
      headerName: '成功率',
      width: 180,
      valueGetter: (v, r) => {
        const total = (r.successCount || 0) + (r.failCount || 0);
        return total > 0 ? ((r.successCount / total) * 100).toFixed(1) + '%' : '—';
      },
      renderCell: (p) => {
        const total = (p.row.successCount || 0) + (p.row.failCount || 0);
        const rate = total > 0 ? (p.row.successCount / total) * 100 : 0;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
            <LinearProgress variant="determinate" value={rate} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
            <Typography sx={{ fontSize: 11, minWidth: 38 }}>{p.value}</Typography>
          </Box>
        );
      },
    },
    {
      field: 'actions',
      headerName: '操作',
      width: 100,
      sortable: false,
      renderCell: (p) => (
        <Tooltip title="删除">
          <IconButton size="small" color="error" onClick={() => handleDelete(p.row as Proxy)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">代理池</Typography>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setWriteVisible(true)}>
          新增代理
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        {[
          { l: '代理总数', v: stats?.total ?? 0, c: 'primary' },
          { l: '活跃', v: stats?.active ?? 0, c: 'success' },
          { l: '整体成功率', v: stats ? `${(stats.successRate * 100).toFixed(1)}%` : '—', c: 'info' },
          { l: '总失败次数', v: stats?.failCount ?? 0, c: 'error' },
        ].map((c) => (
          <Box key={c.l} sx={{ width: { xs: 'calc(50% - 8px)', sm: 'calc(25% - 12px)' } }}>
            <Card><CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h5" color={`${c.c}.main`}>{c.v}</Typography>
              <Typography variant="body2" color="text.secondary">{c.l}</Typography>
            </CardContent></Card>
          </Box>
        ))}
      </Box>

      <Paper sx={{ p: { xs: 1.5, md: 2 } }}>
        <DataGridTable
          columns={columns}
          fetchData={async () => {
            try {
              const res = await listProxies();
              const statsRes = await getProxyStats();
              setStats(statsRes.data);
              return {
                data: { records: res.data?.list || [], totalRow: res.data?.total || 0 },
                success: true,
              };
            } catch (err: any) {
              showMsg(err.message || '获取失败', 'error');
              return { data: { records: [], totalRow: 0 }, success: false };
            }
          }}
        />
      </Paper>

      <Dialog open={writeVisible} onClose={() => setWriteVisible(false)} maxWidth="sm" fullWidth>
        <DialogTitle>新增代理</DialogTitle>
        <DialogContent>
          <TextField label="代理 URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} fullWidth size="small" sx={{ mt: 1, mb: 1.5 }} placeholder="http://127.0.0.1:8888" />
          <TextField select label="类型" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} fullWidth size="small">
            <MenuItem value="http">HTTP</MenuItem>
            <MenuItem value="https">HTTPS</MenuItem>
            <MenuItem value="socks5">SOCKS5</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWriteVisible(false)}>取消</Button>
          <Button variant="contained" onClick={handleAdd} disabled={isSubmitting}>新增</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={2500} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity} variant="filled">{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
