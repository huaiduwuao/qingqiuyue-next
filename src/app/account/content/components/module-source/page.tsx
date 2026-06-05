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
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { GridColDef } from '@mui/x-data-grid';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { page, saveOrUpdate, remove, ModuleSourceItem } from '@/apis/module-source';
import AddIcon from '@mui/icons-material/Add';

const LIST_KEY = ['content', 'module-source'];

interface Props {
  groupId?: number;
  groupData?: any[];
}

const CONTENT_TYPE_MAP: Record<string, string> = {
  NOVEL: '小说', VIDEO: '视频', MUSIC: '音乐', FILM: '电影',
  ARTICLE: '文章', ANIMATION: '动画', TELEPLAY: '电视剧', COMICS: '漫画', VSHOW: '综艺',
};

export default function ModuleSourcePage({ groupId, groupData }: Props) {
  const qc = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [record, setRecord] = useState<ModuleSourceItem | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });
  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  const handleModalVisible = useCallback((flag: boolean, rec?: ModuleSourceItem) => {
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

  const handleDelete = useCallback((row: ModuleSourceItem) => {
    deleteMutation.mutate([row.id]);
  }, [deleteMutation]);

  const handleEdit = useCallback((row: ModuleSourceItem) => {
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
    { field: 'name', headerName: '名称', width: 150 },
    { field: 'domain', headerName: '域名', width: 180 },
    {
      field: 'category',
      headerName: '分类',
      width: 200,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {((params.value as string[]) || []).map((cat, idx) => (
            <Chip key={idx} label={CONTENT_TYPE_MAP[cat] || cat} size="small" />
          ))}
        </Box>
      ),
    },
    {
      field: 'updateTime',
      headerName: '最后更新时间',
      width: 180,
      valueGetter: (value) => value ? new Date(value).toLocaleString('zh-CN') : '-',
    },
  ];

  const toolBarRender = () => (
    <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleModalVisible(true)}>
      新建
    </Button>
  );

  return (
    <Box sx={{ height: "100%", overflow: "hidden" }}>
      <Typography variant="h6" sx={{ mb: 2 }}>来源管理</Typography>
      <DataGridTable
        columns={columns}
        fetchData={(params) => page({ ...params, groupId })}
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
  record: ModuleSourceItem | null;
  onClose: () => void;
  onSave: (values: any) => void;
  isSubmitting?: boolean;
}

function OperationModal({ open, record, onClose, onSave, isSubmitting }: OperationModalProps) {
  const [values, setValues] = useState({
    name: '',
    domain: '',
    url: '',
    category: [] as string[],
  });

  React.useEffect(() => {
    if (record) {
      setValues({
        name: record.name || '',
        domain: record.domain || '',
        url: record.url || '',
        category: record.category || [],
      });
    } else {
      setValues({ name: '', domain: '', url: '', category: [] });
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
          <TextField label="域名" value={values.domain} onChange={handleChange('domain')} fullWidth required />
          <TextField label="URL" value={values.url} onChange={handleChange('url')} fullWidth />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isSubmitting}>确认</Button>
      </DialogActions>
    </Dialog>
  );
}