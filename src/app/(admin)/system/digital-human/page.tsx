'use client';

import React from 'react';
import {
  Box,
  Container,
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
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Tabs,
  Tab,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import QueueRoundedIcon from '@mui/icons-material/QueueRounded';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import FaceRoundedIcon from '@mui/icons-material/FaceRounded';
import Face2RoundedIcon from '@mui/icons-material/Face2Rounded';
import MicExternalOnRoundedIcon from '@mui/icons-material/MicExternalOnRounded';
import GestureRoundedIcon from '@mui/icons-material/GestureRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';

// ── 类型 ──
interface DHAsset {
  id: number;
  name: string;
  style: string;
  status: string;
  statusLabel: string;
  thumbnail: string;
  modelFile: string;
  blendShapeCount: number;
  animationCount: number;
  outfitCount: number;
  sceneCount: number;
  createdAt: string;
  updatedAt: string;
  pipelineStage: string;
  quality: number;
  size: number;
  conversations: number;
}

interface DHJob {
  id: number;
  name: string;
  type: string;
  status: string;
  progress: number;
  createdAt: string;
  finishedAt?: string;
  log: string;
}

const STATUS_CHIP_COLORS: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
  online: 'success', training: 'warning', draft: 'default', deployed: 'success',
};
const JOB_STATUS_ICONS: Record<string, React.ReactNode> = {
  running: <HourglassEmptyRoundedIcon sx={{ fontSize: 16, color: '#FFB400' }} />,
  completed: <CheckCircleRoundedIcon sx={{ fontSize: 16, color: '#5DDB96' }} />,
  failed: <ErrorOutlineRoundedIcon sx={{ fontSize: 16, color: '#FE2C55' }} />,
  queued: <QueueRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />,
};

