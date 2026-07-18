'use client';

/**
 * 镜像管理页面
 */

import React, { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import MenuItem from '@mui/material/MenuItem';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { FilterBar, type FilterField } from '@/components/tables/FilterBar';
import { listImages, createImage } from '@/apis/sandbox';
import { IMAGE_STATUS_LABELS, type SandboxImageResp } from '@/beans/sandbox';

const LIST_KEY = ['sandbox', 'images'];

export default function ImagesPage() {
  const qc = useQueryClient();
  const [writeVisible, setWriteVisible] = useState(false);
  const [viewing, setViewing] = useState<SandboxImageResp | null>(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});

  const showMsg = useCallback((message: string, severity: 'success' | 'error' = 'success') => setSnack({ open: true, message, severity }), []);
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: LIST_KEY }), [qc]);

  const filterFields: FilterField[] = [
    { key: 'name', label: '镜像名称', type: 'text', placeholder: '搜索镜像名称' },
    { key: 'status', label: '状态', type: 'select', options: [
      { label: '全部', value: '' },
      { label: '启用', value: 'active' },
      { label: '禁用', value: 'disabled' },
      { label: '废弃', value: 'deprecated' },
    ]},
  ];

  const createMutation = useMutation({
    mutationFn: (vals: any) => createImage(vals),
    onSuccess: () => {
      showMsg('镜像创建成功');
      setWriteVisible(false);
      refresh();
    },
    onError: (err: any) => showMsg(err.message || '创建失败', 'error'),
  });

  const columns: import('@mui/x-data-grid').GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'name', headerName: '镜像名称', width: 180, renderCell: (p) => (
      <Tooltip title={p.value}><Typography sx={{ fontFamily: 'monospace', fontSize: 13 }}>{p.value}</Typography></Tooltip>
    )},
    { field: 'displayName', headerName: '显示名称', width: 160 },
    { field: 'baseImage', headerName: '基础镜像', width: 140, renderCell: (p) => (
      <Typography sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary' }}>{p.value || '-'}</Typography>
    )},
    { field: 'memoryLimit', headerName: '内存限制', width: 100 },
    { field: 'cpuCount', headerName: 'CPU', width: 70, type: 'number' },
    { field: 'timeoutSec', headerName: '超时(秒)', width: 90, type: 'number' },
    { field: 'pullCount', headerName: '拉取次数', width: 90, type: 'number' },
    { field: 'status', headerName: '状态', width: 90, renderCell: (p) => (
      <Chip label={IMAGE_STATUS_LABELS[p.value] || p.value} size="small" color={p.value === 'active' ? 'success' : p.value === 'disabled' ? 'warning' : 'default'} />
    )},
    { field: 'createTime', headerName: '创建时间', width: 170, renderCell: (p) => p.value ? new Date(p.value).toLocaleString('zh-CN') : '-' },
    {
      field: 'actions', headerName: '操作', width: 120, sortable: false,
      renderCell: (p) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="查看详情">
            <IconButton size="small" onClick={() => setViewing(p.row as SandboxImageResp)}>
              <span style={{ fontSize: 11 }}>查看</span>
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">镜像管理</Typography>
        <Button variant="contained" onClick={() => setWriteVisible(true)}>+ 新建镜像</Button>
      </Box>

      <FilterBar fields={filterFields} values={filterValues} onChange={setFilterValues} onReset={() => setFilterValues({})} />

      <DataGridTable
        columns={columns}
        fetchData={async (params) => {
          try {
            const res = await listImages({ page: params.pageNumber, pageSize: params.pageSize });
            return { data: { records: res.data?.records || res.data?.list || [], totalRow: res.data?.total || res.data?.totalRow || 0 }, success: true };
          } catch (err: any) {
            showMsg(err.message || '获取数据失败', 'error');
            return { data: { records: [], totalRow: 0 }, success: false };
          }
        }}
      />

      {/* 新建镜像 */}
      <CreateImageDialog
        open={writeVisible}
        onClose={() => setWriteVisible(false)}
        onSubmit={(vals) => createMutation.mutate(vals)}
        loading={createMutation.isPending}
      />

      {/* 镜像详情 */}
      <ImageDetailDialog viewing={viewing} onClose={() => setViewing(null)} />

      <Snackbar open={snack.open} autoHideDuration={2500} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
        <Alert severity={snack.severity} variant="filled">{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}

interface CreateImageDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (vals: any) => void;
  loading: boolean;
}

