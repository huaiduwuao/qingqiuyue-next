'use client';

import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Grid,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Divider,
  Skeleton,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Drawer,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import QueueRoundedIcon from '@mui/icons-material/QueueRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';

// ── 类型 (对齐 Go studio.go) ──
interface DHAsset {
  id: string;
  name: string;
  mode: '3dgs' | '2d';
  status: 'ready' | 'training' | 'failed';
  active: boolean;
  published: boolean;
  thumbnail: string;
  sizeMB: number;
  joints: number;
  hasFlame: boolean;
  assetUrl: string;
  createdAt: string;
}

interface DHJob {
  id: string;
  name: string;
  method: string;
  source?: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'canceled';
  stage: string;
  progress: number;
  logs: string[];
  assetId?: string;
  createdAt: string;
}

const STAGE_LABELS: Record<string, string> = {
  capture: '采集素材',
  preprocess: '预处理',
  train: '训练',
  export: '导出',
  deploy: '部署',
};

const STATUS_LABELS: Record<string, string> = {
  queued: '队列中',
  running: '运行中',
  done: '已完成',
  failed: '失败',
  canceled: '已取消',
};

const JOB_STATUS_COLORS: Record<string, 'warning' | 'success' | 'error' | 'default'> = {
  queued: 'default',
  running: 'warning',
  done: 'success',
  failed: 'error',
  canceled: 'default',
};

