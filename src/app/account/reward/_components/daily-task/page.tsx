'use client';

/**
 * 每日任务页面
 * 展示每日可完成的任务,完成后领取积分奖励
 */

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import CommentOutlinedIcon from '@mui/icons-material/CommentOutlined';
import StarIcon from '@mui/icons-material/Star';
import { alpha } from '@mui/material/styles';
import { useApp } from '@/contexts/AppContext';
import {
  getDailyTaskList,
  getDailyTaskStats,
  completeDailyTask,
  DailyTask,
  DailyTaskStats,
} from '@/apis/reward-center';
import { getWalletSummary } from '@/apis/reward-center';

// 任务图标映射
const TASK_ICONS: Record<string, React.ReactNode> = {
  watch: <PlayCircleIcon />,
  like: <ThumbUpAltOutlinedIcon />,
  share: <ShareOutlinedIcon />,
  comment: <CommentOutlinedIcon />,
  sign: <AccessTimeIcon />,
  default: <StarIcon />,
};

export default function DailyTaskPage() {
  const { currentUser } = useApp();
  const currentUserId = currentUser?.id ?? 0;
  const qc = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['reward-center', 'daily-task-stats', currentUserId],
    queryFn: () => getDailyTaskStats(),
    enabled: !!currentUserId,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['reward-center', 'daily-tasks', currentUserId],
    queryFn: () => getDailyTaskList(),
    enabled: !!currentUserId,
    refetchOnMount: 'always',
  });

  const completeMutation = useMutation({
    mutationFn: (taskType: string) => completeDailyTask(taskType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reward-center', 'daily-tasks'] });
      qc.invalidateQueries({ queryKey: ['reward-center', 'daily-task-stats'] });
      qc.invalidateQueries({ queryKey: ['reward-center', 'wallet-summary'] });
    },
  });

  const handleComplete = (taskType: string) => {
    completeMutation.mutate(taskType);
  };

  if (!currentUserId) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ color: 'text.secondary' }}>请先登录后查看任务</Typography>
      </Box>
    );
  }

  if (tasksLoading || statsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const completedCount = tasks.filter(t => t.claimed).length;
  const progressPercent = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* 任务概览 */}
      <Card sx={{
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.16)} 0%, ${alpha(theme.palette.primary.main, 0.12)} 100%)`
            : `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.06)} 100%)`,
        border: '1px solid',
        borderColor: (theme) => alpha(theme.palette.success.main, 0.3),
      }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha('#4CAF50', 0.15),
              color: 'success.main',
            }}>
              <CheckCircleIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                今日任务
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                已完成 {completedCount} / {tasks.length} 个任务
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                +{stats?.totalReward ?? 0}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                积分
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <LinearProgress
                variant="determinate"
                value={progressPercent}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    background: 'linear-gradient(90deg, #4CAF50 0%, #8BC34A 100%)',
                    borderRadius: 4,
                  },
                }}
              />
            </Box>
            <Typography sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'success.main' }}>
              {progressPercent.toFixed(0)}%
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* 任务列表 */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {tasks.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography sx={{ color: 'text.secondary' }}>今日暂无任务</Typography>
          </Box>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.taskType}
              task={task}
              onComplete={handleComplete}
              isLoading={completeMutation.isPending && completeMutation.variables === task.taskType}
            />
          ))
        )}
      </Box>
    </Box>
  );
}

interface TaskCardProps {
  task: DailyTask;
  onComplete: (taskType: string) => void;
  isLoading: boolean;
}

function TaskCard({ task, onComplete, isLoading }: TaskCardProps) {
  const icon = TASK_ICONS[task.taskType.toLowerCase()] || TASK_ICONS.default;
  const canClaim = !task.claimed && task.canClaim;

  return (
    <Card
      variant="outlined"
      sx={{
        opacity: task.claimed ? 0.7 : 1,
        transition: 'all 0.2s',
        '&:hover': { boxShadow: 2 },
      }}
    >
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* 图标 */}
          <Box sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: task.claimed
              ? alpha('#9E9E9E', 0.15)
              : alpha('#2196F3', 0.12),
            color: task.claimed ? 'text.disabled' : 'primary.main',
          }}>
            {icon}
          </Box>

          {/* 任务信息 */}
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
                {task.name}
              </Typography>
              {task.claimed && (
                <Chip
                  icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                  label="已完成"
                  size="small"
                  sx={{
                    height: 20,
                    bgcolor: alpha('#4CAF50', 0.15),
                    color: '#4CAF50',
                    '& .MuiChip-icon': { color: '#4CAF50' },
                  }}
                />
              )}
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12 }}>
              {task.description}
            </Typography>
          </Box>

          {/* 奖励和操作 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontWeight: 700, color: 'success.main', fontSize: 14 }}>
                +{task.rewardPoint}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                积分
              </Typography>
            </Box>

            {task.claimed ? (
              <Button variant="outlined" size="small" disabled sx={{ minWidth: 80 }}>
                已领取
              </Button>
            ) : (
              <Button
                variant="contained"
                size="small"
                disabled={!canClaim || isLoading}
                onClick={() => onComplete(task.taskType)}
                sx={{ minWidth: 80 }}
              >
                {isLoading ? '领取中...' : '领取'}
              </Button>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
