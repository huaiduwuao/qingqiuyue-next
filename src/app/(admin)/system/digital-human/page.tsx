'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
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
  AlertTitle,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Tabs,
  Tab,
  Drawer,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Checkbox,
  FormControlLabel,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import QueueRoundedIcon from '@mui/icons-material/QueueRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { CoverImage } from '@/components/common/CoverImage';
import {
  studioApi,
  fetchClipList,
  canCancel,
  missingCapabilities,
  needsHint,
  pickMethod,
  JOB_STATUS_LABELS,
  STAGE_LABELS,
  CLIP_LABELS,
  type DHAsset,
  type DHJob,
  type JobStatus,
  type StudioCapabilities,
} from '@/lib/avatarStudio';

const JOB_STATUS_COLORS: Record<JobStatus, 'warning' | 'success' | 'error' | 'default' | 'info'> = {
  queued: 'info',
  running: 'warning',
  done: 'success',
  failed: 'error',
  canceled: 'default',
};

const JOB_STATUS_ICONS: Record<JobStatus, React.ReactNode> = {
  queued: <QueueRoundedIcon sx={{ fontSize: 16, color: 'info.main' }} />,
  running: <HourglassEmptyRoundedIcon sx={{ fontSize: 16, color: 'warning.main' }} />,
  done: <CheckCircleRoundedIcon sx={{ fontSize: 16, color: 'success.main' }} />,
  failed: <ErrorOutlineRoundedIcon sx={{ fontSize: 16, color: 'error.main' }} />,
  canceled: <CancelRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />,
};

const ASSET_STATUS: Record<DHAsset['status'], { label: string; color: 'success' | 'warning' | 'error' }> = {
  ready: { label: '就绪', color: 'success' },
  training: { label: '训练中', color: 'warning' },
  failed: { label: '失败', color: 'error' },
};

