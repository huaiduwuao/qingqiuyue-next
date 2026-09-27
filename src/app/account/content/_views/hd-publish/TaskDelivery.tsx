'use client';

import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { alpha } from '@mui/material/styles';
import { submitTask } from '@/apis/reward-task';
import { formatApiError } from '@/lib/api/client';
import type { TaskDeliveryContext } from '@/lib/bountyDelivery';

/**
 * 发布页的「悬赏任务模式」:从任务弹层「去创作交付」进来时,顶部一行提示 + 发布成功后的交付确认。
 * 流程与参数见 lib/bountyDelivery.ts。
 */

/** 顶部一行提示(手机上也保持一行,标题过长省略)。 */
export function TaskDeliveryBanner({
  ctx,
  onBack,
  onExit,
}: {
  ctx: TaskDeliveryContext;
  onBack: () => void;
  onExit: () => void;
}) {
  const title = ctx.taskTitle || `#${ctx.taskId}`;
  return (
    <Box
      role="status"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: { xs: 1.25, md: 1.5 },
        py: 0.5,
        minHeight: 40,
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: (t) => alpha(t.palette.warning.main, 0.35),
        bgcolor: (t) => alpha(t.palette.warning.main, 0.08),
        minWidth: 0,
      }}
    >
      <AssignmentTurnedInRoundedIcon sx={{ fontSize: 18, color: 'warning.main', flexShrink: 0 }} />
      <Typography noWrap title={title} sx={{ flex: 1, minWidth: 0, fontSize: { xs: 12, md: 13 }, color: 'text.primary' }}>
        正在为悬赏任务「{title}」创作
        <Box component="span" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'inline' } }}>
          {' '}· 发布后可直接交付
        </Box>
      </Typography>
      <Button
        size="small"
        variant="text"
        onClick={onBack}
        sx={{ flexShrink: 0, textTransform: 'none', fontSize: 12, minWidth: 0, px: 1, color: 'warning.main' }}
      >
        返回任务
      </Button>
      <IconButton size="small" aria-label="退出任务模式" onClick={onExit} sx={{ flexShrink: 0, color: 'text.secondary' }}>
        <CloseRoundedIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );
}

/** 发布成功后:用刚发布的作品交付任务,还是稍后再说。 */
export function TaskDeliverDialog({
  ctx,
  workId,
  onLater,
  onDelivered,
}: {
  ctx: TaskDeliveryContext | null;
  /** 刚发布的作品 id(十进制字符串);null = 不弹 */
  workId: string | null;
  onLater: () => void;
  onDelivered: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const open = !!ctx && !!workId;

  useEffect(() => {
    if (open) setError('');
  }, [open, workId]);

  const deliver = async () => {
    if (!ctx || !workId) return;
    const taskId = Number(ctx.taskId);
    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      setError('任务编号无效,请回到任务里「从我的作品选择」交付');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      // 交付说明留空:后端会自动写成「提交作品《作品名》」,验收人一眼看得懂
      await submitTask(taskId, '', workId);
      onDelivered();
    } catch (e) {
      // 常见:任务已被驳回后改派 / 已提交 / 已关闭,或不再是认领人
      setError(formatApiError(e) || '交付失败,请回到任务里重试');
    } finally {
      setSubmitting(false);
    }
  };

  const title = ctx?.taskTitle || (ctx ? `#${ctx.taskId}` : '');
  return (
    <Dialog open={open} onClose={submitting ? undefined : onLater} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 16, pb: 1 }}>作品已发布 · 用它交付任务「{title}」?</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          交付后发布者会收到验收通知;作品还在审核中也可以先交付,通过审核后对方才能打开。
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mt: 1.5, fontSize: 12 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button size="small" variant="text" onClick={onLater} disabled={submitting} sx={{ color: 'text.secondary' }}>
          稍后
        </Button>
        <Button size="small" variant="contained" onClick={deliver} disabled={submitting}>
          {submitting ? '交付中…' : '交付'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
