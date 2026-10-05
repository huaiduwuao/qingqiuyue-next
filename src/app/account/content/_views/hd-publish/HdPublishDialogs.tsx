'use client';

/**
 * 高清发布页(page.tsx)里的三个弹窗:更换封面 / 提交申诉 / 审核历史。
 * 上传和提交逻辑在页面里,通过 props 传入;换封面弹窗自己管候选(截帧 / 本地图片)和选中态。
 */
import React, { memo, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import { RelativeTime } from '@/components/common/RelativeTime';
import { coverBackground } from './hdPublishModel';
import { captureVideoFrames } from './videoFrames';
import { type HdResolution, type HdStatus, type ReviewInfo, type Reviewer, REVIEWER_LEVEL_META, FAST_CHANNEL_MONTHLY } from './data';

export interface CoverPickerTarget {
  id: string;
  title: string;
  cover: string;
  videoUrl?: string;
}

export interface CoverPickerDialogProps {
  open: boolean;
  /** 要换封面的视频;页面以它的 id 作 key 挂载,换一条视频时内部状态从头来 */
  video: CoverPickerTarget | null;
  /** 正在上传 / 保存,期间不能再点保存或关闭 */
  saving: boolean;
  onClose: () => void;
  /** 保存选中的封面图片(视频截帧或本地图片);上传和调后端保存由页面做 */
  onSave: (image: Blob, fileName: string) => void;
  /** 截帧实现,默认 captureVideoFrames(测试里注入) */
  captureFrames?: (src: string, signal: AbortSignal) => Promise<Blob[]>;
}

/** 本地选图的限制:与上传接口白名单一致(不收 svg),10 MB 以内 */
export const COVER_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
export const COVER_MAX_BYTES = 10 * 1024 * 1024;

interface CoverCandidate {
  key: string;
  blob: Blob;
  url: string;
  fileName: string;
}

type FrameState = 'none' | 'loading' | 'ready' | 'unavailable';

const defaultCapture = (src: string, signal: AbortSignal) => captureVideoFrames(src, { signal });

function objectUrl(blob: Blob): string {
  return typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : '';
}

function revoke(url: string) {
  if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
}

/**
 * 换封面:候选来自视频截帧(有视频地址且能截时)和本地上传的图片,选中一张后「保存」。
 * 原来这里是 9 张写死的渐变色(点了只提示「封面已设置」,什么也没存)+ 本地上传只改界面。
 */
export function CoverPickerDialog({ open, video, saving, onClose, onSave, captureFrames = defaultCapture }: CoverPickerDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [frames, setFrames] = useState<CoverCandidate[]>([]);
  const [frameState, setFrameState] = useState<FrameState>(video?.videoUrl ? 'loading' : 'none');
  const [uploaded, setUploaded] = useState<CoverCandidate | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const videoUrl = video?.videoUrl;
  useEffect(() => {
    if (!open || !videoUrl) return;
    const ctrl = new AbortController();
    let made: CoverCandidate[] = [];
    captureFrames(videoUrl, ctrl.signal)
      .then((blobs) => {
        if (ctrl.signal.aborted) return;
        made = blobs.map((blob, i) => ({ key: `frame-${i + 1}`, blob, url: objectUrl(blob), fileName: `cover-frame-${i + 1}.jpg` }));
        setFrames(made);
        setFrameState(made.length ? 'ready' : 'unavailable');
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setFrameState('unavailable');
      });
    return () => {
      ctrl.abort();
      made.forEach((f) => revoke(f.url));
    };
  }, [open, videoUrl, captureFrames]);

  useEffect(() => () => revoke(uploaded?.url ?? ''), [uploaded]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!COVER_ACCEPT.split(',').includes(file.type)) {
      setFileError('只支持 JPG / PNG / WebP / GIF 图片');
      return;
    }
    if (file.size > COVER_MAX_BYTES) {
      setFileError('图片不能超过 10 MB');
      return;
    }
    setFileError(null);
    setUploaded({ key: 'upload', blob: file, url: objectUrl(file), fileName: file.name || 'cover.jpg' });
    setSelectedKey('upload');
  };

  const candidates = uploaded ? [uploaded, ...frames] : frames;
  const selected = candidates.find((c) => c.key === selectedKey) ?? null;
  const close = saving ? undefined : onClose;

  return (
    <Dialog
      open={open}
      onClose={close}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' },
        },
      }}
    >
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          更换封面{video?.title ? ` · ${video.title}` : ''}
        </Typography>
        <IconButton size="small" onClick={close} disabled={saving} aria-label="关闭">
          <CloseRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
      <Divider sx={{ borderColor: 'divider' }} />
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Box
            role="img"
            aria-label="当前封面"
            sx={{ width: 112, aspectRatio: '16/9', borderRadius: 0.75, bgcolor: 'action.hover', background: coverBackground(video?.cover), flexShrink: 0 }}
          />
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            当前封面。从视频里截一帧或上传一张图片,选中后保存;已上线的视频换封面后会重新进入审核。
          </Typography>
        </Box>

        <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary' }}>从视频截取</Typography>
        {frameState === 'loading' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', fontSize: 12 }}>
            <CircularProgress size={14} /> 正在截取画面…
          </Box>
        )}
        {(frameState === 'none' || frameState === 'unavailable') && (
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>
            {frameState === 'none' ? '这条视频没有可截取的文件地址,请上传图片。' : '这个视频不能在浏览器里截取画面,请上传图片。'}
          </Typography>
        )}
        {candidates.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 1 }}>
            {candidates.map((c) => {
              const active = c.key === selectedKey;
              return (
                <Box
                  key={c.key}
                  component="button"
                  type="button"
                  aria-pressed={active}
                  aria-label={c.key === 'upload' ? '上传的图片' : `视频画面 ${c.key.replace('frame-', '')}`}
                  onClick={() => setSelectedKey(c.key)}
                  disabled={saving}
                  sx={{
                    p: 0,
                    aspectRatio: '16/9',
                    borderRadius: 0.75,
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: active ? 'primary.main' : 'transparent',
                    bgcolor: 'action.hover',
                    backgroundImage: c.url ? `url("${c.url}")` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
              );
            })}
          </Box>
        )}
        {fileError && <Typography sx={{ fontSize: 12, color: 'error.main' }}>{fileError}</Typography>}
      </Box>
      <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 1, alignItems: 'center' }}>
        <Button
          startIcon={<ImageRoundedIcon sx={{ fontSize: 14 }} />}
          onClick={() => inputRef.current?.click()}
          disabled={saving}
          sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}
        >
          上传图片
        </Button>
        <input ref={inputRef} type="file" accept={COVER_ACCEPT} onChange={handleFile} style={{ display: 'none' }} data-testid="cover-file-input" />
        <Box sx={{ flex: 1 }} />
        <Button onClick={close} disabled={saving} sx={{ textTransform: 'none', fontSize: 12 }}>
          取消
        </Button>
        <Button
          variant="contained"
          disabled={!selected || saving}
          onClick={() => selected && onSave(selected.blob, selected.fileName)}
          sx={{ textTransform: 'none', fontSize: 12 }}
        >
          {saving ? '保存中…' : '保存封面'}
        </Button>
      </Box>
    </Dialog>
  );
}

