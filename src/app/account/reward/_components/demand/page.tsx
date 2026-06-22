'use client';

import React, { useState, useCallback } from 'react';
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
import LinearProgress from '@mui/material/LinearProgress';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { myPage, process, remove, save, update, settleDemand, unsettleDemand } from '@/apis/reward-demand';
import { listTasks } from '@/apis/reward-task';
import { SettlementDialog } from './SettlementDialog';
import type { DemandItem, DemandStatus, RewardTask, RewardTaskStatus, ConceptionItem } from '@/beans/reward';

const STATUS_OPTIONS: Array<{ value: DemandStatus | ''; label: string }> = [
  { value: '', label: '全部' },
  { value: 'PENDING', label: '待发布' },
  { value: 'PUBLISHED', label: '进行中' },
  { value: 'COMPLETED', label: '待结账' },
  { value: 'SETTLED', label: '已结算' },
  { value: 'CLOSED', label: '已关闭' },
];

const STATUS_META: Record<DemandStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: '待发布', color: 'text.secondary', bg: 'rgba(139, 143, 163, 0.12)' },
  PUBLISHED: { label: '进行中', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.12)' },
  COMPLETED: { label: '待结账', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
  SETTLED: { label: '已结算', color: 'success.main', bg: 'rgba(93, 219, 150, 0.12)' },
  CLOSED: { label: '已关闭', color: 'text.disabled', bg: 'rgba(90, 94, 114, 0.12)' },
};

const TASK_STATUS_COLOR: Record<RewardTaskStatus, string> = {
  OPEN: 'success.main',
  CLAIMED: 'secondary.main',
  SUBMITTED: 'warning.main',
  APPROVED: '#8B5CF6',
  REJECTED: 'primary.main',
};

interface Props {
  groupId: any;
  groupData: any;
  onOpenTaskboard?: (demandId: number) => void;
  onOpenConceptionForDemand?: (demandId: number) => void;
  initialConceptionDemandId?: number | null;
}

