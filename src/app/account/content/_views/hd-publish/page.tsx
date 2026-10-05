'use client';


// 该页依赖 client context + 后端实时数据,SSR/pre-render 时 TIERS/orders 等未就绪 →
// 报 "Cannot read properties of undefined"。强制 dynamic 跳过预渲染。

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { getReviewerList } from '@/apis/dashboard';
import { useActiveTab } from '../../ActiveTabContext';
import { PUBLISH_HUB_TYPE_LABEL, type PublishHubType } from '@/lib/contentRoute';
import PublishTypeChips from '../../_components/PublishHub/PublishTypeChips';
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
import { TypePicker } from './TypePicker';
import { TaskDeliveryBanner, TaskDeliverDialog } from './TaskDelivery';
import type { SavedContent } from '../../_components/useContentForm';
import { PUBLISH_TYPES } from '../../_components/publishTypes';
import { rewardTaskHref, takeTaskDeliveryParams, type TaskDeliveryContext } from '@/lib/bountyDelivery';
import { PublishStepper } from './PublishStepper';
import { CoverPickerDialog, AppealDialog, ReviewHistoryDialog } from './HdPublishDialogs';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { submitReview } from '@/apis/review';
import { fileUpload } from '@/apis/global';
import { useContentNavigate } from '@/lib/contentRoute';
import { formatApiError } from '@/lib/api/client';
import { toEntityId } from '@/lib/id';
import type { Reviewer } from './data';
import { mapApiReviewers, computeHdStats, buildReviewHistory, type SnackMsg } from './hdPublishModel';
import { useHdUpload, useHdVideos } from './useHdPublishData';
import { HdStatCards } from './HdStatCards';
import { HdUploadArea } from './HdUploadArea';
import { HdUploadForm } from './HdUploadForm';
import { HdVideoDetailDrawer } from './HdVideoDetailDrawer';

