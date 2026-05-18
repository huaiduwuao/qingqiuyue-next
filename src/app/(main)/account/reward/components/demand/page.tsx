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
import { myPage, process, remove, save, update } from '@/apis/reward-demand';
import { useApp } from '@/contexts/AppContext';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import type { GridColDef } from '@mui/x-data-grid';
import type { DemandItem } from '@/beans/reward';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'WAITING', label: '待审核' },
  { value: 'SUCCESS', label: '审核通过' },
  { value: 'FAIL', label: '驳回' },
  { value: 'FINDING', label: '寻找方案中' },
  { value: 'CLOSED', label: '关闭' },
];

const STATUS_MAP: Record<string, string> = {
  DRAFT: '草稿',
  WAITING: '待审核',
  SUCCESS: '审核通过',
  FAIL: '驳回',
  FINDING: '寻找方案中',
  CLOSED: '关闭',
};

export default function DemandPage({ groupId, groupData }: { groupId: any; groupData: any }) {
  const { currentUser } = useApp();
  const [writeVisible, setWriteVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DemandItem | null>(null);
  const [formValues, setFormValues] = useState<any>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleEdit = (record: DemandItem) => {
    setSelectedRecord(record);
    setFormValues({
      title: record?.title || '',
      subtitle: record?.subtitle || '',
      pay: record?.pay || 0,
      content: record?.content || '',
    });
    setWriteVisible(true);
  };

  const handleFormChange = (field: string, value: any) => {
    setFormValues((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      if (selectedRecord?.id) {
        await update({ ...selectedRecord, ...formValues });
        showMessage('更新成功');
      } else {
        await save({ ...formValues, groupId, status: 'DRAFT' });
        showMessage('创建成功');
      }
      setWriteVisible(false);
    } catch (err: any) {
      showMessage(err.message || '操作失败', 'error');
    }
  };

  const handleDelete = async (record: DemandItem) => {
    if (!confirm('确定删除吗？')) return;
    try {
      await remove([record.id as number]);
      showMessage('删除成功');
    } catch (err: any) {
      showMessage(err.message || '删除失败', 'error');
    }
  };

  const handleStatusChange = async (record: DemandItem, status: string) => {
    try {
      await process({ id: record.id, status });
      showMessage('操作成功');
    } catch (err: any) {
      showMessage(err.message || '操作失败', 'error');
    }
  };

  const getActions = (record: DemandItem) => {
    const actions: React.ReactNode[] = [];

    switch (record.status) {
      case 'DRAFT':
        if (currentUser?.id === record.createUser) {
          actions.push(
            <Tooltip title="编辑" key="edit">
              <IconButton size="small" onClick={() => handleEdit(record)}><EditIcon /></IconButton>
            </Tooltip>
          );
          actions.push(
            <Tooltip title="删除" key="delete">
              <IconButton size="small" color="error" onClick={() => handleDelete(record)}><DeleteIcon /></IconButton>
            </Tooltip>
          );
          actions.push(
            <Button size="small" key="submit" onClick={() => handleStatusChange(record, 'WAITING')}>
              提交审核
            </Button>
          );
        }
        break;
      case 'WAITING':
        if (currentUser?.authorities?.includes('ADMIN')) {
          actions.push(
            <Button size="small" key="approve" onClick={() => handleStatusChange(record, 'SUCCESS')}>
              审核通过
            </Button>
          );
          actions.push(
            <Button size="small" color="error" key="reject" onClick={() => handleStatusChange(record, 'FAIL')}>
              驳回
            </Button>
          );
        }
        break;
      case 'SUCCESS':
        actions.push(
          <Button size="small" key="publish" onClick={() => handleStatusChange(record, 'FINDING')}>
            发布
          </Button>
        );
        break;
      case 'FINDING':
        actions.push(
          <Button size="small" key="close" onClick={() => handleStatusChange(record, 'CLOSED')}>
            关闭
          </Button>
        );
        break;
    }

    return actions;
  };

  const columns: GridColDef[] = [
    {
      field: 'status',
      headerName: '状态',
      width: 120,
      renderCell: (params) => (
        <Typography variant="body2">{STATUS_MAP[params.value] || params.value}</Typography>
      ),
    },
    { field: 'title', headerName: '标题', width: 150 },
    { field: 'subtitle', headerName: '副标题', width: 150 },
    {
      field: 'pay',
      headerName: '报酬',
      width: 100,
    },
    {
      field: 'updateTime',
      headerName: '更新时间',
      width: 180,
      valueFormatter: (value) => value ? new Date(value).toLocaleString() : '-',
    },
    {
      field: 'actions',
      headerName: '操作',
      width: 280,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {getActions(params.row)}
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>需求管理</Typography>
      <DataGridTable
        columns={columns}
        fetchData={async (params) => {
          const res = await myPage({ ...params, pageNumber: params.pageNumber, groupId });
          return {
            data: {
              records: res.data?.records || [],
              totalRow: res.data?.totalRow || 0,
            },
            success: res.data?.success ?? true,
          };
        }}
        toolBarRender={() => (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleEdit({} as DemandItem)}>
            新建
          </Button>
        )}
      />

      <Dialog open={writeVisible} onClose={() => setWriteVisible(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedRecord?.id ? '编辑需求' : '新建需求'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="标题"
              value={formValues.title || ''}
              onChange={(e) => handleFormChange('title', e.target.value)}
              fullWidth
            />
            <TextField
              label="副标题"
              value={formValues.subtitle || ''}
              onChange={(e) => handleFormChange('subtitle', e.target.value)}
              fullWidth
            />
            <TextField
              label="酬劳积分"
              type="number"
              value={formValues.pay || 0}
              onChange={(e) => handleFormChange('pay', Number(e.target.value))}
              fullWidth
            />
            <TextField
              label="简介"
              value={formValues.content || ''}
              onChange={(e) => handleFormChange('content', e.target.value)}
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWriteVisible(false)}>取消</Button>
          <Button variant="contained" onClick={handleSubmit}>提交</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
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