function useDigitalHuman() {
  const assets = useQuery<DHAsset[]>({
    queryKey: ['digital-human', 'assets'],
    queryFn: async () => [
      { id: 1, name: '清秋月·标准', avatar: '', gender: 'female', style: '二次元', status: 'online', quality: 96, conversations: 12850, lastActive: '2026-07-03T10:30:00', createTime: '2026-01-15T08:00:00', pipelineStatus: 'completed' as const, pipelineProgress: 100 },
      { id: 2, name: '小助手·Pro', avatar: '', gender: 'male', style: '写实', status: 'online', quality: 92, conversations: 8320, lastActive: '2026-07-03T09:15:00', createTime: '2026-03-20T10:00:00', pipelineStatus: 'completed' as const, pipelineProgress: 100 },
      { id: 3, name: '配音员·A', avatar: '', gender: 'female', style: '广播剧', status: 'online', quality: 88, conversations: 5600, lastActive: '2026-07-02T22:00:00', createTime: '2026-05-10T14:00:00', pipelineStatus: 'completed' as const, pipelineProgress: 100 },
      { id: 4, name: '小说家·Beta', avatar: '', gender: 'male', style: '文学', status: 'training', quality: 74, conversations: 1200, lastActive: '2026-07-03T06:00:00', createTime: '2026-06-28T09:00:00', pipelineStatus: 'training' as const, pipelineProgress: 68 },
      { id: 5, name: '小悠·V2', avatar: '', gender: 'female', style: '二次元', status: 'offline', quality: 85, conversations: 4200, lastActive: '2026-06-20T16:00:00', createTime: '2026-04-05T11:00:00', pipelineStatus: 'completed' as const, pipelineProgress: 100 },
      { id: 6, name: '客服Bot', avatar: '', gender: 'male', style: '商务', status: 'online', quality: 90, conversations: 25100, lastActive: '2026-07-03T11:00:00', createTime: '2026-02-10T08:00:00', pipelineStatus: 'completed' as const, pipelineProgress: 100 },
      { id: 7, name: '虚拟主播·星', avatar: '', gender: 'female', style: '二次元', status: 'training', quality: 62, conversations: 350, lastActive: '2026-07-01T20:00:00', createTime: '2026-07-01T15:00:00', pipelineStatus: 'training' as const, pipelineProgress: 45 },
      { id: 8, name: '口型测试·C', avatar: '', gender: 'male', style: '写实', status: 'offline', quality: 55, conversations: 80, lastActive: '2026-06-15T12:00:00', createTime: '2026-06-10T09:00:00', pipelineStatus: 'failed' as const, pipelineProgress: 32 },
    ],
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
  const jobs = useQuery<DHJob[]>({
    queryKey: ['digital-human', 'recent-jobs'],
    queryFn: async () => [
      { id: 1, name: '清秋月·标准 — 语音合成', type: '合成', status: 'completed', progress: 100, createTime: '2026-07-03T10:25:00' },
      { id: 2, name: '小助手·Pro — 口型校准', type: '校准', status: 'completed', progress: 100, createTime: '2026-07-03T09:10:00' },
      { id: 3, name: '虚拟主播·星 — 动作绑定', type: '动作', status: 'running', progress: 65, createTime: '2026-07-03T11:00:00' },
      { id: 4, name: '小说家·Beta — 表情生成', type: '表情', status: 'running', progress: 42, createTime: '2026-07-03T10:30:00' },
      { id: 5, name: '客服Bot — 知识库更新', type: '数据', status: 'queued', progress: 0, createTime: '2026-07-03T11:15:00' },
      { id: 6, name: '配音员·A — 模型微调', type: '训练', status: 'completed', progress: 100, createTime: '2026-07-02T18:00:00' },
    ],
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
  return { assets, jobs };
}

// ── 格式化 ──
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmt(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

export default function SystemDigitalHumanPage() {
  const { assets, jobs } = useDigitalHuman();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState(0);
  const [snack, setSnack] = React.useState('');
  const [detailAsset, setDetailAsset] = React.useState<DHAsset | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<DHAsset | null>(null);

  const startJob = useMutation({
    mutationFn: (type: string) => {
      // 本地模拟:添加一个新任务到列表
      const typeNames: Record<string, string> = { synthesize: '合成', calibrate: '校准', motion: '动作', emotion: '表情', train: '训练', data: '数据' };
      const current = queryClient.getQueryData<DHJob[]>(['digital-human', 'recent-jobs']) || [];
      const newJob: DHJob = { id: Date.now(), name: `新任务 — ${typeNames[type] || type}`, type: typeNames[type] || type, status: 'queued', progress: 0, createTime: new Date().toISOString() };
      queryClient.setQueryData(['digital-human', 'recent-jobs'], [newJob, ...current]);
      return Promise.resolve();
    },
    onSuccess: () => { setSnack('任务已提交'); },
    onError: () => { setSnack('任务提交失败'); },
  });

  const onlineCount = (assets.data || []).filter((a: DHAsset) => a.status === 'online').length;
  const trainingCount = (assets.data || []).filter((a: DHAsset) => a.status === 'training').length;
  const totalConversations = (assets.data || []).reduce((acc: number, a: DHAsset) => acc + a.conversations, 0);
  const totalSize = (assets.data || []).reduce((acc: number, a: DHAsset) => acc + a.size, 0);

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
            onClick={() => { assets.refetch(); jobs.refetch(); }}
          >
            刷新
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => router.push('/avatar-pipeline')}
          >
            创建数字人
          </Button>
        </Box>
      </Box>

      {/* ── 概览卡片 ── */}
      {assets.isLoading ? (
        <Box sx={{ display: 'flex', gap: 2 }}>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rounded" width={200} height={100} />)}</Box>
      ) : assets.isError ? (
        <Alert severity="warning">资产数据加载中,请确认后端 API 已启动</Alert>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
          <Card variant="outlined"><CardContent sx={{ py: 2, textAlign: 'center' }}>
            <Typography variant="overline" color="text.secondary">资产总数</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>{(assets.data || []).length}</Typography>
          </CardContent></Card>
          <Card variant="outlined"><CardContent sx={{ py: 2, textAlign: 'center' }}>
            <Typography variant="overline" color="text.secondary">在线</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>{onlineCount}</Typography>
          </CardContent></Card>
          <Card variant="outlined"><CardContent sx={{ py: 2, textAlign: 'center' }}>
            <Typography variant="overline" color="text.secondary">训练中</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>{trainingCount}</Typography>
          </CardContent></Card>
          <Card variant="outlined"><CardContent sx={{ py: 2, textAlign: 'center' }}>
            <Typography variant="overline" color="text.secondary">总对话数</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#8B5CF6' }}>{totalConversations.toLocaleString()}</Typography>
          </CardContent></Card>
        </Box>
      )}

      {/* ── Tab: 资产管理 / 任务管线 ── */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="我的数字人" />
        <Tab label="任务管线" />
      </Tabs>

      {/* ── 资产列表 ── */}
      {tab === 0 && (
        assets.isLoading ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="rounded" height={280} />)}
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
            {(assets.data || []).map((a: DHAsset) => (
              <Card
                key={a.id}
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                }}
                onClick={() => setDetailAsset(a)}
              >
                <Box sx={{ position: 'relative', pt: '75%', bgcolor: 'grey.100', overflow: 'hidden' }}>
                  <CardMedia
                    component="img"
                    image={a.thumbnail}
                    alt={a.name}
                    sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                    <Chip
                      label={a.statusLabel}
                      size="small"
                      color={STATUS_CHIP_COLORS[a.status]}
                      sx={{ fontWeight: 600, fontSize: 11 }}
                    />
                  </Box>
                  <Box sx={{ position: 'absolute', bottom: 8, left: 8 }}>
                    <Chip
                      label={a.style}
                      size="small"
                      variant="outlined"
                      sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white', borderColor: 'transparent', fontSize: 11 }}
                    />
                  </Box>
                </Box>
                <CardContent sx={{ py: 1.5, px: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>{a.name}</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    <Chip size="small" label={`BS×${a.blendShapeCount}`} variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                    <Chip size="small" label={`动作×${a.animationCount}`} variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                    <Chip size="small" label={`换装×${a.outfitCount}`} variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">{a.size}MB</Typography>
                    <Typography variant="caption" color="text.secondary">{fmt(a.conversations)} 对话</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={a.quality}
                    sx={{ mt: 1, height: 4, borderRadius: 2, bgcolor: alpha('#8B5CF6', 0.1), '& .MuiLinearProgress-bar': { bgcolor: a.quality >= 80 ? '#5DDB96' : a.quality >= 50 ? '#FFB400' : '#FE2C55', borderRadius: 2 } }}
                  />
                </CardContent>
              </Card>
            ))}
          </Box>
        )
      )}

      {/* ── 任务管线 ── */}
      {tab === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 快捷操作按钮 */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {[
              { label: '二次元生成', icon: <FaceRoundedIcon />, type: 'generate-anime', color: '#8B5CF6' },
              { label: '真人重建', icon: <Face2RoundedIcon />, type: 'rebuild-real', color: '#5B8DEF' },
              { label: '导入 Mixamo 动作', icon: <GestureRoundedIcon />, type: 'import-mixamo', color: '#FFB400' },
              { label: 'BlendShape 雕刻', icon: <AutoFixHighRoundedIcon />, type: 'sculpt-blendshape', color: '#FE2C55' },
            ].map((btn) => (
              <Button
                key={btn.type}
                variant="outlined"
                size="small"
                startIcon={btn.icon}
                disabled={startJob.isPending}
                onClick={() => startJob.mutate(btn.type)}
                sx={{ borderColor: alpha(btn.color, 0.3), color: btn.color, '&:hover': { borderColor: btn.color, bgcolor: alpha(btn.color, 0.05) } }}
              >
                {btn.label}
              </Button>
            ))}
          </Box>

          {/* 最近任务列表 */}
          <Card>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>最近任务</Typography>
              {jobs.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rounded" height={48} sx={{ mb: 1 }} />)
              ) : (
                <List dense disablePadding>
                  {(jobs.data || []).map((j: DHJob) => (
                    <React.Fragment key={j.id}>
                      <ListItem sx={{ px: 0, py: 1 }}>
                        <ListItemAvatar sx={{ minWidth: 36 }}>
                          <Avatar sx={{ width: 28, height: 28, bgcolor: 'action.hover' }}>
                            {JOB_STATUS_ICONS[j.status]}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={<Typography variant="body2" sx={{ fontSize: 13, fontWeight: 500 }}>{j.name}</Typography>}
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip
                                label={{ running: '运行中', completed: '已完成', failed: '失败', queued: '队列中' }[j.status]}
                                size="small"
                                color={{ running: 'warning', completed: 'success', failed: 'error', queued: 'default' }[j.status] as any}
                                sx={{ height: 20, fontSize: 10 }}
                              />
                              <Typography variant="caption" color="text.secondary">{fmtDate(j.createdAt)}</Typography>
                              {j.finishedAt && <Typography variant="caption" color="text.secondary">· 完成于 {fmtDate(j.finishedAt)}</Typography>}
                            </Box>
                          }
                        />
                        <Box sx={{ textAlign: 'right', minWidth: 100 }}>
                          {j.status === 'running' ? (
                            <>
                              <LinearProgress variant="determinate" value={j.progress} sx={{ width: 80, height: 6, borderRadius: 3, mb: 0.3 }} />
                              <Typography variant="caption" sx={{ fontSize: 10 }}>{j.progress}%</Typography>
                            </>
                          ) : j.status === 'completed' ? (
                            <Chip icon={<CheckCircleRoundedIcon />} label="100%" size="small" color="success" variant="outlined" sx={{ height: 22, fontSize: 10 }} />
                          ) : null}
                        </Box>
                      </ListItem>
                      <Divider component="li" />
                    </React.Fragment>
                  ))}
                  {(jobs.data || []).length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>暂无任务</Typography>
                  )}
                </List>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ── 管线文档(折叠) ── */}
      <Card variant="outlined" sx={{ mt: 1 }}>
        <CardContent sx={{ py: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>管线概览</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1 }}>
            <Box sx={{ p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#8B5CF6' }}>方式 A — Web UI (推荐)</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                二次元: 5 分钟 · 从 10 个预制角色选 → 命名 → 完成<br />
                真人: 30~60 分钟 · 上传视频 → COLMAP + 3DGS + Blender 绑骨
              </Typography>
            </Box>
            <Box sx={{ p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#5B8DEF' }}>方式 B — 命令行 (CI/CD)</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                bash scripts/avatar-pipeline.sh --input &lt;video&gt; --name &lt;name&gt;
              </Typography>
            </Box>
          </Box>
          <Button size="small" sx={{ mt: 1 }} onClick={() => router.push('/avatar-pipeline')}>
            打开 Web UI 创建数字人 →
          </Button>
        </CardContent>
      </Card>

      {/* ── 详情弹窗 ── */}
      <Dialog open={!!detailAsset} onClose={() => setDetailAsset(null)} maxWidth="sm" fullWidth>
        {detailAsset && (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {detailAsset.name}
              <Chip label={detailAsset.statusLabel} size="small" color={STATUS_CHIP_COLORS[detailAsset.status]} />
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Avatar src={detailAsset.thumbnail} variant="rounded" sx={{ width: 120, height: 120 }} />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>质量评分</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <LinearProgress
                      variant="determinate"
                      value={detailAsset.quality}
                      sx={{ width: 100, height: 8, borderRadius: 4, bgcolor: alpha('#8B5CF6', 0.1), '& .MuiLinearProgress-bar': { bgcolor: detailAsset.quality >= 80 ? '#5DDB96' : detailAsset.quality >= 50 ? '#FFB400' : '#FE2C55', borderRadius: 4 } }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{detailAsset.quality}%</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mt: 1.5 }}>规格</Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    BlendShape: {detailAsset.blendShapeCount} · 动作: {detailAsset.animationCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    换装: {detailAsset.outfitCount} · 场景: {detailAsset.sceneCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    文件大小: {detailAsset.size}MB
                  </Typography>
                </Box>
              </Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>管线阶段</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {['mesh', 'rig', 'blendshape', 'outfit', 'deployed'].map((stage, i) => {
                  const done = ['mesh', 'rig', 'blendshape', 'outfit', 'deployed'].indexOf(detailAsset.pipelineStage) >= i;
                  return (
                    <Chip
                      key={stage}
                      label={{ mesh: '网格重建', rig: '骨骼绑定', blendshape: '表情雕刻', outfit: '换装配置', deployed: '已部署' }[stage]}
                      size="small"
                      color={done ? 'primary' : 'default'}
                      variant={done ? 'filled' : 'outlined'}
                      sx={{ fontSize: 10 }}
                    />
                  );
                })}
              </Box>
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>统计</Typography>
              <Box sx={{ display: 'flex', gap: 3 }}>
                <Box><Typography variant="h6" sx={{ fontWeight: 700 }}>{detailAsset.conversations.toLocaleString()}</Typography><Typography variant="caption" color="text.secondary">对话</Typography></Box>
                <Box><Typography variant="h6" sx={{ fontWeight: 700 }}>{fmtDate(detailAsset.updatedAt)}</Typography><Typography variant="caption" color="text.secondary">最后更新</Typography></Box>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button size="small" onClick={() => setConfirmDelete(detailAsset)} color="error" startIcon={<DeleteOutlineRoundedIcon />}>删除</Button>
              <Button size="small" onClick={() => setDetailAsset(null)}>关闭</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ── 确认删除 ── */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>确定要删除数字人 「{confirmDelete?.name}」 吗?此操作不可撤销。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>取消</Button>
          <Button color="error" onClick={() => { setSnack(`已删除 ${confirmDelete?.name}`); setConfirmDelete(null); setDetailAsset(null); }}>确认删除</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}
