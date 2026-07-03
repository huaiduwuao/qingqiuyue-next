'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import CircularProgress from '@mui/material/CircularProgress';
import { DataGridTable } from '@/components/tables/DataGridTable';
import HermesFormDialog from '@/components/hermes/HermesFormDialog';
import InstancesPanel from '@/components/hermes/InstancesPanel';
import { hermesApi } from '@/apis/hermes';
import type { HermesAgentItem, HermesInstanceStatus } from '@/beans/system';
import type { GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PublishIcon from '@mui/icons-material/Publish';
import UnpublishedIcon from '@mui/icons-material/Unpublished';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

type TabKey = 'agents' | 'instances';

const AGENT_LIST_KEY = ['system', 'hermes', 'agents'];

const agentStatusColor: Record<string, 'success' | 'warning' | 'default' | 'error'> = {
  active: 'success',
  paused: 'warning',
  draft: 'default',
};

const agentColumns: GridColDef<HermesAgentItem>[] = [
  { field: 'id', headerName: 'ID', width: 70 },
  {
    field: 'instanceName',
    headerName: '实例',
    width: 150,
    renderCell: (p) => {
      const v = p.value as string | undefined;
      if (!v) return <Chip label="未分配" size="small" variant="outlined" />;
      return <Chip label={v} size="small" variant="outlined" color="primary" />;
    },
  },
  { field: 'name', headerName: '名称', width: 140 },
  { field: 'agentId', headerName: 'agentId', width: 130 },
  { field: 'role', headerName: '角色', width: 140 },
  {
    field: 'tags',
    headerName: '标签',
    flex: 1,
    minWidth: 160,
    renderCell: (p) => {
      const raw = p.value;
      const tags: string[] = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',').filter(Boolean) : [];
      if (!tags.length) return <Chip label="-" size="small" variant="outlined" />;
      return (
        <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 0.5 }}>
          {tags.map((t, i) => (
            <Chip key={i} label={t} size="small" variant="outlined" />
          ))}
        </Box>
      );
    },
  },
  {
    field: 'status',
    headerName: '状态',
    width: 90,
    renderCell: (p) => (
      <Chip
        label={p.value as string}
        size="small"
        color={agentStatusColor[p.value as string] || 'default'}
        variant="outlined"
      />
    ),
  },
  {
    field: 'published',
    headerName: '已发布',
    width: 90,
    renderCell: (p) => <Switch checked={!!p.value} readOnly size="small" />,
  },
  { field: 'chatCount', headerName: '聊天数', width: 90, type: 'number' },
  {
    field: 'createTime',
    headerName: '创建时间',
    width: 170,
    valueFormatter: (value) => (value ? new Date(value as string).toLocaleString() : '-'),
  },
];

