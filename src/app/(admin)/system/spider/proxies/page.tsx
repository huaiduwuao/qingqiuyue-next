'use client';

/**
 * 代理池管理
 * 从 account/content/_views/spider/proxies/ 迁移
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { DataGridTable } from '@/components/tables/DataGridTable';
import {
  listProxies,
  addProxy,
  deleteProxy,
  toggleProxy,
  getProxyStats,
  listProxyProviders,
  addProxyProvider,
  deleteProxyProvider,
  testProxyProvider,
} from '@/apis/spider';
import type { GridColDef } from '@mui/x-data-grid';
import type { Proxy, ProxyProvider } from '@/beans/spider';

const LIST_KEY = ['spider', 'proxies'];

const TYPE_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
  http: 'info',
  https: 'success',
  socks5: 'warning',
};

export default function SpiderProxiesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'proxies' | 'providers'>('proxies');
  const [writeVisible, setWriteVisible] = useState(false);
  const [providerWriteVisible, setProviderWriteVisible] = useState(false);
  const [form, setForm] = useState({ url: '', type: 'http' as 'http' | 'https' | 'socks5' });
  const [providerForm, setProviderForm] = useState({
    name: '快代理',
    api_url: '',
    type: 'http' as 'http' | 'https' | 'socks5',
    local_host: '0.0.0.0',
    local_port: 8888,
    cache_seconds: 30,
  });
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [stats, setStats] = useState<{ total: number; active: number; successRate: number; failCount: number } | null>(null);

  const { data: providersData } = useQuery({
    queryKey: ['spider', 'providers'],
    queryFn: () => listProxyProviders(),
  });
  const providers: ProxyProvider[] = providersData?.list ?? [];

  const showMsg = (m: string, s: 'success' | 'error' = 'success') => setSnack({ open: true, message: m, severity: s });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: LIST_KEY });
    qc.invalidateQueries({ queryKey: ['spider', 'providers'] });
  };

  const addMutation = useMutation({
    mutationFn: (vals: typeof form) => addProxy(vals),
    onSuccess: () => { showMsg('已新增'); setWriteVisible(false); setForm({ url: '', type: 'http' }); refresh(); },
    onError: (err: any) => showMsg(err.message || '新增失败', 'error'),
  });

  const toggleMutation = useMutation({
    mutationFn: (p: Proxy) => toggleProxy(p.id, !p.active),
    onSuccess: () => refresh(),
    onError: (err: any) => showMsg(err.message || '切换失败', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProxy(id),
    onSuccess: () => { showMsg('已删除'); refresh(); },
    onError: (err: any) => showMsg(err.message || '删除失败', 'error'),
  });

  const addProviderMutation = useMutation({
    mutationFn: (vals: typeof providerForm) => addProxyProvider(vals),
    onSuccess: () => {
      showMsg('供应商已新增,本地需启动代理转发器');
      setProviderWriteVisible(false);
      setProviderForm({ name: '快代理', api_url: '', type: 'http', local_host: '0.0.0.0', local_port: 8888, cache_seconds: 30 });
      refresh();
    },
    onError: (err: any) => showMsg(err.message || '新增失败', 'error'),
  });

  const deleteProviderMutation = useMutation({
    mutationFn: (id: string) => deleteProxyProvider(id),
    onSuccess: () => { showMsg('供应商已删除'); refresh(); },
    onError: (err: any) => showMsg(err.message || '删除失败', 'error'),
  });

  const testProviderMutation = useMutation({
    mutationFn: (id: string) => testProxyProvider(id),
    onSuccess: (data: any) => {
      if (data.ok) showMsg(`连接成功,IP=${data.ip},延迟=${data.latency_ms}ms`, 'success');
      else showMsg(`失败:${data.error || 'empty ip'}`, 'error');
    },
    onError: (err: any) => showMsg(err.message || '测试失败', 'error'),
  });

  const handleAdd = () => {
    if (!form.url) return showMsg('URL 必填', 'error');
    addMutation.mutate(form);
  };

  const handleToggle = (p: Proxy) => toggleMutation.mutate(p);
  const handleDelete = (p: Proxy) => {
    if (!confirm(`确定要删除代理 ${p.url}?`)) return;
    deleteMutation.mutate(p.id);
  };

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 100 },
    { field: 'url', headerName: '代理 URL', width: 280, renderCell: (p) => <Typography sx={{ fontFamily: 'monospace', fontSize: 11 }}>{p.value}</Typography> },
    {
      field: 'type',
      headerName: '类型',
      width: 100,
      renderCell: (p) => <Chip label={(p.value as string).toUpperCase()} color={TYPE_COLORS[p.value as string] || 'default'} size="small" />,
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
      valueGetter: (_v, r) => {
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
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">代理池</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<RefreshIcon />}
            onClick={refresh}
          >
            刷新
          </Button>
          {tab === 'proxies' && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setWriteVisible(true)}>
              新增代理
            </Button>
          )}
          {tab === 'providers' && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setProviderWriteVisible(true)}>
              新增供应商
            </Button>
          )}
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="proxies" label="代理池" />
        <Tab value="providers" label="供应商(快代理等)" />
      </Tabs>

      {tab === 'proxies' && (
      <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        {[
          { l: '代理总数', v: stats?.total ?? 0, c: 'primary' },
          { l: '活跃', v: stats?.active ?? 0, c: 'success' },
          { l: '整体成功率', v: stats ? `${(stats.successRate * 100).toFixed(1)}%` : '—', c: 'info' },
          { l: '总失败次数', v: stats?.failCount ?? 0, c: 'error' },
        ].map((c) => (
          <Box key={c.l} sx={{ minWidth: 140 }}>
            <Card><CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h5" color={`${c.c}.main`}>{c.v}</Typography>
              <Typography variant="body2" color="text.secondary">{c.l}</Typography>
            </CardContent></Card>
          </Box>
        ))}
      </Box>

      <Paper sx={{ p: 2 }}>
        <DataGridTable
          columns={columns}
          fetchData={async () => {
            try {
              const res = await listProxies();
              const statsRes = await getProxyStats();
              setStats(statsRes);
              return {
                records: res.list || [],
                totalRow: res.total || 0,
              };
            } catch {
              return { records: [], totalRow: 0 };
            }
          }}
        />
      </Paper>
      </>
      )}

      {tab === 'providers' && (
      <Paper sx={{ p: 2 }}>
        <DataGridTable
          columns={[
            { field: 'name', headerName: '名称', width: 140 },
            {
              field: 'api_url',
              headerName: 'API 提取链接',
              width: 360,
              renderCell: (p) => (
                <Typography sx={{ fontFamily: 'monospace', fontSize: 10, wordBreak: 'break-all' }}>
                  {p.value}
                </Typography>
              ),
            },
            {
              field: 'local_host',
              headerName: '本地 host',
              width: 130,
              renderCell: (p) => <Typography sx={{ fontFamily: 'monospace', fontSize: 11 }}>{p.value}</Typography>,
            },
            {
              field: 'local_port',
              headerName: '本地端口',
              width: 100,
              type: 'number',
              renderCell: (p) => <Typography sx={{ fontFamily: 'monospace', fontSize: 11 }}>{p.value}</Typography>,
            },
            {
              field: 'cache_seconds',
              headerName: '缓存(秒)',
              width: 100,
              type: 'number',
            },
            {
              field: 'last_ip',
              headerName: '最近 IP',
              width: 180,
              renderCell: (p) => <Typography sx={{ fontFamily: 'monospace', fontSize: 10 }}>{p.value || '—'}</Typography>,
            },
            {
              field: 'enabled',
              headerName: '启用',
              width: 80,
              renderCell: (p) => <Switch size="small" checked={!!p.value} disabled />,
            },
            {
              field: 'actions',
              headerName: '操作',
              width: 240,
              sortable: false,
              renderCell: (p) => (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Tooltip title="测试(调 API 提取一个 IP,验证连通)">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => testProviderMutation.mutate((p.row as ProxyProvider).id)}
                      disabled={testProviderMutation.isPending}
                    >
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="删除">
                    <IconButton size="small" color="error" onClick={() => {
                      if (confirm(`确定要删除供应商 ${(p.row as ProxyProvider).name}?`)) {
                        deleteProviderMutation.mutate((p.row as ProxyProvider).id);
                      }
                    }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              ),
            },
          ]}
          fetchData={async () => ({
            records: providers,
            totalRow: providers.length,
          })}
        />
        <Alert severity="info" sx={{ mt: 2 }}>
          供应商 API 配置由本地代理转发器(cmd/proxy-forwarder)读取,通过环境变量 PROXY_API_URL 注入。
          CloakBrowser 启动时加 <code>--proxy-server=http://host:8888</code> 连本地转发器,转发器每次新连接提取一个新 IP。
        </Alert>
      </Paper>
      )}

      <Dialog open={writeVisible} onClose={() => setWriteVisible(false)} maxWidth="sm" fullWidth>
        <DialogTitle>新增代理</DialogTitle>
        <DialogContent>
          <TextField
            label="代理 URL"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            fullWidth size="small"
            sx={{ mt: 1, mb: 1.5 }}
            placeholder="http://127.0.0.1:8888"
          />
          <TextField
            select label="类型"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as any })}
            fullWidth size="small"
          >
            <MenuItem value="http">HTTP</MenuItem>
            <MenuItem value="https">HTTPS</MenuItem>
            <MenuItem value="socks5">SOCKS5</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWriteVisible(false)}>取消</Button>
          <Button variant="contained" onClick={handleAdd} disabled={addMutation.isPending}>新增</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={providerWriteVisible} onClose={() => setProviderWriteVisible(false)} maxWidth="sm" fullWidth>
        <DialogTitle>新增供应商(快代理等)</DialogTitle>
        <DialogContent>
          <TextField
            label="名称"
            value={providerForm.name}
            onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
            fullWidth size="small"
            sx={{ mt: 1, mb: 1.5 }}
            placeholder="快代理"
          />
          <TextField
            label="API 提取链接"
            value={providerForm.api_url}
            onChange={(e) => setProviderForm({ ...providerForm, api_url: e.target.value })}
            fullWidth size="small"
            multiline
            rows={3}
            sx={{ mb: 1.5 }}
            placeholder="https://dps.kdlapi.com/api/getdps/?secret_id=...&signature=...&num=1"
          />
          <TextField
            label="本地 host"
            value={providerForm.local_host}
            onChange={(e) => setProviderForm({ ...providerForm, local_host: e.target.value })}
            fullWidth size="small"
            sx={{ mb: 1.5 }}
            placeholder="0.0.0.0"
          />
          <TextField
            label="本地端口"
            type="number"
            value={providerForm.local_port}
            onChange={(e) => setProviderForm({ ...providerForm, local_port: parseInt(e.target.value, 10) || 8888 })}
            fullWidth size="small"
            sx={{ mb: 1.5 }}
          />
          <TextField
            label="IP 缓存(秒)"
            type="number"
            value={providerForm.cache_seconds}
            onChange={(e) => setProviderForm({ ...providerForm, cache_seconds: parseInt(e.target.value, 10) || 30 })}
            fullWidth size="small"
            sx={{ mb: 1.5 }}
            helperText="30 秒内复用同一 IP,超过重新提取"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProviderWriteVisible(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={() => addProviderMutation.mutate(providerForm)}
            disabled={addProviderMutation.isPending || !providerForm.name || !providerForm.api_url}
          >
            新增
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={2500} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity} variant="filled">{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
