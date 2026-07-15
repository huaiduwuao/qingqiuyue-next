'use client';

import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { page as getUsers, remove, save, update } from '@/apis/system-user';
import { page as getRoles } from '@/apis/system-role';
import type { UserItem } from '@/beans/system';
import type { GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

const LIST_KEY = ['system', 'user'];

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
  const qc = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [record, setRecord] = useState<UserItem | null>(null);
  const [deleteIds, setDeleteIds] = useState<number[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const actionRef = useRef<{ reload: () => void } | null>(null);

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnackbar({ open: true, message, severity });

  const reload = () => {
    qc.invalidateQueries({ queryKey: LIST_KEY });
    actionRef.current?.reload();
  };

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => remove(ids),
    onSuccess: () => { showMessage('删除成功'); reload(); },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });

  const saveMutation = useMutation({
    mutationFn: (vals: any) => save(vals),
    onSuccess: () => { showMessage('操作成功'); handleModalClose(); reload(); },
    onError: (err: any) => showMessage(err.message || '操作失败', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (vals: any) => update(vals),
    onSuccess: () => { showMessage('操作成功'); handleModalClose(); reload(); },
    onError: (err: any) => showMessage(err.message || '操作失败', 'error'),
  });

  const isSubmitting = saveMutation.isPending || updateMutation.isPending;

  const handleAdd = () => {
    setRecord(null);
    setModalVisible(true);
  };

  const handleEdit = (row: UserItem) => {
    setRecord(row);
    setModalVisible(true);
  };

  const handleDelete = (row: UserItem) => {
    if (!confirm('确定删除吗？')) return;
    if (row.id == null) return;
    deleteMutation.mutate([row.id as number]);
  };

  const handleBulkDelete = () => {
    if (deleteIds.length === 0) return;
    if (!confirm(`确定删除选中的 ${deleteIds.length} 项吗？`)) return;
    deleteMutation.mutate(deleteIds, {
      onSuccess: () => setDeleteIds([]),
    });
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setRecord(null);
  };

  const handleSubmit = (values: any) => {
    if (record?.id) {
      updateMutation.mutate({ ...record, ...values });
    } else {
      saveMutation.mutate(values);
    }
  };

  const handleSelectionChange = (rows: UserItem[]) => {
    setDeleteIds(rows.map((r) => r.id as number));
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      <DataGridTable
        title="用户管理"
        columns={columns}
        fetchData={async (params) => {
          const res = await getUsers(params);
          return {
            data: {
              records: res.data?.list || [],
              totalRow: res.data?.total || 0,
            },
            success: res.data?.success ?? true,
          };
        }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSelectionChange={handleSelectionChange}
        filters={{
          fields: [
            { key: 'name', label: '名称', type: 'text' },
            { key: 'status', label: '状态', type: 'select', options: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] },
          ],
          values: filterValues,
          onChange: setFilterValues,
          onReset: () => setFilterValues({}),
        }}
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
        isSubmitting={isSubmitting}
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
  onSubmit: (values: any) => void;
  record: UserItem | null;
  isSubmitting?: boolean;
}

function OperationModal({ open, onClose, onSubmit, record, isSubmitting }: OperationModalProps) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);

  // 获取角色列表
  const { data: rolesData } = useQuery({
    queryKey: ['system', 'role', 'all'],
    queryFn: () => getRoles({ pageNumber: 1, pageSize: 100 }),
    enabled: open,
  });

  React.useEffect(() => {
    if (record) {
      setValues({
        name: record.name || '',
        nickname: record.nickname || '',
        mobile: record.mobile || '',
        email: record.email || '',
        info: record.info || '',
      });
      // 如果记录有 roles 字段，解析角色ID
      if (record.roles && typeof record.roles === 'string') {
        // 假设 roles 格式为 "1,2,3" 或类似格式
        setSelectedRoles(record.roles.split(',').map(Number).filter(Boolean));
      } else if (Array.isArray(record.roles)) {
        setSelectedRoles(record.roles);
      }
    } else {
      setValues({});
      setSelectedRoles([]);
    }
  }, [record]);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
  };

  const handleRoleChange = (event: any) => {
    const value = event.target.value as number[];
    setSelectedRoles(typeof value === 'number' ? [value] : value);
  };

  const handleSubmit = () => {
    onSubmit({ ...values, roleIds: selectedRoles });
  };

  const roles = rolesData?.data?.records || rolesData?.data?.list || [];

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
          <FormControl fullWidth>
            <InputLabel id="roles-select-label">角色</InputLabel>
            <Select
              labelId="roles-select-label"
              multiple
              value={selectedRoles}
              onChange={handleRoleChange}
              input={<OutlinedInput label="角色" />}
              renderValue={(selected) =>
                (selected as number[])
                  .map((id) => roles.find((r: any) => r.id === id)?.name || id)
                  .join(', ')
              }
            >
              {roles.map((role: any) => (
                <MenuItem key={role.id} value={role.id}>
                  <Checkbox checked={selectedRoles.includes(role.id)} />
                  <ListItemText primary={role.name} secondary={role.code} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isSubmitting}>
          提交
        </Button>
      </DialogActions>
    </Dialog>
  );
}
