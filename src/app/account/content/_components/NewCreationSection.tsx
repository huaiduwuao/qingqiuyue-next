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
import { useActiveTab } from '../ActiveTabContext';
import { gradient2, gradient3 } from '@/constants/gradients';
import { accountClient, isNetworkError, isAuthError, formatApiError } from '@/lib/api/client';
import { RelativeTime } from '@/components/common/RelativeTime';

interface CreationItem {
  id: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  gradient: string;
  /** true = 真实表单已上线,可点;false = 仍是 placeholder,显示"开发中" */
  ready: boolean;
  /** 后端 contentType 枚举(用于埋点/未来 payload 预填) */
  contentType: string;
}

const CREATION_ITEMS: CreationItem[] = [
  {
    id: 'video',
    title: '发布视频',
    desc: '支持常用格式，推荐mp4、webm',
    icon: <VideocamIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#FE2C55', '#FF6B8A'),
    ready: true,
    contentType: 'VIDEO',
  },
  {
    id: 'image',
    title: '发布图文',
    desc: '支持常用图片格式，png、jpg',
    icon: <ImageIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#25F4EE', '#5DF7F2'),
    ready: true,
    contentType: 'PICTURE',
  },
  {
    id: 'image-mv',
    title: '发布图片 MV',
    desc: '多图轮播 + 背景音乐',
    icon: <PhotoLibraryRoundedIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#22D3EE', '#67E8F9'),
    ready: true,
    contentType: 'PICTURE',
  },
  {
    id: 'article',
    title: '发布文章',
    desc: '支持 8000 字文本和 30 个图片素材',
    icon: <DescriptionIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#8B5CF6', '#C4B5FD'),
    ready: true,
    contentType: 'ARTICLE',
  },
  {
    id: 'novel',
    title: '发布小说',
    desc: '章节连载，单本可超 10 万字',
    icon: <MenuBookRoundedIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#A78BFA', '#DDD6FE'),
    ready: true,
    contentType: 'NOVEL',
  },
  {
    id: 'news',
    title: '发布新闻',
    desc: '摘要 + 配图 + 来源',
    icon: <ArticleRoundedIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#F87171', '#FCA5A5'),
    ready: true,
    contentType: 'NEWS',
  },
  {
    id: 'music',
    title: '发布音乐',
    desc: '音频 + 封面 + LRC 歌词',
    icon: <LibraryMusicRoundedIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#34D399', '#6EE7B7'),
    ready: true,
    contentType: 'MUSIC',
  },
  {
    id: 'comics',
    title: '发布漫画',
    desc: '分镜列表，每页图片 + 旁白',
    icon: <AutoStoriesRoundedIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#FB923C', '#FDBA74'),
    ready: true,
    contentType: 'COMICS',
  },
  {
    id: 'vshow',
    title: '发布短剧',
    desc: '竖屏短剧，支持选集',
    icon: <MovieFilterRoundedIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#F472B6', '#F9A8D4'),
    ready: true,
    contentType: 'VSHOW',
  },
  {
    id: 'teleplay',
    title: '发布电视剧',
    desc: '季 / 集，每集独立视频',
    icon: <TvRoundedIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#60A5FA', '#93C5FD'),
    ready: true,
    contentType: 'TELEPLAY',
  },
  {
    id: 'film',
    title: '发布电影',
    desc: '长视频,海报+导演+演员+时长',
    icon: <LocalMoviesRoundedIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#1E40AF', '#3B82F6'),
    ready: true,
    contentType: 'FILM',
  },
  {
    id: 'animation',
    title: '发布动画',
    desc: '2D/3D/定格,选集+制作公司+监督',
    icon: <AnimationRoundedIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#A855F7', '#C084FC'),
    ready: true,
    contentType: 'ANIMATION',
  },
  {
    id: 'live',
    title: '发布直播回放',
    desc: '直播录制+开始时间+弹幕开关',
    icon: <LiveTvRoundedIcon sx={{ fontSize: 32 }} />,
    gradient: gradient2('#DC2626', '#EF4444'),
    ready: true,
    contentType: 'LIVE',
  },
];

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
    queryFn: () => getCreatorWipList({ page: 1, size: 50 }),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });
  const wip: WipItem[] = (wipResp?.records ?? wipResp?.list ?? []).map((w) => ({
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
    const item = CREATION_ITEMS.find((c) => c.id === id);
    if (!item) return;
    if (!item.ready) {
      setSnack(`「${item.title}」正在开发中,暂未开放`);
      return;
    }
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

      {/* 10 个发布入口(2 行 × 5 列);ready=false 的灰显并加「开发中」徽标 */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
          gap: { xs: 1.5, md: 1.5 },
        }}
      >
        {CREATION_ITEMS.map((item) => (
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
              opacity: item.ready ? 1 : 0.55,
              '&:hover': item.ready
                ? {
                    transform: 'translateY(-4px)',
                    borderColor: 'primary.main',
                    boxShadow: '0 8px 24px rgba(254, 44, 85, 0.15)',
                    '& .creation-icon': {
                      transform: 'scale(1.1) rotate(-5deg)',
                    },
                  }
                : { borderColor: 'text.disabled' },
            }}
          >
            {!item.ready && (
              <Chip
                size="small"
                label="开发中"
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  height: 18,
                  fontSize: 10,
                  fontWeight: 700,
                  bgcolor: 'rgba(255, 180, 0, 0.16)',
                  color: '#FFB400',
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            )}
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