function AgentsPanel() {
  const qc = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [record, setRecord] = useState<HermesAgentItem | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnackbar({ open: true, message, severity });

  const instanceStatusQuery = useQuery<HermesInstanceStatus>({
    queryKey: ['system', 'hermes', 'legacy-instance'],
    queryFn: () => hermesApi.instanceStatus() as any,
    refetchInterval: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: (vals: any) => hermesApi.save(vals),
    onSuccess: () => { showMessage('创建成功'); handleModalClose(); qc.invalidateQueries({ queryKey: AGENT_LIST_KEY }); },
    onError: (err: any) => showMessage(err.message || '创建失败', 'error'),
  });
  const updateMutation = useMutation({
    mutationFn: (vals: any) => hermesApi.update({ ...vals, id: record?.id }),
    onSuccess: () => { showMessage('更新成功'); handleModalClose(); qc.invalidateQueries({ queryKey: AGENT_LIST_KEY }); },
    onError: (err: any) => showMessage(err.message || '更新失败', 'error'),
  });
  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => hermesApi.remove(ids),
    onSuccess: () => { showMessage('删除成功'); qc.invalidateQueries({ queryKey: AGENT_LIST_KEY }); },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });
  const publishMutation = useMutation({
    mutationFn: (id: number) => hermesApi.publish(id),
    onSuccess: () => { showMessage('已发布'); qc.invalidateQueries({ queryKey: AGENT_LIST_KEY }); },
    onError: (err: any) => showMessage(err.message || '发布失败', 'error'),
  });
  const unpublishMutation = useMutation({
    mutationFn: (id: number) => hermesApi.unpublish(id),
    onSuccess: () => { showMessage('已下线'); qc.invalidateQueries({ queryKey: AGENT_LIST_KEY }); },
    onError: (err: any) => showMessage(err.message || '下线失败', 'error'),
  });
  const pauseMutation = useMutation({
    mutationFn: (id: number) => hermesApi.pause(id),
    onSuccess: () => { showMessage('已暂停'); qc.invalidateQueries({ queryKey: AGENT_LIST_KEY }); },
    onError: (err: any) => showMessage(err.message || '暂停失败', 'error'),
  });
  const resumeMutation = useMutation({
    mutationFn: (id: number) => hermesApi.resume(id),
    onSuccess: () => { showMessage('已恢复'); qc.invalidateQueries({ queryKey: AGENT_LIST_KEY }); },
    onError: (err: any) => showMessage(err.message || '恢复失败', 'error'),
  });
  const syncMutation = useMutation({
    mutationFn: () => hermesApi.instanceSync(),
    onSuccess: (res: any) => {
      const imported = res?.data?.imported;
      showMessage(imported != null ? `已同步,导入 ${imported} 个 agent` : '同步完成');
      qc.invalidateQueries({ queryKey: AGENT_LIST_KEY });
    },
    onError: (err: any) => showMessage(err.message || '同步失败', 'error'),
  });

  const isSubmitting = saveMutation.isPending || updateMutation.isPending;

  const handleAdd = () => {
    setRecord(null);
    setModalVisible(true);
  };
  const handleEdit = (row: HermesAgentItem) => {
    hermesApi.get(row.id as number).then((res) => {
      setRecord((res?.data as HermesAgentItem) || row);
      setModalVisible(true);
    }).catch((err) => showMessage(err.message || '加载失败', 'error'));
  };
  const handleDelete = (row: HermesAgentItem) => {
    if (!confirm(`确定删除 Hermes「${row.name}」?`)) return;
    deleteMutation.mutate([row.id as number]);
  };
  const handlePublish = (row: HermesAgentItem) => publishMutation.mutate(row.id as number);
  const handleUnpublish = (row: HermesAgentItem) => unpublishMutation.mutate(row.id as number);
  const handlePause = (row: HermesAgentItem) => pauseMutation.mutate(row.id as number);
  const handleResume = (row: HermesAgentItem) => resumeMutation.mutate(row.id as number);
  const handleSync = () => syncMutation.mutate();

  const handleModalClose = () => {
    setModalVisible(false);
    setRecord(null);
  };

  const handleSubmit = (vals: any) => {
    if (record?.id) {
      updateMutation.mutate(vals);
    } else {
      saveMutation.mutate(vals);
    }
  };

  const instanceStatus = instanceStatusQuery.data;
  const instanceOk = instanceStatus?.ok;

  return (
    <Box>
      <Card sx={{ mb: 2, bgcolor: 'background.paper' }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
            {instanceStatusQuery.isLoading ? (
              <CircularProgress size={16} />
            ) : instanceOk ? (
              <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
            ) : (
              <ErrorIcon sx={{ fontSize: 18, color: 'error.main' }} />
            )}
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
              {instanceOk ? '默认实例连通' : instanceOk === false ? '默认实例未连通' : '默认实例状态未知'}
            </Typography>
            {instanceStatus?.baseUrl && (
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                baseUrl = {instanceStatus.baseUrl}
              </Typography>
            )}
            {instanceStatus?.containerAgents && instanceStatus.containerAgents.length > 0 && (
              <>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>|</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  默认实例 agent:
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 0.5 }}>
                  {instanceStatus.containerAgents.map((a, i) => (
                    <Chip key={i} label={a} size="small" variant="outlined" />
                  ))}
                </Box>
              </>
            )}
            {instanceStatusQuery.isError && (
              <Typography sx={{ fontSize: 11, color: 'error.main' }}>
                {(instanceStatusQuery.error as any)?.message || '获取失败'}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      <DataGridTable
        title="Hermes 智能体管理"
        columns={agentColumns}
        fetchData={async (params) => {
          const res = await hermesApi.page(params);
          return {
            data: {
              records: res.data?.records || [],
              totalRow: res.data?.totalRow || 0,
            },
            success: res.success ?? true,
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
              { label: 'draft', value: 'draft' },
            ] },
          ],
          values: filterValues,
          onChange: setFilterValues,
          onReset: () => setFilterValues({}),
        }}
        toolBarRender={() => (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
              新建 Hermes
            </Button>
            <Button
              variant="outlined"
              startIcon={syncMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <SyncIcon />}
              onClick={handleSync}
              disabled={syncMutation.isPending}
            >
              同步默认实例 agent
            </Button>
          </Box>
        )}
        customActions={[
          {
            label: '发布',
            icon: <PublishIcon fontSize="small" />,
            onClick: (row: HermesAgentItem) => handlePublish(row),
            hidden: (row: HermesAgentItem) => !!row.published,
            color: 'primary',
          },
          {
            label: '下线',
            icon: <UnpublishedIcon fontSize="small" />,
            onClick: (row: HermesAgentItem) => handleUnpublish(row),
            hidden: (row: HermesAgentItem) => !row.published,
          },
          {
            label: '暂停',
            icon: <PauseIcon fontSize="small" />,
            onClick: (row: HermesAgentItem) => handlePause(row),
            hidden: (row: HermesAgentItem) => row.status === 'paused',
          },
          {
            label: '恢复',
            icon: <PlayArrowIcon fontSize="small" />,
            onClick: (row: HermesAgentItem) => handleResume(row),
            hidden: (row: HermesAgentItem) => row.status !== 'paused',
          },
        ]}
      />

      <HermesFormDialog
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

export default function SystemHermesPage() {
  const [tab, setTab] = useState<TabKey>('agents');

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Tabs
        value={tab}
        onChange={(_, v: TabKey) => setTab(v)}
        sx={{
          minHeight: 36,
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': {
            minHeight: 36,
            fontSize: 14,
            fontWeight: 500,
            textTransform: 'none',
            py: 1,
          },
          '& .Mui-selected': { fontWeight: 700 },
          '& .MuiTabs-indicator': { height: 2 },
        }}
      >
        <Tab value="agents" label="Agent 管理" />
        <Tab value="instances" label="实例管理" />
      </Tabs>

      {tab === 'agents' && <AgentsPanel />}
      {tab === 'instances' && <InstancesPanel />}
    </Box>
  );
}
