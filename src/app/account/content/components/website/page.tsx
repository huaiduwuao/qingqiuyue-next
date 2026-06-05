'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { page, process, remove, save, update } from '@/apis/content-website';
import { useApp } from '@/contexts/AppContext';
import { useAuthority } from '@/contexts/AuthContext';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ShareIcon from '@mui/icons-material/Share';
import type { GridColDef } from '@mui/x-data-grid';

const STATUS_MAP: Record<string, string> = { DRAFT: '草稿', WAITING: '待审核', SUCCESS: '审核通过', FAIL: '驳回' };
const LIST_KEY = ['content', 'website'];

export default function WebsiteContentPage() {
  const qc = useQueryClient();
  const { currentUser } = useApp();
  const { hasAuthority } = useAuthority();
  const [writeVisible, setWriteVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [formValues, setFormValues] = useState({ title: '', subtitle: '', cover: '', info: '' });
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });
  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  const handleEdit = (record: any) => {
    setSelectedRecord(record);
    setFormValues({ title: record?.title || '', subtitle: record?.subtitle || '', cover: record?.cover || '', info: record?.info || '' });
    setWriteVisible(true);
  };

  const handleFormChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => remove(ids),
    onSuccess: () => { showMessage('删除成功'); invalidate(); },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });

  const saveMutation = useMutation({
    mutationFn: (vals: any) => save(vals),
    onSuccess: () => { showMessage('创建成功'); setWriteVisible(false); invalidate(); },
    onError: (err: any) => showMessage(err.message || '创建失败', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (vals: any) => update(vals),
    onSuccess: () => { showMessage('更新成功'); setWriteVisible(false); invalidate(); },
    onError: (err: any) => showMessage(err.message || '更新失败', 'error'),
  });

  const handleDelete = (record: any) => {
    if (!confirm('确定删除吗？')) return;
    deleteMutation.mutate([record.id]);
  };

  const handleSubmit = () => {
    if (selectedRecord?.id) {
      updateMutation.mutate({ ...selectedRecord, ...formValues });
    } else {
      saveMutation.mutate(formValues);
    }
  };

  const handleStatusChange = async (record: any, status: string | null, moduleContentStatus: string | null) => {
    try {
      await process({ ids: [record.id], status, moduleContentStatus });
      showMessage('操作成功');
    } catch (err: any) {
      showMessage(err.message || '操作失败', 'error');
    }
  };

  const handleShare = (record: any) => {
    const url = `${window.location.origin}/share/module-content-detail?id=${record.moduleContentId}`;
    navigator.clipboard.writeText(url);
    showMessage('链接已复制');
  };

  const isSubmitting = saveMutation.isPending || updateMutation.isPending;

  const getActions = (record: any) => {
    const actions: React.ReactNode[] = [];

    switch (record.status) {
      case 'DRAFT':
        if (currentUser?.id === record.createUser) {
          actions.push(<Tooltip title="编辑" key="edit"><IconButton size="small" onClick={() => handleEdit(record)}><EditIcon /></IconButton></Tooltip>);
          actions.push(<Tooltip title="删除" key="delete"><IconButton size="small" color="error" onClick={() => handleDelete(record)}><DeleteIcon /></IconButton></Tooltip>);
          actions.push(<Button size="small" key="submit" onClick={() => handleStatusChange(record, 'WAITING', null)}>提交审核</Button>);
        }
        break;
      case 'WAITING':
        if (currentUser?.id === record.createUser) {
          actions.push(<Button size="small" key="recall" onClick={() => handleStatusChange(record, 'DRAFT', null)}>撤回</Button>);
        }
        if (hasAuthority('ADMIN')) {
          actions.push(<Button size="small" key="approve" onClick={() => handleStatusChange(record, 'SUCCESS', null)}>审核通过</Button>);
          actions.push(<Button size="small" color="error" key="reject" onClick={() => handleStatusChange(record, 'FAIL', null)}>驳回</Button>);
        }
        break;
      case 'SUCCESS':
        if (currentUser?.id === record.createUser) {
          actions.push(<Button size="small" key="reedit" onClick={() => handleEdit(record)}>重新编辑</Button>);
          actions.push(<Button size="small" key="publish" onClick={() => handleStatusChange(record, null, 'PUBLISH')}>发布</Button>);
        }
        break;
      case 'FAIL':
        if (currentUser?.id === record.createUser) {
          actions.push(<Button size="small" key="reedit" onClick={() => handleEdit(record)}>重新编辑</Button>);
          actions.push(<Tooltip title="删除" key="delete"><IconButton size="small" color="error" onClick={() => handleDelete(record)}><DeleteIcon /></IconButton></Tooltip>);
          actions.push(<Button size="small" key="submit" onClick={() => handleStatusChange(record, 'WAITING', null)}>提交审核</Button>);
        }
        break;
    }

    if (record.moduleContentStatus === 'PUBLISH') {
      actions.push(<Button size="small" key="unpublish" onClick={() => handleStatusChange(record, null, 'UN_PUBLISH')}>下架</Button>);
      actions.push(<Tooltip title="分享" key="share"><IconButton size="small" onClick={() => handleShare(record)}><ShareIcon /></IconButton></Tooltip>);
    } else if (record.moduleContentStatus === 'UN_PUBLISH') {
      actions.push(<Button size="small" key="publish" onClick={() => handleStatusChange(record, null, 'PUBLISH')}>上架</Button>);
      actions.push(<Tooltip title="分享" key="share"><IconButton size="small" onClick={() => handleShare(record)}><ShareIcon /></IconButton></Tooltip>);
    }

    return actions;
  };

  const columns: GridColDef[] = [
    {
      field: 'status',
      headerName: '状态',
      width: 100,
      renderCell: (params) => STATUS_MAP[params.value] || params.value,
    },
    {
      field: 'moduleContentStatus',
      headerName: '正式版',
      width: 120,
      renderCell: (params) => {
        if (params.value === 'PUBLISH') return <Typography color="success">已上架</Typography>;
        if (params.value === 'UN_PUBLISH') return <Typography color="warning">已下架</Typography>;
        return '未发布';
      },
    },
    { field: 'title', headerName: '标题', width: 150 },
    { field: 'subtitle', headerName: '副标题', width: 150 },
    { field: 'cover', headerName: '封面', width: 100, renderCell: (params) => params.value ? <img src={params.value} alt="cover" style={{ width: 80, height: 80, objectFit: 'cover' }} /> : null },
    { field: 'info', headerName: '简介', width: 300, renderCell: (params) => <Typography noWrap sx={{ maxWidth: 280 }}>{params.value}</Typography> },
    { field: 'updateTime', headerName: '更新时间', width: 180, valueFormatter: (value) => value ? new Date(value).toLocaleString() : '-' },
    {
      field: 'actions',
      headerName: '操作',
      width: 300,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>{getActions(params.row)}</Box>,
    },
  ];

  return (
    <Box sx={{ height: "100%", overflow: "hidden" }}>
      <Typography variant="h5" sx={{ mb: 2 }}>网站管理</Typography>
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
        <DialogTitle>{selectedRecord?.id ? '编辑网站' : '新建网站'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField label="标题" value={formValues.title} onChange={handleFormChange('title')} fullWidth />
            <TextField label="副标题" value={formValues.subtitle} onChange={handleFormChange('subtitle')} fullWidth />
            <TextField label="封面" value={formValues.cover} onChange={handleFormChange('cover')} fullWidth />
            <TextField label="简介" value={formValues.info} onChange={handleFormChange('info')} fullWidth multiline rows={3} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWriteVisible(false)}>取消</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={isSubmitting}>提交</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
