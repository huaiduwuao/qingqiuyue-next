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

const PRIORITY_COLOR: Record<TaskPriority, { bg: string; fg: string; border: string }> = {
  P0: { bg: 'rgba(254, 44, 85, 0.18)', fg: 'primary.main', border: 'primary.main' },
  P1: { bg: 'rgba(255, 180, 0, 0.18)', fg: 'warning.main', border: 'warning.main' },
  P2: { bg: 'rgba(139, 143, 163, 0.18)', fg: 'text.secondary', border: '#3A3D4D' },
};

interface Props {
  task: RewardTask;
  onClick: (task: RewardTask) => void;
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
        if (isDragging) return;
        e.stopPropagation();
        onClick(task);
      }}
      sx={{
        p: 1.25,
        mb: 1,
        bgcolor: '#1C1F2A',
        border: '1px solid #252836',
        borderLeft: `3px solid ${pri.border}`,
        borderRadius: 1.5,
        boxShadow: isOverlay ? 4 : 'none',
        '&:hover': { borderColor: '#3A3D4D', bgcolor: '#21243A' },
        userSelect: 'none',
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
            bgcolor: pri.bg,
            color: pri.fg,
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
              border: '1px solid #3A3D4D',
              cursor: 'pointer',
              '& .MuiChip-icon': { color: 'text.secondary', ml: 0.5 },
              '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.12)', borderColor: '#8B5CF6', color: '#8B5CF6' },
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
          color: dl?.overdue ? 'primary.main' : '#E5E7EB',
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
                border: '1px dashed #5A5E72',
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
