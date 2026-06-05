'use client';

import React, { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { GridColDef } from '@mui/x-data-grid';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { page, remove, ModuleContentToplistItem } from '@/apis/module-content-toplist-item';
import { suggest, ModuleContentItem } from '@/apis/module-content';

interface Props {
  detail?: { id: number; type: string };
  handleClose?: () => void;
}

const LIST_KEY = ['content', 'module-content-toplist-item'];

export default function ModuleContentToplistItemPage({ detail, handleClose }: Props) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>('');
  const [suggestList, setSuggestList] = useState<ModuleContentItem[]>([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });

  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => remove(ids),
    onSuccess: () => { showMessage('删除成功'); invalidate(); },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });

  const handleSuggest = useCallback(async (title: string) => {
    if (title.length >= 2) {
      const res: any = await suggest({ title, contentType: detail?.type });
      if (res.code === 200) setSuggestList(res.data || []);
    }
  }, [detail?.type]);

  const handleDelete = (row: ModuleContentToplistItem) => {
    if (!confirm('确定删除吗？')) return;
    deleteMutation.mutate([row.id]);
  };

  const columns: GridColDef[] = [
    {
      field: 'title',
      headerName: '标题',
      width: 300,
      valueGetter: (value, row) => row.content?.title || value,
    },
    {
      field: 'subtitle',
      headerName: '副标题',
      width: 200,
      valueGetter: (value, row) => row.content?.subtitle || value,
    },
    {
      field: 'updateTime',
      headerName: '最后更新时间',
      width: 180,
      valueGetter: (value) => value ? new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-',
    },
  ];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2 }}>榜单条目</Typography>
        <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
          <TextField
            sx={{ width: 300 }}
            placeholder="输入名称搜索"
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              handleSuggest(e.target.value);
            }}
          />
        </Box>
        <DataGridTable
          columns={columns}
          fetchData={(params) => page({ ...params, toplistId: detail?.id || 0 })}
          onDelete={handleDelete}
        />
        <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </CardContent>
    </Card>
  );
}