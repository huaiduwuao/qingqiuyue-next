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
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { GridColDef } from '@mui/x-data-grid';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { myPage, save, update, remove, sync, addItem, ModuleContentToplist } from '@/apis/module-content-toplist';
import { page as pageToplistItem, save as saveToplistItem, remove as removeToplistItem } from '@/apis/module-content-toplist-item';
import AddIcon from '@mui/icons-material/Add';
import DetailIcon from '@mui/icons-material/Details';

const LIST_KEY = ['content', 'module-content-toplist'];

interface Props {
  groupId?: number;
  groupData?: any[];
}

export default function ModuleContentToplistPage({ groupId, groupData }: Props) {
  const qc = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [syncVisible, setSyncVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [record, setRecord] = useState<ModuleContentToplist | null>(null);
  const [syncList, setSyncList] = useState<string[]>([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });
  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  const handleModalVisible = useCallback((flag: boolean, rec?: ModuleContentToplist) => {
    setModalVisible(flag);
    setRecord(rec || null);
  }, []);

  const handleSync = useCallback(async (row: ModuleContentToplist) => {
    const res = await sync({ id: row.id, type: row.type });
    setSyncList(res.data || []);
    setRecord(row);
    setSyncVisible(true);
  }, []);

  const handleDetail = useCallback((row: ModuleContentToplist) => {
    setRecord(row);
    setDetailVisible(true);
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

  const addItemMutation = useMutation({
    mutationFn: (payload: { topListId: number; contentType: string; title: string }) => addItem(payload),
    onSuccess: () => { showMessage('操作成功'); invalidate(); },
    onError: (err: any) => showMessage(err.message || '操作失败', 'error'),
  });

  const handleDelete = useCallback((row: ModuleContentToplist) => {
    deleteMutation.mutate([row.id]);
  }, [deleteMutation]);

  const handleEdit = useCallback((row: ModuleContentToplist) => {
    handleModalVisible(true, row);
  }, [handleModalVisible]);

  const handleAdd = (values: any) => {
    if (record?.id) {
      updateMutation.mutate({ ...record, ...values });
    } else {
      saveMutation.mutate({ ...values, groupId });
    }
  };

  const handleAddItem = (item: string) => {
    if (record) {
      addItemMutation.mutate(
        { topListId: record.id, contentType: record.type, title: item },
        {
          onSuccess: () => {
            setSyncList(syncList.filter(i => i !== item));
          },
        },
      );
    }
  };

  const isSubmitting = saveMutation.isPending || updateMutation.isPending || addItemMutation.isPending;

  const columns: GridColDef[] = [
    { field: 'title', headerName: '标题', width: 200 },
    { field: 'subtitle', headerName: '副标题', width: 150 },
    { field: 'type', headerName: '类型', width: 100 },
    {
      field: 'updateTime',
      headerName: '最后更新时间',
      width: 180,
      valueGetter: (value) => value ? new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-',
    },
    {
      field: 'actions',
      headerName: '操作',
      width: 250,
      sortable: false,
      renderCell: (params) => {
        const row = params.row as ModuleContentToplist;
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button size="small" variant="text" onClick={() => handleEdit(row)}>编辑</Button>
            <Button size="small" variant="text" color="error" onClick={() => handleDelete(row)}>删除</Button>
            <Button size="small" variant="text" startIcon={<DetailIcon />} onClick={() => handleDetail(row)}>详情</Button>
            <Button size="small" variant="text" onClick={() => handleSync(row)}>同步</Button>
          </Box>
        );
      },
    },
  ];

  const toolBarRender = () => (
    <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleModalVisible(true)}>
      新建
    </Button>
  );

  return (
    <Box sx={{ height: "100%", overflow: "hidden" }}>
      <Typography variant="h6" sx={{ mb: 2 }}>内容榜单</Typography>
      <DataGridTable
        columns={columns}
        fetchData={(params) => myPage({ ...params, groupId })}
        onEdit={handleEdit}
        onDelete={handleDelete}
        toolBarRender={toolBarRender}
      />

      <Dialog open={modalVisible} onClose={() => setModalVisible(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{record?.id ? '编辑' : '新建'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="标题" value={record?.title || ''} onChange={(e) => setRecord({ ...record!, title: e.target.value })} fullWidth />
            <TextField label="副标题" value={record?.subtitle || ''} onChange={(e) => setRecord({ ...record!, subtitle: e.target.value })} fullWidth />
            <TextField label="类型" value={record?.type || ''} onChange={(e) => setRecord({ ...record!, type: e.target.value })} fullWidth />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalVisible(false)}>取消</Button>
          <Button onClick={() => handleAdd({})} variant="contained">确认</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={syncVisible} onClose={() => setSyncVisible(false)} maxWidth="sm" fullWidth>
        <DialogTitle>可同步</DialogTitle>
        <DialogContent>
          <List>
            {syncList.map((item, idx) => (
              <ListItem key={idx} secondaryAction={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" variant="outlined" onClick={() => handleAddItem(item)}>入榜</Button>
                </Box>
              }>
                <ListItemText primary={item} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
      </Dialog>

      <Dialog open={detailVisible} onClose={() => setDetailVisible(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{record?.title} - 详情</DialogTitle>
        <DialogContent>
          <ModuleContentToplistItemDetail toplistId={record?.id || 0} type={record?.type || ''} />
        </DialogContent>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function ModuleContentToplistItemDetail({ toplistId, type }: { toplistId: number; type: string }) {
  const [suggestList, setSuggestList] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const columns: GridColDef[] = [
    { field: 'title', headerName: '标题', width: 300 },
    { field: 'subtitle', headerName: '副标题', width: 200 },
    {
      field: 'updateTime',
      headerName: '最后更新时间',
      width: 180,
      valueGetter: (value) => value ? new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-',
    },
    {
      field: 'actions',
      headerName: '操作',
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <Button size="small" variant="text" color="error" onClick={() => removeToplistItem([params.row.id]).then(() => setSnackbar({ open: true, message: '删除成功', severity: 'success' }))}>删除</Button>
      ),
    },
  ];

  const handleAdd = async () => {
    if (selectedId) {
      await saveToplistItem({ moduleContentId: parseInt(selectedId), toplistId });
      setSnackbar({ open: true, message: '操作成功', severity: 'success' });
      setSelectedId('');
    }
  };

  return (
    <Box sx={{ height: "100%", overflow: "hidden" }}>
      <Box sx={{ mb: 2 }}>
        <TextField
          sx={{ width: 300 }}
          placeholder="搜索内容"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        />
        <Button variant="contained" sx={{ ml: 1 }} onClick={handleAdd}>添加</Button>
      </Box>
      <DataGridTable
        columns={columns}
        fetchData={(params) => pageToplistItem({ ...params, toplistId })}
        onDelete={(row) => removeToplistItem([row.id]).then(() => setSnackbar({ open: true, message: '删除成功', severity: 'success' }))}
      />
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}