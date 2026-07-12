'use client';

export const dynamic = "force-dynamic";

// 该页依赖 client context + 后端实时数据,SSR/pre-render 时 TIERS/orders 等未就绪 →
// 报 "Cannot read properties of undefined"。强制 dynamic 跳过预渲染。

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { getHdVideoList, getReviewerList, type Reviewer as ApiReviewer } from '@/apis/dashboard';
import { useAuthority } from '@/contexts/AuthContext';
import { useActiveTab } from '../../ActiveTabContext';
import { PUBLISH_HUB_TYPE_LABEL, type PublishHubType } from '@/lib/contentRoute';
import PublishTypeChips from '../../_components/PublishHub/PublishTypeChips';
import UnifiedContentList from '../../_components/PublishHub/UnifiedContentList';
import ContentDetailDrawer from '../../_components/PublishHub/ContentDetailDrawer';
import type { UnifiedContentPayload } from '../../_components/PublishHub';
import {
  ImageFormLazy,
  ImageMvFormLazy,
  ArticleFormLazy,
  NovelFormLazy,
  NewsFormLazy,
  MusicFormLazy,
  ComicsFormLazy,
  VshowFormLazy,
  TeleplayFormLazy,
  FilmFormLazy,
  AnimationFormLazy,
  LiveFormLazy,
} from '../../_components/PublishForms';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import HdRoundedIcon from '@mui/icons-material/HdRounded';
import VideoFileRoundedIcon from '@mui/icons-material/VideoFileRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import SubtitlesRoundedIcon from '@mui/icons-material/SubtitlesRounded';
import HighQualityRoundedIcon from '@mui/icons-material/HighQualityRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import ClosedCaptionRoundedIcon from '@mui/icons-material/ClosedCaptionRounded';
import RecordVoiceOverRoundedIcon from '@mui/icons-material/RecordVoiceOverRounded';
import MovieFilterRoundedIcon from '@mui/icons-material/MovieFilterRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import PlaylistAddCheckRoundedIcon from '@mui/icons-material/PlaylistAddCheckRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { myPage, updateShare, process as contentProcess } from '@/apis/module-content';
import type { ModuleContentItem } from '@/apis/module-content';
import { fileUpload } from '@/apis/global';
import { useContentNavigate } from '@/lib/contentRoute';
import { formatApiError, accountClient } from '@/lib/api/client';
import { RelativeTime } from '@/components/common/RelativeTime';
import { gradient2, gradient3 } from '@/constants/gradients';
import { HdResolution,
  HdStatus,
  HdFilter,
  HdVideo,
  Reviewer,
  SubtitleTrack,
  AudioTrack,
  REVIEW_CHECK_TEMPLATE,
  REVIEWER_LEVEL_META,
  FAST_CHANNEL_MONTHLY } from './data';

type SnackSeverity = 'success' | 'error' | 'info' | 'warning';
interface SnackMsg {
  msg: string;
  severity: SnackSeverity;
}

const QUALITY_PRESETS: { id: HdResolution; label: string; bitrate: string; size: string; popular?: boolean }[] = [
  { id: '4K', label: '4K 超清', bitrate: '60 Mbps', size: '适合 ≤ 20 min', popular: true },
  { id: '2K', label: '2K 高清', bitrate: '30 Mbps', size: '适合 ≤ 30 min' },
  { id: '1080P', label: '1080P 高清', bitrate: '12 Mbps', size: '适合 ≤ 60 min' },
  { id: '720P', label: '720P 标清', bitrate: '6 Mbps', size: '适合长视频' },
];

const STATUS_META: Record<HdStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  transcoding: { label: '转码中', color: '#25F4EE', bg: 'rgba(37, 244, 238, 0.12)', icon: <HourglassEmptyRoundedIcon sx={{ fontSize: 12 }} /> },
  reviewing: { label: '审核中', color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)', icon: <RateReviewRoundedIcon sx={{ fontSize: 12 }} /> },
  review_failed: { label: '审核未通过', color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)', icon: <GavelRoundedIcon sx={{ fontSize: 12 }} /> },
  published: { label: '已发布', color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.12)', icon: <CheckCircleRoundedIcon sx={{ fontSize: 12 }} /> },
  failed: { label: '转码失败', color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)', icon: <ErrorRoundedIcon sx={{ fontSize: 12 }} /> },
  scheduled: { label: '已定时', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)', icon: <RocketLaunchRoundedIcon sx={{ fontSize: 12 }} /> },
};

const RESOLUTION_META: Record<HdResolution, { color: string; bg: string; label: string }> = {
  '4K': { color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)', label: '4K' },
  '2K': { color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)', label: '2K' },
  '1080P': { color: '#25F4EE', bg: 'rgba(37, 244, 238, 0.12)', label: '1080P' },
  '720P': { color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.12)', label: '720P' },
};

// SEED_REVIEWERS, SEED, and shared constants are imported from ./data

const BENEFITS = [
  { icon: <RocketLaunchRoundedIcon sx={{ fontSize: 18 }} />, title: '极速审核', desc: '10 分钟内完成审核上架', color: '#FE2C55' },
  { icon: <BoltRoundedIcon sx={{ fontSize: 18 }} />, title: '智能转码', desc: '云端并行转码,4K ≤ 5 分钟', color: '#FFB400' },
  { icon: <HighQualityRoundedIcon sx={{ fontSize: 18 }} />, title: 'HDR 增强', desc: 'SDR 视频一键 HDR 化', color: '#8B5CF6' },
  { icon: <SubtitlesRoundedIcon sx={{ fontSize: 18 }} />, title: '字幕/音轨', desc: '多语言字幕 + 多音轨支持', color: '#25F4EE' },
  { icon: <SpeedRoundedIcon sx={{ fontSize: 18 }} />, title: '多清晰度', desc: '240P - 4K 自适应切换', color: '#5DDB96' },
  { icon: <AutoAwesomeRoundedIcon sx={{ fontSize: 18 }} />, title: 'AI 封面', desc: '智能抽取最佳帧作封面', color: '#5B8DEF' },
];

