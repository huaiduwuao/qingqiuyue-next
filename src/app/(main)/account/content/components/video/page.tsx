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
import { page, process, remove, save, update } from '@/apis/content-video';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ShareIcon from '@mui/icons-material/Share';
import type { GridColDef } from '@mui/x-data-grid';

const STATUS_MAP: Record<string, string> = { DRAFT: '草稿', WAITING: '待审核', SUCCESS: '审核通过', FAIL: '驳回' };

export default function VideoContentPage() {
  const [writeVisible, setWriteVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [formValues, setFormValues] = useState({ title: '', info: '' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });

  const handleEdit = (record: any) => {
    setSelectedRecord(record);
    setFormValues({ title: record?.title || '', info: record?.info || '' });
    setWriteVisible(true);
  };

  const handleFormChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async () => {
    try {
      if (selectedRecord?.id) {
        await update('video', { ...selectedRecord, ...formValues });
      } else {
        await save('video', { ...formValues, status: 'DRAFT' });
      }
      setWriteVisible(false);
      showMessage(selectedRecord?.id ? '更新成功' : '创建成功');
    } catch (err: any) { showMessage(err.message || '操作失败', 'error'); }
  };

  const handleDelete = async (record: any) => {
    if (!confirm('确定删除吗？')) return;
    try { await remove('video', [record.id]); showMessage('删除成功'); } catch (err: any) { showMessage(err.message || '删除失败', 'error'); }
  };

  const handleStatusChange = async (record: any, status: string | null, moduleContentStatus: string | null) => {
    try { await process('video', { ids: [record.id], status, moduleContentStatus }); showMessage('操作成功'); } catch (err: any) { showMessage(err.message || '操作失败', 'error'); }
  };

  const columns: GridColDef[] = [
    { field: 'status', headerName: '状态', width: 100, renderCell: (params) => STATUS_MAP[params.value] || params.value },
    { field: 'moduleContentStatus', headerName: '正式版', width: 120, renderCell: (params) => params.value === 'PUBLISH' ? <Typography color="success">已上架</Typography> : params.value === 'UN_PUBLISH' ? <Typography color="warning">已下架</Typography> : '未发布' },
    { field: 'title', headerName: '标题', width: 150 },
    { field: 'info', headerName: '简介', width: 300, renderCell: (params) => <Typography noWrap sx={{ maxWidth: 280 }}>{params.value}</Typography> },
    { field: 'updateTime', headerName: '更新时间', width: 180, valueFormatter: (value) => value ? new Date(value).toLocaleString() : '-' },
    { field: 'actions', headerName: '操作', width: 200, sortable: false, disableColumnMenu: true, renderCell: (params) => (
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Tooltip title="编辑"><IconButton size="small" onClick={() => handleEdit(params.row)}><EditIcon /></IconButton></Tooltip>
        <Tooltip title="删除"><IconButton size="small" color="error" onClick={() => handleDelete(params.row)}><DeleteIcon /></IconButton></Tooltip>
      </Box>
    )},
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>视频管理</Typography>
      <DataGridTable columns={columns} fetchData={async (params) => { const res = await page('video', { ...params }); return { data: { records: res.data?.list || [], totalRow: res.data?.total || 0 }, success: res.code === 0 }; }} onEdit={handleEdit} onDelete={handleDelete} toolBarRender={() => <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleEdit({})}>新建</Button>} />
      <Dialog open={writeVisible} onClose={() => setWriteVisible(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedRecord?.id ? '编辑视频' : '新建视频'}</DialogTitle>
        <DialogContent><Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="标题" value={formValues.title} onChange={handleFormChange('title')} fullWidth />
          <TextField label="简介" value={formValues.info} onChange={handleFormChange('info')} fullWidth multiline rows={3} />
        </Box></DialogContent>
        <DialogActions><Button onClick={() => setWriteVisible(false)}>取消</Button><Button variant="contained" onClick={handleSubmit}>提交</Button></DialogActions>
      </Dialog>
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}><Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert></Snackbar>
    </Box>
  );
}