function fmtDate(s?: string) {
  if (!s) return '';
  return new Date(s).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function CapChip({ ok, label, tip }: { ok: boolean; label: string; tip: string }) {
  return (
    <Tooltip title={tip}>
      <Chip
        size="small"
        variant="outlined"
        color={ok ? 'success' : 'error'}
        icon={ok ? <CheckCircleRoundedIcon /> : <ErrorOutlineRoundedIcon />}
        label={`${label}:${ok ? '可用' : '缺失'}`}
      />
    </Tooltip>
  );
}

/** 训练能力:哪些方式能跑、缺什么。数据来自 GET /api/realtime/capabilities,不是前端猜的。 */
function CapabilitiesCard({ caps, loading, error }: { caps?: StudioCapabilities; loading: boolean; error: Error | null }) {
  if (loading) return <Skeleton variant="rounded" height={120} />;
  if (error || !caps) return <Alert severity="error">训练能力获取失败{error ? `:${error.message}` : ''}</Alert>;
  const missing = missingCapabilities(caps);
  return (
    <Card variant="outlined">
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>训练能力</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <CapChip ok={caps.storage} label="对象存储" tip="素材原件与产物都存 MinIO" />
          <CapChip ok={caps.ffmpeg} label="ffmpeg" tip="2D 片段转码 H.264 与截封面" />
          <CapChip ok={caps.trainCmd} label="GPU 训练节点" tip="AVATAR_TRAIN_CMD,3DGS 训练必须" />
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1 }}>
          {caps.methods.map((m) => (
            <Box key={m.key} sx={{ p: 1.25, borderRadius: 1, border: 1, borderColor: m.available ? 'success.main' : 'divider', minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>{m.label}</Typography>
                <Chip size="small" label={m.available ? '可用' : '不可用'} color={m.available ? 'success' : 'default'} sx={{ height: 20, fontSize: 11 }} />
              </Box>
              <Typography variant="caption" color="text.secondary" component="div">
                {m.mode === '3dgs' ? '3DGS 可驱动形象' : '2D 真人片段'} · {m.needsGpu ? '需要 GPU' : 'CPU 即可'}
              </Typography>
              {!m.available && m.reason && (
                <Typography variant="caption" color="error.main" component="div" sx={{ mt: 0.5 }}>{m.reason}</Typography>
              )}
              {!m.available && m.needs && (
                <Chip size="small" variant="outlined" color="error" label={`缺 ${m.needs}`} sx={{ mt: 0.5, height: 20, fontSize: 11 }} />
              )}
            </Box>
          ))}
        </Box>
        {missing.length > 0 && (
          <Alert severity="warning" sx={{ fontSize: 12 }}>
            {missing.map((x) => <div key={x.key}><b>{x.key}</b>:{x.text}</div>)}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

/** 2D 资产的片段:读资产目录里的 clips.json,逐段可预览。 */
function ClipPreview({ asset }: { asset: DHAsset }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['avatar-clips', asset.id, asset.assetUrl],
    queryFn: () => fetchClipList(asset),
    enabled: asset.mode === '2d' && !!asset.assetUrl,
    staleTime: 60_000,
  });
  if (!asset.assetUrl) return <Alert severity="warning">资产没有目录地址,片段不可用</Alert>;
  if (isLoading) return <Skeleton variant="rounded" height={120} />;
  if (error) return <Alert severity="error">{(error as Error).message}</Alert>;
  if (!data || data.length === 0) return <Alert severity="warning">clips.json 里没有可用片段</Alert>;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1 }}>
      {data.map((c) => (
        <Box key={c.key} sx={{ minWidth: 0 }}>
          <Box component="video" src={c.url} controls muted loop={c.loop} preload="metadata" playsInline
            sx={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 1, bgcolor: 'common.black', display: 'block' }} />
          <Typography variant="caption" color="text.secondary" component="div" noWrap>
            {CLIP_LABELS[c.key] || c.key}({c.key}){c.loop ? ' · 循环' : ''}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function JobRow({ j, onCancel, cancelling, onLogs }: { j: DHJob; onCancel: () => void; cancelling: boolean; onLogs: () => void }) {
  const hasLogs = (j.logs?.length ?? 0) > 0;
  return (
    <ListItem sx={{ px: 0, py: 1.5, display: 'block' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ListItemAvatar sx={{ minWidth: 40 }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'action.hover' }}>{JOB_STATUS_ICONS[j.status]}</Avatar>
        </ListItemAvatar>
        <ListItemText
          sx={{ minWidth: 0 }}
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{j.name}</Typography>
              <Chip label={j.method} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
            </Box>
          }
          secondary={
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
              <Chip label={JOB_STATUS_LABELS[j.status] || j.status} size="small" color={JOB_STATUS_COLORS[j.status] || 'default'} sx={{ height: 20, fontSize: 10 }} />
              {j.stage && (
                <Typography variant="caption" color="text.secondary" component="span">{STAGE_LABELS[j.stage] || j.stage}</Typography>
              )}
              <Typography variant="caption" color="text.secondary" component="span">
                · 建于 {fmtDate(j.createdAt)}
                {j.finishedAt ? ` · 结束 ${fmtDate(j.finishedAt)}` : j.startedAt ? ` · 开始 ${fmtDate(j.startedAt)}` : ''}
              </Typography>
            </Box>
          }
          slotProps={{ secondary: { component: 'div' } }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          {hasLogs && <Button size="small" sx={{ minWidth: 'auto', px: 1 }} onClick={onLogs}>日志</Button>}
          {canCancel(j.status) && (
            <Button size="small" color="error" onClick={onCancel} disabled={cancelling}>取消</Button>
          )}
        </Box>
      </Box>
      {(j.status === 'running' || j.status === 'queued') && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 5, mt: 0.75 }}>
          <LinearProgress
            variant={j.status === 'queued' ? 'indeterminate' : 'determinate'}
            value={Math.max(0, Math.min(100, j.progress || 0))}
            color={j.status === 'queued' ? 'info' : 'warning'}
            sx={{ flex: 1, height: 6, borderRadius: 3 }}
          />
          <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'right' }}>
            {j.status === 'queued' ? '排队中' : `${j.progress || 0}%`}
          </Typography>
        </Box>
      )}
      {j.status === 'failed' && (
        <Alert severity="error" sx={{ ml: 5, mt: 0.75, fontSize: 12 }}>
          {j.failReason || '失败原因未记录,请看日志'}
          {j.needs && (
            <Box sx={{ mt: 0.5 }}>
              <Chip size="small" color="error" variant="outlined" label={`缺 ${j.needs}`} sx={{ height: 20, fontSize: 11, mr: 1 }} />
              <Typography variant="caption" component="span">{needsHint(j.needs)}</Typography>
            </Box>
          )}
        </Alert>
      )}
      {j.status === 'canceled' && j.failReason && (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ pl: 5, mt: 0.5 }}>{j.failReason}</Typography>
      )}
    </ListItem>
  );
}

