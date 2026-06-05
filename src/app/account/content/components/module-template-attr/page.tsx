'use client';

import React, { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
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
import { page, save, update, remove, ModuleTemplateAttrItem } from '@/apis/module-template-attr';
import AddIcon from '@mui/icons-material/Add';

const LIST_KEY = ['content', 'module-template-attr'];

interface Props {
  detail?: { id: number };
  handleClose?: () => void;
}

export default function ModuleTemplateAttrPage({ detail, handleClose }: Props) {
  const qc = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [record, setRecord] = useState<ModuleTemplateAttrItem | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });
  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  const handleModalVisible = useCallback((flag: boolean, rec?: ModuleTemplateAttrItem) => {
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

  const handleDelete = useCallback((row: ModuleTemplateAttrItem) => {
    deleteMutation.mutate([row.id]);
  }, [deleteMutation]);

  const handleEdit = useCallback((row: ModuleTemplateAttrItem) => {
    handleModalVisible(true, row);
  }, [handleModalVisible]);

  const handleAdd = (values: any) => {
    if (record?.id) {
      updateMutation.mutate({ ...record, ...values });
    } else {
      saveMutation.mutate({ ...values, templateId: detail?.id });
    }
  };

  const isSubmitting = saveMutation.isPending || updateMutation.isPending;

  const columns: GridColDef[] = [
    { field: 'name', headerName: '名称', width: 150 },
    { field: 'type', headerName: '类型', width: 120 },
    { field: 'code', headerName: '编码', width: 150 },
    { field: 'remark', headerName: '备注', width: 200 },
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
        <Typography variant="h6" sx={{ mb: 2 }}>模板属性管理</Typography>
        <DataGridTable
          columns={columns}
          fetchData={(params) => page({ ...params, templateId: detail?.id || 0 })}
          onEdit={handleEdit}
          onDelete={handleDelete}
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
      </CardContent>
    </Card>
  );
}

interface OperationModalProps {
  open: boolean;
  record: ModuleTemplateAttrItem | null;
  onClose: () => void;
  onSave: (values: any) => void;
  isSubmitting?: boolean;
}

function OperationModal({ open, record, onClose, onSave, isSubmitting }: OperationModalProps) {
  const [values, setValues] = useState({ name: '', type: '', code: '', remark: '' });

  React.useEffect(() => {
    if (record) {
      setValues({
        name: record.name || '',
        type: record.type || '',
        code: record.code || '',
        remark: record.remark || '',
      });
    } else {
      setValues({ name: '', type: '', code: '', remark: '' });
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
          <TextField label="名称" value={values.name} onChange={handleChange('name')} fullWidth required />
          <TextField label="类型" value={values.type} onChange={handleChange('type')} fullWidth />
          <TextField label="编码" value={values.code} onChange={handleChange('code')} fullWidth />
          <TextField label="备注" value={values.remark} onChange={handleChange('remark')} fullWidth />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isSubmitting}>确认</Button>
      </DialogActions>
    </Dialog>
  );
}