'use client';

import React, { useEffect, useState } from 'react';
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
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { myPage, remove, save, update } from '@/apis/reward-realization';
import { useApp } from '@/contexts/AppContext';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import type { RealizationItem } from '@/beans/reward';

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'WAITING', label: '待审核' },
  { value: 'SUCCESS', label: '已通过' },
  { value: 'FAIL', label: '已驳回' },
];

const STATUS_MAP: Record<string, string> = {
  DRAFT: '草稿',
  WAITING: '待审核',
  SUCCESS: '已通过',
  FAIL: '已驳回',
};

interface FilterType {
  status: string;
  keyword: string;
}

export default function RealizationPage({ groupId, groupData }: { groupId: any; groupData: any }) {
  const { currentUser } = useApp();
  const [list, setList] = useState<RealizationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('');
  const [writeVisible, setWriteVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RealizationItem | null>(null);
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

  useEffect(() => {
    fetchData();
  }, [tab, page, groupId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res: any = await myPage({
        pageNumber: page,
        pageSize,
        groupId,
        status: tab || undefined,
      });
      setList(res.data?.records || []);
      setTotal(res.data?.totalRow || 0);
    } catch (err) {
      console.error('Failed to fetch realizations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record: RealizationItem) => {
    setSelectedRecord(record);
    setFormValues({
      title: record?.title || '',
      subtitle: record?.subtitle || '',
      content: record?.content || '',
      cover: record?.cover || '',
    });
    setWriteVisible(true);
  };

  const handleDetail = (record: RealizationItem) => {
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
        await save({ ...formValues, groupId, status: 'DRAFT' });
        showMessage('创建成功');
      }
      setWriteVisible(false);
      fetchData();
    } catch (err: any) {
      showMessage(err.message || '操作失败', 'error');
    }
  };

  const handleDelete = async (record: RealizationItem) => {
    if (!confirm('确定删除吗？')) return;
    try {
      await remove([record.id as number]);
      showMessage('删除成功');
      fetchData();
    } catch (err: any) {
      showMessage(err.message || '删除失败', 'error');
    }
  };

  const getCardActions = (record: RealizationItem) => {
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

    return actions;
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>实现管理</Typography>

      {/* 状态筛选 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(1); }}>
          {STATUS_OPTIONS.map((opt) => (
            <Tab key={opt.value} label={opt.label} value={opt.value} sx={{ minHeight: 36 }} />
          ))}
        </Tabs>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleEdit({} as RealizationItem)}>
          新建实现
        </Button>
      </Box>

      {/* 卡片列表 */}
      <Grid container spacing={2}>
        {list.map((item) => (
          <Grid item xs={12} sm={6} md={4} key={item.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
                  onClick={() => handleDetail(item)}>
              <CardMedia
                component="div"
                sx={{
                  height: 120,
                  backgroundColor: item.cover ? 'transparent' : '#4caf50',
                  backgroundImage: item.cover ? `url(${item.cover})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {!item.cover && (
                  <CheckCircleIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.7)' }} />
                )}
              </CardMedia>
              <CardContent sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold" noWrap sx={{ maxWidth: '70%' }}>
                    {item.title}
                  </Typography>
                  <Chip label={STATUS_MAP[item.status || ''] || item.status} size="small" />
                </Box>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {item.subtitle || '暂无描述'}
                </Typography>
              </CardContent>
              <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                {getCardActions(item)}
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {list.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography color="text.secondary">暂无实现</Typography>
          <Button sx={{ mt: 2 }} onClick={() => handleEdit({} as RealizationItem)}>创建第一个实现</Button>
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
          {selectedRecord?.id ? '编辑实现' : '新建实现'}
          <IconButton onClick={() => setWriteVisible(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="标题"
              value={formValues.title || ''}
              onChange={(e) => handleFormChange('title', e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="副标题"
              value={formValues.subtitle || ''}
              onChange={(e) => handleFormChange('subtitle', e.target.value)}
              fullWidth
            />
            <TextField
              label="封面图URL"
              value={formValues.cover || ''}
              onChange={(e) => handleFormChange('cover', e.target.value)}
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
          {selectedRecord?.title}
          <IconButton onClick={() => setDetailVisible(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Chip label={STATUS_MAP[selectedRecord?.status || '']} />
          </Box>
          {selectedRecord?.cover && (
            <Box
              component="img"
              src={selectedRecord.cover}
              sx={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 1, mb: 2 }}
            />
          )}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>副标题</Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>{selectedRecord?.subtitle || '暂无'}</Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>详细内容</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {selectedRecord?.content || '暂无'}
          </Typography>
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
            <Button variant="contained" onClick={() => { setDetailVisible(false); handleEdit(selectedRecord); }}>
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