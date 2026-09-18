'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Alert from '@mui/material/Alert';
import CloseIcon from '@mui/icons-material/Close';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupIcon from '@mui/icons-material/Group';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { alpha } from '@mui/material/styles';
import { getBountyDetail } from '@/apis/dashboard';
import { listTasks, claimTask } from '@/apis/reward-task';
import { useApp } from '@/contexts/AppContext';
import type { RewardTask } from '@/beans/reward';
import { TaskDetailDialog } from '../taskboard/TaskDetailDialog';
import {
  mapRewardTaskFromBackend,
  mapRewardTaskListFromBackend,
  normalizeRewardTaskStatus,
  REWARD_TASK_STATUS_COLOR,
  REWARD_TASK_STATUS_LABEL,
} from '../taskboard/status';

function fmtYuan(cents: number) {
  return `¥${(cents / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

/**
 * 悬赏详情弹层,在赏金广场内打开,不跳路由。
 * 需求由发布者拆成若干任务,赏金在发布时已从发布者钱包托管;这里可以直接认领任务,
 * 点开任务后在任务弹层里提交交付物、查看验收结果,结账时赏金从托管直接到账。
 */
export default function BountyDetailDialog({
  open,
  bountyId,
  onClose,
}: {
  open: boolean;
  bountyId: string | null;
  onClose: () => void;
}) {
  const { currentUser } = useApp();
  const currentUserId = currentUser?.id ?? 0;
  const qc = useQueryClient();
  const [message, setMessage] = useState<{ text: string; severity: 'success' | 'error' } | null>(null);
  const [activeTask, setActiveTask] = useState<RewardTask | null>(null);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const detailQuery = useQuery({
    queryKey: ['reward', 'bounty', 'detail', bountyId],
    queryFn: () => (bountyId ? getBountyDetail(bountyId) : Promise.resolve(undefined)),
    staleTime: 30 * 1000,
    enabled: open && !!bountyId,
  });
  const tasksQuery = useQuery({
    queryKey: ['reward', 'bounty', 'tasks', bountyId],
    queryFn: async () => {
      const res: any = await listTasks({ demandId: Number(bountyId), pageSize: 100 });
      return mapRewardTaskListFromBackend(res?.data?.records || []) as RewardTask[];
    },
    enabled: open && !!bountyId,
  });
  const found = detailQuery.data;
  const tasks = tasksQuery.data ?? [];
  const isSponsor = !!found && found.sponsorId === currentUserId;
  const accepting = found?.status === 'PUBLISHED' && (found.daysLeft == null || found.daysLeft > 0);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['reward', 'bounty'] });
    qc.invalidateQueries({ queryKey: ['reward-bounty-grid'] });
  };

  const handleClaim = async (task: RewardTask) => {
    setClaimingId(task.id!);
    try {
      const res: any = await claimTask(task.id!);
      // 拦截器已在 code !== 0 时 reject;这里就是成功路径
      setMessage({ text: '认领成功,完成后在任务里提交交付物', severity: 'success' });
      setActiveTask(mapRewardTaskFromBackend(res));
        refresh();
    } catch (e: any) {
      setMessage({ text: e?.message || '认领失败', severity: 'error' });
    } finally {
      setClaimingId(null);
    }
  };

  const deadlineText =
    found?.daysLeft == null ? '长期' : found.daysLeft === 0 ? '已截止' : `${found.daysLeft} 天`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 2, bgcolor: 'background.paper' } } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.5 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary', flex: 1 }}>悬赏详情</Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }} aria-label="关闭">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ pt: 1 }}>
        {message && (
          <Alert severity={message.severity} onClose={() => setMessage(null)} sx={{ mb: 1.5 }}>
            {message.text}
          </Alert>
        )}
        {detailQuery.isLoading ? (
          <Box sx={{ py: 2 }}>
            <LinearProgress sx={{ borderRadius: 1 }} />
            <Typography sx={{ mt: 2, color: 'text.secondary', fontSize: 13 }}>正在加载悬赏详情…</Typography>
          </Box>
        ) : !found ? (
          <Box sx={{ py: 3 }}>
            <Typography variant="h6" sx={{ mb: 1, fontSize: 16 }}>未找到该悬赏</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>它可能已被发布者删除。</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box
              sx={{
                borderRadius: 2,
                p: 2.5,
                background: found.gradient || `linear-gradient(135deg, ${alpha('#FE2C55', 0.18)}, ${alpha('#8B5CF6', 0.18)})`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <WhatshotIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                <Chip size="small" label={`#${found.id}`} sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: 'action.hover' }} />
                {found.category && (
                  <Chip size="small" label={found.category.toUpperCase()} sx={{ height: 20, fontSize: 10, fontWeight: 600, bgcolor: 'action.hover' }} />
                )}
                {!accepting && (
                  <Chip size="small" label={found.status === 'PUBLISHED' ? '已截止' : '已结束'} sx={{ height: 20, fontSize: 10, bgcolor: 'action.hover' }} />
                )}
              </Box>
              <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary', lineHeight: 1.3 }}>{found.title}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <Avatar src={found.sponsorAvatar} sx={{ width: 20, height: 20, fontSize: 11 }}>
                  {found.sponsor?.[0]}
                </Avatar>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  {found.sponsor}
                  {isSponsor && ' (我发布的)'}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
              <Stat icon={<CardGiftcardIcon sx={{ fontSize: 16, color: 'primary.main' }} />} label="总赏金" value={fmtYuan(found.reward)} />
              <Stat icon={<GroupIcon sx={{ fontSize: 16, color: 'secondary.main' }} />} label="参与人数" value={String(found.applicants)} />
              <Stat icon={<AccessTimeIcon sx={{ fontSize: 16, color: 'warning.main' }} />} label="剩余时间" value={deadlineText} />
            </Box>

            {(found.escrowCents ?? 0) > 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderRadius: 1, bgcolor: alpha('#5DDB96', 0.1) }}>
                <VerifiedUserIcon sx={{ fontSize: 16, color: 'success.main' }} />
                <Typography sx={{ fontSize: 12, color: 'success.main' }}>
                  赏金 {fmtYuan(found.escrowCents ?? 0)} 已托管,任务验收通过后在结账时直接到账
                </Typography>
              </Box>
            ) : found.reward > 0 ? (
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>赏金由发布者在结账时从钱包支付。</Typography>
            ) : null}

            {(found.subtitle || found.content) && (
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', mb: 0.75 }}>需求说明</Typography>
                {found.subtitle && (
                  <Typography sx={{ fontSize: 13, color: 'text.primary', mb: found.content ? 1 : 0 }}>{found.subtitle}</Typography>
                )}
                {found.content && (
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {found.content}
                  </Typography>
                )}
              </Box>
            )}

            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', mb: 1 }}>
                可认领的任务 ({found.openTaskCount ?? 0}/{found.totalTaskCount ?? tasks.length})
              </Typography>
              {tasksQuery.isLoading ? (
                <LinearProgress sx={{ borderRadius: 1 }} />
              ) : tasks.length === 0 ? (
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  {isSponsor
                    ? '你还没有把这条需求拆成任务。到「需求」里打开它,在协作看板新建任务后,别人才能认领。'
                    : '发布者还没有把需求拆成任务,暂时无法认领。'}
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {tasks.map((t) => {
                    const s = normalizeRewardTaskStatus(t.status);
                    const mine = !!t.assigneeId && t.assigneeId === currentUserId;
                    const canClaim = s === 'OPEN' && accepting && t.managerId !== currentUserId;
                    const canSubmit = mine && (s === 'CLAIMED' || s === 'REJECTED');
                    return (
                      <Box
                        key={t.id}
                        onClick={() => setActiveTask(t)}
                        sx={{
                          p: 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'action.hover',
                          cursor: 'pointer',
                        }}
                      >
                        <Box sx={{ width: 6, height: 30, borderRadius: 1, bgcolor: REWARD_TASK_STATUS_COLOR[s] }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>{t.title}</Typography>
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                            {t.reward ? `标价 ¥${t.reward}` : '均分剩余赏金'} · {REWARD_TASK_STATUS_LABEL[s]}
                            {t.assigneeName ? ` · ${mine ? '我' : t.assigneeName}` : ''}
                          </Typography>
                        </Box>
                        {canClaim ? (
                          <Button
                            size="small"
                            variant="contained"
                            disabled={claimingId === t.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClaim(t);
                            }}
                            sx={{ textTransform: 'none' }}
                          >
                            认领
                          </Button>
                        ) : canSubmit ? (
                          <Button size="small" variant="outlined" sx={{ textTransform: 'none' }}>
                            去提交
                          </Button>
                        ) : null}
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      <TaskDetailDialog
        open={!!activeTask}
        task={activeTask}
        isOwner={!!activeTask && activeTask.managerId === currentUserId}
        currentUserId={currentUserId}
        onClose={() => setActiveTask(null)}
        onChanged={(updated) => {
          setActiveTask(mapRewardTaskFromBackend(updated));
          setMessage({ text: '操作成功', severity: 'success' });
          refresh();
        }}
        onDeleted={() => {
          setActiveTask(null);
          refresh();
        }}
        onError={(m) => setMessage({ text: m, severity: 'error' })}
      />
    </Dialog>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        {icon}
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{label}</Typography>
      </Box>
      <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary', mt: 0.75, fontFamily: 'monospace' }}>{value}</Typography>
    </Box>
  );
}
