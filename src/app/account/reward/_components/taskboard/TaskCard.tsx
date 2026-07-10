'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import EventIcon from '@mui/icons-material/Event';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import AssignmentIcon from '@mui/icons-material/Assignment';
import GroupsIcon from '@mui/icons-material/Groups';
import type { RewardTask, TaskPriority } from '@/beans/reward';
import { alpha } from '@mui/material/styles';

// 优先级色 — 全部跟随主题:P0 用 primary.main,P1 用 warning.main,P2 用 text.secondary
const PRIORITY_COLOR: Record<TaskPriority, { bgcolor: (t: any) => string; color: string; borderLeftColor: string; borderLeftWidth: number }> = {
  P0: { bgcolor: (t) => alpha(t.palette.primary.main, 0.18), color: 'primary.main', borderLeftColor: 'primary.main', borderLeftWidth: 3 },
  P1: { bgcolor: (t) => alpha(t.palette.warning.main, 0.18), color: 'warning.main', borderLeftColor: 'warning.main', borderLeftWidth: 3 },
  P2: { bgcolor: (t) => alpha(t.palette.text.secondary, 0.18), color: 'text.secondary', borderLeftColor: 'divider', borderLeftWidth: 3 },
};

interface Props {
  task: RewardTask;
  onClick?: (task: RewardTask) => void;
  isOverlay?: boolean;
  demandTitle?: string;
  onOpenDemand?: (demandId: number) => void;
  groupNameMap?: Map<number, string>;
}

function fmtDeadline(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const overdue = d.getTime() < now.getTime();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return { label: `${m}-${day}`, overdue };
}

export function TaskCard({ task, onClick, isOverlay, demandTitle, onOpenDemand, groupNameMap }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id!,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0.3 : 1,
    cursor: 'grab',
  };

  const pri = PRIORITY_COLOR[task.priority || 'P2'];
  const dl = fmtDeadline(task.deadline);

  return (
    <Box
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging || !onClick) return;
        e.stopPropagation();
        onClick(task);
      }}
      sx={{
        p: 1.25,
        mb: 1,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        boxShadow: isOverlay ? 4 : 'none',
        '&:hover': {
          borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)',
          bgcolor: 'action.hover',
        },
        userSelect: 'none',
        // 优先级色(从 pri 展开):左边框颜色 / 宽度
        borderLeftColor: pri.borderLeftColor,
        borderLeftWidth: pri.borderLeftWidth,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, flexWrap: 'wrap' }}>
        <Chip
          label={task.priority}
          size="small"
          sx={{
            height: 18,
            fontSize: 10,
            fontWeight: 700,
            bgcolor: pri.bgcolor,
            color: pri.color,
          }}
        />
        {dl && (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.25,
              fontSize: 10,
              color: dl.overdue ? 'primary.main' : 'text.secondary',
              fontWeight: dl.overdue ? 600 : 400,
            }}
          >
            <EventIcon sx={{ fontSize: 11 }} />
            {dl.label}
          </Box>
        )}
        {task.demandId != null && onOpenDemand && (
          <Chip
            icon={<AssignmentIcon sx={{ fontSize: '11px !important' }} />}
            label={demandTitle || `#${task.demandId}`}
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDemand(task.demandId!);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            sx={{
              height: 18,
              fontSize: 10,
              bgcolor: 'transparent',
              color: 'text.secondary',
              border: '1px solid',
              borderColor: 'divider',
              cursor: 'pointer',
              '& .MuiChip-icon': { color: 'text.secondary', ml: 0.5 },
              // 需求 chip hover — 跟随主品牌色
              '&:hover': (theme) => ({
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                borderColor: theme.palette.primary.main,
                color: theme.palette.primary.main,
              }),
            }}
          />
        )}
        {Array.isArray(task.groupIds) && task.groupIds.length > 1 && (
          <Tooltip
            title={task.groupIds.map((id) => groupNameMap?.get(id) || `团队 ${id}`).join(' / ')}
            placement="top"
          >
            <Chip
              icon={<GroupsIcon sx={{ fontSize: '11px !important' }} />}
              label={`${groupNameMap?.get(task.groupIds[0]) || `团队 ${task.groupIds[0]}`} +${task.groupIds.length - 1}`}
              size="small"
              sx={{
                height: 18,
                fontSize: 10,
                bgcolor: 'rgba(6, 182, 212, 0.12)',
                color: '#06B6D4',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                cursor: 'default',
                '& .MuiChip-icon': { color: '#06B6D4', ml: 0.5 },
              }}
            />
          </Tooltip>
        )}
      </Box>
      <Typography
        sx={{
          fontSize: 12.5,
          fontWeight: 500,
          color: dl?.overdue ? 'primary.main' : 'text.primary',
          lineHeight: 1.4,
          mb: 0.75,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {task.title}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        {task.assigneeId ? (
          <>
            <Avatar src={task.assigneeAvatar} sx={{ width: 18, height: 18, fontSize: 9 }}>
              {task.assigneeName?.[0]}
            </Avatar>
            <Typography sx={{ fontSize: 11, color: 'text.tertiary' }} noWrap>
              {task.assigneeName}
            </Typography>
          </>
        ) : (
          <>
            <Box
              sx={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                border: '1px dashed',
                borderColor: (theme) => theme.palette.mode === 'dark' ? '#5A5E72' : '#D1D5DB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PersonAddIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
            </Box>
            <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>待认领</Typography>
          </>
        )}
      </Box>
    </Box>
  );
}
