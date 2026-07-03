'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAuthority } from '@/contexts/AuthContext';
import { useActiveTab } from '../../ActiveTabContext';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';
import TextField from '@mui/material/TextField';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import GppMaybeRoundedIcon from '@mui/icons-material/GppMaybeRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import AssignmentIndRoundedIcon from '@mui/icons-material/AssignmentIndRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import AssignmentLateRoundedIcon from '@mui/icons-material/AssignmentLateRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded';
import { useQuery } from '@tanstack/react-query';
import { gradient2 } from '@/constants/gradients';
import { myPage, process as updateContentStatus } from '@/apis/module-content';
import {
  HdVideo,
  Reviewer,
  ReviewerVerdict,
  ReviewerDecision,
  SEED,
  SEED_REVIEWERS,
  REVIEWER_LEVEL_META,
  getReviewerById,
  REVIEW_CHECK_TEMPLATE,
} from '../hd-publish/data';

type ReviewTab = 'pending' | 'reviewed';

const PRESET_REJECT_REASONS = [
  '画面含违规内容',
  '未授权品牌 logo',
  '低俗/擦边内容',
  '画质不达标',
  '标题党/封面党',
  '重复/搬运内容',
  '字幕错误过多',
  '音质过差',
];

const CREATOR_FAKE_NAMES = ['创作者 A', '创作者 B', '海风映画', '北纬 30°', '像素工坊', '声光实验室'];

function pickCreatorName(videoId: string): string {
  let hash = 0;
  for (let i = 0; i < videoId.length; i++) hash = (hash * 31 + videoId.charCodeAt(i)) | 0;
  return CREATOR_FAKE_NAMES[Math.abs(hash) % CREATOR_FAKE_NAMES.length];
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

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const abs = Math.abs(diff);
  const isPast = diff > 0;
  const m = Math.floor(abs / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return isPast ? `${m} 分钟前` : `${m} 分钟后`;
  const h = Math.floor(m / 60);
  if (h < 24) return isPast ? `${h} 小时前` : `${h} 小时后`;
  const d = Math.floor(h / 24);
  return isPast ? `${d} 天前` : `${d} 天后`;
}

type RiskLevel = 'low' | 'medium' | 'high';
function computeRiskLevel(video: HdVideo): RiskLevel {
  if (!video.review) return 'low';
  const failures = video.review.checks.filter((c) => c.status === 'failed');
  const copyrightFailed = failures.some((f) => f.id === 'copyright');
  if (copyrightFailed || failures.length >= 2) return 'high';
  if (failures.length === 1) return 'medium';
  return 'low';
}

const RISK_META: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  low: { label: '低风险', color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.12)' },
  medium: { label: '中风险', color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)' },
  high: { label: '高风险', color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)' },
};

