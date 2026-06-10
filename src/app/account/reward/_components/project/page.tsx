'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import CardContent from '@mui/material/CardContent';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Divider from '@mui/material/Divider';
import FolderIcon from '@mui/icons-material/Folder';
import { myPage, remove, save, update } from '@/apis/reward-project';
import { useApp } from '@/contexts/AppContext';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import type { ProjectItem } from '@/beans/reward';

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'WAITING', label: '待审核' },
  { value: 'SUCCESS', label: '进行中' },
  { value: 'CLOSED', label: '已结束' },
];

const STATUS_MAP: Record<string, string> = {
  DRAFT: '草稿',
  WAITING: '待审核',
  SUCCESS: '进行中',
  FAIL: '已驳回',
  CLOSED: '已结束',
};

export default function ProjectPage({ groupId, groupData, onOpenTaskboard }: { groupId: any; groupData: any; onOpenTaskboard?: (projectId: number) => void }) {
  const { currentUser } = useApp();
  const [tab, setTab] = useState('');
  const [writeVisible, setWriteVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ProjectItem | null>(null);
  const [formValues, setFormValues] = useState<any>({});
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const query = useQuery({
    queryKey: ['reward-project', tab, page, groupId],
    queryFn: () => myPage({ pageNumber: page, pageSize, groupId, status: tab || undefined }).then((r) => ({
      records: r.data?.records || [],
      totalRow: r.data?.totalRow || 0,
    })),
    enabled: !!groupId,
    placeholderData: { records: [], totalRow: 0 },
  });

  const handleEdit = (record: ProjectItem) => {
    setSelectedRecord(record);
    setFormValues({
      name: record?.name || '',
      info: record?.info || '',
      content: record?.content || '',
      cover: record?.cover || '',
      tags: record?.tags || '',
      category: record?.category || '',
    });
    setWriteVisible(true);
  };

  const handleDetail = (record: ProjectItem) => {
    setSelectedRecord(record);
    setDetailVisible(true);
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
        await save({ ...formValues, groupId });
        showMessage('创建成功');
      }
      setWriteVisible(false);
      query.refetch();
    } catch (err: any) {
      showMessage(err.message || '操作失败', 'error');
    }
  };

  const handleDelete = async (record: ProjectItem) => {
    if (!confirm('确定删除吗？')) return;
    try {
      await remove([record.id as number]);
      showMessage('删除成功');
      query.refetch();
    } catch (err: any) {
      showMessage(err.message || '删除失败', 'error');
    }
  };

  const getCardActions = (record: ProjectItem) => {
    const actions: React.ReactNode[] = [];

    if (currentUser?.id === record.createUser) {
      actions.push(
        <Tooltip title="编辑" key="edit">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleEdit(record); }}>
            <EditIcon />
          </IconButton>
        </Tooltip>
      );
      actions.push(
        <Tooltip title="删除" key="delete">
          <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDelete(record); }}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      );
    }

    actions.push(
      <Button size="small" key="detail" onClick={(e) => { e.stopPropagation(); handleDetail(record); }}>
        详情
      </Button>
    );

    if (onOpenTaskboard) {
      actions.push(
        <Button
          size="small"
          key="taskboard"
          color="primary"
          onClick={(e) => { e.stopPropagation(); onOpenTaskboard(record.id!); }}
          sx={{ color: '#06B6D4' }}
        >
          查看任务
        </Button>
      );
    }

    return actions;
  };

  const totalPages = Math.ceil((query.data?.totalRow || 0) / pageSize);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>项目管理</Typography>

      {/* 状态筛选 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
        <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(1); }} variant="scrollable" scrollButtons="auto">
          {STATUS_OPTIONS.map((opt) => (
            <Tab key={opt.value} label={opt.label} value={opt.value} sx={{ minHeight: 36 }} />
          ))}
        </Tabs>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleEdit({} as ProjectItem)} sx={{ flexShrink: 0 }}>
          新建项目
        </Button>
      </Box>

      {/* 卡片列表 */}
      <Grid container spacing={2}>
        {(query.data?.records || []).map((item) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
                  onClick={() => handleDetail(item)}>
              <CardMedia
                component="div"
                sx={{
                  height: 100,
                  backgroundColor: item.cover ? 'transparent' : '#1976d2',
                  backgroundImage: item.cover ? `url(${item.cover})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {!item.cover && (
                  <FolderIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.7)' }} />
                )}
              </CardMedia>
              <CardContent sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="subtitle1" noWrap sx={{ fontWeight: "bold", maxWidth: "70%" }}>
                    {item.name}
                  </Typography>
                  <Chip label={STATUS_MAP[item.status || ''] || item.status} size="small" />
                </Box>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {item.info || '暂无描述'}
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {item.groups && (
                    <Chip label={`${item.groups} 个团队`} size="small" variant="outlined" />
                  )}
                  {item.category && (
                    <Chip label={item.category} size="small" variant="outlined" />
                  )}
                </Box>
              </CardContent>
              <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                {getCardActions(item)}
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {(query.data?.records || []).length === 0 && !query.isFetching && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography color="text.secondary">暂无项目</Typography>
          <Button sx={{ mt: 2 }} onClick={() => handleEdit({} as ProjectItem)}>创建第一个项目</Button>
        </Box>
      )}

      {totalPages > 1 && (
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 1 }}>
          <Button disabled={page === 1} onClick={() => setPage(page - 1)}>上一页</Button>
          <Typography sx={{ lineHeight: '36px' }}>第 {page} / {totalPages} 页</Typography>
          <Button disabled={page === totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
        </Box>
      )}

      {/* 新建/编辑弹窗 */}
      <Dialog open={writeVisible} onClose={() => setWriteVisible(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedRecord?.id ? '编辑项目' : '新建项目'}
          <IconButton onClick={() => setWriteVisible(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="名称"
              value={formValues.name || ''}
              onChange={(e) => handleFormChange('name', e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="简介"
              value={formValues.info || ''}
              onChange={(e) => handleFormChange('info', e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="封面图URL"
              value={formValues.cover || ''}
              onChange={(e) => handleFormChange('cover', e.target.value)}
              fullWidth
            />
            <TextField
              label="分类"
              value={formValues.category || ''}
              onChange={(e) => handleFormChange('category', e.target.value)}
              fullWidth
            />
            <TextField
              label="详细内容"
              value={formValues.content || ''}
              onChange={(e) => handleFormChange('content', e.target.value)}
              fullWidth
              multiline
              rows={6}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWriteVisible(false)}>取消</Button>
          <Button variant="contained" onClick={handleSubmit}>提交</Button>
        </DialogActions>
      </Dialog>

      {/* 详情弹窗 */}
      <Dialog open={detailVisible} onClose={() => setDetailVisible(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedRecord?.name}
          <IconButton onClick={() => setDetailVisible(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Chip label={STATUS_MAP[selectedRecord?.status || '']} />
            {selectedRecord?.category && <Chip label={selectedRecord?.category} variant="outlined" />}
          </Box>
          {selectedRecord?.cover && (
            <Box
              component="img"
              src={selectedRecord.cover}
              sx={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 1, mb: 2 }}
            />
          )}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>简介</Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>{selectedRecord?.info || '暂无'}</Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>详细内容</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {selectedRecord?.content || '暂无'}
          </Typography>
          {selectedRecord?.tags && (
            <Box sx={{ mt: 2, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {String(selectedRecord.tags).split(',').map((tag, idx) => (
                <Chip key={idx} label={tag} size="small" />
              ))}
            </Box>
          )}
          <Box sx={{ mt: 3, display: 'flex', gap: 1, alignItems: 'center' }}>
            <Avatar sx={{ width: 32, height: 32 }} src={selectedRecord?.avatar} />
            <Typography variant="caption">{selectedRecord?.username || '未知用户'}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
              {selectedRecord?.createTime ? new Date(selectedRecord.createTime).toLocaleString() : ''}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailVisible(false)}>关闭</Button>
          {currentUser?.id === selectedRecord?.createUser && (
            <Button variant="contained" onClick={() => { setDetailVisible(false); if (selectedRecord) handleEdit(selectedRecord); }}>
              编辑
            </Button>
          )}
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