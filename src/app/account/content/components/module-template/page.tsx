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
import { list, itemList, saveOrUpdate, remove, ModuleTemplateItem } from '@/apis/module-template';
import { page as pageAttr, save as saveAttr, update as updateAttr, remove as removeAttr, ModuleTemplateAttrItem } from '@/apis/module-template-attr';
import AddIcon from '@mui/icons-material/Add';

const LIST_KEY = ['content', 'module-template'];

interface Props {
  detail?: ModuleTemplateItem;
  handleClose?: () => void;
}

export default function ModuleTemplatePage({ detail, handleClose }: Props) {
  const qc = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [record, setRecord] = useState<ModuleTemplateItem | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });
  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  const handleModalVisible = useCallback((flag: boolean, rec?: ModuleTemplateItem) => {
    setModalVisible(flag);
    setRecord(rec || null);
  }, []);

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => remove(ids),
    onSuccess: () => { showMessage('删除成功'); invalidate(); },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });

  const saveMutation = useMutation({
    mutationFn: (vals: any) => saveOrUpdate(vals),
    onSuccess: () => { showMessage('创建成功'); setModalVisible(false); invalidate(); },
    onError: (err: any) => showMessage(err.message || '创建失败', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (vals: any) => saveOrUpdate(vals),
    onSuccess: () => { showMessage('更新成功'); setModalVisible(false); invalidate(); },
    onError: (err: any) => showMessage(err.message || '更新失败', 'error'),
  });

  const handleDelete = useCallback((row: ModuleTemplateItem) => {
    deleteMutation.mutate([row.id]);
  }, [deleteMutation]);

  const handleEdit = useCallback((row: ModuleTemplateItem) => {
    handleModalVisible(true, row);
  }, [handleModalVisible]);

  const handleAdd = (values: any) => {
    if (record?.id) {
      updateMutation.mutate({ ...record, ...values });
    } else {
      saveMutation.mutate({ ...values, sourceId: detail?.id });
    }
  };

  const isSubmitting = saveMutation.isPending || updateMutation.isPending;

  const columns: GridColDef[] = [
    { field: 'type', headerName: '类型', width: 120 },
    { field: 'category', headerName: '分类', width: 120 },
    {
      field: 'actions',
      headerName: '操作',
      width: 200,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button size="small" variant="text" onClick={() => handleEdit(params.row)}>编辑</Button>
          <Button size="small" variant="text" color="error" onClick={() => handleDelete(params.row)}>删除</Button>
        </Box>
      ),
    },
  ];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2 }}>模板管理</Typography>
        <DataGridTable
          columns={columns}
          fetchData={async (params) => {
            const res: any = await list({ ...params, sourceId: detail?.id });
            return {
              data: {
                records: res.data || [],
                totalRow: res.data?.length || 0,
              },
              success: res.code === 200,
            };
          }}
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
  record: ModuleTemplateItem | null;
  onClose: () => void;
  onSave: (values: any) => void;
  isSubmitting?: boolean;
}

function OperationModal({ open, record, onClose, onSave, isSubmitting }: OperationModalProps) {
  const [values, setValues] = useState({ type: '', category: '' });

  React.useEffect(() => {
    if (record) {
      setValues({ type: record.type || '', category: record.category || '' });
    } else {
      setValues({ type: '', category: '' });
    }
  }, [record]);

  const handleChange = (field: string) => (e: any) => {
    setValues({ ...values, [field]: e.target.value });
  };

  const handleSubmit = () => {
    onSave(values);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{record ? '编辑' : '新建'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="类型" value={values.type} onChange={handleChange('type')} fullWidth />
          <TextField label="分类" value={values.category} onChange={handleChange('category')} fullWidth />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isSubmitting}>确认</Button>
      </DialogActions>
    </Dialog>
  );
}