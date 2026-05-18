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
import { page, remove, save, update } from '@/apis/wx-mp-user';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import type { GridColDef } from '@mui/x-data-grid';

export default function WxMpUserPage() {
  const [writeVisible, setWriteVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [formValues, setFormValues] = useState<any>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const SEX_MAP: Record<string, string> = { '0': '未知', '1': '男', '2': '女' };

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });

  const handleEdit = (record: any) => {
    setSelectedRecord(record);
    setFormValues({
      nickName: record?.nickName || '',
      remark: record?.remark || '',
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
    {
      field: 'headimgUrl',
      headerName: '头像',
      width: 80,
      renderCell: (params) => params.value ? <img src={params.value} alt="avatar" style={{ width: 40, height: 40, borderRadius: '50%' }} /> : null,
    },
    { field: 'nickName', headerName: '昵称', width: 150 },
    { field: 'subscribe', headerName: '是否订阅', width: 100 },
    { field: 'openId', headerName: 'OpenID', width: 200 },
    { field: 'subscribeScene', headerName: '关注渠道', width: 120 },
    { field: 'subscribeTime', headerName: '关注时间', width: 180, valueFormatter: (value) => value ? new Date(value).toLocaleString() : '-' },
    { field: 'sex', headerName: '性别', width: 60, renderCell: (params) => SEX_MAP[params.value] || params.value },
    { field: 'country', headerName: '国家', width: 100 },
    { field: 'province', headerName: '省份', width: 100 },
    { field: 'city', headerName: '城市', width: 100 },
    { field: 'tagidList', headerName: '标签', width: 100 },
    { field: 'remark', headerName: '备注', width: 150 },
    { field: 'qrSceneStr', headerName: '扫码场景', width: 150 },
    { field: 'subscribeNum', headerName: '关注次数', width: 100 },
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
      <Typography variant="h5" sx={{ mb: 2 }}>微信用户</Typography>
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
        <DialogTitle>{selectedRecord?.id ? '编辑用户' : '新建用户'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="昵称"
              value={formValues.nickName || ''}
              onChange={(e) => handleFormChange('nickName', e.target.value)}
              fullWidth
            />
            <TextField
              label="备注"
              value={formValues.remark || ''}
              onChange={(e) => handleFormChange('remark', e.target.value)}
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
