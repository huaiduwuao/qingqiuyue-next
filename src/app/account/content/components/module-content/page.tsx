'use client';

import React, { useState, useCallback, useEffect } from 'react';
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
import { myPage, remove, ModuleContentItem, updateShare, process, suggest } from '@/apis/module-content';
import SendToSpider from '@/components/SendToSpider';
import AddIcon from '@mui/icons-material/Add';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface Props {
  moduleId?: number;
  groupId?: number;
  groupData?: any[];
  contentType?: string;
  status?: string;
  source?: string;
  title?: string;
}

const CONTENT_STATUS = { PUBLISH: '已发布', UN_PUBLISH: '已下架' };
const CONTENT_TYPE = {
  PAN: '网盘资源', NOVEL: '小说', VIDEO: '视频', ARTICLE: '文章',
  FILM: '电影', MUSIC: '音乐', PICTURE_ALBUM: '图集',
  ANIMATION: '动画', TELEPLAY: '电视剧', COMICS: '漫画', VSHOW: '综艺',
};
const LIST_KEY = ['content', 'module-content'];

export default function ModuleContentPage({ moduleId, groupId, groupData, contentType, status, source, title }: Props) {
  const qc = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [record, setRecord] = useState<ModuleContentItem | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailRecord, setDetailRecord] = useState<ModuleContentItem | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });
  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  const handleModalVisible = useCallback((flag: boolean, rec?: ModuleContentItem) => {
    setModalVisible(flag);
    setRecord(rec || null);
  }, []);

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => remove(ids),
    onSuccess: () => { showMessage('删除成功'); invalidate(); },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });

  const updateShareMutation = useMutation({
    mutationFn: (vals: any) => updateShare(vals),
    onSuccess: () => { showMessage('操作成功'); setModalVisible(false); invalidate(); },
    onError: (err: any) => showMessage(err.message || '操作失败', 'error'),
  });

  const processMutation = useMutation({
    mutationFn: (vals: any) => process(vals),
    onSuccess: () => { showMessage('操作成功'); invalidate(); },
    onError: (err: any) => showMessage(err.message || '操作失败', 'error'),
  });

  const handleDelete = useCallback((row: ModuleContentItem) => {
    deleteMutation.mutate([row.id]);
  }, [deleteMutation]);

  const handleEdit = useCallback((row: ModuleContentItem) => {
    handleModalVisible(true, row);
  }, [handleModalVisible]);

  const handleView = useCallback((row: ModuleContentItem) => {
    setDetailRecord(row);
    setDetailVisible(true);
  }, []);

  const handleStatusChange = useCallback((row: ModuleContentItem, status: string) => {
    processMutation.mutate({ ids: [row.id], status });
  }, [processMutation]);

  const handleSearchToggle = useCallback((row: ModuleContentItem, checked: boolean) => {
    processMutation.mutate({ ids: [row.id], status: row.status, moduleContentSearch: checked });
  }, [processMutation]);

  const handleAdd = (values: any) => {
    if (record?.id) {
      updateShareMutation.mutate({ ...record, ...values });
    } else {
      setModalVisible(false);
      setSnackbar({ open: true, message: '操作成功', severity: 'success' });
    }
  };

  const isSubmitting = updateShareMutation.isPending;

  const columns: GridColDef[] = [
    {
      field: 'coverUrl',
      headerName: '封面',
      width: 64,
      sortable: false,
      renderCell: (params) =>
        params.value ? (
          <Box
            component="img"
            src={params.value}
            sx={{ width: 40, height: 40, borderRadius: 0.5, objectFit: 'cover', bgcolor: 'rgba(255,255,255,0.04)' }}
          />
        ) : (
          <Box sx={{ width: 40, height: 40, borderRadius: 0.5, bgcolor: 'rgba(255,255,255,0.04)' }} />
        ),
    },
    {
      field: 'status',
      headerName: '状态',
      width: 80,
      renderCell: (params) => CONTENT_STATUS[params.value as keyof typeof CONTENT_STATUS] || params.value,
    },
    {
      field: 'contentType',
      headerName: '类型',
      width: 80,
      renderCell: (params) => CONTENT_TYPE[params.value as keyof typeof CONTENT_TYPE] || params.value,
    },
    { field: 'title', headerName: '标题', flex: 1, minWidth: 160 },
    { field: 'subtitle', headerName: '副标题', flex: 1, minWidth: 140 },
    { field: 'author', headerName: '作者', width: 90 },
    { field: 'sourceLabel', headerName: '来源', width: 90 },
    {
      field: 'createTime',
      headerName: '爬取时间',
      width: 130,
      valueGetter: (value) =>
        value
          ? new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
          : '-',
    },
    {
      field: 'actions',
      headerName: '操作',
      width: 220,
      sortable: false,
      renderCell: (params) => {
        const row = params.row as ModuleContentItem;
        return (
          <Box sx={{ display: 'flex', gap: 0.25, alignItems: 'center', flexWrap: 'nowrap' }}>
            <Button size="small" variant="text" onClick={() => handleView(row)} sx={{ minWidth: 0, px: 0.5, fontSize: 12 }}>查看</Button>
            {row.status === 'PUBLISH' ? (
              <Button size="small" variant="text" color="warning" onClick={() => handleStatusChange(row, 'UN_PUBLISH')} sx={{ minWidth: 0, px: 0.5, fontSize: 12 }}>下架</Button>
            ) : (
              <Button size="small" variant="text" color="success" onClick={() => handleStatusChange(row, 'PUBLISH')} sx={{ minWidth: 0, px: 0.5, fontSize: 12 }}>上架</Button>
            )}
            <Button size="small" variant="text" onClick={() => handleEdit(row)} sx={{ minWidth: 0, px: 0.5, fontSize: 12 }}>编辑</Button>
            <Button size="small" variant="text" color="error" onClick={() => handleDelete(row)} sx={{ minWidth: 0, px: 0.5, fontSize: 12 }}>删除</Button>
          </Box>
        );
      },
    },
  ];

  const toolBarRender = () => (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      <Button variant="contained" startIcon={<CloudUploadIcon />} onClick={() => setModalVisible(true)}>
        导入
      </Button>
      <SendToSpider
        label="URL 抓取"
        defaultUrl="粘贴目标页面 URL,例如 https://example.com/article/123"
        onSuccess={(m) => setSnackbar({ open: true, message: m, severity: 'success' })}
        onError={(m) => setSnackbar({ open: true, message: m, severity: 'error' })}
      />
    </Box>
  );

  return (
    <Box sx={{ height: "100%", overflow: "hidden" }}>
      <Typography variant="h6" sx={{ mb: 2 }}>内容管理</Typography>
      <DataGridTable
        columns={columns}
        fetchData={(params) => myPage({ ...params, moduleId, groupId, contentType, status, source, title })}
        extraParams={{ moduleId, groupId, contentType, status, source, title }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        toolBarRender={toolBarRender}
      />
      <OperationModal
        open={modalVisible}
        record={record}
        isSubmitting={isSubmitting}
        onClose={() => setModalVisible(false)}
        onSave={handleAdd}
      />
      <DetailModal
        open={detailVisible}
        record={detailRecord}
        onClose={() => setDetailVisible(false)}
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
  record: ModuleContentItem | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSave: (values: any) => void;
}

function OperationModal({ open, record, isSubmitting, onClose, onSave }: OperationModalProps) {
  const [values, setValues] = useState({ title: '', subtitle: '' });

  useEffect(() => {
    if (record) {
      setValues({ title: record.title || '', subtitle: record.subtitle || '' });
    } else {
      setValues({ title: '', subtitle: '' });
    }
  }, [record]);

  const handleChange = (field: string) => (e: any) => setValues({ ...values, [field]: e.target.value });
  const handleSubmit = () => { onSave(values); };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{record ? '编辑' : '导入'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="标题" value={values.title} onChange={handleChange('title')} fullWidth required />
          <TextField label="副标题" value={values.subtitle} onChange={handleChange('subtitle')} fullWidth />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isSubmitting}>确认</Button>
      </DialogActions>
    </Dialog>
  );
}