export interface AppealDialogProps {
  open: boolean;
  onClose: () => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  submitting: boolean;
  onSubmit: () => void;
}

export function AppealDialog({ open, onClose, reason, onReasonChange, submitting, onSubmit }: AppealDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
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
        <IconButton size="small" onClick={onClose}>
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
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
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
        <Button onClick={onClose} sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}>
          取消
        </Button>
        <Button
          variant="contained"
          disabled={!reason.trim() || submitting}
          onClick={onSubmit}
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
  );
}

export interface ReviewHistoryItem {
  videoId: string;
  title: string;
  cover: string;
  resolution: HdResolution;
  review: ReviewInfo;
  status: HdStatus;
}

export interface ReviewHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  reviewHistory: ReviewHistoryItem[];
  reviewers: Reviewer[];
  fastChannelQuota: number;
}

/** memo:页面上传表单每次输入都会整页重渲染,审核历史弹窗不跟着重渲染 */
export const ReviewHistoryDialog = memo(function ReviewHistoryDialog({
  open,
  onClose,
  reviewHistory,
  reviewers,
  fastChannelQuota,
}: ReviewHistoryDialogProps) {
  const getReviewer = (id: string | undefined): Reviewer | undefined => {
    if (!id) return undefined;
    return reviewers.find((r) => r.id === id);
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
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
        <IconButton size="small" onClick={onClose}>
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
                      background: coverBackground(h.cover),
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
                        ? <>完成于 <RelativeTime ts={h.review.completedAt} fallback="" /></>
                        : h.review.startedAt
                        ? <>开始于 <RelativeTime ts={h.review.startedAt} fallback="" /></>
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
  );
});
