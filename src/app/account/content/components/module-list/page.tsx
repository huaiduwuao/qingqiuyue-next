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
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { GridColDef } from '@mui/x-data-grid';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { myPage, save, update, remove, ModuleItem } from '@/apis/module-list';
import AddIcon from '@mui/icons-material/Add';

const LIST_KEY = ['content', 'module-list'];

interface Props {
  groupId?: number;
  groupData?: any[];
}

export default function ModuleListPage({ groupId, groupData }: Props) {
  const qc = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [record, setRecord] = useState<ModuleItem | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });
  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  const handleModalVisible = useCallback((flag: boolean, rec?: ModuleItem) => {
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

  const handleDelete = useCallback((row: ModuleItem) => {
    deleteMutation.mutate([row.id]);
  }, [deleteMutation]);

  const handleEdit = useCallback((row: ModuleItem) => {
    handleModalVisible(true, row);
  }, [handleModalVisible]);

  const handleAdd = (values: any) => {
    if (record?.id) {
      updateMutation.mutate({ ...record, ...values });
    } else {
      saveMutation.mutate({ ...values, groupId });
    }
  };

  const isSubmitting = saveMutation.isPending || updateMutation.isPending;

  const columns: GridColDef[] = [
    { field: 'title', headerName: '标题', width: 200 },
    { field: 'subtitle', headerName: '副标题', width: 150 },
    { field: 'icon', headerName: '图标', width: 100 },
    { field: 'templateCode', headerName: '模板code', width: 120 },
    { field: 'type', headerName: '类型', width: 100 },
    { field: 'sort', headerName: '排序', width: 80 },
    {
      field: 'updateTime',
      headerName: '最后更新时间',
      width: 180,
      valueGetter: (value) => value ? new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-',
    },
  ];

  const toolBarRender = () => (
    <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleModalVisible(true)}>
      新建
    </Button>
  );

  return (
    <Box sx={{ height: "100%", overflow: "hidden" }}>
      <Typography variant="h6" sx={{ mb: 2 }}>列表管理</Typography>
      <DataGridTable
        columns={columns}
        fetchData={(params) => myPage({ ...params, groupId })}
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
  record: ModuleItem | null;
  onClose: () => void;
  onSave: (values: any) => void;
  isSubmitting?: boolean;
}

function OperationModal({ open, record, onClose, onSave, isSubmitting }: OperationModalProps) {
  const [values, setValues] = useState({
    title: '',
    subtitle: '',
    icon: '',
    templateCode: '',
    type: '',
    sort: 0,
  });

  React.useEffect(() => {
    if (record) {
      setValues({
        title: record.title || '',
        subtitle: record.subtitle || '',
        icon: record.icon || '',
        templateCode: record.templateCode || '',
        type: record.type || '',
        sort: record.sort || 0,
      });
    } else {
      setValues({ title: '', subtitle: '', icon: '', templateCode: '', type: '', sort: 0 });
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
      <DialogTitle>{record ? '编辑' : '新建'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="标题" value={values.title} onChange={handleChange('title')} fullWidth required />
          <TextField label="副标题" value={values.subtitle} onChange={handleChange('subtitle')} fullWidth />
          <TextField label="图标" value={values.icon} onChange={handleChange('icon')} fullWidth />
          <TextField label="模板code" value={values.templateCode} onChange={handleChange('templateCode')} fullWidth />
          <TextField label="类型" value={values.type} onChange={handleChange('type')} fullWidth />
          <TextField label="排序" type="number" value={values.sort} onChange={handleChange('sort')} fullWidth />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isSubmitting}>确认</Button>
      </DialogActions>
    </Dialog>
  );
}