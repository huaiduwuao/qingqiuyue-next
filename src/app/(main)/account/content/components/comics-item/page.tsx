'use client';

import React, { useState } from 'react';
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
import { DataGridTable } from '@/components/tables/DataGridTable';
import { page, remove, save, update } from '@/apis/content-comics-item';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import type { GridColDef } from '@mui/x-data-grid';

interface Props {
  detail: any;
  handleClose: () => void;
}

export default function ComicsItemContentPage({ detail, handleClose }: Props) {
  const [writeVisible, setWriteVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [formValues, setFormValues] = useState({ num: '', title: '', url: '' });
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });

  const handleEdit = (record: any) => {
    setSelectedRecord(record);
    setFormValues({ num: record?.num || '', title: record?.title || '', url: record?.url || '' });
    setWriteVisible(true);
  };

  const handleFormChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async () => {
    try {
      if (selectedRecord?.id) {
        await update({ ...selectedRecord, ...formValues });
        showMessage('更新成功');
      } else {
        await save(formValues);
        showMessage('创建成功');
      }
      setWriteVisible(false);
    } catch (err: any) {
      showMessage(err.message || '操作失败', 'error');
    }
  };

  const handleDelete = async (record: any) => {
    if (!confirm('确定删除吗？')) return;
    try {
      await remove([record.id]);
      showMessage('删除成功');
    } catch (err: any) {
      showMessage(err.message || '删除失败', 'error');
    }
  };

  const columns: GridColDef[] = [
    { field: 'num', headerName: '序号', width: 80 },
    { field: 'title', headerName: '名称', width: 200 },
    { field: 'url', headerName: '来源地址', width: 250 },
    { field: 'updateTime', headerName: '最后更新时间', width: 180, valueFormatter: (value) => value ? new Date(value).toLocaleString() : '-' },
    {
      field: 'actions',
      headerName: '操作',
      width: 150,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="编辑">
            <IconButton size="small" onClick={() => handleEdit(params.row)}><EditIcon /></IconButton>
          </Tooltip>
          <Tooltip title="删除">
            <IconButton size="small" color="error" onClick={() => handleDelete(params.row)}><DeleteIcon /></IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">{detail?.title || '漫画'} - 章节管理</Typography>
        <Button onClick={handleClose}>关闭</Button>
      </Box>
      <DataGridTable
        columns={columns}
        fetchData={async (params) => {
          const res = await page({ ...params, comicsId: detail?.id });
          return { data: { records: res.data?.records || [], totalRow: res.data?.totalRow || 0 }, success: res.data?.success ?? true };
        }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        toolBarRender={() => (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleEdit({})}>新建</Button>
        )}
      />

      <Dialog open={writeVisible} onClose={() => setWriteVisible(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedRecord?.id ? '编辑章节' : '新建章节'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField label="序号" value={formValues.num} onChange={handleFormChange('num')} fullWidth type="number" />
            <TextField label="名称" value={formValues.title} onChange={handleFormChange('title')} fullWidth />
            <TextField label="来源地址" value={formValues.url} onChange={handleFormChange('url')} fullWidth />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWriteVisible(false)}>取消</Button>
          <Button variant="contained" onClick={handleSubmit}>提交</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