export default function HdReviewPage() {
  const { tabParams, setActiveTab } = useActiveTab();
  const [videos, setVideos] = useState<HdVideo[]>(SEED);
  const [currentReviewerId, setCurrentReviewerId] = useState(tabParams.reviewer || 'r-002');
  const [tab, setTab] = useState<ReviewTab>('pending');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(tabParams.video || null);
  const [verdictNote, setVerdictNote] = useState('');
  const [selectedRejectReasons, setSelectedRejectReasons] = useState<string[]>([]);
  const [snack, setSnack] = useState<string | null>(null);

  // 拉取真实待审核内容(VIDEO 类型 + reviewing 状态)
  const { data: realReviewing } = useQuery({
    queryKey: ['module-content', 'reviewing'],
    queryFn: async () => {
      const res = await myPage({ status: 'reviewing', contentType: 'VIDEO', pageSize: 100 });
      return res.data?.records || [];
    },
    staleTime: 30_000,
  });

  // 把真实内容合并到本地 simulator 列表(去重)
  useEffect(() => {
    if (!realReviewing?.length) return;
    setVideos((prev) => {
      const existingIds = new Set(prev.map((v) => v.id));
      const mapped: HdVideo[] = realReviewing
        .filter((item) => !existingIds.has(String(item.id)))
        .map((item) => ({
          id: String(item.id),
          title: item.title || '(无标题)',
          cover: item.coverUrl || gradient2('#FE2C55', '#FFB400'),
          resolution: '1080P',
          fps: 30,
          hdr: false,
          duration: '00:00',
          sizeMB: 0,
          status: 'reviewing',
          uploadedAt: item.createTime ? new Date(item.createTime).getTime() : Date.now(),
          hasCover: !!item.coverUrl,
          subtitles: [],
          audioTracks: [{ id: 'a1', label: '原声', codec: 'AAC 320kbps', isDefault: true }],
          review: {
            checks: REVIEW_CHECK_TEMPLATE.map((c) => ({ ...c, status: 'pending' as const })),
            startedAt: Date.now(),
            assignedReviewerId: currentReviewerId,
          },
        }));
      return [...mapped, ...prev];
    });
  }, [realReviewing, currentReviewerId]);

  // When hd-publish sends us a pre-selected video via setActiveTab('hd-review',
  // { video }), open that video in the right panel as soon as the data is ready.
  useEffect(() => {
    if (tabParams.video) setSelectedVideoId(tabParams.video);
  }, [tabParams.video]);

  const currentReviewer: Reviewer | undefined = useMemo(
    () => getReviewerById(currentReviewerId),
    [currentReviewerId],
  );

  const selectedVideo = useMemo(
    () => videos.find((v) => v.id === selectedVideoId) ?? null,
    [videos, selectedVideoId],
  );

  const queue = useMemo(() => {
    if (!currentReviewer) return { pending: [], reviewed: [] };
    const myVideos = videos.filter((v) => v.review?.assignedReviewerId === currentReviewerId);
    const pending = myVideos
      .filter((v) => v.status === 'reviewing')
      .sort((a, b) => (a.review?.queuePosition ?? 99) - (b.review?.queuePosition ?? 99));
    const reviewed = myVideos
      .filter((v) => v.status === 'published' || v.status === 'review_failed')
      .filter((v) => v.review?.completedAt)
      .sort((a, b) => (b.review!.completedAt ?? 0) - (a.review!.completedAt ?? 0));
    return { pending, reviewed };
  }, [videos, currentReviewerId, currentReviewer]);

  const stats = useMemo(() => {
    if (!currentReviewer) {
      return { todayDone: 0, todayPass: 0, todayReject: 0, passRate: 0, avgMin: 0 };
    }
    const today = Date.now() - 86400000;
    const todayReviewed = videos.filter(
      (v) =>
        v.review?.completedAt &&
        v.review.completedAt >= today &&
        v.review.assignedReviewerId === currentReviewerId,
    );
    const pass = todayReviewed.filter((v) => v.review?.result === 'pass').length;
    const reject = todayReviewed.filter((v) => v.review?.result === 'reject').length;
    const total = pass + reject;
    const avgMs = todayReviewed
      .filter((v) => v.review?.startedAt && v.review?.completedAt)
      .map((v) => v.review!.completedAt! - v.review!.startedAt!);
    const avgMin = avgMs.length > 0 ? Math.max(1, Math.round(avgMs.reduce((a, b) => a + b, 0) / avgMs.length / 60000)) : 0;
    return {
      todayDone: total,
      todayPass: pass,
      todayReject: reject,
      passRate: total > 0 ? (pass / total) * 100 : 0,
      avgMin,
    };
  }, [videos, currentReviewerId, currentReviewer]);

  const handleSelectVideo = (id: string) => {
    setSelectedVideoId(id);
    setVerdictNote('');
    setSelectedRejectReasons([]);
  };

  const toggleRejectReason = (reason: string) => {
    setSelectedRejectReasons((p) => (p.includes(reason) ? p.filter((r) => r !== reason) : [...p, reason]));
  };

  const handleSubmitVerdict = async (decision: ReviewerDecision) => {
    if (!selectedVideo || !currentReviewer) return;
    if (decision !== 'pass' && verdictNote.trim().length === 0 && selectedRejectReasons.length === 0) {
      setSnack('驳回/需修改时,必须填写备注或选择驳回原因');
      return;
    }
    const note =
      verdictNote.trim() ||
      (decision === 'pass'
        ? '内容符合社区规范,审核通过。'
        : selectedRejectReasons.length > 0
        ? `主要问题:${selectedRejectReasons.join('、')}`
        : '需补充材料后重新提交。');
    const verdict: ReviewerVerdict = {
      decision,
      note,
      reviewerId: currentReviewerId,
      timestamp: Date.now(),
      appealable: decision === 'reject',
      appealDeadline: decision === 'reject' ? Date.now() + 86400000 * 7 : undefined,
    };
    const completedAt = Date.now();
    const isPass = decision === 'pass';

    // 真实内容(数字 ID)同步更新后端状态
    const numericId = Number(selectedVideo.id);
    if (!isNaN(numericId) && numericId > 0) {
      try {
        await updateContentStatus({
          ids: [numericId],
          status: isPass ? 'PUBLISH' : 'UN_PUBLISH',
        });
      } catch (e: any) {
        setSnack(`后端状态更新失败:${e.message || '未知错误'}`);
        return;
      }
    }

    setVideos((p) =>
      p.map((v) =>
        v.id === selectedVideo.id && v.review
          ? {
              ...v,
              status: isPass ? 'published' : 'review_failed',
              failedStage: isPass ? undefined : 'review',
              publishedAt: isPass ? completedAt : v.publishedAt,
              views: isPass ? 0 : v.views,
              likes: isPass ? 0 : v.likes,
              review: {
                ...v.review,
                completedAt,
                result: isPass ? 'pass' : 'reject',
                reviewerVerdict: verdict,
                checks: v.review.checks.map((c) =>
                  c.id === 'manual_review' ? { ...c, status: isPass ? 'passed' : 'failed', message: note } : c,
                ),
              },
            }
          : v,
      ),
    );
    setSnack(
      isPass
        ? `✅ 已通过《${selectedVideo.title}》`
        : decision === 'reject'
        ? `⛔ 已驳回《${selectedVideo.title}》`
        : `📝 已通知创作者补充材料`,
    );
    setSelectedVideoId(null);
    setVerdictNote('');
    setSelectedRejectReasons([]);
  };

  const { hasAuthority } = useAuthority();
  const isReviewer = hasAuthority('REVIEWER') || hasAuthority('ADMIN') || hasAuthority('SUPER_ADMIN');

  if (!isReviewer) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
          height: 'calc(100dvh - 200px)',
          textAlign: 'center',
          px: 3,
        }}
      >
        <GppMaybeRoundedIcon sx={{ fontSize: 56, color: 'text.disabled' }} />
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary' }}>
          没有审核员权限
        </Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', maxWidth: 360 }}>
          审核员工作台仅对持有 <b>REVIEWER</b> 角色的账号开放。如需申请,请联系平台运营。
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 14 }} />}
          onClick={() => setActiveTab('hd-publish')}
          sx={{ mt: 1, textTransform: 'none' }}
        >
          返回高清发布
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: 'calc(100dvh - 100px)' }}>
      {/* 顶部:身份 + 统计 */}
      <Box
        sx={{
          p: 2.5,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1,
            background: 'linear-gradient(135deg, #FFB400 0%, #FE2C55 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
          }}
        >
          <GroupsRoundedIcon sx={{ fontSize: 20 }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
            审核员工作台
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
            模拟审核员视角 · 处理分配给你的视频
          </Typography>
        </Box>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        {/* 切换身份 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>我是</Typography>
          <Select
            size="small"
            value={currentReviewerId}
            onChange={(e) => {
              setCurrentReviewerId(e.target.value);
              setSelectedVideoId(null);
            }}
            sx={{
              minWidth: 200,
              fontSize: 12,
              '& .MuiOutlinedInput-root': { fontSize: 12 },
            }}
            renderValue={(id) => {
              const r = getReviewerById(id);
              if (!r) return id;
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box
                    sx={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: r.avatarColor,
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {r.initials}
                  </Box>
                  <span>{r.name} · {REVIEWER_LEVEL_META[r.level].label} · {r.team}</span>
                </Box>
              );
            }}
          >
            {SEED_REVIEWERS.map((r) => (
              <MenuItem key={r.id} value={r.id} sx={{ fontSize: 12 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, width: '100%' }}>
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: r.avatarColor,
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {r.initials}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{r.name}</Typography>
                      <Box
                        sx={{
                          px: 0.4,
                          py: 0.05,
                          borderRadius: 0.4,
                          bgcolor: REVIEWER_LEVEL_META[r.level].bg,
                          color: REVIEWER_LEVEL_META[r.level].color,
                          fontSize: 8,
                          fontWeight: 700,
                        }}
                      >
                        {REVIEWER_LEVEL_META[r.level].label}
                      </Box>
                      <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>{r.team}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>
                      当前 {r.currentLoad}/{r.maxLoad} · 通过率 {r.passRate}% · {r.online ? '在线' : '离线'}
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </Box>

        <Box sx={{ flex: 1 }} />

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {[
            { label: '今日已审', value: stats.todayDone, suffix: '部', color: '#5B8DEF' },
            { label: '今日通过率', value: stats.todayDone > 0 ? `${stats.passRate.toFixed(0)}%` : '—', suffix: stats.todayDone > 0 ? `(${stats.todayPass}/${stats.todayDone})` : '', color: stats.passRate >= 80 ? '#5DDB96' : stats.passRate >= 50 ? '#FFB400' : '#FE2C55' },
            { label: '平均用时', value: stats.avgMin > 0 ? `${stats.avgMin}` : '—', suffix: stats.avgMin > 0 ? '分钟' : '', color: '#FFB400' },
            { label: '待审', value: queue.pending.length, suffix: '部', color: '#FE2C55' },
            { label: '历史总审核', value: formatCount(currentReviewer?.reviewCount ?? 0), suffix: '', color: '#8B5CF6' },
          ].map((s) => (
            <Box key={s.label} sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>{s.label}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.25 }}>
                <Typography sx={{ fontSize: 18, fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums' }}>
                  {s.value}
                </Typography>
                {s.suffix && <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>{s.suffix}</Typography>}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* 主体: 队列 + 审核面板 */}
      <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
        {/* 队列 */}
        <Box
          sx={{
            width: 380,
            flexShrink: 0,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              minHeight: 0,
              px: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              '& .MuiTab-root': { minHeight: 0, py: 1, fontSize: 12, textTransform: 'none' },
            }}
          >
            <Tab value="pending" label={`待审 (${queue.pending.length})`} />
            <Tab value="reviewed" label={`已审 (${queue.reviewed.length})`} />
          </Tabs>
          <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
            {tab === 'pending' && (
              queue.pending.length === 0 ? (
                <EmptyQueueState
                  icon={<AssignmentTurnedInRoundedIcon sx={{ fontSize: 32, color: '#5DDB96' }} />}
                  title="队列已清空"
                  desc={currentReviewer?.online ? '暂无待审视频,可主动领取或稍后查看' : '当前离线,无法接单'}
                />
              ) : (
                <Stack spacing={1}>
                  {queue.pending.map((v) => (
                    <QueueItem
                      key={v.id}
                      video={v}
                      reviewer={currentReviewer}
                      selected={v.id === selectedVideoId}
                      onClick={() => handleSelectVideo(v.id)}
                    />
                  ))}
                </Stack>
              )
            )}
            {tab === 'reviewed' && (
              queue.reviewed.length === 0 ? (
                <EmptyQueueState
                  icon={<HistoryRoundedIcon sx={{ fontSize: 32, color: 'text.disabled' }} />}
                  title="暂无已审记录"
                  desc="完成审核后会在这里显示"
                />
              ) : (
                <Stack spacing={1}>
                  {queue.reviewed.map((v) => (
                    <QueueItem
                      key={v.id}
                      video={v}
                      reviewer={currentReviewer}
                      selected={v.id === selectedVideoId}
                      onClick={() => handleSelectVideo(v.id)}
                      reviewed
                    />
                  ))}
                </Stack>
              )
            )}
          </Box>
        </Box>

        {/* 审核面板 */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {selectedVideo && currentReviewer ? (
            <ReviewPanel
              video={selectedVideo}
              reviewer={currentReviewer}
              verdictNote={verdictNote}
              onVerdictNoteChange={setVerdictNote}
              selectedRejectReasons={selectedRejectReasons}
              onToggleRejectReason={toggleRejectReason}
              onSubmit={handleSubmitVerdict}
            />
          ) : (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
                color: 'text.disabled',
              }}
            >
              <AssignmentIndRoundedIcon sx={{ fontSize: 56, opacity: 0.4 }} />
              <Typography sx={{ fontSize: 14, color: 'text.secondary', fontWeight: 600 }}>
                {tab === 'pending' ? '请从左侧选择一条待审视频' : '请从左侧选择一条已审记录'}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                {tab === 'pending'
                  ? `${currentReviewer?.name ?? '审核员'} 正在等待你的审核`
                  : '可查看历史审核记录与备注'}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Snackbar
        open={!!snack}
        autoHideDuration={2500}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

// ========== Sub-components ==========

function QueueItem({
  video,
  reviewer,
  selected,
  onClick,
  reviewed = false,
}: {
  video: HdVideo;
  reviewer: Reviewer | undefined;
  selected: boolean;
  onClick: () => void;
  reviewed?: boolean;
}) {
  const risk = computeRiskLevel(video);
  const passedCount = video.review?.checks.filter((c) => c.status === 'passed').length ?? 0;
  const totalChecks = video.review?.checks.length ?? 0;
  const result = video.review?.result;
  const isReviewing = video.status === 'reviewing';

  return (
    <Box
      onClick={onClick}
      sx={{
        p: 1.25,
        borderRadius: 1.25,
        bgcolor: selected ? 'rgba(254, 44, 85, 0.08)' : (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF',
        border: '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        cursor: 'pointer',
        transition: 'all 0.15s',
        '&:hover': { borderColor: selected ? 'primary.main' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover' },
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, mb: 0.75 }}>
        {/* Cover */}
        <Box
          sx={{
            width: 80,
            height: 48,
            borderRadius: 0.75,
            background: video.cover,
            flexShrink: 0,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography sx={{ fontSize: 9, color: '#fff', fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
            {video.resolution}
          </Typography>
          <Box
            sx={{
              position: 'absolute',
              bottom: 2,
              right: 2,
              px: 0.4,
              borderRadius: 0.4,
              bgcolor: 'rgba(0,0,0,0.6)',
              color: '#fff',
              fontSize: 8,
              fontWeight: 600,
            }}
          >
            {video.duration}
          </Box>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 600,
              color: 'text.primary',
              mb: 0.25,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {video.title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            {isReviewing && (
              <Box
                sx={{
                  px: 0.4,
                  py: 0.05,
                  borderRadius: 0.4,
                  bgcolor: RISK_META[risk].bg,
                  color: RISK_META[risk].color,
                  fontSize: 9,
                  fontWeight: 700,
                }}
              >
                {RISK_META[risk].label}
              </Box>
            )}
            {video.review?.useFastChannel && (
              <Box
                sx={{
                  px: 0.4,
                  py: 0.05,
                  borderRadius: 0.4,
                  bgcolor: 'rgba(254, 44, 85, 0.12)',
                  color: '#FE2C55',
                  fontSize: 9,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.25,
                }}
              >
                <BoltRoundedIcon sx={{ fontSize: 9 }} />
                极速
              </Box>
            )}
            {reviewed && result === 'pass' && (
              <Box
                sx={{
                  px: 0.4,
                  py: 0.05,
                  borderRadius: 0.4,
                  bgcolor: 'rgba(93, 219, 150, 0.12)',
                  color: '#5DDB96',
                  fontSize: 9,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.25,
                }}
              >
                <CheckCircleRoundedIcon sx={{ fontSize: 9 }} />
                通过
              </Box>
            )}
            {reviewed && result === 'reject' && (
              <Box
                sx={{
                  px: 0.4,
                  py: 0.05,
                  borderRadius: 0.4,
                  bgcolor: 'rgba(254, 44, 85, 0.12)',
                  color: '#FE2C55',
                  fontSize: 9,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.25,
                }}
              >
                <ErrorRoundedIcon sx={{ fontSize: 9 }} />
                驳回
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* 元信息 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 9, color: 'text.disabled' }}>
        <span>{pickCreatorName(video.id)}</span>
        <Box component="span" sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: 'divider' }} />
        {isReviewing ? (
          <>
            <span>已等待 {video.review?.startedAt ? relativeTime(video.review.startedAt) : '—'}</span>
            <Box component="span" sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: 'divider' }} />
            <span>AI {passedCount}/{totalChecks}</span>
          </>
        ) : (
          <span>{video.review?.completedAt ? `完成于 ${relativeTime(video.review.completedAt)}` : '—'}</span>
        )}
      </Box>

      {/* AI 进度条 */}
      {isReviewing && (
        <LinearProgress
          variant="determinate"
          value={(passedCount / Math.max(1, totalChecks)) * 100}
          sx={{
            mt: 0.75,
            height: 3,
            borderRadius: 1,
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover',
            '& .MuiLinearProgress-bar': {
              bgcolor: risk === 'high' ? '#FE2C55' : risk === 'medium' ? '#FFB400' : '#5DDB96',
            },
          }}
        />
      )}
    </Box>
  );
}

function EmptyQueueState({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 6, gap: 1, color: 'text.disabled' }}>
      {icon}
      <Typography sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 600 }}>{title}</Typography>
      <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{desc}</Typography>
    </Box>
  );
}

function ReviewPanel({
  video,
  reviewer,
  verdictNote,
  onVerdictNoteChange,
  selectedRejectReasons,
  onToggleRejectReason,
  onSubmit,
}: {
  video: HdVideo;
  reviewer: Reviewer;
  verdictNote: string;
  onVerdictNoteChange: (v: string) => void;
  selectedRejectReasons: string[];
  onToggleRejectReason: (r: string) => void;
  onSubmit: (d: ReviewerDecision) => void;
}) {
  const risk = computeRiskLevel(video);
  const checks = video.review?.checks ?? [];
  const passed = checks.filter((c) => c.status === 'passed').length;
  const failed = checks.filter((c) => c.status === 'failed').length;
  const running = checks.filter((c) => c.status === 'running').length;
  const isAlreadyReviewed = video.status === 'published' || video.status === 'review_failed';
  const verdict = video.review?.reviewerVerdict;

  return (
    <>
      <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              position: 'relative',
              width: 48,
              height: 48,
              borderRadius: 1,
              background: video.cover,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              '&:hover .rp-play': { opacity: 1, transform: 'scale(1.1)' },
            }}
          >
            <PlayCircleRoundedIcon
              className="rp-play"
              sx={{
                fontSize: 32,
                color: '#fff',
                opacity: 0.85,
                transition: 'all 0.15s',
                filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.5))',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                px: 0.4,
                borderRadius: 0.4,
                bgcolor: 'rgba(0,0,0,0.6)',
                color: '#fff',
                fontSize: 9,
                fontWeight: 600,
              }}
            >
              {video.duration}
            </Box>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25, flexWrap: 'wrap' }}>
              <Box
                sx={{
                  px: 0.5,
                  py: 0.05,
                  borderRadius: 0.4,
                  bgcolor: 'rgba(254, 44, 85, 0.12)',
                  color: '#FE2C55',
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {video.resolution}
              </Box>
              {video.hdr && (
                <Box
                  sx={{
                    px: 0.5,
                    py: 0.05,
                    borderRadius: 0.4,
                    bgcolor: 'rgba(255, 180, 0, 0.12)',
                    color: '#FFB400',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  HDR
                </Box>
              )}
              <Box
                sx={{
                  px: 0.5,
                  py: 0.05,
                  borderRadius: 0.4,
                  bgcolor: RISK_META[risk].bg,
                  color: RISK_META[risk].color,
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {RISK_META[risk].label}
              </Box>
              {video.review?.useFastChannel && (
                <Chip
                  size="small"
                  icon={<BoltRoundedIcon sx={{ fontSize: 11, color: '#FE2C55 !important' }} />}
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
            </Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', lineHeight: 1.3 }}>
              {video.title}
            </Typography>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
              {video.fps}fps · {formatSize(video.sizeMB)} · {pickCreatorName(video.id)} · 上传于{' '}
              {relativeTime(video.uploadedAt)}
              {video.review?.startedAt && (
                <Box component="span" sx={{ ml: 0.5 }}>
                  · 进入审核 {relativeTime(video.review.startedAt)}
                </Box>
              )}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* 创作者信息 */}
        <Box
          sx={{
            p: 1.5,
            borderRadius: 1.5,
            bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FAFAFA',
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #5B8DEF 0%, #8B5CF6 100%)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {pickCreatorName(video.id)[0]}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary' }}>
              {pickCreatorName(video.id)}
            </Typography>
            <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>
              累计发布 124 部 · 粉丝 8.2w · 历史违规 0 · 信用极好
            </Typography>
          </Box>
          <Button
            size="small"
            sx={{ textTransform: 'none', fontSize: 11, color: 'text.secondary' }}
          >
            查看历史
          </Button>
        </Box>

        {/* AI 审核报告 */}
        <Box
          sx={{
            p: 1.5,
            borderRadius: 1.5,
            bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FAFAFA',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <LightbulbRoundedIcon sx={{ fontSize: 14, color: '#FFB400' }} />
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary' }}>
              AI 审核报告
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
              <Box component="span" sx={{ color: '#5DDB96', fontWeight: 700 }}>{passed}</Box> 通过 ·{' '}
              <Box component="span" sx={{ color: failed > 0 ? '#FE2C55' : 'text.disabled', fontWeight: 700 }}>{failed}</Box> 失败 ·{' '}
              <Box component="span" sx={{ color: running > 0 ? '#25F4EE' : 'text.disabled', fontWeight: 700 }}>{running}</Box> 进行中
            </Typography>
          </Box>
          <Stack spacing={0.5}>
            {checks.map((c) => {
              const meta =
                c.status === 'passed'
                  ? { color: '#5DDB96', icon: <CheckCircleRoundedIcon sx={{ fontSize: 12 }} />, label: '通过' }
                  : c.status === 'failed'
                  ? { color: '#FE2C55', icon: <ErrorRoundedIcon sx={{ fontSize: 12 }} />, label: '失败' }
                  : c.status === 'running'
                  ? { color: '#25F4EE', icon: <HourglassEmptyRoundedIcon sx={{ fontSize: 12 }} />, label: '进行中' }
                  : c.status === 'skipped'
                  ? { color: 'text.disabled', icon: <Box sx={{ fontSize: 10 }}>—</Box>, label: '跳过' }
                  : { color: 'text.disabled', icon: <Box sx={{ fontSize: 10 }}>○</Box>, label: '等待' };
              return (
                <Box
                  key={c.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 0.75,
                    borderRadius: 1,
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover',
                  }}
                >
                  <Box sx={{ color: meta.color, display: 'flex' }}>{meta.icon}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 11, color: 'text.primary', fontWeight: 500 }}>
                      {c.label}
                    </Typography>
                    {c.message && (
                      <Typography sx={{ fontSize: 9, color: c.status === 'failed' ? '#FE2C55' : 'text.secondary' }}>
                        {c.message}
                      </Typography>
                    )}
                  </Box>
                  <Typography sx={{ fontSize: 9, color: 'text.disabled', flexShrink: 0 }}>
                    {c.duration !== undefined ? `${c.duration}s` : '—'}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>

        {/* 已审记录显示 */}
        {isAlreadyReviewed && verdict && (
          <Box
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: verdict.decision === 'pass' ? 'rgba(93, 219, 150, 0.3)' : 'rgba(254, 44, 85, 0.3)',
              bgcolor: verdict.decision === 'pass' ? 'rgba(93, 219, 150, 0.06)' : 'rgba(254, 44, 85, 0.06)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {verdict.decision === 'pass' ? (
                <VerifiedRoundedIcon sx={{ fontSize: 16, color: '#5DDB96' }} />
              ) : (
                <FlagRoundedIcon sx={{ fontSize: 16, color: '#FE2C55' }} />
              )}
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: verdict.decision === 'pass' ? '#5DDB96' : '#FE2C55' }}>
                {verdict.decision === 'pass' ? '审核通过' : verdict.decision === 'reject' ? '已驳回' : '需补充材料'}
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{relativeTime(verdict.timestamp)}</Typography>
            </Box>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.6, mb: 1 }}>
              {verdict.note}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: reviewer.avatarColor,
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {reviewer.initials}
              </Box>
              <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                {reviewer.name} · {REVIEWER_LEVEL_META[reviewer.level].label} · {reviewer.team}
              </Typography>
            </Box>
          </Box>
        )}

        {/* 待审时显示填写区 */}
        {!isAlreadyReviewed && (
          <>
            {/* 快捷驳回原因 */}
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', mb: 0.75 }}>
                快捷驳回原因 (可多选)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {PRESET_REJECT_REASONS.map((r) => {
                  const selected = selectedRejectReasons.includes(r);
                  return (
                    <Chip
                      key={r}
                      size="small"
                      label={r}
                      onClick={() => onToggleRejectReason(r)}
                      sx={{
                        fontSize: 10,
                        fontWeight: selected ? 700 : 500,
                        bgcolor: selected ? 'rgba(254, 44, 85, 0.12)' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover',
                        color: selected ? '#FE2C55' : 'text.secondary',
                        border: '1px solid',
                        borderColor: selected ? '#FE2C55' : 'divider',
                        cursor: 'pointer',
                        '&:hover': { borderColor: '#FE2C55' },
                      }}
                    />
                  );
                })}
              </Box>
            </Box>

            {/* 备注 */}
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', mb: 0.75 }}>
                审核员备注
              </Typography>
              <TextField
                multiline
                minRows={3}
                maxRows={6}
                fullWidth
                value={verdictNote}
                onChange={(e) => onVerdictNoteChange(e.target.value)}
                placeholder={
                  failed > 0
                    ? '请说明驳回的具体问题,例如:画面 03:24 出现未授权品牌 logo,封面图涉及低俗内容...'
                    : '可通过时填写简短备注;需修改时说明补充材料要求'
                }
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: 12,
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FAFAFA',
                  },
                }}
              />
              {failed > 0 && verdictNote.trim().length === 0 && selectedRejectReasons.length === 0 && (
                <Typography sx={{ fontSize: 10, color: '#FE2C55', mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <WarningAmberRoundedIcon sx={{ fontSize: 12 }} />
                  AI 已标记 {failed} 项异常,驳回时必须填写备注或选择驳回原因
                </Typography>
              )}
            </Box>

            {/* AI 命中详情 (如果有 rejections) */}
            {video.review?.rejections && video.review.rejections.length > 0 && (
              <Box
                sx={{
                  p: 1.25,
                  borderRadius: 1.25,
                  bgcolor: 'rgba(254, 44, 85, 0.06)',
                  border: '1px solid rgba(254, 44, 85, 0.2)',
                }}
              >
                <Typography sx={{ fontSize: 11, color: 'primary.main', fontWeight: 600, mb: 0.75, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <WarningAmberRoundedIcon sx={{ fontSize: 12 }} />
                  AI 命中 ({video.review.rejections.length})
                </Typography>
                <Stack spacing={0.5}>
                  {video.review.rejections.map((r, i) => (
                    <Box
                      key={i}
                      sx={{
                        p: 0.75,
                        borderRadius: 0.75,
                        bgcolor: 'rgba(0,0,0,0.2)',
                        display: 'flex',
                        gap: 0.75,
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                          <Typography sx={{ fontSize: 10, color: '#FE2C55', fontWeight: 600 }}>
                            {r.category}
                          </Typography>
                          {r.frameAt && (
                            <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>@ {r.frameAt}</Typography>
                          )}
                        </Box>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary', lineHeight: 1.5 }}>
                          {r.detail}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* 底部操作栏 */}
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        {isAlreadyReviewed ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.disabled', justifyContent: 'center' }}>
            <HistoryRoundedIcon sx={{ fontSize: 14 }} />
            <Typography sx={{ fontSize: 11 }}>该视频已完成审核,可在创作者端查看</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<AssignmentLateRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => onSubmit('request_changes')}
              sx={{
                textTransform: 'none',
                fontSize: 13,
                py: 1,
                borderColor: 'rgba(255, 180, 0, 0.4)',
                color: '#FFB400',
                '&:hover': { borderColor: '#FFB400', bgcolor: 'rgba(255, 180, 0, 0.08)' },
              }}
            >
              需补充材料
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<ErrorRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => onSubmit('reject')}
              sx={{
                textTransform: 'none',
                fontSize: 13,
                py: 1,
                borderColor: 'rgba(254, 44, 85, 0.4)',
                color: '#FE2C55',
                '&:hover': { borderColor: '#FE2C55', bgcolor: 'rgba(254, 44, 85, 0.08)' },
              }}
            >
              驳回
            </Button>
            <Button
              fullWidth
              variant="contained"
              startIcon={<CheckCircleRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => onSubmit('pass')}
              sx={{
                textTransform: 'none',
                fontSize: 13,
                py: 1,
                background: 'linear-gradient(90deg, #5DDB96 0%, #25F4EE 100%)',
                color: '#0a0a0f',
                fontWeight: 700,
                '&:hover': {
                  background: 'linear-gradient(90deg, #5DDB96 0%, #25F4EE 100%)',
                  filter: 'brightness(1.1)',
                },
              }}
            >
              通过
            </Button>
          </Box>
        )}
      </Box>
    </>
  );
}