function CreateImageDialog({ open, onClose, onSubmit, loading }: CreateImageDialogProps) {
  const [form, setForm] = useState({
    name: '',
    displayName: '',
    description: '',
    dockerfile: '',
    entrypoint: '',
    cmd: '',
    memoryLimit: '512m',
    cpuCount: 1,
    timeoutSec: 300,
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (field === 'cpuCount' || field === 'timeoutSec') {
      setForm({ ...form, [field]: Number(value) });
    } else {
      setForm({ ...form, [field]: value });
    }
  };

  const handleSubmit = () => {
    if (!form.name) return;
    onSubmit(form);
  };

  React.useEffect(() => {
    if (open) setForm({
      name: '', displayName: '', description: '', dockerfile: '',
      entrypoint: '', cmd: '', memoryLimit: '512m', cpuCount: 1, timeoutSec: 300,
    });
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>新建镜像</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 1 }}>
          <TextField
            label="镜像名称 *"
            value={form.name}
            onChange={handleChange('name')}
            placeholder="如: python:3.13 或 my-custom-image"
            helperText="唯一标识，用于代码中引用"
            required
            fullWidth
          />
          <TextField
            label="显示名称"
            value={form.displayName}
            onChange={handleChange('displayName')}
            placeholder="如: Python 3.13 运行环境"
            fullWidth
          />
          <TextField
            label="描述"
            value={form.description}
            onChange={handleChange('description')}
            multiline
            rows={2}
            placeholder="镜像用途说明"
            fullWidth
          />
          <TextField
            label="Dockerfile"
            value={form.dockerfile}
            onChange={handleChange('dockerfile')}
            multiline
            rows={6}
            placeholder="FROM python:3.13-slim&#10;RUN pip install numpy pandas"
            helperText="自定义构建 Dockerfile，为空则使用基础镜像"
            fullWidth
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="入口点"
              value={form.entrypoint}
              onChange={handleChange('entrypoint')}
              placeholder="如: python"
              sx={{ flex: 1 }}
            />
            <TextField
              label="启动命令"
              value={form.cmd}
              onChange={handleChange('cmd')}
              placeholder="如: main.py"
              sx={{ flex: 1 }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="内存限制"
              value={form.memoryLimit}
              onChange={handleChange('memoryLimit')}
              placeholder="如: 512m, 1g"
              helperText="容器可用内存"
              sx={{ flex: 1 }}
            />
            <TextField
              label="CPU 核数"
              type="number"
              value={form.cpuCount}
              onChange={handleChange('cpuCount')}
              inputProps={{ min: 0.5, max: 16, step: 0.5 }}
              sx={{ flex: 1 }}
            />
            <TextField
              label="超时(秒)"
              type="number"
              value={form.timeoutSec}
              onChange={handleChange('timeoutSec')}
              inputProps={{ min: 10, max: 3600 }}
              sx={{ flex: 1 }}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading || !form.name}>
          {loading ? '创建中…' : '创建'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ImageDetailDialog({ viewing, onClose }: { viewing: SandboxImageResp | null; onClose: () => void }) {
  if (!viewing) return null;

  return (
    <Dialog open={!!viewing} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>镜像详情 · {viewing.name}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box><Typography variant="caption" color="text.secondary">镜像名称</Typography><Typography sx={{ fontFamily: 'monospace' }}>{viewing.name}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">显示名称</Typography><Typography>{viewing.displayName || '-'}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">基础镜像</Typography><Typography sx={{ fontFamily: 'monospace' }}>{viewing.baseImage || '-'}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">状态</Typography><Chip label={IMAGE_STATUS_LABELS[viewing.status] || viewing.status} size="small" color={viewing.status === 'active' ? 'success' : 'default'} /></Box>
          <Box><Typography variant="caption" color="text.secondary">内存限制</Typography><Typography>{viewing.memoryLimit || '512m'}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">CPU 核数</Typography><Typography>{viewing.cpuCount || 1}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">超时时间</Typography><Typography>{viewing.timeoutSec || 300} 秒</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">拉取次数</Typography><Typography>{viewing.pullCount || 0}</Typography></Box>
          <Box sx={{ gridColumn: '1 / -1' }}><Typography variant="caption" color="text.secondary">描述</Typography><Typography>{viewing.description || '-'}</Typography></Box>
          {viewing.dockerfile && <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography variant="caption" color="text.secondary">Dockerfile</Typography>
            <Box component="pre" sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1, fontSize: 12, fontFamily: 'monospace', overflow: 'auto', maxHeight: 300 }}>
              {viewing.dockerfile}
            </Box>
          </Box>}
          <Box sx={{ gridColumn: '1 / -1' }}><Typography variant="caption" color="text.secondary">入口点</Typography><Typography sx={{ fontFamily: 'monospace' }}>{viewing.entrypoint || '-'}</Typography></Box>
          <Box sx={{ gridColumn: '1 / -1' }}><Typography variant="caption" color="text.secondary">启动命令</Typography><Typography sx={{ fontFamily: 'monospace' }}>{viewing.cmd || '-'}</Typography></Box>
          <Box sx={{ gridColumn: '1 / -1' }}><Typography variant="caption" color="text.secondary">创建时间</Typography><Typography>{viewing.createTime ? new Date(viewing.createTime).toLocaleString('zh-CN') : '-'}</Typography></Box>
        </Box>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>关闭</Button></DialogActions>
    </Dialog>
  );
}