export default function SystemDigitalHumanPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);
  const [detailAsset, setDetailAsset] = useState<DHAsset | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DHAsset | null>(null);
  const [logsJobId, setLogsJobId] = useState<string | null>(null);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [createName, setCreateName] = useState('');
  // null = 还没手选,按能力自动落到第一个可用的方式
  const [pickedMethod, setCreateMethod] = useState<string | null>(null);
  const [createSources, setCreateSources] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const capsQ = useQuery({ queryKey: ['avatar-capabilities'], queryFn: studioApi.capabilities, staleTime: 30_000, refetchInterval: 60_000 });
  const assetsQ = useQuery({ queryKey: ['avatar-assets'], queryFn: studioApi.assets, refetchInterval: 15_000, staleTime: 10_000 });
  const jobsQ = useQuery({
    queryKey: ['avatar-jobs'],
    queryFn: studioApi.jobs,
    // 有排队/运行中的任务时 3 秒一轮,否则 15 秒
    refetchInterval: (q) => ((q.state.data ?? []).some((j) => canCancel(j.status)) ? 3_000 : 15_000),
    staleTime: 2_000,
  });
  const materialsQ = useQuery({ queryKey: ['avatar-materials'], queryFn: studioApi.materials, staleTime: 30_000 });

  const caps = capsQ.data;
  const assets = assetsQ.data ?? [];
  const jobs = jobsQ.data ?? [];
  const materials = materialsQ.data ?? [];
  const createMethod = pickedMethod ?? pickMethod(caps, 'Clip2D');
  const methodCap = caps?.methods.find((m) => m.key === createMethod);

  // 任务跑完会新登记资产,顺手刷新资产列表
  const doneCount = jobs.filter((j) => j.status === 'done').length;
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['avatar-assets'] });
  }, [doneCount, queryClient]);

  const onErr = (e: Error) => setSnack({ msg: e.message, severity: 'error' });

  const deleteMutation = useMutation({
    mutationFn: studioApi.deleteAsset,
    onSuccess: () => {
      setSnack({ msg: '删除成功', severity: 'success' });
      setConfirmDelete(null);
      setDetailAsset(null);
      queryClient.invalidateQueries({ queryKey: ['avatar-assets'] });
    },
    onError: onErr,
  });

  const activateMutation = useMutation({
    mutationFn: studioApi.activateAsset,
    onSuccess: () => {
      setSnack({ msg: '已设为当前形象', severity: 'success' });
      setDetailAsset(null);
      queryClient.invalidateQueries({ queryKey: ['avatar-assets'] });
    },
    onError: onErr,
  });

  const cancelMutation = useMutation({
    mutationFn: studioApi.cancelJob,
    onSuccess: (r) => {
      setSnack({ msg: r?.status === 'running' ? '已通知执行实例停止' : '任务已取消', severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['avatar-jobs'] });
    },
    onError: onErr,
  });

  const trainMutation = useMutation({
    mutationFn: (v: { name: string; method: string; source: string }) => studioApi.train(v.name, v.method, v.source),
    onSuccess: () => {
      setSnack({ msg: '训练任务已提交', severity: 'success' });
      setShowCreatePanel(false);
      setCreateName('');
      setCreateSources([]);
      setTab(1);
      queryClient.invalidateQueries({ queryKey: ['avatar-jobs'] });
    },
    onError: onErr,
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      for (const f of files) await studioApi.uploadMaterial(f);
      return files.length;
    },
    onSuccess: (n) => {
      setSnack({ msg: `已上传 ${n} 个素材`, severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['avatar-materials'] });
    },
    onError: (e: Error) => {
      onErr(e);
      queryClient.invalidateQueries({ queryKey: ['avatar-materials'] });
    },
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: studioApi.deleteMaterial,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['avatar-materials'] }),
    onError: onErr,
  });

  const handleCreate = () => {
    if (!createName.trim()) return setSnack({ msg: '请输入名称', severity: 'error' });
    if (methodCap && !methodCap.available) return setSnack({ msg: methodCap.reason || '该训练方式当前不可用', severity: 'error' });
    if (methodCap?.mode === '2d' && createSources.length === 0) return setSnack({ msg: '真人片段需要至少选一段视频素材', severity: 'error' });
    trainMutation.mutate({ name: createName.trim(), method: createMethod, source: createSources.join(',') });
  };

  const activeJobs = jobs.filter((j) => canCancel(j.status)).length;
  const readyCount = assets.filter((a) => a.status === 'ready').length;
  const kw = keyword.trim().toLowerCase();
  const shownAssets = assets.filter((a) => (!kw || `${a.name} ${a.id}`.toLowerCase().includes(kw)) && (!statusFilter || a.status === statusFilter));
  const shownJobs = jobs.filter((j) => (!kw || `${j.name} ${j.id} ${j.method}`.toLowerCase().includes(kw)) && (!statusFilter || j.status === statusFilter));
  const shownMaterials = materials.filter((m) => !kw || `${m.name} ${m.id}`.toLowerCase().includes(kw));
  const statusOptions: Record<string, string> =
    tab === 0 ? { ready: '就绪', training: '训练中', failed: '失败' } : tab === 1 ? JOB_STATUS_LABELS : {};
  const logsJob = logsJobId ? jobs.find((j) => j.id === logsJobId) ?? null : null;
  // 2D 只吃视频;3DGS 交给外部脚本,图片也可以
  const pickableMaterials = materials.filter((m) => m.key && (methodCap?.mode !== '2d' || m.type !== 'image'));

  const handleRefresh = useCallback(() => {
    capsQ.refetch();
    assetsQ.refetch();
    jobsQ.refetch();
    materialsQ.refetch();
  }, [capsQ, assetsQ, jobsQ, materialsQ]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ── 标题栏 ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary' }}>数字人工作台</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
            素材 → 训练任务 → 资产。真人片段(2D)本机 CPU 出片;3DGS 需要接入 GPU 训练节点
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={handleRefresh}>刷新</Button>
          <Button size="small" variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setShowCreatePanel(true)}>新建训练</Button>
        </Box>
      </Box>

      <CapabilitiesCard caps={caps} loading={capsQ.isLoading} error={capsQ.error as Error | null} />

      {/* ── 概览 ── */}
      {assetsQ.isError ? (
        <Alert severity="error">资产数据加载失败:{(assetsQ.error as Error)?.message}</Alert>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
          {[
            { label: '资产总数', value: assets.length, color: 'text.primary' },
            { label: '已就绪', value: readyCount, color: 'success.main' },
            { label: '进行中任务', value: activeJobs, color: 'warning.main' },
            { label: '素材', value: materials.length, color: 'text.primary' },
          ].map((s) => (
            <Card key={s.label} variant="outlined"><CardContent sx={{ py: 2, textAlign: 'center' }}>
              <Typography variant="overline" color="text.secondary">{s.label}</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: s.color }}>
                {assetsQ.isLoading ? <Skeleton width={40} sx={{ mx: 'auto' }} /> : s.value}
              </Typography>
            </CardContent></Card>
          ))}
        </Box>
      )}

      {/* ── Tab ── */}
      <Tabs value={tab} onChange={(_, v) => { setTab(v); setStatusFilter(''); }} sx={{ borderBottom: 1, borderColor: 'divider' }} variant="scrollable" allowScrollButtonsMobile>
        <Tab label="我的数字人" />
        <Tab label={activeJobs > 0 ? `训练任务(${activeJobs})` : '训练任务'} />
        <Tab label="素材" />
      </Tabs>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: -1.5 }}>
        <TextField size="small" label={tab === 1 ? '任务名 / ID / 方法' : '名称 / ID'} value={keyword} onChange={(e) => setKeyword(e.target.value)} sx={{ width: 220 }} />
        {tab !== 2 && (
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel id="dh-status-filter" shrink>状态</InputLabel>
            <Select labelId="dh-status-filter" label="状态" value={statusFilter} displayEmpty notched onChange={(e) => setStatusFilter(e.target.value)}>
              <MenuItem value="">全部</MenuItem>
              {Object.entries(statusOptions).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </Select>
          </FormControl>
        )}
        {tab === 2 && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="video/*,image/*"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = '';
                if (files.length) uploadMutation.mutate(files);
              }}
            />
            <Button size="small" variant="outlined" startIcon={<UploadFileRoundedIcon />} disabled={uploadMutation.isPending || caps?.storage === false} onClick={() => fileInput.current?.click()}>
              {uploadMutation.isPending ? '上传中…' : '上传素材'}
            </Button>
          </>
        )}
      </Box>

      {/* ── 资产 ── */}
      {tab === 0 && (
        assetsQ.isLoading ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rounded" height={280} />)}
          </Box>
        ) : assets.length === 0 ? (
          <Card><CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary" sx={{ mb: 2 }}>还没有数字人资产。先在「素材」里上传视频,再新建一个训练任务</Typography>
            <Button variant="contained" onClick={() => setShowCreatePanel(true)}>新建训练</Button>
          </CardContent></Card>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
            {shownAssets.length === 0 && <Typography color="text.secondary">没有符合条件的数字人</Typography>}
            {shownAssets.map((a) => (
              <Card
                key={a.id}
                sx={{ cursor: 'pointer', transition: 'all 0.2s', borderColor: a.active ? 'primary.main' : 'divider', borderWidth: a.active ? 2 : 1, '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 } }}
                onClick={() => setDetailAsset(a)}
              >
                <Box sx={{ position: 'relative', pt: '75%', bgcolor: 'action.hover', overflow: 'hidden' }}>
                  <CoverImage src={a.thumbnail} alt={a.name} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5 }}>
                    {a.active && <Chip label="当前" size="small" color="primary" sx={{ fontWeight: 600, fontSize: 10 }} />}
                    {a.published && <Chip label="已发布" size="small" color="info" sx={{ fontWeight: 600, fontSize: 10 }} />}
                    <Chip label={ASSET_STATUS[a.status]?.label || a.status} size="small" color={ASSET_STATUS[a.status]?.color || 'default'} sx={{ fontWeight: 600, fontSize: 10 }} />
                  </Box>
                  <Box sx={{ position: 'absolute', bottom: 8, left: 8 }}>
                    <Chip label={a.mode === '3dgs' ? '3DGS' : '2D 真人片段'} size="small" sx={{ bgcolor: 'rgba(0,0,0,0.55)', color: 'common.white', fontSize: 10 }} />
                  </Box>
                </Box>
                <CardContent sx={{ py: 1.5, px: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }} noWrap>{a.name}</Typography>
                  {a.mode === '3dgs' && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                      {a.joints > 0 && <Chip size="small" label={`骨骼×${a.joints}`} variant="outlined" sx={{ height: 20, fontSize: 10 }} />}
                      {a.hasFlame && <Chip size="small" label="表情" variant="outlined" sx={{ height: 20, fontSize: 10 }} />}
                    </Box>
                  )}
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

      {/* ── 任务 ── */}
      {tab === 1 && (
        <Card><CardContent>
          {jobsQ.isError && <Alert severity="error" sx={{ mb: 2 }}>{(jobsQ.error as Error)?.message}</Alert>}
          {jobsQ.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rounded" height={60} sx={{ mb: 1 }} />)
          ) : shownJobs.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              {jobs.length === 0 ? '暂无训练任务' : '没有符合条件的任务'}
            </Typography>
          ) : (
            <List dense disablePadding>
              {shownJobs.map((j) => (
                <React.Fragment key={j.id}>
                  <JobRow
                    j={j}
                    onCancel={() => cancelMutation.mutate(j.id)}
                    cancelling={cancelMutation.isPending && cancelMutation.variables === j.id}
                    onLogs={() => setLogsJobId(j.id)}
                  />
                  <Divider component="li" />
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent></Card>
      )}

      {/* ── 素材 ── */}
      {tab === 2 && (
        <Card><CardContent>
          {materialsQ.isError && <Alert severity="error" sx={{ mb: 2 }}>{(materialsQ.error as Error)?.message}</Alert>}
          {materialsQ.isLoading ? (
            <Skeleton variant="rounded" height={120} />
          ) : shownMaterials.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              {materials.length === 0 ? '还没有素材。真人片段每段视频对应一个动作:第 1 段待机、第 2 段说话、第 3 段思考……' : '没有符合条件的素材'}
            </Typography>
          ) : (
            <List dense disablePadding>
              {shownMaterials.map((m) => (
                <React.Fragment key={m.id}>
                  <ListItem
                    sx={{ px: 0 }}
                    secondaryAction={
                      <IconButton size="small" aria-label="删除素材" disabled={deleteMaterialMutation.isPending} onClick={() => deleteMaterialMutation.mutate(m.id)}>
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={m.url ? <a href={m.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{m.name || m.id}</a> : (m.name || m.id)}
                      secondary={[
                        m.type === 'image' ? '图片' : '视频',
                        m.sizeMB ? `${m.sizeMB}MB` : '',
                        m.key ? '' : '只有登记、没有原件(训练取不到)',
                        m.usedBy ? `用于 ${m.usedBy}` : '',
                        fmtDate(m.createdAt),
                      ].filter(Boolean).join(' · ')}
                    />
                  </ListItem>
                  <Divider component="li" />
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent></Card>
      )}

      {/* ── 资产详情 ── */}
      <Dialog open={!!detailAsset} onClose={() => setDetailAsset(null)} maxWidth="md" fullWidth>
        {detailAsset && (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
              {detailAsset.name}
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {detailAsset.active && <Chip label="当前形象" size="small" color="primary" />}
                {detailAsset.published && <Chip label="已发布" size="small" color="info" />}
                <Chip label={ASSET_STATUS[detailAsset.status]?.label || detailAsset.status} size="small" color={ASSET_STATUS[detailAsset.status]?.color || 'default'} />
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1.5 }}>
                {detailAsset.mode === '3dgs'
                  ? `3DGS 可驱动形象 · 骨骼 ${detailAsset.joints} · 表情${detailAsset.hasFlame ? '已启用' : '未启用'}`
                  : '2D 真人片段 · 沉浸式数字人的 2D 模式按 clips.json 选片'}
                {` · ${detailAsset.sizeMB}MB · 创建于 ${fmtDate(detailAsset.createdAt)}`}
              </Typography>
              {detailAsset.mode === '2d' ? (
                <ClipPreview asset={detailAsset} />
              ) : (
                <Box sx={{ width: 160, aspectRatio: '3 / 4', position: 'relative', borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover' }}>
                  <CoverImage src={detailAsset.thumbnail} alt={detailAsset.name} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                </Box>
              )}
              {detailAsset.assetUrl && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-all', mt: 1.5 }}>
                  资产目录:{detailAsset.assetUrl}
                </Typography>
              )}
            </DialogContent>
            <DialogActions>
              {!detailAsset.active && detailAsset.status === 'ready' && (
                <Button size="small" variant="contained" onClick={() => activateMutation.mutate(detailAsset.id)} disabled={activateMutation.isPending}>设为当前形象</Button>
              )}
              <Button size="small" color="error" onClick={() => setConfirmDelete(detailAsset)} startIcon={<DeleteOutlineRoundedIcon />}>删除</Button>
              <Button size="small" onClick={() => setDetailAsset(null)}>关闭</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ── 确认删除 ── */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>确定要删除数字人「{confirmDelete?.name}」吗?资产目录会一并删除,不可撤销。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>取消</Button>
          <Button color="error" onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)} disabled={deleteMutation.isPending}>确认删除</Button>
        </DialogActions>
      </Dialog>

      {/* ── 任务日志(随列表轮询刷新) ── */}
      <Dialog open={!!logsJob} onClose={() => setLogsJobId(null)} maxWidth="md" fullWidth>
        {logsJob && (
          <>
            <DialogTitle>任务日志:{logsJob.name}({JOB_STATUS_LABELS[logsJob.status]})</DialogTitle>
            <DialogContent>
              {logsJob.failReason && <Alert severity={logsJob.status === 'failed' ? 'error' : 'info'} sx={{ mb: 1.5 }}>{logsJob.failReason}</Alert>}
              <Box component="pre" sx={{ fontFamily: 'monospace', fontSize: 12, bgcolor: 'grey.900', color: 'grey.100', p: 2, borderRadius: 1, maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', m: 0 }}>
                {logsJob.logs?.join('\n') || '暂无日志'}
              </Box>
            </DialogContent>
            <DialogActions>
              {canCancel(logsJob.status) && (
                <Button color="error" onClick={() => cancelMutation.mutate(logsJob.id)} disabled={cancelMutation.isPending}>取消任务</Button>
              )}
              <Button onClick={() => setLogsJobId(null)}>关闭</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack?.severity || 'info'} onClose={() => setSnack(null)} sx={{ width: '100%' }}>{snack?.msg}</Alert>
      </Snackbar>

      {/* ── 新建训练 ── */}
      <Drawer anchor="right" open={showCreatePanel} onClose={() => setShowCreatePanel(false)} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 420 }, p: 3 } } }}>
        <Typography variant="h6" sx={{ mb: 3 }}>新建训练任务</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField label="数字人名称" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="如:我的数字人" fullWidth autoFocus />

          <FormControl fullWidth>
            <InputLabel id="dh-method">训练方式</InputLabel>
            <Select labelId="dh-method" value={createMethod} label="训练方式" onChange={(e) => setCreateMethod(e.target.value)}>
              {(caps?.methods ?? []).map((m) => (
                <MenuItem key={m.key} value={m.key}>
                  {m.label}{m.available ? '' : '(不可用)'}
                </MenuItem>
              ))}
              {!caps && <MenuItem value={createMethod}>{createMethod}</MenuItem>}
            </Select>
            {methodCap && !methodCap.available && <FormHelperText error>{methodCap.reason}</FormHelperText>}
          </FormControl>

          {methodCap && !methodCap.available && methodCap.needs && (
            <Alert severity="warning" sx={{ fontSize: 12 }}>
              <AlertTitle sx={{ fontSize: 13 }}>缺 {methodCap.needs}</AlertTitle>
              {needsHint(methodCap.needs)}
            </Alert>
          )}

          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              素材{methodCap?.mode === '2d' ? '(必选,按顺序对应 待机/说话/思考/打招呼…)' : '(可选,交给训练脚本)'}
            </Typography>
            {pickableMaterials.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                没有可用素材,先到「素材」页上传{methodCap?.mode === '2d' ? '视频' : ''}
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', maxHeight: 260, overflow: 'auto' }}>
                {pickableMaterials.map((m) => {
                  const idx = createSources.indexOf(m.id);
                  return (
                    <FormControlLabel
                      key={m.id}
                      control={
                        <Checkbox
                          size="small"
                          checked={idx >= 0}
                          onChange={(e) => setCreateSources((cur) => (e.target.checked ? [...cur, m.id] : cur.filter((x) => x !== m.id)))}
                        />
                      }
                      label={
                        <Typography variant="body2" noWrap>
                          {idx >= 0 ? `${idx + 1}. ` : ''}{m.name || m.id}
                          <Typography component="span" variant="caption" color="text.secondary"> · {m.type === 'image' ? '图片' : '视频'}{m.sizeMB ? ` ${m.sizeMB}MB` : ''}</Typography>
                        </Typography>
                      }
                    />
                  );
                })}
              </Box>
            )}
          </Box>

          {methodCap?.mode === '2d' && caps && !caps.ffmpeg && (
            <Alert severity="info" sx={{ fontSize: 12 }}>本机没有 ffmpeg:只有 MP4 / WebM 素材能直接用,其它格式会失败</Alert>
          )}

          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button variant="outlined" onClick={() => setShowCreatePanel(false)} sx={{ flex: 1 }}>取消</Button>
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={trainMutation.isPending || (!!methodCap && !methodCap.available) || (methodCap?.mode === '2d' && createSources.length === 0)}
              sx={{ flex: 1 }}
            >
              {trainMutation.isPending ? '提交中…' : '开始训练'}
            </Button>
          </Box>
        </Box>
      </Drawer>
    </Box>
  );
}
