'use client';

/**
 * 个人工作台 - 我的待办面板(右栏底部)
 *
 * 拉我作为 assigneeId 或 claimerId 的任务,按状态分桶展示;
 * 点击「打开协作看板」跳到 taskboard tab 并按当前用户过滤('mine' 视图)。
 */

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { alpha } from '@mui/material/styles';
import { listTasks } from '@/apis/reward-task';
import { mapRewardTaskListFromBackend, normalizeRewardTaskStatus, REWARD_TASK_STATUS_LABEL } from '../taskboard/status';
import type { RewardTask, RewardTaskStatus } from '@/beans/reward';
import type { GroupInfo } from '@/apis/reward-group';

interface Props {
  currentUserId: number;
  groups: GroupInfo[];
  onOpenTaskboard?: (groupId: number) => void;
}

const STATUS_COLOR: Record<RewardTaskStatus, string> = {
  OPEN:      '#5DDB96',
  CLAIMED:   '#8B5CF6',
  SUBMITTED: '#FFB400',
  APPROVED:  '#5DDB96', // success.main
  REJECTED:  '#FE2C55', // primary.main(默认 primaryColor)
};

const PRIORITY_COLOR: Record<string, string> = {
  P0: '#FE2C55', // primary.main
  P1: '#FFB400', // warning.main
  P2: '#5A5E72', // text.disabled
};

export default function PersonalTaskPanel({ currentUserId, groups, onOpenTaskboard }: Props) {
  // 拉我作为 assignee/claimer 的所有任务;同 taskboard 'mine' 模式
  const query = useQuery({
    queryKey: ['personal', 'tasks', 'mine-detail', currentUserId],
    queryFn: () =>
      listTasks({ assigneeId: currentUserId, claimerId: currentUserId, pageSize: 100 } as any).then((r: any) => {
        return mapRewardTaskListFromBackend(r?.data?.records || []);
      }),
    enabled: !!currentUserId,
    placeholderData: [],
  });

  const tasks: RewardTask[] = query.data || [];

  // 按状态分桶取最近一条
  const grouped = useMemo(() => {
    const buckets: Record<RewardTaskStatus, RewardTask[]> = {
      OPEN: [], CLAIMED: [], SUBMITTED: [], APPROVED: [], REJECTED: [],
    };
    tasks.forEach((t) => {
      const s = normalizeRewardTaskStatus(t.status);
      if (buckets[s]) buckets[s].push(t);
    });
    return buckets;
  }, [tasks]);

  const stats = useMemo(() => ({
    total: tasks.length,
    claimed: grouped.CLAIMED.length,
    submitted: grouped.SUBMITTED.length,
    approved: grouped.APPROVED.length,
  }), [tasks, grouped]);

  // 待展示的 4 个非空状态(优先显示进行中/待验收)
  const displayStatuses: RewardTaskStatus[] = (['CLAIMED', 'SUBMITTED', 'OPEN', 'REJECTED'] as RewardTaskStatus[])
    .filter((s) => grouped[s].length > 0)
    .slice(0, 3);

  // 团队名映射
  const groupNameMap = useMemo(() => {
    const m: Record<number, string> = {};
    groups.forEach((g) => { if (g.id != null) m[g.id] = g.name || `团队 ${g.id}`; });
    return m;
  }, [groups]);

  return (
    <Box
      sx={{
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        p: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <ViewKanbanIcon sx={{ fontSize: 16, color: '#06B6D4', mr: 1 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', flex: 1 }}>
          我的待办
        </Typography>
        {onOpenTaskboard && tasks.length > 0 && groups[0] && (
          <Button
            size="small"
            endIcon={<ArrowForwardIosIcon sx={{ fontSize: 10 }} />}
            onClick={() => onOpenTaskboard(groups[0].id)}
            sx={{ minWidth: 0, color: 'text.secondary', fontSize: 11, textTransform: 'none' }}
          >
            看板
          </Button>
        )}
      </Box>
      {/* 顶部 4 个计数:总数 / 进行中 / 待验收 / 已完成 */}
      <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5 }}>
        {[
          { label: '总数', value: stats.total, color: 'text.primary' },
          { label: '进行中', value: stats.claimed, color: STATUS_COLOR.CLAIMED },
          { label: '待验收', value: stats.submitted, color: STATUS_COLOR.SUBMITTED },
          { label: '已完成', value: stats.approved, color: STATUS_COLOR.APPROVED },
        ].map((s) => (
          <Box key={s.label} sx={{ flex: 1, textAlign: 'center', py: 0.75, borderRadius: 1, bgcolor: 'action.hover' }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: s.color, fontFamily: 'monospace', lineHeight: 1.1 }}>
              {query.isLoading ? '—' : s.value}
            </Typography>
            <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>{s.label}</Typography>
          </Box>
        ))}
      </Box>
      {/* 各状态最近 1 条 */}
      {query.isLoading ? (
        <Typography sx={{ fontSize: 11, color: 'text.disabled', py: 2, textAlign: 'center' }}>加载中…</Typography>
      ) : displayStatuses.length === 0 ? (
        <Typography sx={{ fontSize: 11, color: 'text.disabled', py: 2, textAlign: 'center' }}>
          {tasks.length === 0 ? '暂无待办任务' : '所有任务都已完成 ✓'}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {displayStatuses.map((s) => {
            const t = grouped[s][0];
            const groupName = t.groupId != null ? groupNameMap[t.groupId] : null;
            return (
              <Box
                key={s}
                sx={{
                  p: 1,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: alpha(STATUS_COLOR[s], 0.05),
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                  <Chip
                    label={REWARD_TASK_STATUS_LABEL[s]}
                    size="small"
                    sx={{ height: 16, fontSize: 9, bgcolor: alpha(STATUS_COLOR[s], 0.18), color: STATUS_COLOR[s], fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }}
                  />
                  {t.priority && (
                    <Chip
                      label={t.priority}
                      size="small"
                      sx={{ height: 16, fontSize: 9, bgcolor: alpha(PRIORITY_COLOR[t.priority] || 'text.disabled', 0.12), color: PRIORITY_COLOR[t.priority] || 'text.disabled', fontWeight: 600, '& .MuiChip-label': { px: 0.5 } }}
                    />
                  )}
                  <Typography sx={{ fontSize: 10, color: 'text.disabled', ml: 'auto' }} noWrap>
                    {groupName}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 11, color: 'text.primary', fontWeight: 500 }} noWrap>
                  {t.title || '(无标题)'}
                </Typography>
                {grouped[s].length > 1 && (
                  <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>
                    还有 {grouped[s].length - 1} 个同状态任务,去协作看板查看全部
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}