function DetailModal({ open, record, onClose }: { open: boolean; record: ModuleContentItem | null; onClose: () => void }) {
  if (!record) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {record.coverUrl && (
            <Box component="img" src={record.coverUrl} sx={{ width: 64, height: 64, borderRadius: 1, objectFit: 'cover' }} />
          )}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">{record.title}</Typography>
            {record.subtitle && <Typography variant="body2" color="text.secondary">{record.subtitle}</Typography>}
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5, mb: 2 }}>
          <Field label="类型" value={CONTENT_TYPE[record.contentType as keyof typeof CONTENT_TYPE] || record.contentType} />
          <Field label="状态" value={CONTENT_STATUS[record.status as keyof typeof CONTENT_STATUS] || record.status} />
          <Field label="作者" value={record.author || '-'} />
          <Field label="来源" value={record.sourceLabel || record.source || '-'} />
          <Field label="爬取时间" value={record.createTime ? new Date(record.createTime).toLocaleString('zh-CN') : '-'} />
          <Field label="更新" value={record.updateTime ? new Date(record.updateTime).toLocaleString('zh-CN') : '-'} />
        </Box>
        <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>爬取内容</Typography>
        <Box
          sx={{
            p: 2,
            borderRadius: 1,
            bgcolor: 'rgba(255,255,255,0.04)',
            maxHeight: 320,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            fontSize: 13,
            lineHeight: 1.7,
            fontFamily: 'monospace',
          }}
        >
          {record.content || '(无内容)'}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">关闭</Button>
      </DialogActions>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>{value}</Typography>
    </Box>
  );
}