export default function DemandPage({ groupId, onOpenTaskboard, onOpenConceptionForDemand }: Props) {
  const [tab, setTab] = useState<DemandStatus | ''>('');
  const [writeVisible, setWriteVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [settleVisible, setSettleVisible] = useState(false);
  const [settleReadonly, setSettleReadonly] = useState(false);
  const [settling, setSettling] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DemandItem | null>(null);
  const [relatedTasks, setRelatedTasks] = useState<RewardTask[]>([]);
  const [relatedConceptions, setRelatedConceptions] = useState<ConceptionItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [formValues, setFormValues] = useState<any>({});
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [keyword, setKeyword] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const query = useQuery({
    queryKey: ['reward-demand', tab, page, groupId, keyword],
    queryFn: () => myPage({ pageNumber: page, pageSize, groupId, status: tab || undefined, keyword }).then((r) => ({
      records: r.data?.records || [],
      totalRow: r.data?.totalRow || 0,
    })),
    enabled: !!groupId,
    placeholderData: { records: [], totalRow: 0 },
  });

  // 加载需求详情时同时拉关联任务 + 关联意境
  const loadRelatedTasks = useCallback(async (demandId: number) => {
    setLoadingTasks(true);
    try {
      const [taskRes, conceptionRes]: any[] = await Promise.all([
        listTasks({ demandId, pageSize: 100 }),
        fetch(`/api/reward/conception/client/page?demandId=${demandId}`).then((r) => r.json()).catch(() => null),
      ]);
      setRelatedTasks(taskRes?.data?.records || []);
      // conception 接口实时化(后端会按 demandId 过滤)
      setRelatedConceptions(conceptionRes?.data?.records || []);
    } catch (e) {
      console.error('Failed to load related tasks', e);
      setRelatedTasks([]);
      setRelatedConceptions([]);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

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
    if (record.taskIds && record.taskIds.length > 0) {
      loadRelatedTasks(record.id as number);
    } else {
      setRelatedTasks([]);
    }
  };

  const handleSettle = (record: DemandItem) => {
    setSelectedRecord(record);
    setSettleReadonly(record.status === 'SETTLED');
    setSettleVisible(true);
  };

  const handleConfirmSettle = async () => {
    if (!selectedRecord?.id) return;
    setSettling(true);
    try {
      const res: any = await settleDemand(selectedRecord.id);
      if (res?.code === 200) {
        showMessage('结账成功');
        setSettleVisible(false);
        setDetailVisible(false);
        query.refetch();
      } else {
        showMessage(res?.msg || '结账失败', 'error');
      }
    } catch (err: any) {
      showMessage(err?.message || '结账失败', 'error');
    } finally {
      setSettling(false);
    }
  };

  const handleConfirmUnsettle = async () => {
    if (!selectedRecord?.id) return;
    if (!confirm('确定要反结账吗?将回滚所有贡献者的贡献度,该操作不可撤销。')) return;
    setSettling(true);
    try {
      const res: any = await unsettleDemand(selectedRecord.id);
      if (res?.code === 200) {
        showMessage('反结账成功,已回到待结账状态');
        setSettleVisible(false);
        // 同步刷新详情 + 列表
        setSelectedRecord(res.data);
        setDetailVisible(true);
        query.refetch();
        // 重新拉关联任务(状态可能从 APPROVED 退回)
        if (res.data?.id) loadRelatedTasks(res.data.id);
      } else {
        showMessage(res?.msg || '反结账失败', 'error');
      }
    } catch (err: any) {
      showMessage(err?.message || '反结账失败', 'error');
    } finally {
      setSettling(false);
    }
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
        await save({ ...formValues, groupId, status: 'PENDING' });
        showMessage('创建成功');
      }
      setWriteVisible(false);
      query.refetch();
    } catch (err: any) {
      showMessage(err.message || '操作失败', 'error');
    }
  };

  const handleDelete = async (record: DemandItem) => {
    if (!confirm('确定删除吗？')) return;
    try {
      await remove([record.id as number]);
      showMessage('删除成功');
      query.refetch();
    } catch (err: any) {
      showMessage(err.message || '删除失败', 'error');
    }
  };

  const handleStatusChange = async (record: DemandItem, status: DemandStatus) => {
    try {
      await process({ id: record.id, status });
      showMessage('操作成功');
      query.refetch();
      if (detailVisible && selectedRecord?.id === record.id) {
        setSelectedRecord({ ...selectedRecord, status });
      }
    } catch (err: any) {
      showMessage(err.message || '操作失败', 'error');
    }
  };

  const totalPages = Math.ceil((query.data?.totalRow || 0) / pageSize);
  const isSettled = selectedRecord?.status === 'SETTLED';
  const isCompleted = selectedRecord?.status === 'COMPLETED';
  const isPublished = selectedRecord?.status === 'PUBLISHED';
  const isPending = selectedRecord?.status === 'PENDING';
  const completedCount = selectedRecord?.completedCount ?? 0;
  const totalTaskCount = selectedRecord?.totalTaskCount ?? 0;
  const progressPercent = totalTaskCount > 0 ? Math.round((completedCount / totalTaskCount) * 100) : 0;
  const progressColor = progressPercent >= 100 ? 'success.main' : progressPercent >= 50 ? 'warning.main' : '#06B6D4';

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>需求管理</Typography>

      {/* 状态筛选 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
        <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(1); }} variant="scrollable" scrollButtons="auto">
          {STATUS_OPTIONS.map((opt) => (
            <Tab key={opt.value} label={opt.label} value={opt.value} sx={{ minHeight: 36 }} />
          ))}
        </Tabs>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleEdit({} as DemandItem)} sx={{ flexShrink: 0 }}>
          新建需求
        </Button>
      </Box>

      {/* 卡片列表 */}
      <Grid container spacing={2}>
        {(query.data?.records || []).map((item) => {
          const meta = STATUS_META[(item.status as DemandStatus) || 'PENDING'] || STATUS_META.PENDING;
          return (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
                    onClick={() => handleDetail(item)}>
                <CardMedia
                  component="div"
                  sx={{
                    height: 120,
                    backgroundColor: item.cover ? 'transparent' : (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FAFAFA',
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
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, gap: 1 }}>
                    <Typography variant="subtitle1" noWrap sx={{ fontWeight: "bold", maxWidth: "70%" }}>
                      {item.title}
                    </Typography>
                    <Chip
                      label={meta.label}
                      size="small"
                      sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 600 }}
                    />
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
                    {item.totalTaskCount != null && item.totalTaskCount > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <ViewKanbanIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption">
                          {item.completedCount || 0}/{item.totalTaskCount} 任务
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
                <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                  {onOpenTaskboard && (item.taskIds?.length || 0) > 0 && (
                    <Button
                      size="small"
                      startIcon={<ViewKanbanIcon sx={{ fontSize: 14 }} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTaskboard(item.id as number);
                      }}
                      sx={{ color: '#06B6D4', textTransform: 'none', fontSize: 12 }}
                    >
                      查看任务
                    </Button>
                  )}
                  {item.status === 'SETTLED' ? (
                    <Button
                      size="small"
                      startIcon={<ReceiptLongIcon sx={{ fontSize: 14 }} />}
                      onClick={(e) => { e.stopPropagation(); handleSettle(item); }}
                      sx={{ color: 'success.main', textTransform: 'none', fontSize: 12 }}
                    >
                      结算单
                    </Button>
                  ) : item.status === 'COMPLETED' ? (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={(e) => { e.stopPropagation(); handleSettle(item); }}
                      sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: '#4AC97F' }, textTransform: 'none', fontSize: 12 }}
                    >
                      结账
                    </Button>
                  ) : (
                    <Tooltip title="编辑">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleEdit(item); }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {(query.data?.records || []).length === 0 && !query.isFetching && (
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
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            {selectedRecord?.status && STATUS_META[selectedRecord.status as DemandStatus] && (
              <Chip
                label={STATUS_META[selectedRecord.status as DemandStatus].label}
                sx={{ bgcolor: STATUS_META[selectedRecord.status as DemandStatus].bg, color: STATUS_META[selectedRecord.status as DemandStatus].color, fontWeight: 600 }}
              />
            )}
            <Chip label={`酬劳: ${selectedRecord?.pay || 0}`} variant="outlined" />
            {isSettled && selectedRecord?.settledAt && (
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                label={`已结算 ${new Date(selectedRecord.settledAt).toLocaleDateString()}`}
                sx={{ bgcolor: 'rgba(93, 219, 150, 0.12)', color: 'success.main' }}
              />
            )}
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

          {/* 关联任务 + 进度 */}
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Typography variant="subtitle2">
              关联任务 ({completedCount}/{totalTaskCount})
            </Typography>
            {onOpenTaskboard && (selectedRecord?.taskIds?.length || 0) > 0 && (
              <Button
                size="small"
                startIcon={<ViewKanbanIcon sx={{ fontSize: 14 }} />}
                onClick={() => onOpenTaskboard(selectedRecord!.id as number)}
                sx={{ color: '#06B6D4', textTransform: 'none', fontSize: 12, ml: 'auto' }}
              >
                在看板中查看
              </Button>
            )}
          </Box>
          {totalTaskCount > 0 ? (
            <Box sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">完成度</Typography>
                <Typography variant="caption" sx={{ fontWeight: 600, color: progressColor }}>
                  {progressPercent}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progressPercent}
                sx={{ height: 6, borderRadius: 3, bgcolor: 'divider', '& .MuiLinearProgress-bar': { bgcolor: progressColor, borderRadius: 3 } }}
              />
            </Box>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              该需求下暂无任务
            </Typography>
          )}

          {loadingTasks ? (
            <Typography variant="caption" color="text.secondary">加载任务中…</Typography>
          ) : relatedTasks.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, maxHeight: 240, overflowY: 'auto' }}>
              {relatedTasks.map((t) => (
                <Box
                  key={t.id}
                  sx={{
                    p: 1,
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FAFAFA',
                    border: '1px solid',
                    borderColor: (theme) => theme.palette.mode === 'dark' ? '#252836' : '#E5E7EB',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Box sx={{ width: 6, height: 28, borderRadius: 1, bgcolor: TASK_STATUS_COLOR[t.status || 'OPEN'] }} />
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                    {t.title}
                  </Typography>
                  {t.assigneeName && (
                    <Typography variant="caption" color="text.secondary">
                      {t.assigneeName}
                    </Typography>
                  )}
                  <Chip
                    label={(t.status || 'OPEN').toLowerCase()}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: 10,
                      bgcolor: `${TASK_STATUS_COLOR[t.status || 'OPEN']}20`,
                      color: TASK_STATUS_COLOR[t.status || 'OPEN'],
                      fontWeight: 600,
                    }}
                  />
                </Box>
              ))}
            </Box>
          ) : null}

          {/* 关联意境 */}
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <AutoAwesomeIcon sx={{ fontSize: 16, color: 'success.main' }} />
            <Typography variant="subtitle2">
              关联意境 ({relatedConceptions.length})
            </Typography>
            {onOpenConceptionForDemand && (
              <Button
                size="small"
                onClick={() => onOpenConceptionForDemand(selectedRecord!.id as number)}
                sx={{ color: 'success.main', textTransform: 'none', fontSize: 12, ml: 'auto' }}
              >
                在意境管理中查看 →
              </Button>
            )}
          </Box>
          {relatedConceptions.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, maxHeight: 160, overflowY: 'auto' }}>
              {relatedConceptions.map((c) => (
                <Box
                  key={c.id}
                  sx={{
                    p: 1,
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FAFAFA',
                    border: '1px solid',
                    borderColor: (theme) => theme.palette.mode === 'dark' ? '#252836' : '#E5E7EB',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <AutoAwesomeIcon sx={{ fontSize: 14, color: 'success.main' }} />
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                    {c.name || (c as any).title}
                  </Typography>
                  <Chip
                    label={c.status || 'OPEN'}
                    size="small"
                    sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(93, 219, 150, 0.12)', color: 'success.main', fontWeight: 600 }}
                  />
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="caption" color="text.secondary">该需求下暂无关联意境</Typography>
          )}

          <Box sx={{ mt: 3, display: 'flex', gap: 1, alignItems: 'center' }}>
            <Avatar sx={{ width: 32, height: 32 }} src={selectedRecord?.avatar} />
            <Typography variant="caption">{selectedRecord?.username || '未知用户'}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
              {selectedRecord?.createTime ? new Date(selectedRecord.createTime).toLocaleString() : ''}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ gap: 1 }}>
          {isPending && (
            <Button variant="contained" onClick={() => handleStatusChange(selectedRecord!, 'PUBLISHED')}>
              发布
            </Button>
          )}
          {isPublished && (
            <Button color="warning" onClick={() => handleStatusChange(selectedRecord!, 'CLOSED')}>
              关闭需求
            </Button>
          )}
          {isCompleted && (
            <Button
              variant="contained"
              startIcon={<CheckCircleIcon />}
              onClick={() => handleSettle(selectedRecord!)}
              sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: '#4AC97F' } }}
            >
              结账
            </Button>
          )}
          {isSettled && (
            <Button
              startIcon={<ReceiptLongIcon />}
              onClick={() => handleSettle(selectedRecord!)}
              sx={{ color: 'success.main' }}
            >
              查看结算单
            </Button>
          )}
          <Button onClick={() => setDetailVisible(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 结算单 */}
      <SettlementDialog
        open={settleVisible}
        demand={selectedRecord}
        readonly={settleReadonly}
        loading={settling}
        onClose={() => setSettleVisible(false)}
        onConfirm={settleReadonly ? undefined : handleConfirmSettle}
        onUnsettle={settleReadonly ? handleConfirmUnsettle : undefined}
      />

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
