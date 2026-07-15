'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import SyncIcon from '@mui/icons-material/Sync';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import { DataGridTable } from '@/components/tables/DataGridTable';
import HermesInstanceFormDialog from '@/components/hermes/HermesInstanceFormDialog';
import { hermesApi, type HermesDiscoverResult, type HermesInstanceItem } from '@/apis/hermes';
import type { GridColDef } from '@mui/x-data-grid';
import { RelativeTime } from '@/components/common/RelativeTime';

// 类型定义
type InstanceFormValues = {
  name: string;
  code: string;
  baseUrl: string;
  description?: string;
  region?: string;
  maxConcurrent?: number;
};

interface ErrorWithMessage {
  message?: string;
}

type InstanceSyncResp = {
  imported?: number;
  skipped?: number;
};

const LIST_KEY = ['system', 'hermes', 'instances'];

const statusColor: Record<HermesInstanceItem['status'], 'success' | 'warning' | 'error' | 'default'> = {
  active: 'success',
  paused: 'warning',
  offline: 'error',
};

const healthColor: Record<HermesInstanceItem['healthStatus'], 'success' | 'error' | 'default'> = {
  healthy: 'success',
  unhealthy: 'error',
  unknown: 'default',
};

// relativeTime() 已废弃:SSR/CSR Date.now() 不同会引发 hydration mismatch。
// 改用 <RelativeTime ts={...} /> 组件。

function truncate(s: string | undefined, max = 50): string {
  if (!s) return '-';
  return s.length > max ? s.slice(0, max) + '…' : s;
}

