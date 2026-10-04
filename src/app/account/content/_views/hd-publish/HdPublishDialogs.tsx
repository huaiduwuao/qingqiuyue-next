'use client';

/**
 * 高清发布页(page.tsx)里的三个弹窗:选择封面 / 提交申诉 / 审核历史。
 * 纯展示,状态和提交逻辑仍在页面里,通过 props 传入;JSX 原样搬出,不改行为。
 */
import React, { memo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import { RelativeTime } from '@/components/common/RelativeTime';
import { gradient2 } from '@/constants/gradients';
import { type HdResolution, type HdStatus, type ReviewInfo, type Reviewer, REVIEWER_LEVEL_META, FAST_CHANNEL_MONTHLY } from './data';

export interface CoverPickerDialogProps {
  open: boolean;
  onClose: () => void;
  /** 点了一张预设渐变封面 */
  onPickPreset: () => void;
  /** 点「从本地上传」 */
  onPickFile: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function CoverPickerDialog({ open, onClose, onPickPreset, onPickFile, inputRef, onFileChange }: CoverPickerDialogProps) {
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
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>选择封面</Typography>
        <IconButton size="small" onClick={onClose}>
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
            onClick={onPickPreset}
          />
        ))}
      </Box>
      <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
        <Button
          startIcon={<ImageRoundedIcon sx={{ fontSize: 14 }} />}
          onClick={onPickFile}
          sx={{ textTransform: 'none', fontSize: 11, color: 'text.secondary' }}
        >
          从本地上传
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          style={{ display: 'none' }}
        />
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
