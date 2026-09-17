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
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import { ListLayout, ListLayoutSwitch, LIST_ROW } from '@/components/common/ListLayout';
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
import { myPage, process, remove, save, update, settleDemand } from '@/apis/reward-demand';
import { listTasks } from '@/apis/reward-task';
import { mapRewardTaskListFromBackend, normalizeRewardTaskStatus, REWARD_TASK_STATUS_LABEL } from '../taskboard/status';
import { SettlementDialog } from './SettlementDialog';
import { BotBadge } from '@/components/community/UserLine';
import type { DemandItem, DemandStatus, RewardTask, RewardTaskStatus } from '@/beans/reward';

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

export default function DemandPage({ groupId, onOpenTaskboard }: Props) {
  const [tab, setTab] = useState<DemandStatus | ''>('');
  const [writeVisible, setWriteVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [settleVisible, setSettleVisible] = useState(false);
  const [settleReadonly, setSettleReadonly] = useState(false);
  const [settling, setSettling] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DemandItem | null>(null);
  const [relatedTasks, setRelatedTasks] = useState<RewardTask[]>([]);
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
    queryFn: () => myPage({ page, pageSize, groupId, status: tab || undefined, keyword }).then((r) => ({
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
      const taskRes: any = await listTasks({ demandId, pageSize: 100 });
      setRelatedTasks(mapRewardTaskListFromBackend(taskRes?.data?.records || []));
    } catch (e) {
      console.error('Failed to load related tasks', e);
      setRelatedTasks([]);
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
      endTime: record?.endTime ? String(record.endTime).slice(0, 10) : '',
    });
    setWriteVisible(true);
  };

  const handleDetail = (record: DemandItem) => {
    setSelectedRecord(record);
    setDetailVisible(true);
    loadRelatedTasks(record.id as number);
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
      if (res?.code === 200 || res?.code === 0) {
        showMessage('结账成功,赏金已发放给贡献者');
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

  const handleFormChange = (field: string, value: any) => {
    setFormValues((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!String(formValues.title || '').trim()) {
      showMessage('请填写标题', 'error');
      return;
    }
    // 截止日期按当天 23:59:59 计;不填表示长期有效
    const payload = {
      ...formValues,
      pay: Number(formValues.pay) || 0,
      endTime: formValues.endTime ? new Date(`${formValues.endTime}T23:59:59`).toISOString() : null,
    };
    try {
      if (selectedRecord?.id) {
        await update({ ...selectedRecord, ...payload });
        showMessage('更新成功');
      } else {
        await save({ ...payload, groupId });
        showMessage('已创建为待发布,发布时赏金将从钱包托管');
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
    const pay = Number(record.pay) || 0;
    const tip =
      status === 'PUBLISHED'
        ? pay > 0
          ? `发布后将从你的钱包托管赏金 ¥${pay},结账时付给验收通过的贡献者,未分配的部分退回。确定发布?`
          : '确定发布这条需求?'
        : '关闭后托管的赏金会退回你的钱包,已认领的任务将不能再提交。确定关闭?';
    if (!confirm(tip)) return;
    try {
      const res: any = await process({ id: record.id, status });
      showMessage(status === 'PUBLISHED' ? '已发布' : '已关闭,托管赏金已退回');
      query.refetch();
      if (detailVisible && selectedRecord?.id === record.id) {
        setSelectedRecord(res?.data ?? { ...selectedRecord, status });
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
        <ListLayoutSwitch sx={{ ml: 'auto' }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleEdit({} as DemandItem)} sx={{ flexShrink: 0 }}>
          新建需求
        </Button>
      </Box>

      {/* 卡片列表 */}
      <ListLayout minColumnWidth={300} gap={16}>
        {(query.data?.records || []).map((item) => {
          const meta = STATUS_META[(item.status as DemandStatus) || 'PENDING'] || STATUS_META.PENDING;
          return (
            <Card key={item.id} sx={{ height: '100%', display: 'flex', flexDirection: 'column', cursor: 'pointer', [LIST_ROW]: { flexDirection: 'row', flexWrap: { xs: 'wrap', sm: 'nowrap' } } }}
                  onClick={() => handleDetail(item)}>
              <CardMedia
                component="div"
                sx={{
                  height: 120,
                  backgroundColor: item.cover ? 'transparent' : 'action.hover',
                  backgroundImage: item.cover ? `url(${item.cover})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  [LIST_ROW]: { width: { xs: 120, sm: 200 }, flexShrink: 0, height: 'auto', minHeight: 96 },
                }}
              >
                {!item.cover && (
                  <Typography variant="h4" sx={{ color: '#ccc' }}>
                    {item.title?.charAt(0) || '?'}
                  </Typography>
                )}
              </CardMedia>
              <CardContent sx={{ flex: 1, [LIST_ROW]: { minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}>
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
              <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end', gap: 0.5, [LIST_ROW]: { flexBasis: { xs: '100%', sm: 'auto' }, flexShrink: 0, alignItems: 'center' } }} onClick={(e) => e.stopPropagation()}>
                {onOpenTaskboard && ((item.taskIds?.length || 0) > 0 || item.status === 'PENDING' || item.status === 'PUBLISHED') && (
                  <Button
                    size="small"
                    startIcon={<ViewKanbanIcon sx={{ fontSize: 14 }} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTaskboard(item.id as number);
                    }}
                    sx={{ color: '#06B6D4', textTransform: 'none', fontSize: 12 }}
                  >
                    {(item.taskIds?.length || 0) > 0 ? '查看任务' : '拆分任务'}
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
          );
        })}
      </ListLayout>

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
              label="赏金(元)"
              type="number"
              value={formValues.pay ?? 0}
              onChange={(e) => handleFormChange('pay', e.target.value)}
              fullWidth
              disabled={!!selectedRecord?.id && selectedRecord.status !== 'PENDING'}
              helperText={
                selectedRecord?.id && selectedRecord.status !== 'PENDING'
                  ? '发布后赏金已托管,不能再修改'
                  : '发布时从你的钱包托管这笔赏金;拆分任务后,验收通过的贡献者在结账时分得'
              }
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
            />
            <TextField
              label="截止日期(可选)"
              type="date"
              value={formValues.endTime || ''}
              onChange={(e) => handleFormChange('endTime', e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              helperText="过了截止日期就不能再认领任务;不填表示长期有效"
            />
            <TextField
              select
              label="分类"
              value={formValues.category || ''}
              onChange={(e) => handleFormChange('category', e.target.value)}
              fullWidth
            >
              <MenuItem value="">未分类</MenuItem>
              <MenuItem value="video">短视频</MenuItem>
              <MenuItem value="image">图文</MenuItem>
              <MenuItem value="novel">小说</MenuItem>
              <MenuItem value="art">画作</MenuItem>
              <MenuItem value="music">音乐</MenuItem>
              <MenuItem value="film">短剧</MenuItem>
              <MenuItem value="live">直播</MenuItem>
              <MenuItem value="voice">配音</MenuItem>
            </TextField>
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
            <Chip label={`赏金 ¥${selectedRecord?.pay || 0}`} variant="outlined" />
            {(selectedRecord?.escrowCents ?? 0) > 0 && (
              <Chip
                label={`托管中 ¥${((selectedRecord?.escrowCents ?? 0) / 100).toFixed(2)}`}
                sx={{ bgcolor: 'rgba(93, 219, 150, 0.12)', color: 'success.main' }}
              />
            )}
            {selectedRecord?.endTime && (
              <Chip label={`截止 ${new Date(selectedRecord.endTime).toLocaleDateString()}`} variant="outlined" />
            )}
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
                    bgcolor: 'action.hover',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Box sx={{ width: 6, height: 28, borderRadius: 1, bgcolor: TASK_STATUS_COLOR[normalizeRewardTaskStatus(t.status)] }} />
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                    {t.title}
                  </Typography>
                  {t.assigneeName && (
                    <Typography variant="caption" color="text.secondary">
                      {t.assigneeName}
                    </Typography>
                  )}
                  <Chip
                    label={REWARD_TASK_STATUS_LABEL[normalizeRewardTaskStatus(t.status)]}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: 10,
                      bgcolor: `${TASK_STATUS_COLOR[normalizeRewardTaskStatus(t.status)]}20`,
                      color: TASK_STATUS_COLOR[normalizeRewardTaskStatus(t.status)],
                      fontWeight: 600,
                    }}
                  />
                </Box>
              ))}
            </Box>
          ) : null}

          <Box sx={{ mt: 3, display: 'flex', gap: 1, alignItems: 'center' }}>
            <Avatar sx={{ width: 32, height: 32 }} src={selectedRecord?.avatar} />
            <Typography variant="caption">{selectedRecord?.username || '未知用户'}</Typography>
            {selectedRecord?.isBot && <BotBadge />}
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
          {(isCompleted || (isPublished && completedCount > 0)) && (
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
