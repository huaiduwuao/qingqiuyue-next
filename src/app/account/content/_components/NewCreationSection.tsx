'use client';

import React, { useState } from 'react';
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
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useActiveTab } from '../ActiveTabContext';
import { gradient2, gradient3 } from '@/constants/gradients';
import { accountClient, isNetworkError, isAuthError, formatApiError } from '@/lib/api/client';
import { RelativeTime } from '@/components/common/RelativeTime';

const CREATION_ITEMS = [
  {
    id: 'video',
    title: '发布视频',
    desc: '支持常用格式，推荐mp4、webm',
    icon: <VideocamIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#FE2C55', '#FF6B8A'),
  },
  {
    id: 'image',
    title: '发布图文',
    desc: '支持常用图片格式，png、jpg',
    icon: <ImageIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#25F4EE', '#5DF7F2'),
  },
  {
    id: 'panorama',
    title: '发布全景视频',
    desc: '推荐4K及以上分辨率',
    icon: <ThreeSixtyIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#FFB400', '#FFD566'),
  },
  {
    id: 'article',
    title: '发布文章',
    desc: '支持8000字文本和30个图片素材',
    icon: <DescriptionIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#8B5CF6', '#C4B5FD'),
  },
];

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

const SEED_WIP: WipItem[] = [
  {
    id: 'd-001',
    kind: 'draft',
    type: 'video',
    title: '我的家乡｜回家路上的风景',
    cover: gradient2('#5B8DEF', '#8B5CF6'),
    updatedAt: Date.now() - 1000 * 60 * 35,
    tags: ['家乡', '旅行'],
  },
  {
    id: 'd-002',
    kind: 'draft',
    type: 'article',
    title: '我对 AI 工具的 5 点思考(未完成)',
    cover: gradient2('#FFB400', '#FFD566'),
    updatedAt: Date.now() - 1000 * 60 * 60 * 6,
    wordCount: 1843,
  },
  {
    id: 'u-001',
    kind: 'uploading',
    type: 'video',
    title: '深夜街拍｜东京 4K HDR.mp4',
    cover: gradient3('#FE2C55', '#FF6B8A', '#FFB400'),
    progress: 67,
    speedKB: 3420,
    paused: false,
  },
  {
    id: 's-001',
    kind: 'scheduled',
    type: 'image',
    title: '夏日穿搭合集｜白色系特辑',
    cover: gradient2('#25F4EE', '#5DF7F2'),
    scheduleAt: Date.now() + 1000 * 60 * 60 * 8,
    tags: ['穿搭', '夏日'],
  },
  {
    id: 's-002',
    kind: 'scheduled',
    type: 'video',
    title: '【教程】10 分钟学会快手早餐',
    cover: gradient2('#5DDB96', '#25F4EE'),
    scheduleAt: Date.now() + 1000 * 60 * 60 * 26,
    tags: ['美食', '教程'],
  },
];

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
  const [wip, setWip] = useState<WipItem[]>(SEED_WIP);
  const [snack, setSnack] = useState<string | null>(null);
  const { setActiveTab } = useActiveTab();

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
      if (isNetworkError(err)) {
        setWip((p) => p.filter((w) => w.id !== item.id));
        setSnack('已取消(离线模式)');
      } else if (isAuthError(err)) {
        setSnack('请重新登录');
      } else {
        setSnack(formatApiError(err));
      }
    }
  };
  const handlePauseToggle = async (item: WipItem) => {
    try {
      await accountClient.post('/account/content/wip/pause', { id: item.id, paused: !item.paused });
      setWip((p) => p.map((w) => (w.id === item.id ? { ...w, paused: !w.paused } : w)));
    } catch (err) {
      if (isNetworkError(err)) {
        setWip((p) => p.map((w) => (w.id === item.id ? { ...w, paused: !w.paused } : w)));
        setSnack(item.paused ? '已继续(离线模式)' : '已暂停(离线模式)');
      } else if (isAuthError(err)) {
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
      if (isNetworkError(err)) {
        setWip((p) => p.filter((w) => w.id !== item.id));
        setSnack('已发布(离线模式)');
      } else if (isAuthError(err)) {
        setSnack('请重新登录');
      } else {
        setSnack(formatApiError(err));
      }
    }
  };
  const handleCreate = (id: string) => {
    setActiveTab('hd-publish', { type: id });
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

      {/* 4 个发布入口 */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
          gap: { xs: 1.5, md: 2 },
        }}
      >
        {CREATION_ITEMS.map((item) => (
          <Box
            key={item.id}
            onClick={() => handleCreate(item.id)}
            sx={{
              p: 2.5,
              borderRadius: 2,
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF'),
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
                width: 56,
                height: 56,
                borderRadius: 2,
                background: item.gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.primary',
                mb: 1.5,
                transition: 'transform 0.3s ease-in-out',
              }}
            >
              {item.icon}
            </Box>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
              {item.title}
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.5 }}>
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
        </Box>

        {wip.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3, color: 'text.disabled', fontSize: 12 }}>
            暂无进行中的创作
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 1.5 }}>
            {wip.map((item) => {
              const km = KIND_META[item.kind];
              return (
                <Box
                  key={item.id}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF'),
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
                      background: item.cover,
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
                              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'action.hover'),
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
                                  bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'action.hover'),
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
          </Box>
        )}
      </Box>

      <Snackbar
        open={!!snack}
        autoHideDuration={2200}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
