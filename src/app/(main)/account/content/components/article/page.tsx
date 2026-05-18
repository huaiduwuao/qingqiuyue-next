'use client';

import React, { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { page, process, remove, save, update } from '@/apis/content-article';
import { useApp } from '@/contexts/AppContext';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import QrCodeIcon from '@mui/icons-material/QrCode';
import type { GridColDef, GridRowId } from '@mui/x-data-grid';
import type { ArticleItem } from '@/beans/content';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'WAITING', label: '待审核' },
  { value: 'SUCCESS', label: '审核通过' },
  { value: 'FAIL', label: '驳回' },
];

const CONTENT_STATUS_OPTIONS = [
  { value: 'PUBLISH', label: '已上架' },
  { value: 'UN_PUBLISH', label: '已下架' },
];

export default function ArticleContentPage() {
  const { currentUser, dict } = useApp();
  const [writeVisible, setWriteVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ArticleItem | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const actionRef = useRef<{ reload: () => void } | null>(null);

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleEdit = (record: ArticleItem) => {
    setSelectedRecord(record);
    setWriteVisible(true);
  };

  const handleDelete = async (record: ArticleItem) => {
    if (!confirm('确定删除吗？')) return;
    try {
      await remove([record.id as number]);
      showMessage('删除成功');
      actionRef.current?.reload();
    } catch (err: any) {
      showMessage(err.message || '删除失败', 'error');
    }
  };

  const handleStatusChange = async (record: ArticleItem, status: string | null, moduleContentStatus: string | null) => {
    try {
      await process({
        ids: [record.id as number],
        status,
        moduleContentStatus,
      });
      showMessage('操作成功');
      actionRef.current?.reload();
    } catch (err: any) {
      showMessage(err.message || '操作失败', 'error');
    }
  };

  const handleShare = (record: ArticleItem) => {
    const url = `${window.location.origin}/share/module-content-detail?id=${record.moduleContentId}`;
    setShareUrl(url);
    setSelectedRecord(record);
    setShareVisible(true);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    showMessage('复制成功');
  };

  const handleSearchToggle = async (record: ArticleItem, checked: boolean) => {
    try {
      await process({
        ids: [record.id as number],
        status: record.status,
        moduleContentStatus: record.moduleContentStatus,
        moduleContentSearch: checked,
      });
      showMessage('操作成功');
      actionRef.current?.reload();
    } catch (err: any) {
      showMessage(err.message || '操作失败', 'error');
    }
  };

  const handleCloseWrite = () => {
    setWriteVisible(false);
    setSelectedRecord(null);
    actionRef.current?.reload();
  };

  const getActions = (record: ArticleItem) => {
    const actions: React.ReactNode[] = [];

    // 根据状态显示不同操作
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
            <Button size="small" key="submit" onClick={() => handleStatusChange(record, 'WAITING', null)}>
              提交审核
            </Button>
          );
        }
        break;
      case 'WAITING':
        if (currentUser?.id === record.createUser) {
          actions.push(
            <Button size="small" key="recall" onClick={() => handleStatusChange(record, 'DRAFT', null)}>
              撤回
            </Button>
          );
        }
        if (currentUser?.authorities?.includes('ADMIN')) {
          actions.push(
            <Button size="small" key="approve" onClick={() => handleStatusChange(record, 'SUCCESS', null)}>
              审核通过
            </Button>
          );
          actions.push(
            <Button size="small" color="error" key="reject" onClick={() => handleStatusChange(record, 'FAIL', null)}>
              驳回
            </Button>
          );
        }
        break;
      case 'SUCCESS':
        if (currentUser?.id === record.createUser) {
          actions.push(
            <Button size="small" key="publish" onClick={() => handleStatusChange(record, null, 'PUBLISH')}>
              发布
            </Button>
          );
        }
        break;
      case 'FAIL':
        if (currentUser?.id === record.createUser) {
          actions.push(
            <Button size="small" key="reedit" onClick={() => handleStatusChange(record, 'WAITING', null)}>
              重新编辑
            </Button>
          );
          actions.push(
            <Tooltip title="删除" key="delete">
              <IconButton size="small" color="error" onClick={() => handleDelete(record)}><DeleteIcon /></IconButton>
            </Tooltip>
          );
        }
        break;
    }

    // 上架/下架状态
    if (record.moduleContentStatus === 'PUBLISH') {
      actions.push(
        <Button size="small" key="unpublish" onClick={() => handleStatusChange(record, null, 'UN_PUBLISH')}>
          下架
        </Button>
      );
      actions.push(
        <Tooltip title="分享" key="share">
          <IconButton size="small" onClick={() => handleShare(record)}><ShareIcon /></IconButton>
        </Tooltip>
      );
    } else if (record.moduleContentStatus === 'UN_PUBLISH') {
      actions.push(
        <Button size="small" key="publish2" onClick={() => handleStatusChange(record, null, 'PUBLISH')}>
          上架
        </Button>
      );
      actions.push(
        <Tooltip title="分享" key="share">
          <IconButton size="small" onClick={() => handleShare(record)}><ShareIcon /></IconButton>
        </Tooltip>
      );
    }

    return actions;
  };

  const columns: GridColDef[] = [
    {
      field: 'status',
      headerName: '状态',
      width: 100,
      renderCell: (params) => {
        const statusMap: Record<string, string> = {
          DRAFT: '草稿',
          WAITING: '待审核',
          SUCCESS: '审核通过',
          FAIL: '驳回',
        };
        return statusMap[params.value] || params.value;
      },
    },
    {
      field: 'moduleContentStatus',
      headerName: '正式版',
      width: 120,
      renderCell: (params) => {
        if (params.value === 'PUBLISH') {
          return <Typography color="success">已上架</Typography>;
        } else if (params.value === 'UN_PUBLISH') {
          return <Typography color="warning">已下架</Typography>;
        }
        return '未发布';
      },
    },
    {
      field: 'moduleContentSearch',
      headerName: '检索',
      width: 100,
      renderCell: (params) => (
        <Switch
          checked={params.row.moduleContentSearch}
          onChange={(e) => handleSearchToggle(params.row, e.target.checked)}
        />
      ),
    },
    { field: 'title', headerName: '标题', width: 150 },
    { field: 'subtitle', headerName: '副标题', width: 150 },
    {
      field: 'info',
      headerName: '简介',
      width: 350,
      renderCell: (params) => (
        <Tooltip title={params.value}>
          <Typography noWrap sx={{ maxWidth: 330 }}>
            {params.value}
          </Typography>
        </Tooltip>
      ),
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
      width: 300,
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
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>文章管理</Typography>
      <DataGridTable
        columns={columns}
        fetchData={async (params) => {
          const res = await page({ ...params, pageNumber: params.pageNumber });
          return {
            data: {
              records: res.data?.records || [],
              totalRow: res.data?.totalRow || 0,
            },
            success: res.data?.success ?? true,
          };
        }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        toolBarRender={() => (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleEdit({} as ArticleItem)}>
            新建
          </Button>
        )}
      />

      {/* 编辑弹窗 */}
      <OperationModal
        open={writeVisible}
        onClose={handleCloseWrite}
        record={selectedRecord}
      />

      {/* 分享弹窗 */}
      <Dialog open={shareVisible} onClose={() => setShareVisible(false)} maxWidth="xs" fullWidth>
        <DialogTitle>分享</DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          <Box sx={{ my: 2 }}>
            <QrCodeIcon sx={{ fontSize: 128 }} />
          </Box>
          <Typography variant="body2" sx={{ wordBreak: 'break-all', mb: 2 }}>
            {shareUrl}
          </Typography>
          <Button startIcon={<ContentCopyIcon />} variant="contained" onClick={handleCopyUrl}>
            复制链接
          </Button>
        </DialogContent>
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

interface OperationModalProps {
  open: boolean;
  onClose: () => void;
  record: ArticleItem | null;
}

function OperationModal({ open, onClose, record }: OperationModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    info: '',
    content: '',
  });

  useEffect(() => {
    if (record?.id) {
      setFormData({
        title: record.title || '',
        subtitle: record.subtitle || '',
        info: record.info || '',
        content: (record as any).content || '',
      });
    } else {
      setFormData({ title: '', subtitle: '', info: '', content: '' });
    }
  }, [record]);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async () => {
    try {
      if (record?.id) {
        await update({ ...record, ...formData } as ArticleItem);
      } else {
        await save(formData as ArticleItem);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{record?.id ? '编辑文章' : '新建文章'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="标题"
            value={formData.title}
            onChange={handleChange('title')}
            fullWidth
          />
          <TextField
            label="副标题"
            value={formData.subtitle}
            onChange={handleChange('subtitle')}
            fullWidth
          />
          <TextField
            label="简介"
            value={formData.info}
            onChange={handleChange('info')}
            fullWidth
            multiline
            rows={3}
          />
          <TextField
            label="内容"
            value={formData.content}
            onChange={handleChange('content')}
            fullWidth
            multiline
            rows={10}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={handleSubmit}>提交</Button>
      </DialogActions>
    </Dialog>
  );
}
