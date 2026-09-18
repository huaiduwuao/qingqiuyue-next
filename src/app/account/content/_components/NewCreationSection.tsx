'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCreatorWipList } from '@/apis/dashboard';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import IconButton from '@mui/material/IconButton';
import VideocamIcon from '@mui/icons-material/Videocam';
import ImageIcon from '@mui/icons-material/Image';
import ThreeSixtyIcon from '@mui/icons-material/ThreeSixty';
import DescriptionIcon from '@mui/icons-material/Description';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import LibraryMusicRoundedIcon from '@mui/icons-material/LibraryMusicRounded';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import MovieFilterRoundedIcon from '@mui/icons-material/MovieFilterRounded';
import TvRoundedIcon from '@mui/icons-material/TvRounded';
import LocalMoviesRoundedIcon from '@mui/icons-material/LocalMoviesRounded';
import AnimationRoundedIcon from '@mui/icons-material/AnimationRounded';
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
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
import { scheduleContent } from '@/apis/review';

// 13 个内容创作类型的统一配置 —— 工作台 / 发布中心 / 落地页三处共用。
// 单一事实来源:contentTypes.tsx。这里只保留工作台特有的样式与交互逻辑。
import { CREATION_TYPES, type CreationType, type CreationTypeId } from './contentTypes';

// type → view id 路由表。视频和图片 MV 都进 hd-publish dispatcher,
// hd-publish 内部用 chip 选子类型。其他类型也全部进 hd-publish,
// type 作为 tabParams 传入让 dispatcher 自动切 chip 并弹对应 dialog。
// 早期版本每种类型一个独立 page,现已统一为 dispatcher 入口。
const TYPE_TO_TAB: Record<string, string> = {
  video: 'hd-publish',
  panorama: 'hd-publish', // 并入视频(后续在 hd-publish 加 360° 开关)
  image: 'hd-publish',
  'image-mv': 'hd-publish',
  article: 'hd-publish',
  novel: 'hd-publish',
  news: 'hd-publish',
  music: 'hd-publish',
  comics: 'hd-publish',
  vshow: 'hd-publish',
  teleplay: 'hd-publish',
  film: 'hd-publish',
  animation: 'hd-publish',
  live: 'hd-publish',
};

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
  const handleCreate = (id: string) => {
    // 13 个创作入口全部进 hd-publish dispatcher,type 作 tabParams:
    //   video      → type='video'  (默认 VIDEO 流程:HD 转码 / 审核 / 极速通道)
    //   image      → type='picture-album'  (图集)
    //   image-mv   → type='picture-mv'
    //   article    → type='article'
    //   novel      → type='novel'  / news  → 'news'
    //   music      → type='music'
    //   comics     → type='comics'
    //   vshow      → type='vshow'
    //   teleplay   → type='teleplay'
    //   film       → type='film'
    //   animation  → type='animation'
    //   live       → type='live'
    // dispatcher 接住 tabParams.type 自动切 chip + 弹对应表单 dialog。
    const item = CREATION_TYPES.find((c) => c.id === id);
    if (!item) return;
    const tab = TYPE_TO_TAB[id] ?? 'hd-publish';
    // type 用 chip 用的 kebab-case;chip 内部 PUBLISH_HUB_TYPE_TO_CONTENT_TYPE 再转后端枚举
    setActiveTab(tab, { type: id === 'panorama' ? 'video' : id });
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
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 600, color: 'text.primary' }}>
          新的创作
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: 'pointer',
            color: 'text.secondary',
            fontSize: 12,
            '&:hover': { color: 'primary.main' },
          }}
          onClick={handleViewAll}
        >
          <Typography sx={{ fontSize: 12 }}>查看全部</Typography>
          <ArrowForwardIosIcon sx={{ fontSize: 10 }} />
        </Box>
      </Box>

      {/* 发布入口(2 行 × 5 列),每个都直达对应的发布表单 */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
          gap: { xs: 1.5, md: 1.5 },
        }}
      >
        {CREATION_TYPES.map((item) => (
          <Box
            key={item.id}
            onClick={() => handleCreate(item.id)}
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              cursor: 'pointer',
              transition: 'all 0.25s ease-in-out',
              position: 'relative',
              overflow: 'hidden',
              '&:hover': {
                transform: 'translateY(-4px)',
                borderColor: 'primary.main',
                boxShadow: '0 8px 24px rgba(254, 44, 85, 0.15)',
                '& .creation-icon': {
                  transform: 'scale(1.1) rotate(-5deg)',
                },
              },
            }}
          >
            <Box
              className="creation-icon"
              sx={{
                width: 48,
                height: 48,
                borderRadius: 1.5,
                background: item.gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.primary',
                mb: 1.25,
                transition: 'transform 0.3s ease-in-out',
              }}
            >
              {item.icon}
            </Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
              {item.title}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.5 }}>
              {item.desc}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* 进行中 (草稿 / 上传中 / 定时发布) */}
      <Box sx={{ mt: 3, pt: 2.5, borderTop: '1px dashed', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
            进行中
          </Typography>
          <Chip
            size="small"
            label={`${wip.length}`}
            sx={{
              height: 18,
              fontSize: 10,
              fontWeight: 700,
              bgcolor: 'rgba(254, 44, 85, 0.12)',
              color: 'primary.main',
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
            草稿 {drafts.length} · 上传中 {uploading.length} · 已定时 {scheduled.length}
          </Typography>
          <ListLayoutSwitch />
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
                          <Button
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
                          <Button
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
                          <Button
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
      </Box>

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
              onChange={(e) => setRescheduleAt(e.target.value)}
              fullWidth
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setRescheduleOpen(null)} sx={{ textTransform: 'none' }}>
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
