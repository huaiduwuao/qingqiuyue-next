'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { listSensitiveWords, addSensitiveWord, deleteSensitiveWord } from '@/apis/system-moderation';
import { useAuthority } from '@/contexts/AuthContext';
import { PERMISSIONS } from '@/lib/permissions';
import type { GridColDef } from '@mui/x-data-grid';

const LIST_KEY = ['system', 'moderation', 'sensitive-words'];

interface SensitiveWordItem {
  id: number;
  word: string;
  level: number;
  category: string;
  status: string;
  createdAt: string;
}

const columns: GridColDef<SensitiveWordItem>[] = [
  { field: 'id', headerName: 'ID', width: 80 },
  { field: 'word', headerName: '敏感词', width: 180 },
  {
    field: 'level',
    headerName: '级别',
    width: 100,
    renderCell: (params) => (
      <Chip
        label={params.value === 2 ? '拦截' : '提示'}
        color={params.value === 2 ? 'error' : 'warning'}
        size="small"
      />
    ),
  },
  { field: 'category', headerName: '类别', width: 140 },
  {
    field: 'createdAt',
    headerName: '创建时间',
    width: 180,
    valueFormatter: (value) => (value ? new Date(value).toLocaleString() : '-'),
  },
];

export default function ModerationSensitiveWordsPage() {
  const qc = useQueryClient();
  const { can } = useAuthority();
  const [modalOpen, setModalOpen] = useState(false);
  const [word, setWord] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState(2);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const canCreate = can(PERMISSIONS.SYSTEM_MODERATION.SENSITIVE_WORD_CREATE);
  const canDelete = can(PERMISSIONS.SYSTEM_MODERATION.SENSITIVE_WORD_DELETE);

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnackbar({ open: true, message, severity });

  const addMutation = useMutation({
    mutationFn: addSensitiveWord,
    onSuccess: () => {
      showMessage('添加成功');
      setModalOpen(false);
      setWord('');
      setCategory('');
      setLevel(2);
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (err: any) => showMessage(err.message || '添加失败', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSensitiveWord,
    onSuccess: () => {
      showMessage('删除成功');
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });

  const handleAdd = () => {
    if (!word.trim()) {
      showMessage('请输入敏感词', 'error');
      return;
    }
    addMutation.mutate({ word: word.trim(), category: category.trim() || 'general', level });
  };

  const handleDelete = (row: SensitiveWordItem) => {
    if (!confirm(`确定删除敏感词「${row.word}」吗？`)) return;
    deleteMutation.mutate(row.id);
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      <DataGridTable
        title="敏感词管理"
        columns={columns}
        fetchData={async () => {
          const res = await listSensitiveWords();
          return {
            data: {
              records: res.data?.records || res.data?.list || [],
              totalRow: res.data?.totalRow || res.data?.total || 0,
            },
            success: true,
          };
        }}
        onDelete={canDelete ? handleDelete : undefined}
        toolBarRender={() =>
          canCreate ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setModalOpen(true)}>
              添加敏感词
            </Button>
          ) : undefined
        }
      />

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>添加敏感词</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="敏感词"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="类别"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              fullWidth
              placeholder="如: porn, illegal, political"
            />
            <TextField
              label="级别"
              type="number"
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              fullWidth
              helperText="1=提示, 2=拦截"
              slotProps={{ htmlInput: { min: 1, max: 2 } }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>取消</Button>
          <Button onClick={handleAdd} variant="contained" disabled={addMutation.isPending}>
            添加
          </Button>
        </DialogActions>
      </Dialog>

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
