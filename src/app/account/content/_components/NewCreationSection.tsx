'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCreatorWipList } from '@/apis/dashboard';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import IconButton from '@mui/material/IconButton';
import VideocamIcon from '@mui/icons-material/Videocam';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EditCalendarRoundedIcon from '@mui/icons-material/EditCalendarRounded';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { useActiveTab } from '../ActiveTabContext';
import { gradient2, gradient3 } from '@/constants/gradients';
import { accountClient, isNetworkError, isAuthError, formatApiError } from '@/lib/api/client';
import { RelativeTime } from '@/components/common/RelativeTime';
import { coverBackground } from '@/lib/media';
import { ListLayout, ListLayoutSwitch } from '@/components/common/ListLayout';
import { scheduleContent, SCHEDULE_CONTENT_SUPPORTED } from '@/apis/review';

type WipKind = 'draft' | 'uploading' | 'scheduled';
type WipType = 'video' | 'image' | 'article';

interface WipItem {
  id: string;
  kind: WipKind;
  type: WipType;
  title: string;
  cover: string;
  // draft
  updatedAt?: number;
  wordCount?: number;
  // uploading
  progress?: number;
  speedKB?: number;
  paused?: boolean;
  // scheduled
  scheduleAt?: number;
  tags?: string[];
}

// SSR 阶段不计算 Date.now()——返回 fallback 字符串避免 hydration mismatch。
// 客户端通过 RelativeTime 组件在 mount 后才填真实值。
// 已统一用 <RelativeTime ts={...} /> 组件处理,这里不再需要函数实现。

const TYPE_ICON: Record<WipType, React.ReactNode> = {
  video: <VideocamIcon sx={{ fontSize: 13 }} />,
  image: <ImageIcon sx={{ fontSize: 13 }} />,
  article: <DescriptionIcon sx={{ fontSize: 13 }} />,
};

const KIND_META: Record<WipKind, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  draft: { label: '草稿', color: 'text.secondary', bg: 'action.hover', icon: <EditRoundedIcon sx={{ fontSize: 13 }} /> },
  uploading: { label: '上传中', color: '#25F4EE', bg: 'rgba(37, 244, 238, 0.12)', icon: <CloudUploadRoundedIcon sx={{ fontSize: 13 }} /> },
  scheduled: { label: '已定时', color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)', icon: <ScheduleRoundedIcon sx={{ fontSize: 13 }} /> },
};

