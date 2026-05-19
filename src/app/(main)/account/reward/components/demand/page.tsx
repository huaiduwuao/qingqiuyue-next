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
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { myPage, process, remove, save, update } from '@/apis/reward-demand';
import { useApp } from '@/contexts/AppContext';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import type { DemandItem } from '@/beans/reward';

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'WAITING', label: '待审核' },
  { value: 'SUCCESS', label: '已发布' },
  { value: 'FINDING', label: '寻找方案中' },
  { value: 'CLOSED', label: '已关闭' },
];

const STATUS_MAP: Record<string, string> = {
  DRAFT: '草稿',
  WAITING: '待审核',
  SUCCESS: '已发布',
  FAIL: '已驳回',
  FINDING: '寻找方案中',
  CLOSED: '已关闭',
};

export default function DemandPage({ groupId, groupData }: { groupId: any; groupData: any }) {
  const { currentUser } = useApp();
  const [list, setList] = useState<DemandItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('');
  const [writeVisible, setWriteVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DemandItem | null>(null);
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
      console.error('Failed to fetch demands:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record: DemandItem) => {
    setSelectedRecord(record);
    setFormValues({
      title: record?.title || '',
      subtitle: record?.subtitle || '',
      pay: record?.pay || 0,
      content: record?.content || '',
      cover: record?.cover || '',
      tags: record?.tags || '',
    });
    setWriteVisible(true);
  };

  const handleDetail = (record: DemandItem) => {
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

  const handleDelete = async (record: DemandItem) => {
    if (!confirm('确定删除吗？')) return;
    try {
      await remove([record.id as number]);
      showMessage('删除成功');
      fetchData();
    } catch (err: any) {
      showMessage(err.message || '删除失败', 'error');
    }
  };

  const handleStatusChange = async (record: DemandItem, status: string) => {
    try {
      await process({ id: record.id, status });
      showMessage('操作成功');
      fetchData();
    } catch (err: any) {
      showMessage(err.message || '操作失败', 'error');
    }
  };

  const getCardActions = (record: DemandItem) => {
    const actions: React.ReactNode[] = [];

    if (currentUser?.id === record.createUser) {
      actions.push(
        <Tooltip title="编辑" key="edit">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleEdit(record); }}>
            <EditIcon />
          </IconButton>
        </Tooltip>
      );
      if (record.status === 'DRAFT') {
        actions.push(
          <Button size="small" key="submit" onClick={(e) => { e.stopPropagation(); handleStatusChange(record, 'WAITING'); }}>
            提交
          </Button>
        );
      }
      if (record.status === 'WAITING' && currentUser?.authorities?.includes('ADMIN')) {
        actions.push(
          <Button size="small" key="publish" onClick={(e) => { e.stopPropagation(); handleStatusChange(record, 'SUCCESS'); }}>
            通过
          </Button>
        );
      }
    }

    if (record.status === 'SUCCESS') {
      actions.push(
        <Button size="small" key="find" onClick={(e) => { e.stopPropagation(); handleStatusChange(record, 'FINDING'); }}>
          发布
        </Button>
      );
    }

    return actions;
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>需求管理</Typography>

      {/* 状态筛选 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(1); }}>
          {STATUS_OPTIONS.map((opt) => (
            <Tab key={opt.value} label={opt.label} value={opt.value} sx={{ minHeight: 36 }} />
          ))}
        </Tabs>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleEdit({} as DemandItem)}>
          新建需求
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
                  backgroundColor: item.cover ? 'transparent' : '#f5f5f5',
                  backgroundImage: item.cover ? `url(${item.cover})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {!item.cover && (
                  <Typography variant="h4" sx={{ color: '#ccc' }}>
                    {item.title?.charAt(0) || '?'}
                  </Typography>
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
                  {item.subtitle || item.content || '暂无描述'}
                </Typography>
                <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AttachMoneyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="caption">{item.pay || 0}</Typography>
                  </Box>
                  {item.endTime && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption">{new Date(item.endTime).toLocaleDateString()}</Typography>
                    </Box>
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

      {list.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography color="text.secondary">暂无需求</Typography>
          <Button sx={{ mt: 2 }} onClick={() => handleEdit({} as DemandItem)}>发布第一个需求</Button>
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
          {selectedRecord?.id ? '编辑需求' : '新建需求'}
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
              label="酬劳积分"
              type="number"
              value={formValues.pay || 0}
              onChange={(e) => handleFormChange('pay', Number(e.target.value))}
              fullWidth
            />
            <TextField
              label="封面图URL"
              value={formValues.cover || ''}
              onChange={(e) => handleFormChange('cover', e.target.value)}
              fullWidth
            />
            <TextField
              label="标签(逗号分隔)"
              value={formValues.tags || ''}
              onChange={(e) => handleFormChange('tags', e.target.value)}
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
            <Chip label={`酬劳: ${selectedRecord?.pay || 0}`} variant="outlined" />
          </Box>
          {selectedRecord?.cover && (
            <Box
              component="img"
              src={selectedRecord.cover}
              sx={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 1, mb: 2 }}
            />
          )}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>简介</Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>{selectedRecord?.subtitle || '暂无'}</Typography>
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