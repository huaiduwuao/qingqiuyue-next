'use client';

import React, { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { GridColDef } from '@mui/x-data-grid';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { page, save, update, remove } from '@/apis/module-banner';
import type { ModuleBannerItem } from '@/apis/module-banner';
import AddIcon from '@mui/icons-material/Add';

const LIST_KEY = ['content', 'module-banner'];

interface Props {
  moduleId?: number;
}

export default function ModuleBannerPage({ moduleId }: Props) {
  const qc = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [record, setRecord] = useState<ModuleBannerItem | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });
  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  const handleModalVisible = useCallback((flag: boolean, rec?: ModuleBannerItem) => {
    setModalVisible(flag);
    setRecord(rec || null);
  }, []);

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => remove(ids),
    onSuccess: () => { showMessage('删除成功'); invalidate(); },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });

  const saveMutation = useMutation({
    mutationFn: (vals: any) => save(vals),
    onSuccess: () => { showMessage('创建成功'); setModalVisible(false); invalidate(); },
    onError: (err: any) => showMessage(err.message || '创建失败', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (vals: any) => update(vals),
    onSuccess: () => { showMessage('更新成功'); setModalVisible(false); invalidate(); },
    onError: (err: any) => showMessage(err.message || '更新失败', 'error'),
  });

  const handleDelete = useCallback((row: ModuleBannerItem) => {
    deleteMutation.mutate([row.id]);
  }, [deleteMutation]);

  const handleEdit = useCallback((row: ModuleBannerItem) => {
    handleModalVisible(true, row);
  }, [handleModalVisible]);

  const handleAdd = (values: any) => {
    if (record?.id) {
      updateMutation.mutate({ ...record, ...values });
    } else {
      saveMutation.mutate({ ...values, moduleId });
    }
  };

  const isSubmitting = saveMutation.isPending || updateMutation.isPending;

  const columns: GridColDef[] = [
    { field: 'moduleName', headerName: '模块', width: 100 },
    { field: 'title', headerName: '标题', width: 150 },
    { field: 'subtitle', headerName: '副标题', width: 150 },
    {
      field: 'link',
      headerName: '内容链接',
      width: 150,
      renderCell: (params) => (
        <a href={params.value} target="_blank" rel="noopener noreferrer">跳转</a>
      ),
    },
    {
      field: 'url',
      headerName: '图片',
      width: 120,
      renderCell: (params) => (
        <img src={params.value} style={{ width: 80, height: 40, objectFit: 'cover' }} alt="" />
      ),
    },
    { field: 'sort', headerName: '排序', width: 80 },
    { field: 'updateTime', headerName: '最后更新时间', width: 180, valueGetter: (value) => value ? new Date(value).toLocaleString() : '-', },
  ];

  const toolBarRender = () => (
    <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleModalVisible(true)}>
      新建
    </Button>
  );

  return (
    <Box sx={{ height: "100%", overflow: "hidden" }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Banner管理</Typography>
      <DataGridTable
        columns={columns}
        fetchData={(params) => page({ ...params, moduleId })}
        onEdit={handleEdit}
        onDelete={handleDelete}
        toolBarRender={toolBarRender}
      />
      <OperationModal
        open={modalVisible}
        record={record}
        onClose={() => setModalVisible(false)}
        onSave={handleAdd}
        isSubmitting={isSubmitting}
      />
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

interface OperationModalProps {
  open: boolean;
  record: ModuleBannerItem | null;
  onClose: () => void;
  onSave: (values: any) => void;
  isSubmitting?: boolean;
}

function OperationModal({ open, record, onClose, onSave, isSubmitting }: OperationModalProps) {
  const [values, setValues] = useState({
    title: '',
    subtitle: '',
    link: '',
    url: '',
    type: 'online',
    sort: 0,
  });

  React.useEffect(() => {
    if (record) {
      setValues({
        title: record.title || '',
        subtitle: record.subtitle || '',
        link: record.link || '',
        url: record.url || '',
        type: (record as any).type || 'online',
        sort: record.sort || 0,
      });
    } else {
      setValues({ title: '', subtitle: '', link: '', url: '', type: 'online', sort: 0 });
    }
  }, [record]);

  const handleChange = (field: string) => (e: any) => {
    setValues({ ...values, [field]: e.target.value });
  };

  const handleSubmit = () => {
    onSave(values);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{record ? '编辑' : '新增'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="标题"
            value={values.title}
            onChange={handleChange('title')}
            fullWidth
            required
          />
          <TextField
            label="副标题"
            value={values.subtitle}
            onChange={handleChange('subtitle')}
            fullWidth
          />
          <TextField
            label="链接"
            value={values.link}
            onChange={handleChange('link')}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel>类型</InputLabel>
            <Select value={values.type} onChange={handleChange('type')} label="类型">
              <MenuItem value="online">在线</MenuItem>
              <MenuItem value="local">本地</MenuItem>
            </Select>
          </FormControl>
          {values.type === 'local' ? (
            <TextField
              label="封面URL"
              value={values.url}
              onChange={handleChange('url')}
              fullWidth
            />
          ) : (
            <TextField
              label="封面URL"
              value={values.url}
              onChange={handleChange('url')}
              fullWidth
              required
            />
          )}
          <TextField
            label="排序"
            type="number"
            value={values.sort}
            onChange={handleChange('sort')}
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isSubmitting}>确认</Button>
      </DialogActions>
    </Dialog>
  );
}