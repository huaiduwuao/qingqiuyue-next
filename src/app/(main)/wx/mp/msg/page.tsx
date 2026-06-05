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
import { page, remove, save, update } from '@/apis/wx-mp-msg';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import type { GridColDef } from '@mui/x-data-grid';

export default function WxMpMsgPage() {
  const [writeVisible, setWriteVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [formValues, setFormValues] = useState<any>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });

  const handleEdit = (record: any) => {
    setSelectedRecord(record);
    setFormValues({
      repType: record?.repType || '',
      wxUserId: record?.wxUserId || '',
      repEvent: record?.repEvent || '',
    });
    setWriteVisible(true);
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

  const handleSubmit = async () => {
    try {
      if (selectedRecord?.id) {
        await update({ ...formValues, id: selectedRecord.id });
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

  const handleFormChange = (field: string, value: any) => {
    setFormValues((prev: any) => ({ ...prev, [field]: value }));
  };

  const columns: GridColDef[] = [
    { field: 'repType', headerName: '消息类型', width: 120 },
    { field: 'wxUserId', headerName: '用户', width: 150 },
    { field: 'repEvent', headerName: '类型', width: 100 },
    { field: 'createTime', headerName: '时间', width: 180 },
    { field: 'readFlag', headerName: '是否已读', width: 100, renderCell: (params) => params.value ? '已读' : '未读' },
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
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Typography variant="h5" sx={{ mb: 2 }}>微信消息</Typography>
      <DataGridTable
        columns={columns}
        fetchData={async (params) => {
          const res = await page({ ...params, pageNumber: params.pageNumber });
          return { data: { records: res.data?.records || [], totalRow: res.data?.totalRow || 0 }, success: res.data?.success ?? true };
        }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        toolBarRender={() => (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleEdit({})}>新建</Button>
        )}
      />

      <Dialog open={writeVisible} onClose={() => setWriteVisible(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedRecord?.id ? '编辑消息' : '新建消息'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="消息类型"
              value={formValues.repType || ''}
              onChange={(e) => handleFormChange('repType', e.target.value)}
              fullWidth
            />
            <TextField
              label="用户"
              value={formValues.wxUserId || ''}
              onChange={(e) => handleFormChange('wxUserId', e.target.value)}
              fullWidth
            />
            <TextField
              label="类型"
              value={formValues.repEvent || ''}
              onChange={(e) => handleFormChange('repEvent', e.target.value)}
              fullWidth
            />
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