const JOB_STATUS_ICONS: Record<string, React.ReactNode> = {
  queued: <QueueRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />,
  running: <HourglassEmptyRoundedIcon sx={{ fontSize: 16, color: '#FFB400' }} />,
  done: <CheckCircleRoundedIcon sx={{ fontSize: 16, color: '#5DDB96' }} />,
  failed: <ErrorOutlineRoundedIcon sx={{ fontSize: 16, color: '#FE2C55' }} />,
  canceled: <CancelRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />,
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ── API ──
async function fetchAssets(): Promise<{ list: DHAsset[] }> {
  const r = await fetch('/api/realtime/assets');
  if (!r.ok) throw new Error(`获取资产列表失败: ${r.status}`);
  return r.json();
}

async function deleteAsset(id: string): Promise<void> {
  const r = await fetch(`/api/realtime/assets/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`删除失败: ${r.status}`);
}

async function activateAsset(id: string): Promise<void> {
  const r = await fetch(`/api/realtime/assets/${id}/activate`, { method: 'POST' });
  if (!r.ok) throw new Error(`激活失败: ${r.status}`);
}

async function fetchJobs(): Promise<{ list: DHJob[] }> {
  const r = await fetch('/api/realtime/jobs');
  if (!r.ok) throw new Error(`获取任务列表失败: ${r.status}`);
  return r.json();
}

async function cancelJob(id: string): Promise<void> {
  const r = await fetch(`/api/realtime/jobs/${id}/cancel`, { method: 'POST' });
  if (!r.ok) throw new Error(`取消失败: ${r.status}`);
}

async function startTraining(name: string, method: string, source: string): Promise<{ jobId: string }> {
  const r = await fetch('/api/realtime/train', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, method, source }),
  });
  if (!r.ok) throw new Error(`启动训练失败: ${r.status}`);
  return r.json();
}

export default function SystemDigitalHumanPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);
  const [detailAsset, setDetailAsset] = useState<DHAsset | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DHAsset | null>(null);
  const [showJobLogs, setShowJobLogs] = useState<DHJob | null>(null);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createMethod, setCreateMethod] = useState('ExAvatar');

  // 创建数字人
  const handleCreate = () => {
    if (!createName.trim()) {
      setSnack({ msg: '请输入名称', severity: 'error' });
      return;
    }
    trainMutation.mutate({ name: createName, method: createMethod, source: '' });
    setShowCreatePanel(false);
    setCreateName('');
    setTab(1); // 切换到训练任务页
  };

  // 查询资产列表
  const { data: assetsData, isLoading: assetsLoading, isError: assetsError, refetch: refetchAssets } = useQuery({
    queryKey: ['avatar-assets'],
    queryFn: fetchAssets,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  // 查询任务列表
  const { data: jobsData, isLoading: jobsLoading, isError: jobsError, refetch: refetchJobs } = useQuery({
    queryKey: ['avatar-jobs'],
    queryFn: fetchJobs,
    refetchInterval: 5_000, // 任务状态变化快，更频繁轮询
    staleTime: 3_000,
  });

  // 删除资产
  const deleteMutation = useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => {
      setSnack({ msg: '删除成功', severity: 'success' });
      setConfirmDelete(null);
      setDetailAsset(null);
      queryClient.invalidateQueries({ queryKey: ['avatar-assets'] });
    },
    onError: (e: Error) => {
      setSnack({ msg: e.message, severity: 'error' });
    },
  });

  // 激活资产
  const activateMutation = useMutation({
    mutationFn: activateAsset,
    onSuccess: () => {
      setSnack({ msg: '已设为当前形象', severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['avatar-assets'] });
    },
    onError: (e: Error) => {
      setSnack({ msg: e.message, severity: 'error' });
    },
  });

  // 取消任务
  const cancelMutation = useMutation({
    mutationFn: cancelJob,
    onSuccess: () => {
      setSnack({ msg: '任务已取消', severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['avatar-jobs'] });
    },
    onError: (e: Error) => {
      setSnack({ msg: e.message, severity: 'error' });
    },
  });

  // 启动训练
  const trainMutation = useMutation({
    mutationFn: ({ name, method, source }: { name: string; method: string; source: string }) =>
      startTraining(name, method, source),
    onSuccess: () => {
      setSnack({ msg: '训练任务已提交', severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['avatar-jobs'] });
    },
    onError: (e: Error) => {
      setSnack({ msg: e.message, severity: 'error' });
    },
  });

  const assets = assetsData?.list || [];
  const jobs = jobsData?.list || [];
  const onlineCount = assets.filter(a => a.status === 'ready' && a.published).length;
  const trainingCount = assets.filter(a => a.status === 'training').length;

  const handleRefresh = useCallback(() => {
    refetchAssets();
    refetchJobs();
  }, [refetchAssets, refetchJobs]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ── 标题栏 ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary' }}>
            数字人资产管理
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
            Blender + COLMAP + 3DGS · 完全开源 · 商用干净
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={handleRefresh}
          >
            刷新
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => setShowCreatePanel(true)}
          >
            创建数字人
          </Button>
        </Box>
      </Box>

      {/* ── 概览卡片 ── */}
      {assetsLoading ? (
        <Box sx={{ display: 'flex', gap: 2 }}>{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rounded" width={200} height={100} />)}</Box>
      ) : assetsError ? (
        <Alert severity="error">资产数据加载失败，请确认后端 API 已启动</Alert>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
          <Card variant="outlined"><CardContent sx={{ py: 2, textAlign: 'center' }}>
            <Typography variant="overline" color="text.secondary">资产总数</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>{assets.length}</Typography>
          </CardContent></Card>
          <Card variant="outlined"><CardContent sx={{ py: 2, textAlign: 'center' }}>
            <Typography variant="overline" color="text.secondary">已就绪</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>{onlineCount}</Typography>
          </CardContent></Card>
          <Card variant="outlined"><CardContent sx={{ py: 2, textAlign: 'center' }}>
            <Typography variant="overline" color="text.secondary">训练中</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>{trainingCount}</Typography>
          </CardContent></Card>
        </Box>
      )}

      {/* ── Tab ── */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="我的数字人" />
        <Tab label="训练任务" />
      </Tabs>

      {/* ── 资产列表 ── */}
      {tab === 0 && (
        assetsLoading ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="rounded" height={280} />)}
          </Box>
        ) : assets.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <Typography color="text.secondary" sx={{ mb: 2 }}>暂无数字人资产</Typography>
              <Button variant="contained" onClick={() => setShowCreatePanel(true)}>
                创建第一个数字人
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
            {assets.map((a) => (
              <Card
                key={a.id}
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  borderColor: a.active ? 'primary.main' : 'divider',
                  borderWidth: a.active ? 2 : 1,
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                }}
                onClick={() => setDetailAsset(a)}
              >
                <Box sx={{ position: 'relative', pt: '75%', bgcolor: 'grey.100', overflow: 'hidden' }}>
                  <CardMedia
                    component="img"
                    image={a.thumbnail || 'https://picsum.photos/seed/default-avatar/200/300'}
                    alt={a.name}
                    sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5 }}>
                    {a.active && <Chip label="当前" size="small" color="primary" sx={{ fontWeight: 600, fontSize: 10 }} />}
                    <Chip
                      label={a.status === 'ready' ? '就绪' : a.status === 'training' ? '训练中' : '失败'}
                      size="small"
                      color={a.status === 'ready' ? 'success' : a.status === 'training' ? 'warning' : 'error'}
                      sx={{ fontWeight: 600, fontSize: 10 }}
                    />
                  </Box>
                  <Box sx={{ position: 'absolute', bottom: 8, left: 8 }}>
                    <Chip
                      label={a.mode === '3dgs' ? '3DGS' : '2D'}
                      size="small"
                      variant="outlined"
                      sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white', borderColor: 'transparent', fontSize: 10 }}
                    />
                  </Box>
                </Box>
                <CardContent sx={{ py: 1.5, px: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>{a.name}</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    <Chip size="small" label={`骨骼×${a.joints}`} variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                    {a.hasFlame && <Chip size="small" label="表情" variant="outlined" sx={{ height: 20, fontSize: 10 }} />}
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">{a.sizeMB}MB</Typography>
                    <Typography variant="caption" color="text.secondary">{fmtDate(a.createdAt)}</Typography>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )
      )}

      {/* ── 任务列表 ── */}
      {tab === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 快捷启动 */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>快速启动训练</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={trainMutation.isPending}
                  onClick={() => trainMutation.mutate({ name: '新数字人-' + Date.now(), method: 'ExAvatar', source: '' })}
                  sx={{ borderColor: alpha('#8B5CF6', 0.5), color: '#8B5CF6' }}
                >
                  启动训练 (ExAvatar)
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={trainMutation.isPending}
                  onClick={() => trainMutation.mutate({ name: '新数字人-' + Date.now(), method: 'Gaussian', source: '' })}
                  sx={{ borderColor: alpha('#5B8DEF', 0.5), color: '#5B8DEF' }}
                >
                  启动训练 (Gaussian)
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* 任务列表 */}
          <Card>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>训练任务</Typography>
              {jobsLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rounded" height={60} sx={{ mb: 1 }} />)
              ) : jobs.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  暂无训练任务
                </Typography>
              ) : (
                <List dense disablePadding>
                  {jobs.map((j) => (
                    <React.Fragment key={j.id}>
                      <ListItem
                        sx={{ px: 0, py: 1.5 }}
                        secondaryAction={
                          j.status === 'running' && (
                            <Button
                              size="small"
                              color="error"
                              onClick={() => cancelMutation.mutate(j.id)}
                              disabled={cancelMutation.isPending}
                              sx={{ mr: 1 }}
                            >
                              取消
                            </Button>
                          )
                        }
                      >
                        <ListItemAvatar sx={{ minWidth: 40 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: 'action.hover' }}>
                            {JOB_STATUS_ICONS[j.status]}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>{j.name}</Typography>
                              <Chip
                                label={j.method}
                                size="small"
                                variant="outlined"
                                sx={{ height: 18, fontSize: 10 }}
                              />
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <Chip
                                label={STATUS_LABELS[j.status]}
                                size="small"
                                color={JOB_STATUS_COLORS[j.status]}
                                sx={{ height: 20, fontSize: 10 }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {j.stage ? STAGE_LABELS[j.stage] || j.stage : '准备中'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                · {fmtDate(j.createdAt)}
                              </Typography>
                              {j.logs?.length > 0 && (
                                <Button
                                  size="small"
                                  sx={{ ml: 'auto', fontSize: 10, minWidth: 'auto', px: 1 }}
                                  onClick={() => setShowJobLogs(j)}
                                >
                                  日志
                                </Button>
                              )}
                            </Box>
                          }
                        />
                        <Box sx={{ minWidth: 100, textAlign: 'right', mr: 2 }}>
                          {j.status === 'running' ? (
                            <>
                              <LinearProgress
                                variant="determinate"
                                value={j.progress}
                                sx={{ width: 80, height: 6, borderRadius: 3, mx: 'auto', mb: 0.3 }}
                              />
                              <Typography variant="caption" sx={{ fontSize: 10 }}>{j.progress}%</Typography>
                            </>
                          ) : j.status === 'done' ? (
                            <Chip icon={<CheckCircleRoundedIcon />} label="完成" size="small" color="success" variant="outlined" sx={{ height: 22, fontSize: 10 }} />
                          ) : null}
                        </Box>
                      </ListItem>
                      <Divider component="li" />
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ── 详情弹窗 ── */}
      <Dialog open={!!detailAsset} onClose={() => setDetailAsset(null)} maxWidth="sm" fullWidth>
        {detailAsset && (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {detailAsset.name}
              <Chip
                label={detailAsset.status === 'ready' ? '就绪' : detailAsset.status === 'training' ? '训练中' : '失败'}
                size="small"
                color={detailAsset.status === 'ready' ? 'success' : detailAsset.status === 'training' ? 'warning' : 'error'}
              />
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Avatar
                  src={detailAsset.thumbnail || 'https://picsum.photos/seed/default-avatar/200/300'}
                  variant="rounded"
                  sx={{ width: 120, height: 160 }}
                />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>规格</Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    类型: {detailAsset.mode === '3dgs' ? '3DGS 动态' : '2D 片段'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    骨骼: {detailAsset.joints}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    表情系统: {detailAsset.hasFlame ? '已启用' : '未启用'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    大小: {detailAsset.sizeMB}MB
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
                    创建: {fmtDate(detailAsset.createdAt)}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                {detailAsset.published && <Chip label="已发布" size="small" color="success" />}
                {detailAsset.active && <Chip label="当前形象" size="small" color="primary" />}
              </Box>
              {detailAsset.assetUrl && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-all' }}>
                  模型地址: {detailAsset.assetUrl}
                </Typography>
              )}
            </DialogContent>
            <DialogActions>
              {!detailAsset.active && detailAsset.status === 'ready' && (
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => activateMutation.mutate(detailAsset.id)}
                  disabled={activateMutation.isPending}
                >
                  设为当前形象
                </Button>
              )}
              <Button size="small" color="error" onClick={() => setConfirmDelete(detailAsset)} startIcon={<DeleteOutlineRoundedIcon />}>
                删除
              </Button>
              <Button size="small" onClick={() => setDetailAsset(null)}>关闭</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ── 确认删除 ── */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>确定要删除数字人 「{confirmDelete?.name}」 吗？此操作不可撤销。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>取消</Button>
          <Button
            color="error"
            onClick={() => deleteMutation.mutate(confirmDelete!.id)}
            disabled={deleteMutation.isPending}
          >
            确认删除
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── 任务日志 ── */}
      <Dialog open={!!showJobLogs} onClose={() => setShowJobLogs(null)} maxWidth="md" fullWidth>
        {showJobLogs && (
          <>
            <DialogTitle>
              任务日志: {showJobLogs.name}
            </DialogTitle>
            <DialogContent>
              <Box
                component="pre"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  bgcolor: 'grey.900',
                  color: 'grey.100',
                  p: 2,
                  borderRadius: 1,
                  maxHeight: 400,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {showJobLogs.logs?.join('\n') || '暂无日志'}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowJobLogs(null)}>关闭</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={!!snack}
        autoHideDuration={3000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack?.severity || 'info'} onClose={() => setSnack(null)} sx={{ width: '100%' }}>
          {snack?.msg}
        </Alert>
      </Snackbar>

      {/* 创建数字人面板 */}
      <Drawer
        anchor="right"
        open={showCreatePanel}
        onClose={() => setShowCreatePanel(false)}
        slotProps={{ paper: { sx: { width: 400, p: 3 } } }}
      >
        <Typography variant="h6" sx={{ mb: 3 }}>创建数字人</Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            label="数字人名称"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="如：我的数字人"
            fullWidth
            autoFocus
          />

          <FormControl fullWidth>
            <InputLabel>训练方法</InputLabel>
            <Select
              value={createMethod}
              label="训练方法"
              onChange={(e) => setCreateMethod(e.target.value)}
            >
              <MenuItem value="ExAvatar">ExAvatar（快速）</MenuItem>
              <MenuItem value="Gaussian">Gaussian（高质量）</MenuItem>
            </Select>
          </FormControl>

          <Alert severity="info" sx={{ fontSize: 12 }}>
            训练过程大约需要 30-60 分钟，完成后可在「我的数字人」中查看。
          </Alert>

          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Button variant="outlined" onClick={() => setShowCreatePanel(false)} sx={{ flex: 1 }}>
              取消
            </Button>
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={trainMutation.isPending}
              sx={{ flex: 1 }}
            >
              {trainMutation.isPending ? '创建中...' : '开始训练'}
            </Button>
          </Box>
        </Box>
      </Drawer>
    </Box>
  );
}