function formatDuration(s: number): string {
  if (s < 60) return `${s} 秒`;
  if (s < 3600) return `${Math.floor(s / 60)} 分钟`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时`;
  return `${Math.floor(s / 86400)} 天`;
}

function formatSize(mb: number): string {
  if (mb < 1024) return `${mb} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// relativeTime() 已废弃:直接调用 Date.now() 在 SSR/CSR 阶段值不同,会引发 hydration mismatch。
// 改用 <RelativeTime ts={...} /> 组件,在 client mount 后才计算显示。

function mapContentStatusToHd(status?: string): HdStatus {
  const s = status?.toLowerCase() || '';
  if (s === 'reviewing' || s === 'review') return 'reviewing';
  if (s === 'publish' || s === 'published' || s === 'online') return 'published';
  if (s === 'un_publish' || s === 'offline' || s === 'reject' || s === 'review_failed') return 'review_failed';
  if (s === 'failed' || s === 'error') return 'failed';
  // 默认放在转码中,符合 HD 发布流程
  return 'transcoding';
}

export default function HdPublishPage() {
  const { setActiveTab } = useActiveTab();
  const { hasAuthority } = useAuthority();
  const isReviewer = hasAuthority('REVIEWER') || hasAuthority('ADMIN') || hasAuthority('SUPER_ADMIN');
  const [tab, setTab] = useState<HdFilter>('all');
  const [search, setSearch] = useState('');
  const [snack, setSnackRaw] = useState<SnackMsg | null>(null);
  // setSnack 接受 string 或 SnackMsg — 旧 30+ 处 setSnack('msg') 调用无需改,
  // 自动转成 { msg, severity: 'info' }。新代码可传 { msg, severity } 显式区分。
  const setSnack = React.useCallback((s: string | SnackMsg) => {
    setSnackRaw(typeof s === 'string' ? { msg: s, severity: 'info' } : s);
  }, []);
  const dismissSnack = React.useCallback(() => setSnackRaw(null), []);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; id: string } | null>(null);

  // ---- Dispatcher state ----
  // 13 类型 chip: 'all' 默认显示所有上传区 + 视频 HD 列表
  const { tabParams } = useActiveTab();
  const [selectedType, setSelectedType] = useState<PublishHubType>(
    (tabParams.type as PublishHubType) || 'video',
  );
  // 非 VIDEO 类型弹窗:打开后渲染对应表单
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  // 非 VIDEO 通用详情(我的发布列表点击进)
  const [unifiedDetail, setUnifiedDetail] = useState<UnifiedContentPayload | null>(null);

  // 当 chip 切到其它类型时,自动弹对应表单 Dialog
  useEffect(() => {
    if (selectedType !== 'video' && selectedType !== 'all') {
      setFormDialogOpen(true);
    } else {
      setFormDialogOpen(false);
    }
  }, [selectedType]);

  // 上传文件状态机(用于提交按钮 disabled + 失败保护)。
  // 历史上 handleFileChange 直接调后端 /file/upload,文件未存到 state,
  // handleSubmitUpload 不知道用户有没有选过文件 → 没文件也能提交 → catch 后创建假 item。
  type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'failed';
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [uploadFileSizeMB, setUploadFileSizeMB] = useState(0);
  const [uploadFileUrl, setUploadFileUrl] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const resetUpload = React.useCallback(() => {
    setUploadFileName(null);
    setUploadFileSizeMB(0);
    setUploadFileUrl(null);
    setUploadStatus('idle');
  }, []);

  // 真接口:HD 视频列表(uid 隔离)
  const { data: hdResp } = useQuery({
    queryKey: ['creator-hd-videos'],
    queryFn: () => getHdVideoList({ page: 1, size: 50 }),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });
  // 按 id 去重:后端 /creator/hd/videos 在 stale cache 命中或后端测试数据偶发会
  // 返回两条同 id 的记录(react-query staleTime 30s 内复用 cache + 后端 raw 数据
  // 重复),触发 React duplicate key 警告,严重时导致 fiber 错位渲染(用户反馈
  // 「界面下部分黑色遮罩 + 点哪都出现视频详情」)。Map 去重即可消除该现象。
  const apiVideos: HdVideo[] = Array.from(
    new Map(
      (hdResp?.records ?? hdResp?.list ?? [])
        .filter((v: any) => v && v.id !== undefined && v.id !== null)
        .map((v: any) => [String(v.id), v] as const),
    ).values(),
  ).map((v: any) => ({
    id: String(v.id), title: v.title, cover: v.cover,
    resolution: v.resolution, fps: v.fps, hdr: v.hdr, duration: v.duration, sizeMB: v.sizeMB,
    status: v.status, progress: v.progress, uploadedAt: v.uploadedAt,
    views: v.views, likes: v.likes, hasCover: v.hasCover,
    subtitles: [], audioTracks: [],
  }));
  const [videos, setVideos] = useState<HdVideo[]>(apiVideos);
  React.useEffect(() => {
    if (apiVideos.length) setVideos(apiVideos);
  }, [apiVideos.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [fastChannelQuota, setFastChannelQuota] = useState(5); // 每月极速通道剩余
  const [reviewHistoryOpen, setReviewHistoryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverTargetId, setCoverTargetId] = useState<string | null>(null);
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealReason, setAppealReason] = useState('');

  const router = useRouter();
  const navigateToContent = useContentNavigate();

  // upload dialog state
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadResolution, setUploadResolution] = useState<HdResolution>('4K');
  const [uploadHdr, setUploadHdr] = useState(true);
  const [uploadAutoCover, setUploadAutoCover] = useState(true);
  const [uploadSubtitles, setUploadSubtitles] = useState<SubtitleTrack[]>([]);
  const [uploadAudios, setUploadAudios] = useState<AudioTrack[]>([
    { id: 'a1', label: '原声', codec: 'AAC 320kbps', isDefault: true },
  ]);
  const [newSubLang, setNewSubLang] = useState('');
  const [newSubLabel, setNewSubLabel] = useState('');

  // 拉取真实 VIDEO 内容并合并到本地列表(去重)
  const { data: realVideos } = useQuery({
    queryKey: ['module-content', 'hd-publish', 'videos'],
    queryFn: async () => {
      const res = await myPage({ contentType: 'VIDEO', pageSize: 100 });
      return (res.data?.records || []) as ModuleContentItem[];
    },
    staleTime: 30_000,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (!realVideos?.length) return;
    setVideos((prev) => {
      const existingIds = new Set(prev.map((v) => v.id));
      const mapped: HdVideo[] = realVideos
        .filter((item) => !existingIds.has(String(item.id)))
        .map((item) => ({
          id: String(item.id),
          title: item.title || '(无标题)',
          cover: item.coverUrl || item.cover || gradient2('#FE2C55', '#FFB400'),
          resolution: '1080P',
          fps: 30,
          hdr: false,
          duration: '00:00',
          sizeMB: 0,
          status: mapContentStatusToHd(item.status),
          uploadedAt: item.createTime ? new Date(item.createTime).getTime() : Date.now(),
          hasCover: !!(item.coverUrl || item.cover),
          subtitles: [],
          audioTracks: [{ id: 'a1', label: '原声', codec: 'AAC 320kbps', isDefault: true }],
          views: item.readNum ?? 0,
          likes: item.agreeNum ?? 0,
        }));
      return [...mapped, ...prev];
    });
  }, [realVideos]);

  const detail = useMemo(() => videos.find((v) => v.id === detailId) ?? null, [videos, detailId]);

  // 真接口:审核员列表(公共,不分 uid)
  const { data: reviewerResp } = useQuery({
    queryKey: ['creator-hd-reviewers'],
    queryFn: () => getReviewerList(),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
  });
  const apiReviewers: Reviewer[] = (reviewerResp?.records ?? reviewerResp?.list ?? []).map((r: ApiReviewer) => ({
    id: r.id, name: r.name, initials: r.initials, avatarColor: r.avatarColor,
    team: r.team, level: r.level as 1 | 2 | 3, title: r.title,
    reviewCount: r.reviewCount, avgReviewSec: 300, passRate: r.passRate,
    online: r.online, currentLoad: r.currentLoad, maxLoad: r.maxLoad, specialties: r.specialties,
  }));
  const reviewers = apiReviewers;
  const getReviewer = (id: string | undefined): Reviewer | undefined => {
    if (!id) return undefined;
    return reviewers.find((r) => r.id === id);
  };

  const stats = useMemo(() => {
    const today = Date.now() - 86400000;
    const todayReviewed = videos.filter(
      (v) => v.review?.completedAt && v.review.completedAt >= today,
    );
    const passed = todayReviewed.filter((v) => v.review?.result === 'pass').length;
    const rejected = todayReviewed.filter((v) => v.review?.result === 'reject').length;
    const totalReviewed = passed + rejected;
    const avgReviewMs = todayReviewed
      .filter((v) => v.review?.startedAt && v.review?.completedAt)
      .map((v) => (v.review!.completedAt! - v.review!.startedAt!))
      .reduce((a, b, _, arr) => a + b / arr.length, 0);
    return {
      todayUploads: videos.filter((v) => v.uploadedAt >= today).length,
      hdCount: videos.filter((v) => v.resolution === '4K' || v.resolution === '2K').length,
      fastChannelQuota,
      fastChannelMonthly: FAST_CHANNEL_MONTHLY,
      transcoding: videos.filter((v) => v.status === 'transcoding').length,
      todayReviewed: totalReviewed,
      passRate: totalReviewed > 0 ? (passed / totalReviewed) * 100 : 0,
      avgReviewMin: avgReviewMs > 0 ? Math.max(1, Math.round(avgReviewMs / 60000)) : 0,
    };
  }, [videos, fastChannelQuota]);

  const reviewHistory = useMemo(() => {
    return videos
      .filter((v) => v.review)
      .map((v) => ({
        videoId: v.id,
        title: v.title,
        cover: v.cover,
        resolution: v.resolution,
        review: v.review!,
        status: v.status,
      }))
      .sort((a, b) => (b.review.completedAt ?? b.review.startedAt ?? 0) - (a.review.completedAt ?? a.review.startedAt ?? 0));
  }, [videos]);

  const filtered = useMemo(() => {
    let list = videos;
    if (tab === 'transcoding') list = list.filter((v) => v.status === 'transcoding');
    else if (tab === 'reviewing') list = list.filter((v) => v.status === 'reviewing');
    else if (tab === 'review_failed') list = list.filter((v) => v.status === 'review_failed');
    else if (tab === 'published') list = list.filter((v) => v.status === 'published');
    else if (tab === 'failed') list = list.filter((v) => v.status === 'failed');
    if (search) {
      const k = search.toLowerCase();
      list = list.filter((v) => v.title.toLowerCase().includes(k));
    }
    return list;
  }, [videos, tab, search]);

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, id: string) => {
    setMenuAnchor({ el: e.currentTarget, id });
  };
  const handleMenuClose = () => setMenuAnchor(null);

  const handleDelete = async (id: string) => {
    // 乐观更新:先从本地移除,失败时回滚
    const previous = videos.find((v) => v.id === id);
    setVideos((p) => p.filter((v) => v.id !== id));
    handleMenuClose();
    try {
      await accountClient.delete(`/account/content/${id}`);
      setSnack('已删除');
    } catch (e) {
      // 回滚本地 state
      if (previous) {
        setVideos((p) => (p.some((v) => v.id === id) ? p : [previous, ...p]));
      }
      setSnack(`删除失败:${formatApiError(e)}`);
    }
  };
  const handleRetry = async (id: string) => {
    // 乐观更新
    setVideos((p) =>
      p.map((v) => (v.id === id ? { ...v, status: 'transcoding', progress: 0, failedReason: undefined } : v)),
    );
    handleMenuClose();
    try {
      await accountClient.post(`/account/content/${id}/transcode`);
      setSnack('已重新提交转码');
    } catch (e) {
      // 转码任务 API 失败时回滚状态
      setVideos((p) =>
        p.map((v) => (v.id === id ? { ...v, status: 'failed' } : v)),
      );
      setSnack(`重新转码失败:${formatApiError(e)}`);
    }
  };
  const handlePublishNow = async (id: string) => {
    // 乐观更新
    setVideos((p) => p.filter((v) => v.id !== id));
    handleMenuClose();
    try {
      await accountClient.post(`/account/content/${id}/publish`);
      setSnack('已立即发布');
    } catch (e) {
      // 回滚:刷新列表数据由后台 useQuery 重拉;此处提示失败
      setSnack(`发布失败:${formatApiError(e)}`);
    }
  };

  const handleFastTrackReview = async (id: string) => {
    if (fastChannelQuota <= 0) {
      setSnack('本月极速通道已用完,下月 1 日恢复');
      return;
    }
    // 乐观更新
    setVideos((p) =>
      p.map((v) =>
        v.id === id && v.review
          ? {
              ...v,
              review: {
                ...v.review,
                useFastChannel: true,
                fastChannelChargedAt: Date.now(),
              },
            }
          : v,
      ),
    );
    setFastChannelQuota((q) => q - 1);
    handleMenuClose();
    try {
      await accountClient.post(`/account/content/${id}/fasttrack`);
      setSnack('已启用极速通道,审核将优先处理');
    } catch (e) {
      // 回滚
      setVideos((p) =>
        p.map((v) =>
          v.id === id && v.review
            ? {
                ...v,
                review: {
                  ...v.review,
                  useFastChannel: false,
                  fastChannelChargedAt: undefined,
                },
              }
            : v,
        ),
      );
      setFastChannelQuota((q) => q + 1);
      setSnack(`极速送审失败:${formatApiError(e)}`);
    }
  };

  const handleResubmitReview = async (id: string) => {
    // 乐观更新
    setVideos((p) =>
      p.map((v) =>
        v.id === id
          ? {
              ...v,
              status: 'reviewing',
              failedStage: undefined,
              failedReason: undefined,
              review: {
                ...v.review,
                checks: REVIEW_CHECK_TEMPLATE.map((c) => ({ ...c, status: 'pending' as const })),
                startedAt: Date.now(),
              },
            }
          : v,
      ),
    );
    handleMenuClose();
    try {
      await accountClient.post(`/account/content/${id}/review`);
      setSnack('已重新提交审核');
    } catch (e) {
      // 回滚
      setVideos((p) =>
        p.map((v) =>
          v.id === id
            ? { ...v, status: 'review_failed' }
            : v,
        ),
      );
      setSnack(`重新送审失败:${formatApiError(e)}`);
    }
  };

  const handleViewPublished = (id: string) => {
    const numericId = Number(id);
    if (numericId) {
      navigateToContent('VIDEO', numericId);
    } else {
      router.push(`/detail/video-detail?id=${encodeURIComponent(id)}`);
    }
  };

  const handleOpenAppeal = () => {
    setAppealReason('');
    setAppealOpen(true);
  };

  const handleSubmitAppeal = async () => {
    if (!detail) return;
    if (!appealReason.trim()) {
      setSnack('请输入申诉理由');
      return;
    }
    const contentId = Number(detail.id);
    if (!contentId) {
      setSnack('演示内容不支持提交申诉');
      return;
    }
    try {
      await contentProcess({
        ids: [contentId],
        status: 'appeal',
        moduleContentStatus: 'appeal',
      });
      setSnack('申诉已提交,审核员将在 72 小时内复审');
      setAppealOpen(false);
    } catch (e) {
      setSnack(`申诉提交失败:${formatApiError(e)}`);
    }
  };

  const handleOpenCoverPicker = (id: string) => {
    setCoverTargetId(id);
    setCoverPickerOpen(true);
    handleMenuClose();
  };

  const handlePickCoverFile = () => {
    coverInputRef.current?.click();
  };

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !coverTargetId) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = (await fileUpload(formData as unknown as Record<string, unknown>)) as { data?: { url?: string } };
      const url = res?.data?.url;
      if (url) {
        setVideos((p) =>
          p.map((v) => (v.id === coverTargetId ? { ...v, cover: url, hasCover: true } : v)),
        );
        setSnack('封面已更新');
      } else {
        setSnack('上传成功但未返回封面地址');
      }
    } catch (e) {
      setSnack(`封面上传失败:${formatApiError(e)}`);
    }
    setCoverPickerOpen(false);
    setCoverTargetId(null);
    e.target.value = '';
  };

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadTitle((p) => p || file.name.replace(/\.[^.]+$/, ''));
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    setUploadFileName(file.name);
    setUploadFileSizeMB(Number(sizeMB));
    setUploadStatus('uploading');
    setSnack({ msg: `已选择文件: ${sizeMB} MB,正在上传...`, severity: 'info' });
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await accountClient.post('/file/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = (res as { data?: { url?: string } })?.data?.url;
      if (url) {
        setUploadFileUrl(url);
        setUploadStatus('uploaded');
        setSnack({ msg: '文件上传成功,可以提交了', severity: 'success' });
      } else {
        // 后端 200 但没 url:视为失败,不让用户提交。
        setUploadStatus('failed');
        setSnack({ msg: '上传成功但未返回文件地址,请重试', severity: 'error' });
      }
    } catch (e) {
      setUploadStatus('failed');
      setSnack({ msg: `文件上传失败:${formatApiError(e)}`, severity: 'error' });
    }
  };

  const handleAddSubtitle = () => {
    if (!newSubLang || !newSubLabel) return;
    setUploadSubtitles((p) => [
      ...p,
      { id: `s${Date.now()}`, lang: newSubLang, label: newSubLabel, isDefault: p.length === 0 },
    ]);
    setNewSubLang('');
    setNewSubLabel('');
  };
  const handleRemoveSubtitle = (id: string) => {
    setUploadSubtitles((p) => p.filter((s) => s.id !== id));
  };
  const handleAddAudio = () => {
    setUploadAudios((p) => [
      ...p,
      { id: `a${Date.now()}`, label: `音轨 ${p.length + 1}`, codec: 'AAC 320kbps', isDefault: p.length === 0 },
    ]);
  };
  const handleRemoveAudio = (id: string) => {
    setUploadAudios((p) => p.filter((a) => a.id !== id));
  };
  const handleSetDefaultAudio = (id: string) => {
    setUploadAudios((p) => p.map((a) => ({ ...a, isDefault: a.id === id })));
  };

  const createMutation = useMutation({
    mutationFn: (title: string) =>
      updateShare({
        title,
        contentType: 'VIDEO',
        status: 'reviewing',
        subtitle: `分辨率:${uploadResolution} · HDR:${uploadHdr ? '是' : '否'}`,
      } as ModuleContentItem),
  });

  const handleSubmitUpload = async () => {
    if (!uploadTitle.trim()) {
      setSnack({ msg: '请输入视频标题', severity: 'warning' });
      return;
    }
    // 文件上传状态机检查(历史上完全没检查过文件,导致没选文件也能提交)。
    if (uploadStatus === 'idle') {
      setSnack({ msg: '请先选择视频文件', severity: 'warning' });
      return;
    }
    if (uploadStatus === 'uploading') {
      setSnack({ msg: '文件正在上传,请稍候...', severity: 'info' });
      return;
    }
    if (uploadStatus === 'failed') {
      setSnack({ msg: '文件上传失败,请重新选择文件后重试', severity: 'error' });
      return;
    }
    if (!uploadFileUrl) {
      setSnack({ msg: '文件地址缺失,请重新选择', severity: 'error' });
      return;
    }
    try {
      await createMutation.mutateAsync(uploadTitle.trim());
    } catch (e: any) {
      // catch 后立即 return,不再继续往下走创建 progress:5% / sizeMB:0 的假 item —
      // 历史上假 item 加进列表但永远卡 5%,KPI 数字不变,用户感知为"界面死了"。
      setSnack({ msg: `内容创建失败:${e.message || '未知错误'}`, severity: 'error' });
      return;
    }
    const newItem: HdVideo = {
      id: `hd-${Date.now()}`,
      title: uploadTitle.trim(),
      cover: gradient3('#25F4EE', '#5DF7F2', '#8B5CF6'),
      resolution: uploadResolution,
      fps: uploadResolution === '4K' || uploadResolution === '1080P' ? 60 : 30,
      hdr: uploadHdr,
      duration: '00:00',
      sizeMB: uploadFileSizeMB,
      status: 'transcoding',
      progress: 5,
      uploadedAt: Date.now(),
      hasCover: uploadAutoCover,
      subtitles: uploadSubtitles,
      audioTracks: uploadAudios,
    };
    setVideos((p) => [newItem, ...p]);
    setSnack({ msg: `《${newItem.title}》已加入转码队列`, severity: 'success' });
    setUploadOpen(false);
    // reset
    setUploadTitle('');
    setUploadResolution('4K');
    setUploadHdr(true);
    setUploadAutoCover(true);
    setUploadSubtitles([]);
    setUploadAudios([{ id: 'a1', label: '原声', codec: 'AAC 320kbps', isDefault: true }]);
    resetUpload();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Dispatcher 顶部:13 类型 chip 选择 */}
      <PublishTypeChips value={selectedType} onChange={setSelectedType} />

      {/* 非 VIDEO 类型渲染对应表单到 Dialog */}
      {selectedType !== 'video' && selectedType !== 'all' && (
        <Dialog
          open={formDialogOpen}
          onClose={() => setFormDialogOpen(false)}
          maxWidth="lg"
          fullWidth
          slotProps={{
            paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', maxHeight: '90vh' } },
          }}
        >
          <Box sx={{ p: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary' }}>
              发布「{PUBLISH_HUB_TYPE_LABEL[selectedType]}」
            </Typography>
            <IconButton size="small" onClick={() => setFormDialogOpen(false)}>
              <CloseRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
          <Box sx={{ p: 3, maxHeight: 'calc(90vh - 80px)', overflow: 'auto' }}>
            {/* 按类型懒加载对应表单 */}
            {selectedType === 'picture-album' && <ImageFormLazy onSuccess={() => setFormDialogOpen(false)} />}
            {selectedType === 'picture-mv' && <ImageMvFormLazy onSuccess={() => setFormDialogOpen(false)} />}
            {selectedType === 'article' && <ArticleFormLazy onSuccess={() => setFormDialogOpen(false)} />}
            {selectedType === 'novel' && <NovelFormLazy onSuccess={() => setFormDialogOpen(false)} />}
            {selectedType === 'news' && <NewsFormLazy onSuccess={() => setFormDialogOpen(false)} />}
            {selectedType === 'music' && <MusicFormLazy onSuccess={() => setFormDialogOpen(false)} />}
            {selectedType === 'comics' && <ComicsFormLazy onSuccess={() => setFormDialogOpen(false)} />}
            {selectedType === 'vshow' && <VshowFormLazy onSuccess={() => setFormDialogOpen(false)} />}
            {selectedType === 'teleplay' && <TeleplayFormLazy onSuccess={() => setFormDialogOpen(false)} />}
            {selectedType === 'film' && <FilmFormLazy onSuccess={() => setFormDialogOpen(false)} />}
            {selectedType === 'animation' && <AnimationFormLazy onSuccess={() => setFormDialogOpen(false)} />}
            {selectedType === 'live' && <LiveFormLazy onSuccess={() => setFormDialogOpen(false)} />}
          </Box>
        </Dialog>
      )}

      {/* 非 VIDEO 内容的统一详情 Drawer */}
      <ContentDetailDrawer
        open={!!unifiedDetail}
        payload={unifiedDetail}
        onClose={() => setUnifiedDetail(null)}
      />

      {/* 非 VIDEO 列表区:按下文判定显隐 */}
      {selectedType !== 'video' && (
        <UnifiedContentList
          selectedType={selectedType === 'all' ? 'video' : selectedType}
          onSelectItem={(item) => {
            // VIDEO 类型走原 drawer;其它用统一 drawer
            if (item.contentType === 'VIDEO') {
              setDetailId(String(item.id));
            } else {
              setUnifiedDetail(item);
            }
          }}
        />
      )}

      {/* Stat cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        {[
          { label: '今日上传', value: String(stats.todayUploads), suffix: '个', icon: <CloudUploadRoundedIcon />, color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)' },
          { label: 'HD 作品总数', value: String(stats.hdCount), suffix: '部', icon: <HdRoundedIcon />, color: '#25F4EE', bg: 'rgba(37, 244, 238, 0.12)' },
          { label: '极速通道剩余', value: `${stats.fastChannelQuota}`, suffix: `/${stats.fastChannelMonthly} 次`, icon: <RocketLaunchRoundedIcon />, color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)' },
          { label: '今日审核', value: stats.todayReviewed > 0 ? `${stats.passRate.toFixed(0)}%` : '—', suffix: stats.todayReviewed > 0 ? `通过率 (${stats.todayReviewed} 部)` : '暂无审核记录', icon: <RateReviewRoundedIcon />, color: stats.passRate >= 80 ? '#5DDB96' : stats.passRate >= 50 ? '#FFB400' : '#FE2C55', bg: stats.passRate >= 80 ? 'rgba(93, 219, 150, 0.12)' : stats.passRate >= 50 ? 'rgba(255, 180, 0, 0.12)' : 'rgba(254, 44, 85, 0.12)' },
        ].map((s) => (
          <Box
            key={s.label}
            sx={{
              p: 2.5,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: s.bg,
                filter: 'blur(20px)',
              }}
            />
            <Box sx={{ position: 'relative' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1,
                    bgcolor: s.bg,
                    color: s.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {s.icon}
                </Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s.label}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography sx={{ fontSize: 26, fontWeight: 700, color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
                  {s.value}
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>{s.suffix}</Typography>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Upload trigger + benefits */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
          gap: 2,
        }}
      >
        {/* Upload area */}
        <Box
          onClick={() => setUploadOpen(true)}
          sx={{
            borderRadius: 2,
            border: '2px dashed',
            borderColor: 'primary.main',
            p: { xs: 3, md: 4 },
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, rgba(254, 44, 85, 0.06) 0%, rgba(37, 244, 238, 0.06) 100%)',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: 'primary.main',
              background: 'linear-gradient(135deg, rgba(254, 44, 85, 0.10) 0%, rgba(37, 244, 238, 0.10) 100%)',
              transform: 'translateY(-2px)',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              <CloudUploadRoundedIcon sx={{ fontSize: 32 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: 18, fontWeight: 600, color: 'text.primary' }}>
                  上传高清视频
                </Typography>
                <Chip
                  size="small"
                  label="支持 4K 60fps · HDR"
                  sx={{
                    height: 18,
                    fontSize: 10,
                    fontWeight: 700,
                    bgcolor: 'rgba(254, 44, 85, 0.12)',
                    color: 'primary.main',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              </Box>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.6 }}>
                点击或拖拽视频文件到此区域 · 单文件最大 10GB · 支持 MP4 / MOV / MKV / WebM
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, flexWrap: 'wrap' }}>
                {['4K 60fps', 'HDR 10bit', '杜比全景声', '多音轨多字幕'].map((t) => (
                  <Box
                    key={t}
                    sx={{
                      px: 1,
                      py: 0.25,
                      borderRadius: 0.5,
                      bgcolor: 'action.hover',
                      color: 'text.secondary',
                      fontSize: 10,
                    }}
                  >
                    {t}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </Box>

        {/* HD 权益 panel */}
        <Box
          sx={{
            p: 2.5,
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: 0.75,
                background: 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                mr: 1,
              }}
            >
              <HdRoundedIcon sx={{ fontSize: 14 }} />
            </Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>HD 创作特权</Typography>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.25 }}>
            {BENEFITS.map((b) => (
              <Tooltip key={b.title} title={b.desc} placement="top" arrow>
                <Box
                  sx={{
                    p: 1.25,
                    borderRadius: 1.5,
                    bgcolor: 'action.hover',
                    border: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    transition: 'all 0.15s',
                    cursor: 'help',
                    '&:hover': { borderColor: b.color, bgcolor: `${b.color}08` },
                  }}
                >
                  <Box sx={{ color: b.color, display: 'flex' }}>{b.icon}</Box>
                  <Typography sx={{ fontSize: 11, color: 'text.primary', fontWeight: 500 }}>{b.title}</Typography>
                </Box>
              </Tooltip>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Video list */}
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 2,
          p: 2.5,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              minHeight: 0,
              '& .MuiTab-root': { minHeight: 0, py: 0.5, px: 1.5, fontSize: 12, textTransform: 'none' },
            }}
          >
            <Tab value="all" label={`全部 ${videos.length}`} />
            <Tab value="transcoding" label={`转码中 ${videos.filter((v) => v.status === 'transcoding').length}`} />
            <Tab value="reviewing" label={`审核中 ${videos.filter((v) => v.status === 'reviewing').length}`} />
            <Tab value="review_failed" label={`审核未通过 ${videos.filter((v) => v.status === 'review_failed').length}`} />
            <Tab value="published" label={`已发布 ${videos.filter((v) => v.status === 'published').length}`} />
            <Tab value="failed" label={`转码失败 ${videos.filter((v) => v.status === 'failed').length}`} />
          </Tabs>
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            startIcon={<HistoryRoundedIcon sx={{ fontSize: 14 }} />}
            onClick={() => setReviewHistoryOpen(true)}
            sx={{
              textTransform: 'none',
              fontSize: 11,
              minWidth: 0,
              px: 1.25,
              color: 'text.secondary',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.5,
            }}
          >
            审核历史
          </Button>
          <TextField
            size="small"
            placeholder="搜索视频标题…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{
              minWidth: 220,
              '& .MuiOutlinedInput-root': {
                fontSize: 12,
                bgcolor: 'action.hover',
                '& fieldset': { borderColor: 'divider' },
              },
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Box sx={{ fontSize: 14, color: 'text.disabled' }}>🔍</Box>
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>

        {filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled', fontSize: 13 }}>
            暂无符合条件的视频
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {filtered.map((v) => {
              const sm = STATUS_META[v.status];
              const rm = RESOLUTION_META[v.resolution];
              return (
                <Box
                  key={v.id}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: v.status === 'failed' ? 'rgba(254, 44, 85, 0.3)' : 'divider',
                    display: 'flex',
                    gap: 2,
                    transition: 'border-color 0.15s',
                    '&:hover': { borderColor: sm.color },
                  }}
                >
                  {/* Cover */}
                  <Box
                    onClick={() => setDetailId(v.id)}
                    sx={{
                      width: 140,
                      height: 80,
                      borderRadius: 1,
                      background: v.cover,
                      flexShrink: 0,
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {v.hasCover ? (
                      <>
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.6) 100%)',
                          }}
                        />
                        <Typography
                          sx={{
                            position: 'absolute',
                            bottom: 4,
                            right: 4,
                            fontSize: 10,
                            color: '#fff',
                            fontWeight: 600,
                            bgcolor: 'rgba(0,0,0,0.6)',
                            px: 0.5,
                            borderRadius: 0.5,
                          }}
                        >
                          {v.duration}
                        </Typography>
                      </>
                    ) : (
                      <VideoFileRoundedIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.3)' }} />
                    )}
                    {/* Resolution badge */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        display: 'flex',
                        gap: 0.5,
                      }}
                    >
                      <Box
                        sx={{
                          px: 0.5,
                          py: 0.1,
                          borderRadius: 0.5,
                          bgcolor: rm.bg,
                          color: rm.color,
                          fontSize: 9,
                          fontWeight: 700,
                        }}
                      >
                        {rm.label}
                      </Box>
                      {v.hdr && (
                        <Box
                          sx={{
                            px: 0.5,
                            py: 0.1,
                            borderRadius: 0.5,
                            bgcolor: 'rgba(255, 180, 0, 0.8)',
                            color: '#000',
                            fontSize: 9,
                            fontWeight: 700,
                          }}
                        >
                          HDR
                        </Box>
                      )}
                    </Box>
                  </Box>

                  {/* Info */}
                  <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.25,
                          px: 0.5,
                          py: 0.1,
                          borderRadius: 0.5,
                          bgcolor: sm.bg,
                          color: sm.color,
                          fontSize: 9,
                          fontWeight: 700,
                        }}
                      >
                        {sm.icon}
                        {sm.label}
                      </Box>
                      <Typography
                        sx={{
                          fontSize: 9,
                          color: 'text.disabled',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {v.fps}fps · {formatSize(v.sizeMB)} · {v.subtitles.length} 字幕 · {v.audioTracks.length} 音轨
                      </Typography>
                    </Box>
                    <Typography
                      onClick={() => setDetailId(v.id)}
                      sx={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'text.primary',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      {v.title}
                    </Typography>

                    {/* Status-specific row */}
                    {v.status === 'transcoding' && (
                      <Box sx={{ mt: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={v.progress ?? 0}
                            sx={{
                              flex: 1,
                              height: 4,
                              borderRadius: 1,
                              bgcolor: 'action.hover',
                              '& .MuiLinearProgress-bar': { bgcolor: '#25F4EE' },
                            }}
                          />
                          <Typography sx={{ fontSize: 10, color: 'text.disabled', fontVariantNumeric: 'tabular-nums', minWidth: 32 }}>
                            {v.progress}%
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: 10, color: 'text.disabled', mt: 0.25 }}>
                          预计 {formatDuration(Math.floor(((100 - (v.progress ?? 0)) * 8)))} 完成
                        </Typography>
                      </Box>
                    )}

                    {v.status === 'reviewing' && v.review && (
                      <Box sx={{ mt: 0.75 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5, flexWrap: 'wrap' }}>
                          <RateReviewRoundedIcon sx={{ fontSize: 12, color: '#FFB400' }} />
                          <Typography sx={{ fontSize: 10, color: '#FFB400', fontWeight: 600 }}>
                            审核中 · {v.review.checks.filter((c) => c.status === 'passed').length}/{v.review.checks.length} 项通过
                            {v.review.useFastChannel && (
                              <Box component="span" sx={{ ml: 0.75, color: '#FE2C55', fontWeight: 700 }}>
                                · ⚡ 极速
                              </Box>
                            )}
                          </Typography>
                          {(() => {
                            const r = getReviewer(v.review.assignedReviewerId);
                            if (!r) return null;
                            return (
                              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, ml: 'auto' }}>
                                <Box
                                  sx={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: '50%',
                                    background: r.avatarColor,
                                    color: '#fff',
                                    fontSize: 8,
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  {r.initials}
                                </Box>
                                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                                  {v.review.queuePosition !== undefined
                                    ? `${r.name} · 队列第 ${v.review.queuePosition} 位`
                                    : r.online
                                    ? `${r.name} · 正在审核`
                                    : r.name}
                                </Typography>
                              </Box>
                            );
                          })()}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                          {v.review.checks.map((c) => {
                            const cs: { bg: string | ((t: any) => string); color: string | ((t: any) => string) } =
                              c.status === 'passed'
                                ? { bg: 'rgba(93, 219, 150, 0.12)', color: '#5DDB96' }
                                : c.status === 'failed'
                                ? { bg: 'rgba(254, 44, 85, 0.12)', color: '#FE2C55' }
                                : c.status === 'running'
                                ? { bg: 'rgba(37, 244, 238, 0.12)', color: '#25F4EE' }
                                : { bg: (theme: any) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover', color: (theme: any) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.4)' : 'text.secondary' };
                            return (
                              <Box
                                key={c.id}
                                sx={{
                                  px: 0.5,
                                  py: 0.1,
                                  borderRadius: 0.5,
                                  bgcolor: cs.bg,
                                  color: cs.color,
                                  fontSize: 9,
                                  fontWeight: 600,
                                }}
                              >
                                {c.label}
                                {c.status === 'passed' ? ' ✓' : c.status === 'failed' ? ' ✕' : c.status === 'running' ? ' …' : ''}
                              </Box>
                            );
                          })}
                        </Box>
                      </Box>
                    )}

                    {v.status === 'review_failed' && v.review?.rejections && (
                      <Box
                        sx={{
                          mt: 0.5,
                          p: 1,
                          borderRadius: 0.75,
                          bgcolor: 'rgba(254, 44, 85, 0.06)',
                          border: '1px solid rgba(254, 44, 85, 0.2)',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                          <Typography sx={{ fontSize: 10, color: 'primary.main', fontWeight: 600 }}>
                            ⚠ {v.review.rejections[0].category}
                            {v.review.rejections.length > 1 && ` 等 ${v.review.rejections.length} 项`}
                          </Typography>
                          {(() => {
                            const r = getReviewer(v.review.assignedReviewerId);
                            if (!r) return null;
                            return (
                              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, ml: 'auto' }}>
                                <Box
                                  sx={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: '50%',
                                    background: r.avatarColor,
                                    color: '#fff',
                                    fontSize: 8,
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  {r.initials}
                                </Box>
                                <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>
                                  由 {r.name} 判定
                                </Typography>
                              </Box>
                            );
                          })()}
                        </Box>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {v.review.rejections[0].detail}
                        </Typography>
                      </Box>
                    )}

                    {v.status === 'published' && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                          👁 {formatCount(v.views ?? 0)} 播放
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                          ❤ {formatCount(v.likes ?? 0)} 点赞
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                          发布于 {v.publishedAt && <RelativeTime ts={v.publishedAt} fallback="" />}
                        </Typography>
                      </Box>
                    )}

                    {v.status === 'failed' && (
                      <Box sx={{ mt: 0.5, p: 1, borderRadius: 0.75, bgcolor: 'rgba(254, 44, 85, 0.08)' }}>
                        <Typography sx={{ fontSize: 10, color: 'primary.main' }}>
                          ⚠ {v.failedReason}
                        </Typography>
                      </Box>
                    )}

                    {v.status === 'scheduled' && (
                      <Typography sx={{ fontSize: 10, color: '#8B5CF6', mt: 0.5 }}>
                        🚀 将在 {v.scheduledAt && <RelativeTime ts={v.scheduledAt} fallback="" />} 自动发布
                      </Typography>
                    )}
                  </Box>

                  {/* Actions */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                    {isReviewer && (v.status === 'reviewing' || v.status === 'review_failed') && (
                      <Tooltip title="作为审核员审核此视频">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<RateReviewRoundedIcon sx={{ fontSize: 14 }} />}
                          onClick={() => {
                            const params: Record<string, string> = { video: v.id };
                            const rid = v.review?.assignedReviewerId;
                            if (rid) params.reviewer = rid;
                            setActiveTab('hd-review', params);
                          }}
                          sx={{
                            textTransform: 'none',
                            fontSize: 11,
                            minWidth: 0,
                            px: 1,
                            py: 0.25,
                            borderColor: 'rgba(91, 141, 239, 0.5)',
                            color: '#5B8DEF',
                            '&:hover': { borderColor: '#5B8DEF', bgcolor: 'rgba(91, 141, 239, 0.08)' },
                          }}
                        >
                          去审核
                        </Button>
                      </Tooltip>
                    )}
                    {v.status === 'published' && (
                      <Button
                        size="small"
                        startIcon={<VisibilityRoundedIcon sx={{ fontSize: 14 }} />}
                        onClick={() => handleViewPublished(v.id)}
                        sx={{ textTransform: 'none', fontSize: 11, color: 'text.secondary', minWidth: 0, px: 1 }}
                      >
                        查看
                      </Button>
                    )}
                    {v.status === 'failed' && (
                      <Button
                        size="small"
                        startIcon={<RefreshRoundedIcon sx={{ fontSize: 14 }} />}
                        onClick={() => handleRetry(v.id)}
                        sx={{
                          textTransform: 'none',
                          fontSize: 11,
                          minWidth: 0,
                          px: 1,
                          color: 'primary.main',
                        }}
                      >
                        重试
                      </Button>
                    )}
                    {v.status === 'reviewing' && !v.review?.useFastChannel && (
                      <Tooltip title={fastChannelQuota > 0 ? '消耗 1 次极速通道,优先审核' : '本月极速通道已用完'}>
                        <Box component="span">
                          <Button
                            size="small"
                            disabled={fastChannelQuota <= 0}
                            startIcon={<BoltRoundedIcon sx={{ fontSize: 14 }} />}
                            onClick={() => handleFastTrackReview(v.id)}
                            sx={{
                              textTransform: 'none',
                              fontSize: 11,
                              minWidth: 0,
                              px: 1,
                              color: fastChannelQuota > 0 ? '#FE2C55' : 'text.disabled',
                            }}
                          >
                            极速送审
                          </Button>
                        </Box>
                      </Tooltip>
                    )}
                    {v.status === 'review_failed' && (
                      <Button
                        size="small"
                        startIcon={<RefreshRoundedIcon sx={{ fontSize: 14 }} />}
                        onClick={() => handleResubmitReview(v.id)}
                        sx={{
                          textTransform: 'none',
                          fontSize: 11,
                          minWidth: 0,
                          px: 1,
                          color: 'primary.main',
                        }}
                      >
                        重新送审
                      </Button>
                    )}
                    {v.status === 'scheduled' && (
                      <Button
                        size="small"
                        onClick={() => handlePublishNow(v.id)}
                        sx={{
                          textTransform: 'none',
                          fontSize: 11,
                          minWidth: 0,
                          px: 1,
                          color: '#5DDB96',
                        }}
                      >
                        立即发布
                      </Button>
                    )}
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, v.id)}
                      sx={{ p: 0.5 }}
                      aria-label="更多"
                    >
                      <MoreHorizIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Row action menu */}
      <Menu
        anchorEl={menuAnchor?.el ?? null}
        open={!!menuAnchor}
        onClose={handleMenuClose}
        slotProps={{
          paper: {
            sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', minWidth: 140 },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            if (menuAnchor) setDetailId(menuAnchor.id);
            handleMenuClose();
          }}
          sx={{ fontSize: 12 }}
        >
          <VisibilityRoundedIcon sx={{ fontSize: 14, mr: 1 }} />
          详情
        </MenuItem>
        {menuAnchor && videos.find((v) => v.id === menuAnchor.id)?.status === 'failed' && (
          <MenuItem
            onClick={() => menuAnchor && handleRetry(menuAnchor.id)}
            sx={{ fontSize: 12 }}
          >
            <RefreshRoundedIcon sx={{ fontSize: 14, mr: 1 }} />
            重新转码
          </MenuItem>
        )}
        {menuAnchor && videos.find((v) => v.id === menuAnchor.id)?.status === 'reviewing' && !videos.find((v) => v.id === menuAnchor.id)?.review?.useFastChannel && (
          <MenuItem
            onClick={() => menuAnchor && handleFastTrackReview(menuAnchor.id)}
            disabled={fastChannelQuota <= 0}
            sx={{ fontSize: 12, color: '#FE2C55' }}
          >
            <BoltRoundedIcon sx={{ fontSize: 14, mr: 1 }} />
            极速送审
          </MenuItem>
        )}
        {menuAnchor && videos.find((v) => v.id === menuAnchor.id)?.status === 'review_failed' && (
          <MenuItem
            onClick={() => menuAnchor && handleResubmitReview(menuAnchor.id)}
            sx={{ fontSize: 12, color: 'primary.main' }}
          >
            <RefreshRoundedIcon sx={{ fontSize: 14, mr: 1 }} />
            重新送审
          </MenuItem>
        )}
        {menuAnchor && (
          <MenuItem
            onClick={() => menuAnchor && handleOpenCoverPicker(menuAnchor.id)}
            sx={{ fontSize: 12 }}
          >
            <ImageRoundedIcon sx={{ fontSize: 14, mr: 1 }} />
            更换封面
          </MenuItem>
        )}
        <Divider sx={{ my: 0.5, borderColor: 'divider' }} />
        <MenuItem
          onClick={() => menuAnchor && handleDelete(menuAnchor.id)}
          sx={{ fontSize: 12, color: 'primary.main' }}
        >
          <DeleteOutlineRoundedIcon sx={{ fontSize: 14, mr: 1 }} />
          删除
        </MenuItem>
      </Menu>

      {/* Upload dialog */}
      <Dialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' },
          },
        }}
      >
        <Box sx={{ p: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                background: 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <CloudUploadRoundedIcon sx={{ fontSize: 18 }} />
            </Box>
            <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary' }}>上传高清视频</Typography>
          </Box>
          <IconButton size="small" onClick={() => setUploadOpen(false)}>
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: 'divider' }} />

        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* File picker */}
          <Box
            onClick={handlePickFile}
            sx={{
              p: 3,
              borderRadius: 1.5,
              border: '1.5px dashed',
              borderColor: 'divider',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(254, 44, 85, 0.04)' },
            }}
          >
            <CloudUploadRoundedIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
            <Typography sx={{ fontSize: 13, color: 'text.primary', fontWeight: 500 }}>
              点击选择视频文件
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.5 }}>
              MP4 / MOV / MKV / WebM · 最大 10GB
            </Typography>
          </Box>

          {/* Title */}
          <TextField
            label="视频标题"
            size="small"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            slotProps={{
              inputLabel: { sx: { fontSize: 12 } },
              input: { sx: { fontSize: 13 } },
            }}
          />

          {/* Quality preset */}
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', mb: 1 }}>
              输出质量
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 1,
              }}
            >
              {QUALITY_PRESETS.map((q) => {
                const selected = uploadResolution === q.id;
                return (
                  <Box
                    key={q.id}
                    onClick={() => setUploadResolution(q.id)}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      border: '1.5px solid',
                      borderColor: selected ? 'primary.main' : 'divider',
                      bgcolor: selected ? 'rgba(254, 44, 85, 0.06)' : 'transparent',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.15s',
                    }}
                  >
                    {q.popular && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: -8,
                          right: 8,
                          px: 0.5,
                          py: 0.1,
                          borderRadius: 0.5,
                          bgcolor: 'primary.main',
                          color: '#fff',
                          fontSize: 9,
                          fontWeight: 700,
                        }}
                      >
                        推荐
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>{q.label}</Typography>
                      {selected && <CheckRoundedIcon sx={{ fontSize: 14, color: 'primary.main' }} />}
                    </Box>
                    <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                      {q.bitrate} · {q.size}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Toggles */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={uploadHdr}
                  onChange={(e) => setUploadHdr(e.target.checked)}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <HighQualityRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography sx={{ fontSize: 12, color: 'text.primary' }}>启用 HDR 增强</Typography>
                </Box>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={uploadAutoCover}
                  onChange={(e) => setUploadAutoCover(e.target.checked)}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <AutoAwesomeRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography sx={{ fontSize: 12, color: 'text.primary' }}>AI 智能抽取封面</Typography>
                </Box>
              }
            />
          </Box>

          {/* Audio tracks */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 0.5 }}>
              <RecordVoiceOverRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>音轨</Typography>
              <Box sx={{ flex: 1 }} />
              <Button
                size="small"
                startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />}
                onClick={handleAddAudio}
                sx={{ textTransform: 'none', fontSize: 11, minWidth: 0, px: 1 }}
              >
                添加
              </Button>
            </Box>
            <Stack spacing={0.75}>
              {uploadAudios.map((a) => (
                <Box
                  key={a.id}
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                    border: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Typography sx={{ fontSize: 12, color: 'text.primary', flex: 1 }}>
                    {a.label} <Box component="span" sx={{ color: 'text.disabled', fontSize: 10 }}>· {a.codec}</Box>
                  </Typography>
                  {!a.isDefault && (
                    <Button
                      size="small"
                      onClick={() => handleSetDefaultAudio(a.id)}
                      sx={{ textTransform: 'none', fontSize: 10, minWidth: 0, px: 0.75, color: 'text.secondary' }}
                    >
                      设为默认
                    </Button>
                  )}
                  {a.isDefault && (
                    <Chip
                      size="small"
                      label="默认"
                      sx={{
                        height: 16,
                        fontSize: 9,
                        bgcolor: 'rgba(93, 219, 150, 0.12)',
                        color: '#5DDB96',
                        '& .MuiChip-label': { px: 0.5 },
                      }}
                    />
                  )}
                  {uploadAudios.length > 1 && (
                    <IconButton size="small" onClick={() => handleRemoveAudio(a.id)} sx={{ p: 0.25 }}>
                      <CloseRoundedIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  )}
                </Box>
              ))}
            </Stack>
          </Box>

          {/* Subtitles */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 0.5 }}>
              <ClosedCaptionRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>字幕轨</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                size="small"
                placeholder="语言 (zh-CN)"
                value={newSubLang}
                onChange={(e) => setNewSubLang(e.target.value)}
                sx={{ flex: 1, '& .MuiOutlinedInput-root': { fontSize: 11 } }}
              />
              <TextField
                size="small"
                placeholder="标签 (简体中文)"
                value={newSubLabel}
                onChange={(e) => setNewSubLabel(e.target.value)}
                sx={{ flex: 1.5, '& .MuiOutlinedInput-root': { fontSize: 11 } }}
              />
              <Button
                size="small"
                variant="outlined"
                onClick={handleAddSubtitle}
                disabled={!newSubLang || !newSubLabel}
                sx={{ textTransform: 'none', fontSize: 11, minWidth: 0, px: 1.5, borderColor: 'divider' }}
              >
                添加
              </Button>
            </Box>
            {uploadSubtitles.length === 0 ? (
              <Typography sx={{ fontSize: 10, color: 'text.disabled', py: 0.5 }}>
                暂未添加字幕
              </Typography>
            ) : (
              <Stack spacing={0.5}>
                {uploadSubtitles.map((s) => (
                  <Box
                    key={s.id}
                    sx={{
                      p: 0.75,
                      borderRadius: 0.75,
                      bgcolor: 'action.hover',
                      border: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <Typography sx={{ fontSize: 11, color: 'text.primary', flex: 1 }}>
                      {s.label} <Box component="span" sx={{ color: 'text.disabled', fontSize: 10 }}>· {s.lang}</Box>
                    </Typography>
                    <IconButton size="small" onClick={() => handleRemoveSubtitle(s.id)} sx={{ p: 0.25 }}>
                      <CloseRoundedIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </Box>

        <Divider sx={{ borderColor: 'divider' }} />
        <Box sx={{ p: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button
            onClick={() => setUploadOpen(false)}
            sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}
          >
            取消
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitUpload}
            disabled={
              !uploadTitle.trim() ||
              uploadStatus !== 'uploaded' ||
              createMutation.isPending
            }
            sx={{
              textTransform: 'none',
              fontSize: 12,
              background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
              '&:hover': {
                background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                filter: 'brightness(1.1)',
              },
            }}
          >
            {createMutation.isPending
              ? '提交中...'
              : uploadStatus !== 'uploaded'
                ? '请先上传文件'
                : '提交上传'}
          </Button>
        </Box>
      </Dialog>

      {/* Detail drawer */}
      <Drawer
        anchor="right"
        open={!!detail}
        onClose={() => setDetailId(null)}
        slotProps={{
          paper: { sx: { width: { xs: '100%', sm: 480 }, bgcolor: 'background.paper' } },
        }}
      >
        {detail && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box
              sx={{
                p: 2.5,
                pb: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary' }}>视频详情</Typography>
              <IconButton size="small" onClick={() => setDetailId(null)}>
                <CloseRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto', p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box
                sx={{
                  width: '100%',
                  aspectRatio: '16/9',
                  borderRadius: 1.5,
                  background: detail.cover,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MovieFilterRoundedIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.5)' }} />
                {detail.hasCover && (
                  <Typography
                    sx={{
                      position: 'absolute',
                      bottom: 8,
                      right: 8,
                      fontSize: 11,
                      color: '#fff',
                      fontWeight: 600,
                      bgcolor: 'rgba(0,0,0,0.6)',
                      px: 0.75,
                      borderRadius: 0.5,
                    }}
                  >
                    {detail.duration}
                  </Typography>
                )}
              </Box>

              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5, flexWrap: 'wrap' }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.25,
                      px: 0.5,
                      py: 0.1,
                      borderRadius: 0.5,
                      bgcolor: STATUS_META[detail.status].bg,
                      color: STATUS_META[detail.status].color,
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    {STATUS_META[detail.status].icon}
                    {STATUS_META[detail.status].label}
                  </Box>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.25,
                      px: 0.5,
                      py: 0.1,
                      borderRadius: 0.5,
                      bgcolor: RESOLUTION_META[detail.resolution].bg,
                      color: RESOLUTION_META[detail.resolution].color,
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    {detail.resolution}
                  </Box>
                  {detail.hdr && (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.25,
                        px: 0.5,
                        py: 0.1,
                        borderRadius: 0.5,
                        bgcolor: 'rgba(255, 180, 0, 0.12)',
                        color: '#FFB400',
                        fontSize: 9,
                        fontWeight: 700,
                      }}
                    >
                      HDR
                    </Box>
                  )}
                </Box>
                <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
                  {detail.title}
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                  {detail.fps}fps · {formatSize(detail.sizeMB)} · 上传于 {<RelativeTime ts={detail.uploadedAt} fallback="" />}
                </Typography>
              </Box>

              {detail.status === 'published' && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    bgcolor: 'rgba(93, 219, 150, 0.06)',
                    border: '1px solid',
                    borderColor: 'rgba(93, 219, 150, 0.3)',
                  }}
                >
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.75, fontWeight: 600 }}>
                    数据表现
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Box>
                      <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>播放</Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
                        {formatCount(detail.views ?? 0)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>点赞</Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
                        {formatCount(detail.likes ?? 0)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>点赞率</Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#5DDB96' }}>
                        {detail.views ? `${((detail.likes ?? 0) / detail.views * 100).toFixed(1)}%` : '-'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}

              {detail.status === 'failed' && detail.failedReason && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    bgcolor: 'rgba(254, 44, 85, 0.06)',
                    border: '1px solid',
                    borderColor: 'rgba(254, 44, 85, 0.3)',
                  }}
                >
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5, fontWeight: 600 }}>
                    {detail.failedStage === 'review' ? '审核未通过原因' : '转码失败原因'}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'primary.main' }}>
                    {detail.failedReason}
                  </Typography>
                </Box>
              )}

              {/* 审核流程时间线 */}
              {detail.review && (detail.status === 'reviewing' || detail.status === 'review_failed' || detail.status === 'published') && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    bgcolor: 'action.hover',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                    <PlaylistAddCheckRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>
                      审核流程
                    </Typography>
                    {detail.review.useFastChannel && (
                      <Chip
                        size="small"
                        icon={<BoltRoundedIcon sx={{ fontSize: 12, color: '#FE2C55 !important' }} />}
                        label="极速通道"
                        sx={{
                          height: 18,
                          fontSize: 9,
                          fontWeight: 700,
                          bgcolor: 'rgba(254, 44, 85, 0.12)',
                          color: '#FE2C55',
                          '& .MuiChip-label': { px: 0.5 },
                        }}
                      />
                    )}
                    <Box sx={{ flex: 1 }} />
                    {detail.review.startedAt && (
                      <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>
                        开始 {<RelativeTime ts={detail.review.startedAt} fallback="" />}
                      </Typography>
                    )}
                  </Box>

                  {/* 审核员信息 */}
                  {(() => {
                    const reviewer = getReviewer(detail.review.assignedReviewerId);
                    if (!reviewer) return null;
                    const lm = REVIEWER_LEVEL_META[reviewer.level];
                    const isReviewing = detail.status === 'reviewing';
                    const isRejected = detail.status === 'review_failed';
                    return (
                      <Box
                        sx={{
                          mb: 1.5,
                          p: 1.25,
                          borderRadius: 1.25,
                          bgcolor: isReviewing
                            ? 'rgba(255, 180, 0, 0.06)'
                            : isRejected
                            ? 'rgba(254, 44, 85, 0.06)'
                            : 'rgba(93, 219, 150, 0.06)',
                          border: '1px solid',
                          borderColor: isReviewing
                            ? 'rgba(255, 180, 0, 0.25)'
                            : isRejected
                            ? 'rgba(254, 44, 85, 0.25)'
                            : 'rgba(93, 219, 150, 0.25)',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              position: 'relative',
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              background: reviewer.avatarColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontSize: 14,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {reviewer.initials}
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                bgcolor: reviewer.online ? '#5DDB96' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.3)' : '#9CA3AF',
                                border: '2px solid',
                                borderColor: 'background.paper',
                              }}
                            />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                              <Typography sx={{ fontSize: 12, color: 'text.primary', fontWeight: 600 }}>
                                {reviewer.name}
                              </Typography>
                              <Box
                                sx={{
                                  px: 0.5,
                                  py: 0.05,
                                  borderRadius: 0.4,
                                  bgcolor: lm.bg,
                                  color: lm.color,
                                  fontSize: 9,
                                  fontWeight: 700,
                                }}
                              >
                                {lm.label} · {reviewer.team}
                              </Box>
                            </Box>
                            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                              {reviewer.title}
                            </Typography>
                          </Box>
                          {isReviewing && (
                            <Box sx={{ textAlign: 'right' }}>
                              {detail.review.queuePosition !== undefined ? (
                                <>
                                  <Typography sx={{ fontSize: 10, color: '#FFB400', fontWeight: 600 }}>
                                    队列第 {detail.review.queuePosition} 位
                                  </Typography>
                                  {detail.review.estimatedWaitMin !== undefined && (
                                    <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>
                                      预计 {detail.review.estimatedWaitMin} 分钟
                                    </Typography>
                                  )}
                                </>
                              ) : (
                                <Typography sx={{ fontSize: 10, color: '#25F4EE', fontWeight: 600 }}>
                                  正在审核
                                </Typography>
                              )}
                            </Box>
                          )}
                          {isRejected && detail.review.reviewerVerdict && (
                            <Box sx={{ textAlign: 'right' }}>
                              <Typography sx={{ fontSize: 10, color: '#FE2C55', fontWeight: 600 }}>
                                拒绝 · {<RelativeTime ts={detail.review.reviewerVerdict.timestamp} fallback="" />}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                        {detail.review.reviewerVerdict?.note && (
                          <Box
                            sx={{
                              mt: 1,
                              pt: 1,
                              borderTop: '1px dashed',
                              borderColor: 'divider',
                              display: 'flex',
                              gap: 0.75,
                            }}
                          >
                            <Typography sx={{ fontSize: 9, color: 'text.disabled', fontWeight: 600, flexShrink: 0 }}>
                              审核员备注:
                            </Typography>
                            <Typography sx={{ fontSize: 10, color: 'text.secondary', lineHeight: 1.5, flex: 1 }}>
                              {detail.review.reviewerVerdict.note}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    );
                  })()}

                  {/* 步骤列表 */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {detail.review.checks.map((c, i) => {
                      const isLast = i === detail.review!.checks.length - 1;
                      const node: { bg: string | ((t: any) => string); color: string | ((t: any) => string); icon: React.ReactNode } =
                        c.status === 'passed'
                          ? { bg: 'rgba(93, 219, 150, 0.18)', color: '#5DDB96', icon: <VerifiedRoundedIcon sx={{ fontSize: 12 }} /> }
                          : c.status === 'failed'
                          ? { bg: 'rgba(254, 44, 85, 0.18)', color: '#FE2C55', icon: <ErrorRoundedIcon sx={{ fontSize: 12 }} /> }
                          : c.status === 'running'
                          ? { bg: 'rgba(37, 244, 238, 0.18)', color: '#25F4EE', icon: <AutorenewRoundedIcon sx={{ fontSize: 12 }} /> }
                          : c.status === 'skipped'
                          ? { bg: (theme: any) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover', color: (theme: any) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.3)' : 'text.disabled', icon: <Box sx={{ fontSize: 10 }}>—</Box> }
                          : { bg: (theme: any) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover', color: (theme: any) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.3)' : 'text.disabled', icon: <Box sx={{ fontSize: 10 }}>{i + 1}</Box> };
                      return (
                        <Box key={c.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 18 }}>
                            <Box
                              sx={{
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                bgcolor: node.bg,
                                color: node.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {node.icon}
                            </Box>
                            {!isLast && (
                              <Box sx={{ width: 1, flex: 1, minHeight: 20, bgcolor: c.status === 'passed' ? 'rgba(93, 219, 150, 0.3)' : 'divider', my: 0.25 }} />
                            )}
                          </Box>
                          <Box sx={{ flex: 1, pb: isLast ? 0 : 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                              <Typography sx={{ fontSize: 11, color: 'text.primary', fontWeight: 500 }}>
                                {c.label}
                              </Typography>
                              {c.duration !== undefined && (
                                <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>
                                  · {c.duration}s
                                </Typography>
                              )}
                              {c.status === 'running' && (
                                <Typography sx={{ fontSize: 9, color: '#25F4EE', fontWeight: 600 }}>
                                  进行中
                                </Typography>
                              )}
                            </Box>
                            {c.desc && (
                              <Typography sx={{ fontSize: 9, color: 'text.disabled', mt: 0.25 }}>
                                {c.desc}
                              </Typography>
                            )}
                            {c.message && (
                              <Typography sx={{ fontSize: 10, color: c.status === 'failed' ? '#FE2C55' : 'text.secondary', mt: 0.25 }}>
                                {c.message}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>

                  {/* 失败原因详情 */}
                  {detail.status === 'review_failed' && detail.review.rejections && detail.review.rejections.length > 0 && (
                    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Typography sx={{ fontSize: 11, color: 'primary.main', fontWeight: 600, mb: 0.75, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <WarningAmberRoundedIcon sx={{ fontSize: 12 }} />
                        违规详情 ({detail.review.rejections.length})
                      </Typography>
                      <Stack spacing={0.75}>
                        {detail.review.rejections.map((r, i) => {
                          const checkLabel = detail.review!.checks.find((c) => c.id === r.checkId)?.label ?? r.checkId;
                          return (
                            <Box
                              key={i}
                              sx={{
                                p: 1,
                                borderRadius: 0.75,
                                bgcolor: 'rgba(254, 44, 85, 0.06)',
                                border: '1px solid rgba(254, 44, 85, 0.2)',
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                                <Typography sx={{ fontSize: 10, color: 'primary.main', fontWeight: 600 }}>
                                  {r.category}
                                </Typography>
                                <Chip
                                  size="small"
                                  label={checkLabel}
                                  sx={{
                                    height: 14,
                                    fontSize: 9,
                                    bgcolor: 'action.hover',
                                    color: 'text.secondary',
                                    '& .MuiChip-label': { px: 0.5 },
                                  }}
                                />
                                {r.frameAt && (
                                  <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>
                                    @ {r.frameAt}
                                  </Typography>
                                )}
                              </Box>
                              <Typography sx={{ fontSize: 10, color: 'text.secondary', lineHeight: 1.5 }}>
                                {r.detail}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  )}

                  {/* 审核总结 + 申诉入口 */}
                  {detail.review.completedAt && (
                    <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: detail.review.result === 'reject' && detail.review.reviewerVerdict?.appealable ? 1 : 0 }}>
                        <SecurityRoundedIcon sx={{ fontSize: 12, color: detail.review.result === 'pass' ? '#5DDB96' : '#FE2C55' }} />
                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                          {detail.review.result === 'pass' ? '审核通过' : '审核未通过'} · 完成于 {<RelativeTime ts={detail.review.completedAt} fallback="" />}
                        </Typography>
                        <Box sx={{ flex: 1 }} />
                        {detail.review.result === 'pass' && detail.review.reviewerVerdict && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <VerifiedRoundedIcon sx={{ fontSize: 12, color: '#5DDB96' }} />
                            <Typography sx={{ fontSize: 9, color: '#5DDB96', fontWeight: 600 }}>
                              {getReviewer(detail.review.reviewerVerdict.reviewerId)?.name ?? '审核员'} 已签字
                            </Typography>
                          </Box>
                        )}
                      </Box>
                      {detail.review.result === 'reject' && detail.review.reviewerVerdict?.appealable && (
                        <Box
                          sx={{
                            p: 1,
                            borderRadius: 0.75,
                            bgcolor: 'rgba(91, 141, 239, 0.06)',
                            border: '1px solid rgba(91, 141, 239, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                          }}
                        >
                          <GavelRoundedIcon sx={{ fontSize: 14, color: '#5B8DEF' }} />
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: 10, color: 'text.primary', fontWeight: 600 }}>
                              对审核结果有异议?
                            </Typography>
                            <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>
                              {detail.review.reviewerVerdict.appealDeadline
                                ? `可在 ${<RelativeTime ts={detail.review.reviewerVerdict.appealDeadline} fallback="" />} 前提交申诉,72 小时内重新审核`
                                : '可在 7 天内提交申诉,72 小时内重新审核'}
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            onClick={handleOpenAppeal}
                            sx={{
                              textTransform: 'none',
                              fontSize: 11,
                              minWidth: 0,
                              px: 1.5,
                              color: '#5B8DEF',
                              border: '1px solid',
                              borderColor: 'rgba(91, 141, 239, 0.3)',
                              borderRadius: 1.5,
                            }}
                          >
                            提交申诉
                          </Button>
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              )}

              {/* Tracks */}
              {(detail.subtitles.length > 0 || detail.audioTracks.length > 0) && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    bgcolor: 'action.hover',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {detail.audioTracks.length > 0 && (
                    <Box sx={{ mb: detail.subtitles.length > 0 ? 1.5 : 0 }}>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.75, fontWeight: 600 }}>
                        音轨 ({detail.audioTracks.length})
                      </Typography>
                      <Stack spacing={0.5}>
                        {detail.audioTracks.map((a) => (
                          <Box
                            key={a.id}
                            sx={{
                              p: 0.75,
                              borderRadius: 0.75,
                              bgcolor: 'action.hover',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Typography sx={{ fontSize: 11, color: 'text.primary', flex: 1 }}>
                              {a.label}
                            </Typography>
                            <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{a.codec}</Typography>
                            {a.isDefault && (
                              <Chip
                                size="small"
                                label="默认"
                                sx={{
                                  height: 14,
                                  fontSize: 9,
                                  bgcolor: 'rgba(93, 219, 150, 0.12)',
                                  color: '#5DDB96',
                                  '& .MuiChip-label': { px: 0.5 },
                                }}
                              />
                            )}
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}
                  {detail.subtitles.length > 0 && (
                    <Box>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.75, fontWeight: 600 }}>
                        字幕 ({detail.subtitles.length})
                      </Typography>
                      <Stack spacing={0.5}>
                        {detail.subtitles.map((s) => (
                          <Box
                            key={s.id}
                            sx={{
                              p: 0.75,
                              borderRadius: 0.75,
                              bgcolor: 'action.hover',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Typography sx={{ fontSize: 11, color: 'text.primary', flex: 1 }}>
                              {s.label}
                            </Typography>
                            <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{s.lang}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Box>
              )}

              {detail.status === 'transcoding' && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>
                      转码进度
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.primary', fontWeight: 600 }}>
                      {detail.progress}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={detail.progress ?? 0}
                    sx={{
                      height: 6,
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                      '& .MuiLinearProgress-bar': { bgcolor: '#25F4EE' },
                    }}
                  />
                </Box>
              )}
            </Box>

            <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 1 }}>
              {detail.status === 'failed' && (
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<RefreshRoundedIcon sx={{ fontSize: 14 }} />}
                  onClick={() => {
                    handleRetry(detail.id);
                    setDetailId(null);
                  }}
                  sx={{
                    textTransform: 'none',
                    fontSize: 12,
                    background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                    '&:hover': {
                      background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                      filter: 'brightness(1.1)',
                    },
                  }}
                >
                  重新转码
                </Button>
              )}
              {detail.status === 'reviewing' && !detail.review?.useFastChannel && (
                <Button
                  fullWidth
                  variant="contained"
                  disabled={fastChannelQuota <= 0}
                  startIcon={<BoltRoundedIcon sx={{ fontSize: 14 }} />}
                  onClick={() => {
                    handleFastTrackReview(detail.id);
                  }}
                  sx={{
                    textTransform: 'none',
                    fontSize: 12,
                    background: fastChannelQuota > 0 ? 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)' : undefined,
                    '&:hover': {
                      background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                      filter: 'brightness(1.1)',
                    },
                    '&.Mui-disabled': {
                      bgcolor: 'action.hover',
                      color: 'text.disabled',
                    },
                  }}
                >
                  {fastChannelQuota > 0 ? '极速送审 (剩 ' + fastChannelQuota + ' 次)' : '本月极速通道已用完'}
                </Button>
              )}
              {detail.status === 'review_failed' && (
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<RefreshRoundedIcon sx={{ fontSize: 14 }} />}
                  onClick={() => {
                    handleResubmitReview(detail.id);
                    setDetailId(null);
                  }}
                  sx={{
                    textTransform: 'none',
                    fontSize: 12,
                    background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                    '&:hover': {
                      background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                      filter: 'brightness(1.1)',
                    },
                  }}
                >
                  重新送审
                </Button>
              )}
              {detail.status === 'published' && (
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<VisibilityRoundedIcon sx={{ fontSize: 14 }} />}
                  onClick={() => handleViewPublished(detail.id)}
                  sx={{
                    textTransform: 'none',
                    fontSize: 12,
                    borderColor: 'divider',
                    color: 'text.primary',
                  }}
                >
                  查看视频
                </Button>
              )}
              {detail.status === 'scheduled' && (
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => {
                    handlePublishNow(detail.id);
                    setDetailId(null);
                  }}
                  sx={{
                    textTransform: 'none',
                    fontSize: 12,
                    background: 'linear-gradient(90deg, #5DDB96 0%, #25F4EE 100%)',
                    '&:hover': {
                      background: 'linear-gradient(90deg, #5DDB96 0%, #25F4EE 100%)',
                      filter: 'brightness(1.1)',
                    },
                  }}
                >
                  立即发布
                </Button>
              )}
              <Button
                onClick={() => {
                  handleDelete(detail.id);
                  setDetailId(null);
                }}
                sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}
              >
                删除
              </Button>
            </Box>
          </Box>
        )}
      </Drawer>

      {/* Cover picker dialog */}
      <Dialog
        open={coverPickerOpen}
        onClose={() => setCoverPickerOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' },
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>选择封面</Typography>
          <IconButton size="small" onClick={() => setCoverPickerOpen(false)}>
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: 'divider' }} />
        <Box sx={{ p: 2, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <Box
              key={i}
              sx={{
                aspectRatio: '16/9',
                borderRadius: 0.75,
                background: gradient2(['#FE2C55', '#FFB400', '#25F4EE', '#8B5CF6', '#5DDB96', '#5B8DEF'][i % 6], ['#FF6B8A', '#FFD566', '#5DF7F2', '#C4B5FD', '#5DF7F2', '#8B5CF6'][i % 6]),
                cursor: 'pointer',
                transition: 'transform 0.15s',
                '&:hover': { transform: 'scale(1.05)' },
              }}
              onClick={() => {
                setSnack('封面已设置');
                setCoverPickerOpen(false);
              }}
            />
          ))}
        </Box>
        <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
          <Button
            startIcon={<ImageRoundedIcon sx={{ fontSize: 14 }} />}
            onClick={handlePickCoverFile}
            sx={{ textTransform: 'none', fontSize: 11, color: 'text.secondary' }}
          >
            从本地上传
          </Button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            onChange={handleCoverFileChange}
            style={{ display: 'none' }}
          />
        </Box>
      </Dialog>

      {/* 申诉 Dialog */}
      <Dialog
        open={appealOpen}
        onClose={() => setAppealOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' },
          },
        }}
      >
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary' }}>提交申诉</Typography>
          <IconButton size="small" onClick={() => setAppealOpen(false)}>
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: 'divider' }} />
        <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            请说明您认为审核结果有误的原因,审核员将在 72 小时内复审。
          </Typography>
          <TextField
            label="申诉理由"
            value={appealReason}
            onChange={(e) => setAppealReason(e.target.value)}
            multiline
            minRows={3}
            maxRows={5}
            fullWidth
            placeholder="例如:封面中的 logo 已获得品牌方授权..."
            slotProps={{
              inputLabel: { sx: { fontSize: 12 } },
              input: { sx: { fontSize: 13 } },
            }}
          />
        </Box>
        <Divider sx={{ borderColor: 'divider' }} />
        <Box sx={{ p: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button onClick={() => setAppealOpen(false)} sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}>
            取消
          </Button>
          <Button
            variant="contained"
            disabled={!appealReason.trim()}
            onClick={handleSubmitAppeal}
            sx={{
              textTransform: 'none',
              fontSize: 12,
              background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
              '&:hover': {
                background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                filter: 'brightness(1.1)',
              },
            }}
          >
            提交申诉
          </Button>
        </Box>
      </Dialog>

      {/* 审核历史 Dialog */}
      <Dialog
        open={reviewHistoryOpen}
        onClose={() => setReviewHistoryOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' },
          },
        }}
      >
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                background: 'linear-gradient(135deg, #FFB400 0%, #FE2C55 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <HistoryRoundedIcon sx={{ fontSize: 18 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary' }}>审核历史</Typography>
              <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                共 {reviewHistory.length} 条记录 · 极速通道已用 {FAST_CHANNEL_MONTHLY - fastChannelQuota}/{FAST_CHANNEL_MONTHLY} 次
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setReviewHistoryOpen(false)}>
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: 'divider' }} />
        <Box sx={{ p: 2, maxHeight: 480, overflow: 'auto' }}>
          {reviewHistory.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.disabled', fontSize: 12 }}>
              暂无审核记录
            </Box>
          ) : (
            <Stack spacing={1}>
              {reviewHistory.map((h) => {
                const result = h.review.result;
                const color = result === 'pass' ? '#5DDB96' : result === 'reject' ? '#FE2C55' : '#FFB400';
                const bg = result === 'pass' ? 'rgba(93, 219, 150, 0.08)' : result === 'reject' ? 'rgba(254, 44, 85, 0.08)' : 'rgba(255, 180, 0, 0.08)';
                const label = result === 'pass' ? '通过' : result === 'reject' ? '未通过' : '审核中';
                return (
                  <Box
                    key={h.videoId}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      bgcolor: 'action.hover',
                      border: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      gap: 1.5,
                    }}
                  >
                    <Box
                      sx={{
                        width: 64,
                        height: 40,
                        borderRadius: 0.75,
                        background: h.cover,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography sx={{ fontSize: 10, color: '#fff', fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
                        {h.resolution}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontSize: 12, color: 'text.primary', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {h.title}
                        </Typography>
                        <Chip
                          size="small"
                          label={label}
                          sx={{
                            height: 16,
                            fontSize: 9,
                            fontWeight: 700,
                            bgcolor: bg,
                            color,
                            '& .MuiChip-label': { px: 0.5 },
                          }}
                        />
                        {h.review.useFastChannel && (
                          <Chip
                            size="small"
                            icon={<BoltRoundedIcon sx={{ fontSize: 10, color: '#FE2C55 !important' }} />}
                            label="极速"
                            sx={{
                              height: 16,
                              fontSize: 9,
                              fontWeight: 700,
                              bgcolor: 'rgba(254, 44, 85, 0.12)',
                              color: '#FE2C55',
                              '& .MuiChip-label': { px: 0.5 },
                            }}
                          />
                        )}
                      </Box>
                      {(() => {
                        const r = getReviewer(h.review.assignedReviewerId);
                        if (!r) return null;
                        const lm = REVIEWER_LEVEL_META[r.level];
                        return (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                            <Box
                              sx={{
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                background: r.avatarColor,
                                color: '#fff',
                                fontSize: 8,
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {r.initials}
                            </Box>
                            <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>
                              {r.name}
                            </Typography>
                            <Box
                              sx={{
                                px: 0.4,
                                py: 0.05,
                                borderRadius: 0.4,
                                bgcolor: lm.bg,
                                color: lm.color,
                                fontSize: 8,
                                fontWeight: 700,
                              }}
                            >
                              {lm.label}
                            </Box>
                            <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>· {r.team}</Typography>
                          </Box>
                        );
                      })()}
                      <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                        {h.review.completedAt
                          ? `完成于 ${<RelativeTime ts={h.review.completedAt} fallback="" />}`
                          : h.review.startedAt
                          ? `开始于 ${<RelativeTime ts={h.review.startedAt} fallback="" />}`
                          : '尚未开始'}
                        {h.review.startedAt && h.review.completedAt && (
                          <Box component="span" sx={{ ml: 0.75 }}>
                            · 用时 {Math.max(1, Math.round((h.review.completedAt - h.review.startedAt) / 60000))} 分钟
                          </Box>
                        )}
                        <Box component="span" sx={{ ml: 0.75 }}>
                          · {h.review.checks.length} 项检查
                        </Box>
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={snack?.severity === 'error' ? 5000 : 2400}
        onClose={dismissSnack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert
            severity={snack.severity}
            variant="filled"
            onClose={dismissSnack}
            sx={{ width: '100%' }}
          >
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