export default function NewCreationSection() {
  const [snack, setSnack] = useState<string | null>(null);
  const { setActiveTab } = useActiveTab();

  // 真接口拉创作中作品(draft/uploading/scheduled 在后端 wip 中一并返回,前端按 stage 字段映射 kind)
  const qc = useQueryClient();
  const { data: wipResp } = useQuery({
    queryKey: ['creator-wip'],
    queryFn: () => getCreatorWipList({ page: 1, pageSize: 50 }),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });
  const wip: WipItem[] = (wipResp?.list ?? []).map((w: any) => ({
    id: w.id,
    kind: w.stage === 'draft' ? 'draft' : w.stage === 'transcoding' || w.stage === 'reviewing' ? 'uploading' : 'scheduled',
    type: (w.type as WipItem['type']) ?? 'video',
    title: w.title,
    cover: w.cover || gradient2('#5B8DEF', '#8B5CF6'),
    updatedAt: w.updatedAt,
    progress: w.progress,
    tags: [],
  }));
  // 操作后(取消/暂停等)通过 invalidate 触发重新拉
  const setWip = (_updater: (prev: WipItem[]) => WipItem[]) => {
    qc.invalidateQueries({ queryKey: ['creator-wip'] });
  };

  const drafts = wip.filter((w) => w.kind === 'draft');
  const uploading = wip.filter((w) => w.kind === 'uploading');
  const scheduled = wip.filter((w) => w.kind === 'scheduled');

  const handleResume = (item: WipItem) => {
    setActiveTab('hd-publish', { resumeId: item.id });
  };
  const handleCancel = async (item: WipItem) => {
    try {
      await accountClient.post('/account/content/wip/cancel', { id: item.id });
      setWip((p) => p.filter((w) => w.id !== item.id));
      setSnack('已取消');
    } catch (err) {
      // 失败就是失败:以前网络错时本地把条目删掉并提示「已取消(离线模式)」,服务端其实没动
      if (isAuthError(err)) {
        setSnack('请重新登录');
      } else {
        setSnack(formatApiError(err));
      }
    }
  };

  // B1:重新定时 — 给已定时但还没到点的草稿换个时间。
  const [rescheduleOpen, setRescheduleOpen] = useState<WipItem | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState('');
  const handleRescheduleSubmit = async () => {
    if (!rescheduleOpen) return;
    const ts = new Date(rescheduleAt).getTime();
    if (!Number.isFinite(ts) || ts <= Date.now()) {
      setSnack('请选择未来的时间');
      return;
    }
    try {
      await scheduleContent(rescheduleOpen.id, ts);
      setSnack(`已重新定时到 ${new Date(ts).toLocaleString('zh-CN')}`);
      setRescheduleOpen(null);
      setRescheduleAt('');
      setWip((p) => []);
    } catch (err) {
      setSnack(formatApiError(err));
    }
  };
  const handlePauseToggle = async (item: WipItem) => {
    try {
      await accountClient.post('/account/content/wip/pause', { id: item.id, paused: !item.paused });
      setWip((p) => p.map((w) => (w.id === item.id ? { ...w, paused: !w.paused } : w)));
    } catch (err) {
      if (isAuthError(err)) {
        setSnack('请重新登录');
      } else {
        setSnack(formatApiError(err));
      }
    }
  };
  const handlePublishNow = async (item: WipItem) => {
    try {
      await accountClient.post('/account/content/wip/publish', { id: item.id });
      setWip((p) => p.filter((w) => w.id !== item.id));
      setSnack('已发布');
    } catch (err) {
      if (isAuthError(err)) {
        setSnack('请重新登录');
      } else {
        setSnack(formatApiError(err));
      }
    }
  };
  const handleViewAll = () => {
    setActiveTab('works');
  };

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 2,
        p: 3,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* 13 种发布入口只在「发布作品」页有一份(以前这里又铺了一遍同样的 13 张卡片)。
          工作台这一步只放发布页没有的东西:进行中的草稿 / 上传中 / 定时发布,外加一个去发布的按钮。 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
            进行中
          </Typography>
          <Chip
            size="small"
            label={String(wip.length)}
            sx={{
              height: 18,
              fontSize: 10,
              fontWeight: 700,
              bgcolor: 'rgba(254, 44, 85, 0.12)',
              color: 'primary.main',
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
          <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
            草稿 {drafts.length} · 上传中 {uploading.length} · 已定时 {scheduled.length}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: { xs: 'none', sm: 'flex' } }}>
            <ListLayoutSwitch />
          </Box>
          <Button size="small" variant="text" onClick={handleViewAll} endIcon={<ArrowForwardIosIcon sx={{ fontSize: '10px !important' }} />} sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}>
            全部作品
          </Button>
          <Button
            size="small"
            variant="contained"
            disableElevation
            startIcon={<AddRoundedIcon />}
            onClick={() => setActiveTab('hd-publish')}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 600, borderRadius: 999 }}
          >
            发布作品
          </Button>
        </Box>

        {wip.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3, color: 'text.disabled', fontSize: 12 }}>
            暂无进行中的创作
          </Box>
        ) : (
          <ListLayout rows minColumnWidth={300} gap={12}>
            {wip.map((item) => {
              const km = KIND_META[item.kind];
              return (
                <Box
                  key={item.id}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    gap: 1.5,
                    transition: 'border-color 0.15s',
                    '&:hover': { borderColor: km.color },
                  }}
                >
                  <Box
                    sx={{
                      width: 60,
                      height: 60,
                      borderRadius: 1,
                      background: coverBackground(item.cover),
                      flexShrink: 0,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        color: '#fff',
                        opacity: 0.9,
                        bgcolor: 'rgba(0,0,0,0.3)',
                        borderRadius: 0.5,
                        px: 0.5,
                        py: 0.125,
                      }}
                    >
                      {TYPE_ICON[item.type]}
                    </Box>
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.25,
                          px: 0.5,
                          py: 0.125,
                          borderRadius: 0.5,
                          bgcolor: km.bg,
                          color: km.color,
                          fontSize: 9,
                          fontWeight: 700,
                        }}
                      >
                        {km.icon}
                        {km.label}
                      </Box>
                    </Box>
                    <Typography
                      sx={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'text.primary',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.title}
                    </Typography>

                    {item.kind === 'draft' && (
                      <>
                        <Typography sx={{ fontSize: 10, color: 'text.disabled', mt: 0.25 }} suppressHydrationWarning>
                          {item.wordCount ? `${item.wordCount} 字 · ` : ''}最后编辑 {item.updatedAt && <RelativeTime ts={item.updatedAt} fallback="" />}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 'auto', pt: 0.75 }}>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleResume(item)}
                            sx={{
                              textTransform: 'none',
                              fontSize: 10,
                              borderRadius: 1,
                              minWidth: 0,
                              py: 0.25,
                              px: 1,
                              background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                              '&:hover': {
                                background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                                filter: 'brightness(1.1)',
                              },
                            }}
                          >
                            继续编辑
                          </Button>
                          <Button variant="text"
                            size="small"
                            onClick={() => handleCancel(item)}
                            sx={{ textTransform: 'none', fontSize: 10, color: 'text.secondary', minWidth: 0, py: 0.25, px: 1 }}
                          >
                            删除
                          </Button>
                        </Box>
                      </>
                    )}

                    {item.kind === 'uploading' && (
                      <>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                          <LinearProgress
                            variant="determinate"
                            value={item.progress ?? 0}
                            sx={{
                              flex: 1,
                              height: 4,
                              borderRadius: 1,
                              bgcolor: 'action.hover',
                              '& .MuiLinearProgress-bar': {
                                bgcolor: item.paused
                                  ? (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)')
                                  : '#25F4EE',
                              },
                            }}
                          />
                          <Typography sx={{ fontSize: 10, color: 'text.disabled', fontVariantNumeric: 'tabular-nums', minWidth: 28 }}>
                            {item.progress}%
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: 10, color: 'text.disabled', mt: 0.25 }}>
                          {item.paused ? '已暂停' : `${((item.speedKB ?? 0) / 1024).toFixed(1)} MB/s`}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.25, mt: 'auto', pt: 0.5 }}>
                          <IconButton
                            size="small"
                            onClick={() => handlePauseToggle(item)}
                            sx={{ p: 0.25 }}
                            aria-label={item.paused ? '继续' : '暂停'}
                          >
                            {item.paused ? <PlayArrowRoundedIcon sx={{ fontSize: 14 }} /> : <PauseRoundedIcon sx={{ fontSize: 14 }} />}
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleCancel(item)}
                            sx={{ p: 0.25 }}
                            aria-label="取消上传"
                          >
                            <CloseRoundedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Box>
                      </>
                    )}

                    {item.kind === 'scheduled' && (
                      <>
                        <Typography sx={{ fontSize: 10, color: 'text.disabled', mt: 0.25 }} suppressHydrationWarning>
                          预定 {item.scheduleAt && <RelativeTime ts={item.scheduleAt} showFuture fallback="" />} 发布
                        </Typography>
                        {item.tags && item.tags.length > 0 && (
                          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25 }}>
                            {item.tags.map((t) => (
                              <Box
                                key={t}
                                sx={{
                                  px: 0.5,
                                  py: 0.05,
                                  borderRadius: 0.5,
                                  bgcolor: 'action.hover',
                                  color: 'text.secondary',
                                  fontSize: 9,
                                }}
                              >
                                #{t}
                              </Box>
                            ))}
                          </Box>
                        )}
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 'auto', pt: 0.5 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handlePublishNow(item)}
                            sx={{ textTransform: 'none', fontSize: 10, borderRadius: 1, minWidth: 0, py: 0.25, px: 1, borderColor: 'divider', color: '#FFB400' }}
                          >
                            立即发布
                          </Button>
                          {/* 后端还没有改定时接口,先隐藏「改时间」 */}
                          {SCHEDULE_CONTENT_SUPPORTED && (
                          <Button variant="text"
                            size="small"
                            startIcon={<EditCalendarRoundedIcon sx={{ fontSize: 12 }} />}
                            onClick={() => {
                              // 默认当前时间 + 1 小时
                              const def = new Date(Date.now() + 60 * 60 * 1000);
                              setRescheduleAt(def.toISOString().slice(0, 16));
                              setRescheduleOpen(item);
                            }}
                            sx={{ textTransform: 'none', fontSize: 10, color: 'text.secondary', minWidth: 0, py: 0.25, px: 1 }}
                          >
                            改时间
                          </Button>
                          )}
                          <Button variant="text"
                            size="small"
                            onClick={() => handleCancel(item)}
                            sx={{ textTransform: 'none', fontSize: 10, color: 'text.secondary', minWidth: 0, py: 0.25, px: 1 }}
                          >
                            取消定时
                          </Button>
                        </Box>
                      </>
                    )}
                  </Box>
                </Box>
              );
            })}
          </ListLayout>
        )}

      <Snackbar
        open={!!snack}
        autoHideDuration={2200}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      {/* B1:重新定时发布对话框 */}
      <Dialog
        open={!!rescheduleOpen}
        onClose={() => setRescheduleOpen(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { bgcolor: 'background.paper', backgroundImage: 'none' } } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditCalendarRoundedIcon color="primary" />
          重新定时发布
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: 'divider' }}>
          <Box sx={{ pt: 1 }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>
              当前作品:{rescheduleOpen?.title}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.disabled', mb: 2 }}>
              原定时:{rescheduleOpen?.scheduleAt ? new Date(rescheduleOpen.scheduleAt).toLocaleString('zh-CN') : '—'}
            </Typography>
            <TextField
              type="datetime-local"
              label="新定时"
              value={rescheduleAt}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRescheduleAt(e.target.value)}
              fullWidth
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button variant="text" onClick={() => setRescheduleOpen(null)} sx={{ textTransform: 'none' }}>
            取消
          </Button>
          <Button
            variant="contained"
            onClick={handleRescheduleSubmit}
            sx={{
              textTransform: 'none',
              background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
              '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' },
            }}
          >
            确认改时间
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
