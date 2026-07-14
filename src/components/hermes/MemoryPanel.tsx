'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { hermesApi, HermesMemoryAdminItem } from '@/apis/hermes';
import type { GridColDef } from '@mui/x-data-grid';

const scopeColor: Record<string, 'primary' | 'secondary' | 'default'> = {
  user: 'primary',
  agent: 'secondary',
  shared: 'default',
};

const memoryColumns: GridColDef<HermesMemoryAdminItem>[] = [
  { field: 'id', headerName: 'ID', width: 80 },
  { field: 'userId', headerName: '用户ID', width: 100 },
  { field: 'agentId', headerName: 'Agent', width: 130 },
  {
    field: 'scope',
    headerName: 'Scope',
    width: 100,
    renderCell: (p) => (
      <Chip
        label={p.value as string}
        size="small"
        color={scopeColor[p.value as string] || 'default'}
        variant="outlined"
      />
    ),
  },
  {
    field: 'content',
    headerName: '内容',
    flex: 1,
    minWidth: 200,
    renderCell: (p) => (
      <Box
        sx={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 13,
        }}
        title={p.value as string}
      >
        {p.value as string}
      </Box>
    ),
  },
  { field: 'sourceNodeId', headerName: '来源节点', width: 150 },
  {
    field: 'createdAt',
    headerName: '创建时间',
    width: 170,
    valueFormatter: (value) => (value ? new Date(value as string).toLocaleString() : '-'),
  },
];

export default function MemoryPanel() {
  const qc = useQueryClient();
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnackbar({ open: true, message, severity });

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => hermesApi.memoryAdminBatchDelete(ids),
    onSuccess: () => {
      showMessage('删除成功');
      qc.invalidateQueries({ queryKey: ['system', 'hermes', 'memory'] });
    },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });

  const handleDelete = (row: HermesMemoryAdminItem) => {
    if (!confirm(`确定删除该记忆 (ID: ${row.id})?`)) return;
    deleteMutation.mutate([row.id]);
  };

  return (
    <Box>
      <DataGridTable
        title="记忆管理"
        columns={memoryColumns}
        fetchData={async (params) => {
          const res = await hermesApi.memoryAdminPage({
            page: params.pageNumber,
            pageSize: params.pageSize,
            ...filterValues,
          });
          return {
            data: {
              records: res.data?.records || [],
              totalRow: res.data?.totalRow || 0,
            },
            success: res.success ?? true,
          };
        }}
        onDelete={handleDelete}
        filters={{
          fields: [
            { key: 'userId', label: '用户ID', type: 'text' },
            { key: 'agentId', label: 'Agent', type: 'text' },
            {
              key: 'scope',
              label: 'Scope',
              type: 'select',
              options: [
                { label: 'user', value: 'user' },
                { label: 'agent', value: 'agent' },
                { label: 'shared', value: 'shared' },
              ],
            },
            { key: 'keyword', label: '关键词', type: 'text' },
          ],
          values: filterValues,
          onChange: setFilterValues,
          onReset: () => setFilterValues({}),
        }}
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
