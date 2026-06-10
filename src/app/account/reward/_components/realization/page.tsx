'use client';

import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import AssignmentIcon from '@mui/icons-material/Assignment';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { myPage, remove, save, update } from '@/apis/reward-realization';
import { myPage as listDemands } from '@/apis/reward-demand';
import { useApp } from '@/contexts/AppContext';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import type { RealizationItem, DemandItem } from '@/beans/reward';

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

interface Props {
  groupId: any;
  groupData: any;
  initialDemandId?: number | null;
  onOpenDemandDetail?: (demandId: number) => void;
}

export default function RealizationPage({ groupId, groupData, initialDemandId, onOpenDemandDetail }: Props) {
  const { currentUser } = useApp();
  const qc = useQueryClient();
  const LIST_KEY = ['reward-realization'];
  const [tab, setTab] = useState('');
  const [demandFilter, setDemandFilter] = useState<number | ''>(initialDemandId ?? '');
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

  // 拉取所有需求(用于下拉 + 卡片显示)
  const demandsQuery = useQuery({
    queryKey: ['reward-demands', 'all'],
    queryFn: () => listDemands({ pageSize: 100 }).then((r: any) => r.data?.records || r.data?.list || []),
    placeholderData: [],
  });
  const demands: DemandItem[] = demandsQuery.data || [];

  // 需求过滤响应外部入参变化
  useEffect(() => {
    if (initialDemandId != null) setDemandFilter(initialDemandId);
  }, [initialDemandId]);

  const query = useQuery({
    queryKey: [...LIST_KEY, tab, page, groupId],
    queryFn: () => myPage({ pageNumber: page, pageSize, groupId, status: tab || undefined } as any).then((r: any) => ({
      records: r.data?.records || [],
      totalRow: r.data?.totalRow || 0,
    })),
    enabled: !!groupId,
    placeholderData: { records: [], totalRow: 0 },
  });
  const list: any[] = query.data?.records || [];
  const total = query.data?.totalRow || 0;
  const loading = query.isFetching;

  const saveMutation = useMutation({
    mutationFn: (data: any) => save(data),
    onSuccess: () => {
      showMessage('创建成功');
      setWriteVisible(false);
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (err: any) => showMessage(err.message || '创建失败', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => update(data),
    onSuccess: () => {
      showMessage('更新成功');
      setWriteVisible(false);
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (err: any) => showMessage(err.message || '更新失败', 'error'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => remove([id]),
    onSuccess: () => {
      showMessage('删除成功');
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });

  const isSubmitting = saveMutation.isPending || updateMutation.isPending;

  const demandTitleMap = React.useMemo(() => {
    const m = new Map<number, string>();
    demands.forEach((d) => {
      if (d.id != null) m.set(d.id, d.title || `需求 ${d.id}`);
    });
    return m;
  }, [demands]);

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

  const handleSubmit = () => {
    if (selectedRecord?.id) {
      updateMutation.mutate({ ...selectedRecord, ...formValues });
    } else {
      saveMutation.mutate({ ...formValues, groupId, status: 'DRAFT' });
    }
  };

  const handleDelete = (record: RealizationItem) => {
    if (!confirm('确定删除吗？')) return;
    removeMutation.mutate(record.id as number);
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

      {/* 状态筛选 + 需求过滤 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
        <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(1); }} variant="scrollable" scrollButtons="auto">
          {STATUS_OPTIONS.map((opt) => (
            <Tab key={opt.value} label={opt.label} value={opt.value} sx={{ minHeight: 36 }} />
          ))}
        </Tabs>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>按需求过滤</InputLabel>
            <Select
              value={demandFilter}
              label="按需求过滤"
              onChange={(e) => setDemandFilter(e.target.value as number | '')}
            >
              <MenuItem value="">全部需求</MenuItem>
              {demands.map((d) => (
                <MenuItem key={d.id} value={d.id}>#{d.id} {d.title}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleEdit({} as RealizationItem)}>
            新建实现
          </Button>
        </Box>
      </Box>

      {/* 卡片列表 */}
      <Grid container spacing={2}>
        {list.map((item) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.id}>
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
                  <Typography variant="subtitle1" noWrap sx={{ fontWeight: "bold", maxWidth: "70%" }}>
                    {item.title}
                  </Typography>
                  <Chip label={STATUS_MAP[item.status || ''] || item.status} size="small" />
                </Box>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {item.subtitle || '暂无描述'}
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {item.demandId != null && (
                    <Chip
                      icon={<AssignmentIcon sx={{ fontSize: '12px !important' }} />}
                      label={demandTitleMap.get(item.demandId) || `需求 ${item.demandId}`}
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDemandDetail?.(item.demandId!);
                      }}
                      sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6', cursor: 'pointer' }}
                    />
                  )}
                  {(item as any).taskId != null && (
                    <Chip
                      label={`任务 #${(item as any).taskId}`}
                      size="small"
                      sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(6, 182, 212, 0.12)', color: '#06B6D4' }}
                    />
                  )}
                  {(item as any).autoGenerated && (
                    <Chip
                      label="自动派生"
                      size="small"
                      sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(93, 219, 150, 0.12)', color: 'success.main' }}
                    />
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
          <Button variant="contained" onClick={handleSubmit} disabled={isSubmitting}>提交</Button>
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