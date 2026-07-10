'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import type { RewardTask, RewardTaskStatus } from '@/beans/reward';
import { alpha } from '@mui/material/styles';

// 状态色 — REJECTED 用 primary.main(跟主题色),其余是平台视觉色(青/黄/绿)
const STATUS_META: Record<RewardTaskStatus, { label: string; color: string; bg: (t: any) => string }> = {
  OPEN: { label: '待领', color: 'success.main', bg: (t) => alpha(t.palette.success.main, 0.12) },
  CLAIMED: { label: '进行中', color: 'secondary.main', bg: (t) => alpha(t.palette.secondary.main, 0.12) },
  SUBMITTED: { label: '待验收', color: 'warning.main', bg: (t) => alpha(t.palette.warning.main, 0.12) },
  APPROVED: { label: '已完成', color: 'secondary.main', bg: (t) => alpha(t.palette.secondary.main, 0.12) },
  REJECTED: { label: '已驳回', color: 'primary.main', bg: (t) => alpha(t.palette.primary.main, 0.12) },
};

interface Props {
  status: RewardTaskStatus;
  tasks: RewardTask[];
  onTaskClick: (task: RewardTask) => void;
  onOpenDemand?: (demandId: number) => void;
  demandTitleMap?: Map<number, string>;
  groupNameMap?: Map<number, string>;
}

export function KanbanColumn({ status, tasks, onTaskClick, onOpenDemand, demandTitleMap, groupNameMap }: Props) {
  const meta = STATUS_META[status];
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` });

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        transition: 'border-color 0.15s, background-color 0.15s',
        ...(isOver && { borderColor: meta.color, bgcolor: (theme) => alpha(meta.color === 'primary.main' ? theme.palette.primary.main : theme.palette.secondary.main, 0.18) }),
      }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 1,
          borderBottom: '1px solid',
          borderBottomColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: meta.bg,
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: meta.color,
            // 状态点光晕 — 用 alpha 包装 meta.color
            boxShadow: (theme) => {
              const c =
                meta.color === 'primary.main' ? theme.palette.primary.main :
                meta.color === 'secondary.main' ? theme.palette.secondary.main :
                meta.color === 'success.main' ? theme.palette.success.main :
                meta.color === 'warning.main' ? theme.palette.warning.main :
                theme.palette.secondary.main;
              return `0 0 6px ${alpha(c, 0.5)}`;
            },
          }}
        />
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', flex: 1 }}>
          {meta.label}
        </Typography>
        <Chip
          label={tasks.length}
          size="small"
          sx={{
            height: 18,
            fontSize: 10,
            fontWeight: 700,
            bgcolor: 'action.hover',
            color: meta.color,
          }}
        />
      </Box>
      <Box
        ref={setNodeRef}
        sx={{
          flex: 1,
          minHeight: 200,
          p: 1,
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 360px)',
        }}
      >
        <SortableContext items={tasks.map((t) => t.id!)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onClick={onTaskClick}
              demandTitle={t.demandId != null ? demandTitleMap?.get(t.demandId) : undefined}
              onOpenDemand={onOpenDemand}
              groupNameMap={groupNameMap}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 3, color: 'text.disabled', fontSize: 11 }}>无任务</Box>
        )}
      </Box>
    </Box>
  );
}