export default function HdPublishPage() {
  const { setActiveTab } = useActiveTab();
  const [snack, setSnackRaw] = useState<SnackMsg | null>(null);
  // setSnack 接受 string 或 SnackMsg — 旧 30+ 处 setSnack('msg') 调用无需改,
  // 自动转成 { msg, severity: 'info' }。新代码可传 { msg, severity } 显式区分。
  const setSnack = React.useCallback((s: string | SnackMsg) => {
    setSnackRaw(typeof s === 'string' ? { msg: s, severity: 'info' } : s);
  }, []);
  const dismissSnack = React.useCallback(() => setSnackRaw(null), []);
  const [detailId, setDetailId] = useState<string | null>(null);

  // ---- Dispatcher state ----
  // 13 类型 chip;selectedType 硬初始化为 'video'(忽略 tabParams.type),
  // 这样不管从哪个路径进 dispatcher,默认都是 VIDEO HD 流程原貌,绝不
  // 自动弹 Dialog 把整个页面挡成黑色 backdrop。
  //
  // 上一个版本还在读 tabParams.type,即便 useEffect 删了,首次 mount
  // 时若 tabParams 残留 stale(如 NewCreationSection 卡预 set 的 type),
  // selectedType 仍可能是 non-video,导致 UnifiedContentList 区域拉错类型
  // 数据 + chip 状态错乱。改成硬初始化,NewCreationSection 卡的"打开图文
  // 发布"路径让用户自己点 chip 来恢复(代价小、稳定性高)。
  const [selectedType, setSelectedType] = useState<PublishHubType>('video');
  // 非 VIDEO 通用详情(我的发布列表点击进)
  const [unifiedDetail, setUnifiedDetail] = useState<UnifiedContentPayload | null>(null);
  // 类型选择页落地态:进入「发布」默认显示 13 类型卡片网格(而非直接的视频上传区);
  // 用户挑了类型 / 点顶部 chip 后才进入正常流程。要"重新选择"时回到 true。
  const [showTypePicker, setShowTypePicker] = useState(true);

  // chip 主动点击:切类型 + 退出 picker(非 VIDEO 类型有内联 form,VIDEO 走上传区,
  // 都不再弹 Dialog,改完后回到类型选择页)
  const handleTypeClick = React.useCallback((next: PublishHubType) => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      // dev self-check:每次 chip 点击都打印,确认 handleTypeClick 路径活跃
       
      console.debug('[hd-publish.dispatcher] chip click →', next);
    }
    setSelectedType(next);
    // 从 picker 切到任何一个具体类型,都退出 picker 模式
    setShowTypePicker(false);
  }, []);

  // TypePicker 卡片点击:同 chip,但更显式(用户主动选了某类型)
  const handlePickFromType = React.useCallback((type: PublishHubType) => {
    handleTypeClick(type);
  }, [handleTypeClick]);

  const { videos, setVideos, fastChannelQuota, handleDelete, handleRetry, handlePublishNow, handleFastTrackReview, handleResubmitReview } =
    useHdVideos(setSnack);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [reviewHistoryOpen, setReviewHistoryOpen] = useState(false);
  const closeReviewHistory = useCallback(() => setReviewHistoryOpen(false), []);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverTargetId, setCoverTargetId] = useState<string | null>(null);
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [appealSubmitting, setAppealSubmitting] = useState(false);

  const router = useRouter();
  const navigateToContent = useContentNavigate();

  // ---- 悬赏任务模式(奖励中心「去创作交付」带 ?task=&taskTitle=&demand=&ptype= 进来)----
  // 只在 mount 时读一次 URL 并立刻去掉这些参数;没有参数时以上 dispatcher 行为完全不变。
  const [taskCtx, setTaskCtx] = useState<TaskDeliveryContext | null>(null);
  // 任务模式下刚发布成功的作品 id(十进制字符串),非空时弹「用它交付」
  const [deliverWorkId, setDeliverWorkId] = useState<string | null>(null);
  useEffect(() => {
    const ctx = takeTaskDeliveryParams();
    if (!ctx) return;
    setTaskCtx(ctx);
    const pt = ctx.ptype;
    if (pt && PUBLISH_TYPES.some((t) => t.id === pt)) {
      setSelectedType(pt as PublishHubType);
      setShowTypePicker(false);
    }
  }, []);
  const backToTask = React.useCallback(() => {
    if (taskCtx) router.push(rewardTaskHref(taskCtx.taskId, taskCtx.demandId));
  }, [router, taskCtx]);
  /** 发布成功(12 个表单 + 视频上传共用):任务模式下拿到新作品 id 就问要不要直接交付 */
  const handlePublished = React.useCallback(
    (saved?: SavedContent) => {
      if (!taskCtx) return;
      const id = saved?.id === undefined || saved?.id === null ? '' : String(saved.id);
      if (/^[1-9]\d*$/.test(id)) setDeliverWorkId(id);
      else setSnack({ msg: '作品已发布;回到任务里「从我的作品选择」即可交付', severity: 'info' });
    },
    [taskCtx, setSnack],
  );
  const handleFormSuccess = React.useCallback(
    (saved?: SavedContent) => {
      setShowTypePicker(true);
      handlePublished(saved);
    },
    [handlePublished],
  );
  const handleDelivered = React.useCallback(() => {
    const ctx = taskCtx;
    setDeliverWorkId(null);
    setTaskCtx(null);
    setSnack({ msg: '已交付,等待发布者验收', severity: 'success' });
    if (ctx) window.setTimeout(() => router.push(rewardTaskHref(ctx.taskId, ctx.demandId)), 800);
  }, [router, taskCtx, setSnack]);

  const detail = useMemo(() => videos.find((v) => v.id === detailId) ?? null, [videos, detailId]);

  // 真接口:审核员列表(公共,不分 uid)
  const { data: reviewerResp } = useQuery({
    queryKey: ['creator-hd-reviewers'],
    queryFn: () => getReviewerList(),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
  });
  const apiReviewers: Reviewer[] = useMemo(() => mapApiReviewers(reviewerResp), [reviewerResp]);
  const reviewers = apiReviewers;
  const getReviewer = useCallback((id: string | undefined): Reviewer | undefined => {
    if (!id) return undefined;
    return reviewers.find((r) => r.id === id);
  }, [reviewers]);

  const stats = useMemo(() => computeHdStats(videos, fastChannelQuota), [videos, fastChannelQuota]);

  const reviewHistory = useMemo(() => buildReviewHistory(videos), [videos]);

  const handleViewPublished = useCallback((id: string) => {
    // 作品 id 是超 2^53 的 BIGINT 字符串,Number() 会截断成另一条内容
    const contentId = toEntityId(id);
    if (contentId !== null) {
      navigateToContent('VIDEO', contentId);
    } else {
      router.push(`/detail/video-detail?id=${encodeURIComponent(id)}`);
    }
  }, [navigateToContent, router]);

  const handleOpenAppeal = useCallback(() => {
    setAppealReason('');
    setAppealOpen(true);
  }, []);

  const handleSubmitAppeal = async () => {
    if (!detail || appealSubmitting) return;
    if (!appealReason.trim()) {
      setSnack('请输入申诉理由');
      return;
    }
    const contentId = toEntityId(detail.id);
    if (contentId === null) {
      setSnack('作品还没有有效的内容编号,无法提交申诉');
      return;
    }
    setAppealSubmitting(true);
    try {
      // 申诉 = 带着说明重新提交审核,进入内容运营的待审队列
      await submitReview({
        contentId,
        contentType: 'VIDEO',
        title: detail.title,
        coverUrl: detail.cover?.startsWith('http') ? detail.cover : undefined,
        reason: appealReason.trim(),
      });
      setSnack('已重新提交审核,审核结论会通知你');
      setAppealOpen(false);
    } catch (e) {
      setSnack(`申诉提交失败:${formatApiError(e)}`);
    } finally {
      setAppealSubmitting(false);
    }
  };

  const handleOpenCoverPicker = (id: string) => {
    setCoverTargetId(id);
    setCoverPickerOpen(true);
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
      const res = (await fileUpload(formData as unknown as Record<string, unknown>)) as { url?: string };
      const url = res?.url;
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

  const upload = useHdUpload({ setSnack, setVideos, onPublished: handlePublished });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {taskCtx && <TaskDeliveryBanner ctx={taskCtx} onBack={backToTask} onExit={() => setTaskCtx(null)} />}
      <TaskDeliverDialog
        ctx={taskCtx}
        workId={deliverWorkId}
        onLater={() => {
          setDeliverWorkId(null);
          setShowTypePicker(true);
        }}
        onDelivered={handleDelivered}
      />
      {/* 落地态 1:未选类型 — 13 类型卡片网格,挑了再进入正常流程 */}
      {showTypePicker && <TypePicker onPick={handlePickFromType} />}

      {/* 落地态 2:已选类型 — 顶部 chip 切换 + "重新选择" 返回卡片,主体走原流程 */}
      {!showTypePicker && (
        <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Button
          size="small"
          variant="text"
          startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 14 }} />}
          onClick={() => setShowTypePicker(true)}
          sx={{ textTransform: 'none', color: 'text.secondary', fontSize: 12, flexShrink: 0 }}
        >
          重新选择
        </Button>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Dispatcher 顶部:13 类型 chip 选择 */}
          <PublishTypeChips value={selectedType} onChange={handleTypeClick} />
        </Box>
      </Box>

      {/* 非 VIDEO 类型:内联分步表单(无 Dialog)
          顶部 3 步 stepper(基本信息 / 内容详情 / 预览提交),PublishForm 直接在页面渲染。
          onSuccess 提交后回到类型选择页。 */}
      {selectedType !== 'video' && selectedType !== 'all' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary' }}>
              发布「{PUBLISH_HUB_TYPE_LABEL[selectedType]}」
            </Typography>
            <Box sx={{ flex: 1 }} />
          </Box>
          <PublishStepper activeStep={0} />
          {selectedType === 'picture-album' && <ImageFormLazy onSuccess={handleFormSuccess} />}
          {selectedType === 'picture-mv' && <ImageMvFormLazy onSuccess={handleFormSuccess} />}
          {selectedType === 'article' && <ArticleFormLazy onSuccess={handleFormSuccess} />}
          {selectedType === 'novel' && <NovelFormLazy onSuccess={handleFormSuccess} />}
          {selectedType === 'news' && <NewsFormLazy onSuccess={handleFormSuccess} />}
          {selectedType === 'music' && <MusicFormLazy onSuccess={handleFormSuccess} />}
          {selectedType === 'comics' && <ComicsFormLazy onSuccess={handleFormSuccess} />}
          {selectedType === 'vshow' && <VshowFormLazy onSuccess={handleFormSuccess} />}
          {selectedType === 'teleplay' && <TeleplayFormLazy onSuccess={handleFormSuccess} />}
          {selectedType === 'film' && <FilmFormLazy onSuccess={handleFormSuccess} />}
          {selectedType === 'animation' && <AnimationFormLazy onSuccess={handleFormSuccess} />}
          {selectedType === 'live' && <LiveFormLazy onSuccess={handleFormSuccess} />}
        </Box>
      )}

      {/* 非 VIDEO 内容的统一详情 Drawer */}
      <ContentDetailDrawer
        open={!!unifiedDetail}
        payload={unifiedDetail}
        onClose={() => setUnifiedDetail(null)}
      />

      {/* VIDEO 类型:统计卡片 + 上传区 + 元数据表单 */}
      {selectedType === 'video' && (
        <>
        {/* Stat cards */}
        <HdStatCards stats={stats} />

        {/* Upload trigger + benefits */}
        <HdUploadArea
          uploadFileName={upload.uploadFileName}
          uploadFileSizeMB={upload.uploadFileSizeMB}
          uploadStatus={upload.uploadStatus}
          onFileChange={upload.handleFileChange}
        />

        {/* VIDEO 上传元数据表单 — 内联(原 Dialog 内容),分步:基础信息 → 质量/特性 → 音轨/字幕 */}
        <HdUploadForm upload={upload} />
        </>
      )}

      {/* Detail drawer */}
      <HdVideoDetailDrawer
        detail={detail}
        setDetailId={setDetailId}
        getReviewer={getReviewer}
        fastChannelQuota={fastChannelQuota}
        onRetry={handleRetry}
        onFastTrackReview={handleFastTrackReview}
        onResubmitReview={handleResubmitReview}
        onViewPublished={handleViewPublished}
        onPublishNow={handlePublishNow}
        onDelete={handleDelete}
        onOpenAppeal={handleOpenAppeal}
      />

      {/* Cover picker dialog */}
      <CoverPickerDialog
        open={coverPickerOpen}
        onClose={() => setCoverPickerOpen(false)}
        onPickPreset={() => {
          setSnack('封面已设置');
          setCoverPickerOpen(false);
        }}
        onPickFile={handlePickCoverFile}
        inputRef={coverInputRef}
        onFileChange={handleCoverFileChange}
      />

      {/* 申诉 Dialog */}
      <AppealDialog
        open={appealOpen}
        onClose={() => setAppealOpen(false)}
        reason={appealReason}
        onReasonChange={setAppealReason}
        submitting={appealSubmitting}
        onSubmit={handleSubmitAppeal}
      />

      {/* 审核历史 Dialog */}
      <ReviewHistoryDialog
        open={reviewHistoryOpen}
        onClose={closeReviewHistory}
        reviewHistory={reviewHistory}
        reviewers={reviewers}
        fastChannelQuota={fastChannelQuota}
      />

      </>)}
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
