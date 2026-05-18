'use client';

import React, { useState, useRef } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { page, remove, save, update } from '@/apis/system-user';
import type { UserItem } from '@/beans/system';
import type { GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

const columns: GridColDef<UserItem>[] = [
  { field: 'name', headerName: '账户名', width: 150 },
  { field: 'nickname', headerName: '昵称', width: 150 },
  { field: 'roles', headerName: '角色数', width: 100 },
  { field: 'info', headerName: '简介', width: 200 },
  { field: 'mobile', headerName: '手机号', width: 130 },
  { field: 'email', headerName: '邮箱', width: 180 },
  { field: 'address', headerName: '地址', width: 200 },
  { field: 'signature', headerName: '签名', width: 200 },
  {
    field: 'updateTime',
    headerName: '最后更新时间',
    width: 180,
    valueFormatter: (value) => value ? new Date(value).toLocaleString() : '-',
  },
];

export default function SystemUserPage() {
  const [modalVisible, setModalVisible] = useState(false);
  const [record, setRecord] = useState<UserItem | null>(null);
  const [deleteIds, setDeleteIds] = useState<number[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const actionRef = useRef<{ reload: () => void } | null>(null);

  const handleAdd = () => {
    setRecord(null);
    setModalVisible(true);
  };

  const handleEdit = (row: UserItem) => {
    setRecord(row);
    setModalVisible(true);
  };

  const handleDelete = async (row: UserItem) => {
    if (!confirm('确定删除吗？')) return;
    if (row.id == null) return;
    try {
      await remove([row.id as number]);
      setSnackbar({ open: true, message: '删除成功', severity: 'success' });
      actionRef.current?.reload();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message || '删除失败', severity: 'error' });
    }
  };

  const handleBulkDelete = async () => {
    if (deleteIds.length === 0) return;
    if (!confirm(`确定删除选中的 ${deleteIds.length} 项吗？`)) return;
    try {
      await remove(deleteIds);
      setSnackbar({ open: true, message: '删除成功', severity: 'success' });
      setDeleteIds([]);
      actionRef.current?.reload();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message || '删除失败', severity: 'error' });
    }
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setRecord(null);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (record?.id) {
        await update({ ...record, ...values });
      } else {
        await save(values);
      }
      setSnackbar({ open: true, message: '操作成功', severity: 'success' });
      handleModalClose();
      actionRef.current?.reload();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message || '操作失败', severity: 'error' });
    }
  };

  const handleSelectionChange = (rows: UserItem[]) => {
    setDeleteIds(rows.map((r) => r.id as number));
  };

  return (
    <Box sx={{ p: 3 }}>
      <DataGridTable
        title="用户管理"
        columns={columns}
        fetchData={async (params) => {
          const res = await page(params);
          return {
            data: {
              records: res.data?.data?.records || [],
              totalRow: res.data?.data?.totalRow || 0,
            },
            success: res.data?.success ?? true,
          };
        }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSelectionChange={handleSelectionChange}
        toolBarRender={() => (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
              新建
            </Button>
            {deleteIds.length > 0 && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleBulkDelete}
              >
                批量删除 ({deleteIds.length})
              </Button>
            )}
          </Box>
        )}
      />

      <OperationModal
        open={modalVisible}
        onClose={handleModalClose}
        onSubmit={handleSubmit}
        record={record}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

interface OperationModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: any) => Promise<void>;
  record: UserItem | null;
}

function OperationModal({ open, onClose, onSubmit, record }: OperationModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (record) {
      setValues({
        name: record.name || '',
        nickname: record.nickname || '',
        mobile: record.mobile || '',
        email: record.email || '',
        info: record.info || '',
      });
    } else {
      setValues({});
    }
  }, [record]);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
  };

  const handleSubmit = async () => {
    await onSubmit(values);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{record?.id ? '编辑' : '新增'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="账户名"
            value={values.name || ''}
            onChange={handleChange('name')}
            fullWidth
          />
          <TextField
            label="昵称"
            value={values.nickname || ''}
            onChange={handleChange('nickname')}
            fullWidth
          />
          <TextField
            label="手机号"
            value={values.mobile || ''}
            onChange={handleChange('mobile')}
            fullWidth
          />
          <TextField
            label="邮箱"
            value={values.email || ''}
            onChange={handleChange('email')}
            fullWidth
          />
          <TextField
            label="简介"
            value={values.info || ''}
            onChange={handleChange('info')}
            fullWidth
            multiline
            rows={3}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} variant="contained">
          提交
        </Button>
      </DialogActions>
    </Dialog>
  );
}
