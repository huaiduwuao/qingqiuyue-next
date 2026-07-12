'use client';

/**
 * 个人工作台 — 顶部 KPI 横条
 *
 * 用 react-query 并行拉 4 个计数(团队/需求/实现/任务),与积分卡片并排展示。
 * 计数都取 totalRow,最多拉前 200 条做粗略统计;后续如要精确可改用专门的
 * count 接口(若后端提供)。
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import { alpha } from '@mui/material/styles';
import GroupsIcon from '@mui/icons-material/Groups';
import FolderIcon from '@mui/icons-material/Folder';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HandshakeIcon from '@mui/icons-material/Handshake';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { userPointMe } from '@/apis/global';
import { listGroups } from '@/apis/reward-group';
import { listDemands } from '@/apis/reward-demand';
import { listProjects } from '@/apis/reward-project';
import { listRealizations } from '@/apis/reward-realization';
import { listTasks } from '@/apis/reward-task';
import { mapRewardTaskListFromBackend } from '../taskboard/status';
import { useApp } from '@/contexts/AppContext';
import type { GroupInfo } from '@/apis/reward-group';

interface Props {
  groups: GroupInfo[];
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  loading?: boolean;
}

function KpiCard({ icon, label, value, color, loading }: KpiCardProps) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 120,
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        transition: 'border-color .15s',
        '&:hover': { borderColor: alpha(color, 0.5) },
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1,
          bgcolor: alpha(color, 0.12),
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 10, color: 'text.secondary', lineHeight: 1.1 }} noWrap>
          {label}
        </Typography>
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary', fontFamily: 'monospace', lineHeight: 1.2 }}>
          {loading ? '—' : value}
        </Typography>
      </Box>
    </Box>
  );
}

export default function PersonalHero({ groups }: Props) {
  const { currentUser } = useApp();
  const currentUserId = currentUser?.id ?? 0;

  // 积分(赏金类型)
  const pointQuery = useQuery({
    queryKey: ['personal', 'point', 'me'],
    queryFn: () => userPointMe({ type: 'reward' }).then((r: any) => r.data || {}),
    placeholderData: {},
  });
  const myPoint: any = pointQuery.data || {};
  const totalPoint = Number(myPoint.totalPoint || 0);
  const level = Number(myPoint.level || 0);
  const levelName = myPoint.levelName || '赏金新手';
  const needPoint = Number(myPoint.needPoint || 0);
  const progressTarget = totalPoint + needPoint;
  const progressPercent = progressTarget > 0 ? (totalPoint / progressTarget) * 100 : 0;

  // 团队数:取 props.groups 长度(父组件已拉过,不重复请求)
  const groupsCount = groups.length;

  // 我的需求(不传 groupId -> 后端按当前用户过滤)
  const demandsCountQuery = useQuery({
    queryKey: ['personal', 'demands', 'count', currentUserId],
    queryFn: () => listDemands({ pageSize: 1 }).then((r: any) => r.data?.totalRow || 0),
    enabled: !!currentUserId,
    placeholderData: 0,
  });

  // 我的项目
  const projectsCountQuery = useQuery({
    queryKey: ['personal', 'projects', 'count', currentUserId],
    queryFn: () => listProjects({ pageSize: 1 }).then((r: any) => r.data?.totalRow || 0),
    enabled: !!currentUserId,
    placeholderData: 0,
  });

  // 我的实现(显式传 userId)
  const realizationsCountQuery = useQuery({
    queryKey: ['personal', 'realizations', 'count', currentUserId],
    queryFn: () => listRealizations({ userId: currentUserId, pageSize: 1 }).then((r: any) => r.data?.totalRow || 0),
    enabled: !!currentUserId,
    placeholderData: 0,
  });

  // 我的待办(assigneeId + claimerId 双发,与 taskboard 'mine' 模式同款)
  const myTasksQuery = useQuery({
    queryKey: ['personal', 'tasks', 'mine', currentUserId],
    queryFn: () =>
      listTasks({ assigneeId: currentUserId, claimerId: currentUserId, pageSize: 1 } as any).then(
        (r: any) => r?.data?.totalRow || 0
      ),
    enabled: !!currentUserId,
    placeholderData: 0,
  });

  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, ${alpha(theme.palette.secondary.main, 0.12)} 100%)`
            : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.secondary.main, 0.06)} 100%)`,
        border: '1px solid',
        borderColor: (theme) => alpha(theme.palette.primary.main, 0.18),
        p: { xs: 2, md: 2.5 },
      }}
    >
      {/* 左上:头像 + 欢迎语 + 等级进度 */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2.5, alignItems: { md: 'center' } }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
            <CardGiftcardIcon sx={{ fontSize: 16, color: 'primary.main' }} />
            <Typography sx={{ fontSize: 11, color: 'text.secondary', letterSpacing: 1 }}>我的工作台</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary' }}>
              {currentUser?.nickname || currentUser?.name || '我'}
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{levelName}</Typography>
            <Box
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: 1,
                background: (theme) => `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.warning.main} 100%)`,
                color: (theme) => theme.palette.primary.contrastText,
                fontSize: 10,
                fontWeight: 700,
                fontFamily: 'monospace',
              }}
            >
              Lv {level}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <Box sx={{ flex: 1, maxWidth: 280 }}>
              <LinearProgress
                variant="determinate"
                value={progressPercent}
                sx={{
                  height: 5,
                  borderRadius: 3,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    background: (theme) => `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.warning.main} 100%)`,
                    borderRadius: 3,
                  },
                }}
              />
            </Box>
            <Typography sx={{ fontSize: 10, color: 'text.secondary', fontFamily: 'monospace' }}>
              {totalPoint.toLocaleString()} / {progressTarget.toLocaleString()}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.5 }}>
            距离 Lv {level + 1} 还需 <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>{needPoint.toLocaleString()}</Box> 灵气
          </Typography>
        </Box>

        {/* 右下:KPI 卡片栅格 */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', flexShrink: 0 }}>
          <KpiCard
            icon={<GroupsIcon sx={{ fontSize: 18 }} />}
            label="我的团队"
            value={groupsCount}
            color="#F59E0B"
          />
          <KpiCard
            icon={<FolderIcon sx={{ fontSize: 18 }} />}
            label="我的项目"
            value={projectsCountQuery.data ?? 0}
            color="#8B5CF6"
            loading={projectsCountQuery.isLoading}
          />
          <KpiCard
            icon={<AssignmentIcon sx={{ fontSize: 18 }} />}
            label="我的需求"
            value={demandsCountQuery.data ?? 0}
            color="#FFB400"
            loading={demandsCountQuery.isLoading}
          />
          <KpiCard
            icon={<HandshakeIcon sx={{ fontSize: 18 }} />}
            label="我的实现"
            value={realizationsCountQuery.data ?? 0}
            color="#25F4EE"
            loading={realizationsCountQuery.isLoading}
          />
          <KpiCard
            icon={<ViewKanbanIcon sx={{ fontSize: 18 }} />}
            label="我的任务"
            value={myTasksQuery.data ?? 0}
            color="#06B6D4"
            loading={myTasksQuery.isLoading}
          />
        </Box>
      </Box>

      {/* 底部:快捷入口 */}
      <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <EmojiEventsIcon sx={{ fontSize: 12, color: 'warning.main' }} />
        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
          点击右侧各面板标题旁的 → 按钮可一键跳到对应管理模块
        </Typography>
      </Box>
    </Box>
  );
}