export default function InstancesPanel() {
  const qc = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [record, setRecord] = useState<HermesInstanceItem | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const showMessage = (message: string, severity: 'success' | 'error' | 'info' = 'success') =>
    setSnackbar({ open: true, message, severity });

  const saveMutation = useMutation({
    mutationFn: (vals: InstanceFormValues) => hermesApi.instanceSave(vals),
    onSuccess: () => {
      showMessage('创建成功');
      handleModalClose();
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (err: ErrorWithMessage) => showMessage(err.message || '创建失败', 'error'),
  });
  const updateMutation = useMutation({
    mutationFn: (vals: InstanceFormValues) => hermesApi.instanceUpdate({ ...vals, id: record?.id ?? 0 }),
    onSuccess: () => {
      showMessage('更新成功');
      handleModalClose();
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (err: ErrorWithMessage) => showMessage(err.message || '更新失败', 'error'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => hermesApi.instanceRemove(id),
    onSuccess: () => {
      showMessage('删除成功');
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (err: ErrorWithMessage) => showMessage(err.message || '删除失败', 'error'),
  });
  const healthMutation = useMutation({
    mutationFn: (id: number) => hermesApi.instanceHealth(id),
    onSuccess: (res) => {
      const data = (res?.data ?? res) as { ok?: boolean; message?: string };
      const msg = data?.message || (data?.ok ? '健康检查通过' : '健康检查失败');
      showMessage(`${data?.ok ? 'OK' : 'FAIL'} · ${msg}`, data?.ok ? 'success' : 'error');
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (err: ErrorWithMessage) => showMessage(err.message || '健康检查失败', 'error'),
  });
  const discoverMutation = useMutation({
    mutationFn: () => hermesApi.instanceDiscover(),
    onSuccess: (res) => {
      const data = (res?.data ?? res) as HermesDiscoverResult;
      const msg = `扫描 ${data.scanned} 个容器,发现 ${data.candidates} 个候选:新增 ${data.imported} / 更新 ${data.updated} / 跳过 ${data.skipped}`;
      showMessage(msg, data.imported + data.updated > 0 ? 'success' : 'info');
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: ['system', 'hermes', 'agents'] });
    },
    onError: (err: ErrorWithMessage) => showMessage(err.message || '发现失败', 'error'),
  });

  const syncMutation = useMutation({
    mutationFn: (id: number) => hermesApi.instanceSyncAgents(id),
    onSuccess: (res) => {
      const data = (res?.data ?? res) as InstanceSyncResp;
      const imported = data?.imported ?? 0;
      const skipped = data?.skipped ?? 0;
      showMessage(`已导入 ${imported} 个,跳过 ${skipped} 个`, 'success');
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: ['system', 'hermes', 'agents'] });
      qc.invalidateQueries({ queryKey: ['system', 'hermes'] });
    },
    onError: (err: ErrorWithMessage) => showMessage(err.message || '同步失败', 'error'),
  });

  const isSubmitting = saveMutation.isPending || updateMutation.isPending;

  const handleAdd = () => {
    setRecord(null);
    setModalVisible(true);
  };
  const handleEdit = (row: HermesInstanceItem) => {
    hermesApi.instanceGet(row.id).then((res) => {
      setRecord((res?.data as HermesInstanceItem) || row);
      setModalVisible(true);
    }).catch((err: ErrorWithMessage) => showMessage(err.message || '加载失败', 'error'));
  };
  const handleDelete = (row: HermesInstanceItem) => {
    if (!confirm(`确定删除实例「${row.name}」?该实例下的 agent 关联会被清空。`)) return;
    deleteMutation.mutate(row.id);
  };
  const handleHealth = (row: HermesInstanceItem) => healthMutation.mutate(row.id);
  const handleSync = (row: HermesInstanceItem) => syncMutation.mutate(row.id);

  const handleModalClose = () => {
    setModalVisible(false);
    setRecord(null);
  };

  const handleSubmit = (vals: InstanceFormValues) => {
    if (record?.id) {
      updateMutation.mutate(vals);
    } else {
      saveMutation.mutate(vals);
    }
  };

  const columns: GridColDef<HermesInstanceItem>[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'name', headerName: '名称', width: 140 },
    { field: 'code', headerName: '编码', width: 110 },
    {
      field: 'baseUrl',
      headerName: 'baseUrl',
      flex: 1,
      minWidth: 200,
      renderCell: (p) => (
        <Tooltip title={(p.value as string) || ''} placement="top">
          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{truncate(p.value as string, 50)}</span>
        </Tooltip>
      ),
    },
    {
      field: 'region',
      headerName: '区域',
      width: 100,
      renderCell: (p) => <Chip label={(p.value as string) || '-'} size="small" variant="outlined" />,
    },
    {
      field: 'status',
      headerName: '状态',
      width: 90,
      renderCell: (p) => (
        <Chip
          label={p.value as string}
          size="small"
          color={statusColor[p.value as HermesInstanceItem['status']] || 'default'}
          variant="outlined"
        />
      ),
    },
    {
      field: 'healthStatus',
      headerName: '健康',
      width: 200,
      renderCell: (p) => {
        const row = p.row as HermesInstanceItem;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Chip
              label={p.value as string}
              size="small"
              color={healthColor[p.value as HermesInstanceItem['healthStatus']] || 'default'}
              variant="outlined"
            />
            <Box component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>
              {<RelativeTime ts={row.lastHealthAt} fallback="" />}
            </Box>
          </Box>
        );
      },
    },
    {
      field: 'agentCount',
      headerName: 'agent 数',
      width: 80,
      type: 'number',
      renderCell: (p) => (p.value == null ? '-' : String(p.value)),
    },
    { field: 'maxConcurrent', headerName: '并发上限', width: 90, type: 'number' },
    {
      field: 'createTime',
      headerName: '创建时间',
      width: 170,
      valueFormatter: (value) => (value ? new Date(value as string).toLocaleString() : '-'),
    },
  ];

  return (
    <Box>
      <DataGridTable
        title="Hermes 实例管理"
        columns={columns}
        fetchData={async (params) => {
          const res = await hermesApi.instancePage(params);
          return {
            data: {
              records: res.list || [],
              totalRow: res.total || 0,
            },
            success: true,
          };
        }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        filters={{
          fields: [
            { key: 'name', label: '名称', type: 'text' },
            { key: 'status', label: '状态', type: 'select', options: [
              { label: 'active', value: 'active' },
              { label: 'paused', value: 'paused' },
              { label: 'offline', value: 'offline' },
            ] },
          ],
          values: filterValues,
          onChange: setFilterValues,
          onReset: () => setFilterValues({}),
        }}
        toolBarRender={() => (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
              新建实例
            </Button>
            <Button
              variant="outlined"
              startIcon={discoverMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <TravelExploreIcon />}
              onClick={() => discoverMutation.mutate()}
              disabled={discoverMutation.isPending}
            >
              扫描容器发现
            </Button>
          </Box>
        )}
        customActions={[
          {
            label: '健康检查',
            icon: healthMutation.isPending ? <CircularProgress size={12} color="inherit" /> : <HealthAndSafetyIcon fontSize="small" />,
            onClick: (row: HermesInstanceItem) => handleHealth(row),
            color: 'info',
          },
          {
            label: '同步 agent',
            icon: syncMutation.isPending ? <CircularProgress size={12} color="inherit" /> : <SyncIcon fontSize="small" />,
            onClick: (row: HermesInstanceItem) => handleSync(row),
            color: 'success',
          },
        ]}
      />

      <HermesInstanceFormDialog
        open={modalVisible}
        onClose={handleModalClose}
        onSubmit={handleSubmit}
        record={record}
        isSubmitting={isSubmitting}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
