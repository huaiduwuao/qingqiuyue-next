'use client';

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { alpha } from '@mui/material/styles';
import { claimTask, submitTask, reviewTask, disputeTask } from '@/apis/reward-task';
import type { RewardTask, RewardTaskStatus } from '@/beans/reward';
import { BotBadge } from '@/components/community/UserLine';
import { normalizeRewardTaskStatus, REWARD_TASK_STATUS_LABEL, REWARD_TASK_STATUS_COLOR } from './status';

interface Props {
  open: boolean;
  task: RewardTask | null;
  isOwner: boolean;
  currentUserId: number;
  onClose: () => void;
  onChanged: (updated: RewardTask) => void;
  onDeleted: (id: number) => void;
  onError: (msg: string) => void;
}

function fmtTime(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function TaskDetailDialog({ open, task, isOwner, currentUserId, onClose, onChanged, onDeleted, onError }: Props) {
  // 后端成功 code 为 0（client.ts 拦截器兼容 0/200），业务层判定需同时认 0 与 200
  const isOk = (res: any) => res?.code === 200 || res?.code === 0 || res?.code === '200' || res?.code === '0';
  const [deliverable, setDeliverable] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setDeliverable(task?.deliverable || '');
      setReviewNote('');
      setDisputeReason('');
    }
  }, [open, task]);

  if (!task) return null;

  // 后端原样存小写 pending/claimed/submitted/approved/rejected；前端用 OPEN/CLAIMED/... → 归一化
  const status = normalizeRewardTaskStatus(task.status);
  const isAssignee = task.assigneeId === currentUserId;
  // isOwner = 当前用户是任务管理者(task.managerId):需求发布者或独立任务的负责人
  const canClaim = status === 'OPEN' && !task.assigneeId && !isOwner;
  const canSubmit = (status === 'CLAIMED' || status === 'REJECTED') && isAssignee;
  const canReview = status === 'SUBMITTED' && isOwner;
  const canDelete = isOwner && (status === 'OPEN' || status === 'REJECTED');
  const waitingReview = status === 'SUBMITTED' && isAssignee && !isOwner;
  // 认领人对驳回有异议时可申请平台仲裁(只限挂在需求下、有赏金的任务)
  const rejectedMine = status === 'REJECTED' && isAssignee && !!task.demandId;
  const canDispute = rejectedMine && task.disputeStatus !== 'pending';

  const handleDispute = async () => {
    setSubmitting(true);
    try {
      const res: any = await disputeTask(task.id!, disputeReason);
      if (isOk(res)) onChanged(res.data);
      else onError(res?.msg || '申请仲裁失败');
    } catch (e: any) {
      onError(e?.message || '申请仲裁失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaim = async () => {
    setSubmitting(true);
    try {
      const res: any = await claimTask(task.id!);
      if (isOk(res)) onChanged(res.data);
      else onError(res?.msg || '领取失败');
    } catch (e: any) {
      onError(e?.message || '领取失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!deliverable.trim()) {
      onError('请填写交付物链接或说明');
      return;
    }
    setSubmitting(true);
    try {
      const res: any = await submitTask(task.id!, deliverable);
      if (isOk(res)) onChanged(res.data);
      else onError(res?.msg || '提交失败');
    } catch (e: any) {
      onError(e?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (approved: boolean) => {
    setSubmitting(true);
    try {
      const res: any = await reviewTask(task.id!, approved, reviewNote);
      if (isOk(res)) onChanged(res.data);
      else onError(res?.msg || '审稿失败');
    } catch (e: any) {
      onError(e?.message || '审稿失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('确认删除此任务?此操作不可撤销。')) return;
    const { deleteTask } = await import('@/apis/reward-task');
    try {
      const res: any = await deleteTask(task.id!);
      if (isOk(res)) onDeleted(task.id!);
      else onError(res?.msg || '删除失败');
    } catch (e: any) {
      onError(e?.message || '删除失败');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Chip
            label={task.priority}
            size="small"
            sx={{
              height: 20,
              fontSize: 11,
              fontWeight: 700,
              bgcolor: (theme) => task.priority === 'P0'
                ? alpha(theme.palette.primary.main, 0.18)
                : task.priority === 'P1'
                  ? alpha(theme.palette.warning.main, 0.18)
                  : alpha(theme.palette.text.secondary, 0.18),
              color: task.priority === 'P0' ? 'primary.main' : task.priority === 'P1' ? 'warning.main' : 'text.secondary',
            }}
          />
          <Chip
            label={REWARD_TASK_STATUS_LABEL[status]}
            size="small"
            sx={{
              height: 20,
              fontSize: 11,
              fontWeight: 600,
              bgcolor: `${REWARD_TASK_STATUS_COLOR[status]}1A`,
              color: REWARD_TASK_STATUS_COLOR[status],
            }}
          />
          {task.deadline && (
            <Typography sx={{ fontSize: 11, color: 'text.secondary', ml: 'auto' }}>
              截止 {fmtTime(task.deadline)}
            </Typography>
          )}
        </Box>
        <Typography variant="subtitle1" component="div" sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary' }}>
          {task.title}
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'divider' }}>
        {(task.demandTitle || task.demandId) && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
            <Chip
              size="small"
              variant="outlined"
              label={
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  {`需求:${task.demandTitle || `#${task.demandId}`}`}
                  {task.managerIsBot && <BotBadge />}
                </Box>
              }
            />
            <Chip
              size="small"
              sx={{ bgcolor: 'rgba(255,180,0,0.12)', color: 'warning.main', fontWeight: 600 }}
              label={task.reward ? `标价 ¥${task.reward}` : '均分需求剩余赏金'}
            />
          </Box>
        )}

        {/* Assignee */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          {task.assigneeId ? (
            <>
              <Avatar src={task.assigneeAvatar} sx={{ width: 28, height: 28, fontSize: 12 }}>
                {task.assigneeName?.[0]}
              </Avatar>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 500, color: 'text.primary' }}>{task.assigneeName}</Typography>
                  {task.assigneeIsBot && <BotBadge />}
                </Box>
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>负责人</Typography>
              </Box>
            </>
          ) : (
            <>
              <Avatar sx={{ width: 28, height: 28, bgcolor: 'transparent', border: '1px dashed', borderColor: (theme) => theme.palette.mode === 'dark' ? '#5A5E72' : '#D1D5DB' }} />
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>暂无人认领</Typography>
            </>
          )}
        </Box>

        <Divider sx={{ borderColor: 'divider', mb: 2 }} />

        {/* Description */}
        <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5, textTransform: 'uppercase' }}>
          任务描述
        </Typography>
        <Typography
          sx={{
            fontSize: 13,
            color: 'text.tertiary',
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            mb: 2,
            fontFamily: 'monospace',
          }}
        >
          {task.description || '(无)'}
        </Typography>

        {/* Action areas */}
        {canClaim && (
          <Box sx={{ p: 1.5, bgcolor: 'rgba(93,219,150,0.08)', border: '1px solid rgba(93,219,150,0.3)', borderRadius: 1, mb: 2 }}>
            <Typography sx={{ fontSize: 12, color: 'success.main', mb: 1 }}>此任务尚未认领</Typography>
            <Button
              variant="contained"
              size="small"
              onClick={handleClaim}
              disabled={submitting}
              sx={{ bgcolor: 'success.main', color: 'background.default', '&:hover': { bgcolor: '#4DC986' } }}
            >
              我来认领
            </Button>
          </Box>
        )}

        {canSubmit && (
          <Box sx={{ p: 1.5, bgcolor: 'rgba(37,244,238,0.08)', border: '1px solid rgba(37,244,238,0.3)', borderRadius: 1, mb: 2 }}>
            <Typography sx={{ fontSize: 12, color: 'secondary.main', mb: 1 }}>
              {status === 'REJECTED' ? '任务被驳回,请修改后重新提交' : '提交你的工作成果'}
            </Typography>
            <TextField
              value={deliverable}
              onChange={(e) => setDeliverable(e.target.value)}
              placeholder="交付物链接 / 文本说明"
              fullWidth
              multiline
              minRows={2}
              size="small"
              sx={{
                mb: 1,
                '& .MuiOutlinedInput-root': { bgcolor: (theme) => theme.palette.mode === 'dark' ? '#0F1018' : '#FAFAFA', fontSize: 12 },
              }}
            />
            {status === 'REJECTED' && task.reviewNote && (
              <Typography sx={{ fontSize: 11, color: 'primary.main', mb: 1 }}>
                驳回意见: {task.reviewNote}
              </Typography>
            )}
            <Button
              variant="contained"
              size="small"
              onClick={handleSubmit}
              disabled={submitting}
              sx={{ bgcolor: 'secondary.main', color: 'background.default', '&:hover': { bgcolor: '#0ED4CE' } }}
            >
              提交
            </Button>
          </Box>
        )}

        {rejectedMine && task.disputeStatus === 'pending' && (
          <Box sx={{ p: 1.5, bgcolor: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.3)', borderRadius: 1, mb: 2 }}>
            <Typography sx={{ fontSize: 12, color: 'warning.main' }}>已申请平台仲裁,等待运营核实;有结论后会通知你</Typography>
          </Box>
        )}

        {canDispute && (
          <Box sx={{ p: 1.5, border: '1px dashed', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>
              {task.disputeStatus === 'rejected'
                ? '平台上次维持了驳回。如果修改后再次被驳回且仍有异议,可以再申请一次。'
                : '认为交付符合要求?可以申请平台仲裁,运营核实后可改判通过。'}
            </Typography>
            <TextField
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="说明交付为什么符合任务要求"
              fullWidth
              multiline
              minRows={2}
              size="small"
              sx={{
                mb: 1,
                '& .MuiOutlinedInput-root': { bgcolor: (theme) => theme.palette.mode === 'dark' ? '#0F1018' : '#FAFAFA', fontSize: 12 },
              }}
            />
            <Button variant="outlined" size="small" onClick={handleDispute} disabled={submitting || !disputeReason.trim()}>
              申请平台仲裁
            </Button>
          </Box>
        )}

        {canReview && (
          <Box sx={{ p: 1.5, bgcolor: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.3)', borderRadius: 1, mb: 2 }}>
            <Typography sx={{ fontSize: 12, color: 'warning.main', mb: 1 }}>负责人已提交,等待审稿</Typography>
            {task.assigneeIsBot && (
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1 }}>
                这份交付由平台运营的 AI 用户生成。不满意可以直接驳回,任务会重新开放给其他人认领。
              </Typography>
            )}
            {task.deliverable && (
              <Typography sx={{ fontSize: 11, color: 'text.tertiary', mb: 1, wordBreak: 'break-all' }}>
                交付物: {task.deliverable}
              </Typography>
            )}
            <TextField
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="验收意见(驳回时必填)"
              fullWidth
              multiline
              minRows={2}
              size="small"
              sx={{
                mb: 1,
                '& .MuiOutlinedInput-root': { bgcolor: (theme) => theme.palette.mode === 'dark' ? '#0F1018' : '#FAFAFA', fontSize: 12 },
              }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                size="small"
                startIcon={<CheckIcon sx={{ fontSize: 14 }} />}
                onClick={() => handleReview(true)}
                disabled={submitting}
                sx={{ bgcolor: 'success.main', color: 'background.default', '&:hover': { bgcolor: '#4DC986' } }}
              >
                通过
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CloseIcon sx={{ fontSize: 14 }} />}
                onClick={() => handleReview(false)}
                disabled={submitting || !reviewNote.trim()}
                sx={{
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  '&:hover': (theme) => ({ borderColor: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.1) }),
                }}
              >
                驳回
              </Button>
            </Box>
          </Box>
        )}

        {waitingReview && (
          <Box sx={{ p: 1.5, bgcolor: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.3)', borderRadius: 1, mb: 2 }}>
            <Typography sx={{ fontSize: 12, color: 'warning.main', mb: task.deliverable ? 0.5 : 0 }}>已提交,等待发布者验收</Typography>
            {task.deliverable && (
              <Typography sx={{ fontSize: 11, color: 'text.tertiary', wordBreak: 'break-all' }}>交付物: {task.deliverable}</Typography>
            )}
          </Box>
        )}

        {status === 'APPROVED' && task.reviewNote && (
          <Box sx={{ p: 1.5, bgcolor: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 1, mb: 2 }}>
            <Typography sx={{ fontSize: 11, color: '#8B5CF6' }}>✓ 已通过 · {task.reviewNote}</Typography>
          </Box>
        )}

        {/* Timeline */}
        <Divider sx={{ borderColor: 'divider', my: 2 }} />
        <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1, textTransform: 'uppercase' }}>
          时间线
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '80px 1fr', rowGap: 0.5, columnGap: 1 }}>
          <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>创建</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.tertiary' }}>{fmtTime(task.createdAt)}</Typography>
          {task.claimedAt && (
            <>
              <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>认领</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.tertiary' }}>{fmtTime(task.claimedAt)}</Typography>
            </>
          )}
          {task.submittedAt && (
            <>
              <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>提交</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.tertiary' }}>{fmtTime(task.submittedAt)}</Typography>
            </>
          )}
          {task.reviewedAt && (
            <>
              <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>审稿</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.tertiary' }}>{fmtTime(task.reviewedAt)}</Typography>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ borderTop: '1px solid', borderColor: 'divider', px: 2, py: 1.5, justifyContent: 'space-between' }}>
        {canDelete ? (
          <Button size="small" color="error" onClick={handleDelete}>
            删除
          </Button>
        ) : (
          <Box />
        )}
        <Button size="small" variant="outlined" onClick={onClose} sx={{ borderColor: 'divider', color: 'text.tertiary' }}>
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  );
}
