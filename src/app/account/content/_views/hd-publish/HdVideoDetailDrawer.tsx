'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MovieFilterRoundedIcon from '@mui/icons-material/MovieFilterRounded';
import PlaylistAddCheckRoundedIcon from '@mui/icons-material/PlaylistAddCheckRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { RelativeTime } from '@/components/common/RelativeTime';
import { formatCount } from '@/lib/utils/format';
import { REVIEWER_LEVEL_META, type HdVideo, type Reviewer } from './data';
import { RESOLUTION_META, formatSize } from './hdPublishModel';
import { STATUS_META } from './hdPublishMeta';

/** 视频详情抽屉:状态/分辨率、数据表现、失败原因、审核流程时间线、音轨字幕、转码进度和底部操作。 */
export const HdVideoDetailDrawer = React.memo(function HdVideoDetailDrawer({
  detail,
  setDetailId,
  getReviewer,
  fastChannelQuota,
  onRetry: handleRetry,
  onFastTrackReview: handleFastTrackReview,
  onResubmitReview: handleResubmitReview,
  onViewPublished: handleViewPublished,
  onPublishNow: handlePublishNow,
  onDelete: handleDelete,
  onOpenAppeal: handleOpenAppeal,
}: {
  detail: HdVideo | null;
  setDetailId: (id: string | null) => void;
  getReviewer: (id: string | undefined) => Reviewer | undefined;
  fastChannelQuota: number;
  onRetry: (id: string) => void;
  onFastTrackReview: (id: string) => void;
  onResubmitReview: (id: string) => void;
  onViewPublished: (id: string) => void;
  onPublishNow: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenAppeal: () => void;
}) {
  return (
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
              <MovieFilterRoundedIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.7)', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.45))' }} />
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
                      color: 'var(--fg-amber)',
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
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-green)' }}>
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
                                <Typography sx={{ fontSize: 10, color: 'var(--fg-amber)', fontWeight: 600 }}>
                                  队列第 {detail.review.queuePosition} 位
                                </Typography>
                                {detail.review.estimatedWaitMin !== undefined && (
                                  <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>
                                    预计 {detail.review.estimatedWaitMin} 分钟
                                  </Typography>
                                )}
                              </>
                            ) : (
                              <Typography sx={{ fontSize: 10, color: 'var(--fg-cyan)', fontWeight: 600 }}>
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
                        ? { bg: 'rgba(93, 219, 150, 0.18)', color: 'var(--fg-green)', icon: <VerifiedRoundedIcon sx={{ fontSize: 12 }} /> }
                        : c.status === 'failed'
                        ? { bg: 'rgba(254, 44, 85, 0.18)', color: '#FE2C55', icon: <ErrorRoundedIcon sx={{ fontSize: 12 }} /> }
                        : c.status === 'running'
                        ? { bg: 'rgba(37, 244, 238, 0.18)', color: 'var(--fg-cyan)', icon: <AutorenewRoundedIcon sx={{ fontSize: 12 }} /> }
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
                            <Box sx={{ width: '1px', flex: 1, minHeight: 20, bgcolor: c.status === 'passed' ? 'rgba(93, 219, 150, 0.3)' : 'divider', my: 0.25 }} />
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
                              <Typography sx={{ fontSize: 9, color: 'var(--fg-cyan)', fontWeight: 600 }}>
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
                          <VerifiedRoundedIcon sx={{ fontSize: 12, color: 'var(--fg-green)' }} />
                          <Typography sx={{ fontSize: 9, color: 'var(--fg-green)', fontWeight: 600 }}>
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
                              ? <>可在 <RelativeTime ts={detail.review.reviewerVerdict.appealDeadline} fallback="" /> 前提交申诉,72 小时内重新审核</>
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
                                color: 'var(--fg-green)',
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
                    {detail.progress != null ? `${detail.progress}%` : '处理中'}
                  </Typography>
                </Box>
                <LinearProgress
                  variant={detail.progress != null ? 'determinate' : 'indeterminate'}
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
  );
});
