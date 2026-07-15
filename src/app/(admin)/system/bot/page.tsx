'use client';

import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { DataGridTable } from '@/components/tables/DataGridTable';
import BotFormDialog from '@/components/bot/BotFormDialog';
import * as botApi from '@/apis/bot';
import type { BotItem } from '@/beans/system';
import type { GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

const LIST_KEY = ['system', 'bot'];

const statusColor: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  active: 'success',
  paused: 'warning',
  banned: 'error',
};

const columns: GridColDef<BotItem>[] = [
  { field: 'id', headerName: 'ID', width: 80 },
  { field: 'name', headerName: '账户名', width: 160 },
  { field: 'nickname', headerName: '昵称', width: 140 },
  {
    field: 'status',
    headerName: '状态',
    width: 100,
    renderCell: (p) => (
      <Chip
        label={p.value as string}
        size="small"
        color={statusColor[p.value as string] || 'default'}
        variant="outlined"
      />
    ),
  },
  {
    field: 'commentTemplates',
    headerName: '模板数',
    width: 90,
    valueGetter: (_v, row) => (row.commentTemplates || []).length,
  },
  {
    field: 'useLlmForComments',
    headerName: 'LLM 评论',
    width: 110,
    renderCell: (p) => (p.value ? <Chip label="ON" size="small" color="primary" /> : <Chip label="OFF" size="small" />),
  },
  {
    field: 'commentIntervalMinutes',
    headerName: '评论间隔(分)',
    width: 130,
    type: 'number',
  },
  {
    field: 'chatEnabled',
    headerName: '陪聊',
    width: 90,
    renderCell: (p) => (p.value ? <Chip label="ON" size="small" color="primary" /> : <Chip label="OFF" size="small" />),
  },
  { field: 'llmModel', headerName: 'LLM 模型', width: 160 },
  {
    field: 'lastActiveAt',
    headerName: '最近活跃',
    width: 180,
    valueFormatter: (value) => (value ? new Date(value as string).toLocaleString() : '-'),
  },
];

export default function SystemBotPage() {
  const qc = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [record, setRecord] = useState<BotItem | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const actionRef = useRef<{ reload: () => void } | null>(null);

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnackbar({ open: true, message, severity });

  const reload = () => {
    qc.invalidateQueries({ queryKey: LIST_KEY });
    actionRef.current?.reload();
  };

  const saveMutation = useMutation({
    mutationFn: (vals: any) => botApi.save(vals),
    onSuccess: () => { showMessage('创建成功'); handleModalClose(); reload(); },
    onError: (err: any) => showMessage(err.message || '创建失败', 'error'),
  });
  const updateMutation = useMutation({
    mutationFn: (vals: any) => botApi.update({ ...vals, id: record?.id }),
    onSuccess: () => { showMessage('更新成功'); handleModalClose(); reload(); },
    onError: (err: any) => showMessage(err.message || '更新失败', 'error'),
  });
  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => botApi.remove(ids),
    onSuccess: () => { showMessage('删除成功'); reload(); },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });
  const pauseMutation = useMutation({
    mutationFn: (id: number) => botApi.pause(id),
    onSuccess: () => { showMessage('已暂停'); reload(); },
    onError: (err: any) => showMessage(err.message || '操作失败', 'error'),
  });
  const resumeMutation = useMutation({
    mutationFn: (id: number) => botApi.resume(id),
    onSuccess: () => { showMessage('已恢复'); reload(); },
    onError: (err: any) => showMessage(err.message || '操作失败', 'error'),
  });

  const isSubmitting = saveMutation.isPending || updateMutation.isPending;

  const handleAdd = () => {
    setRecord(null);
    setModalVisible(true);
  };
  const handleEdit = (row: BotItem) => {
    botApi.get(row.id as number).then((res) => {
      setRecord((res?.data as BotItem) || row);
      setModalVisible(true);
    }).catch((err) => showMessage(err.message || '加载失败', 'error'));
  };
  const handleDelete = (row: BotItem) => {
    if (!confirm(`确定删除假人「${row.nickname || row.name}」?将软删 user + bot_profile。`)) return;
    deleteMutation.mutate([row.id as number]);
  };
  const handlePause = (row: BotItem) => pauseMutation.mutate(row.id as number);
  const handleResume = (row: BotItem) => resumeMutation.mutate(row.id as number);

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

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      <DataGridTable
        title="假人管理"
        columns={columns}
        fetchData={async (params) => {
          const res = await botApi.page(params);
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
              { label: 'banned', value: 'banned' },
            ] },
          ],
          values: filterValues,
          onChange: setFilterValues,
          onReset: () => setFilterValues({}),
        }}
        toolBarRender={() => (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
              新建假人
            </Button>
          </Box>
        )}
        customActions={[
          {
            label: '暂停',
            icon: <PauseIcon fontSize="small" />,
            onClick: (row: BotItem) => handlePause(row),
            hidden: (row: BotItem) => row.status !== 'active',
          },
          {
            label: '恢复',
            icon: <PlayArrowIcon fontSize="small" />,
            onClick: (row: BotItem) => handleResume(row),
            hidden: (row: BotItem) => row.status === 'active',
          },
        ]}
      />

      <BotFormDialog
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