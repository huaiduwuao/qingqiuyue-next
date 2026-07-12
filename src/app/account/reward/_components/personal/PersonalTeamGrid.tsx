'use client';

/**
 * 个人工作台 — 我的团队卡片
 *
 * 卡片化展示当前用户加入的所有团队,每张卡显示:
 *   - 团队名 + 简介 + 状态
 *   - 成员数(用 listGroupUsers 单独拉取,失败则显示 -)
 *   - 两个快捷按钮:查看团队详情 / 进入协作看板
 *
 * 复用父组件已经拉好的 groups(避免重复请求)。
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import GroupsIcon from '@mui/icons-material/Groups';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { alpha } from '@mui/material/styles';
import { listGroupUsers } from '@/apis/reward-group-user';
import type { GroupInfo } from '@/apis/reward-group';

interface Props {
  groups: GroupInfo[];
  onOpenTeam?: (groupId: number) => void;
  onOpenTaskboard?: (groupId: number) => void;
}

function MemberCountBadge({ groupId }: { groupId: number }) {
  const q = useQuery({
    queryKey: ['personal', 'group', groupId, 'members'],
    queryFn: () => listGroupUsers({ groupId, pageSize: 100 }).then((r: any) => {
      const data = r?.data?.list || r?.data?.records || r?.data || [];
      return Array.isArray(data) ? data.length : 0;
    }),
    placeholderData: 0,
    staleTime: 60_000,
  });

  return (
    <Chip
      size="small"
      icon={<GroupsIcon sx={{ fontSize: 12 }} />}
      label={q.isLoading ? '...' : `${q.data ?? 0} 人`}
      sx={{
        height: 20,
        fontSize: 10,
        bgcolor: 'action.hover',
        '& .MuiChip-icon': { color: 'text.secondary', ml: 0.5 },
      }}
    />
  );
}

export default function PersonalTeamGrid({ groups, onOpenTeam, onOpenTaskboard }: Props) {
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
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <GroupsIcon sx={{ fontSize: 16, color: '#F59E0B', mr: 1 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', flex: 1 }}>
          我的团队
        </Typography>
        {onOpenTeam && groups.length > 0 && (
          <Button
            size="small"
            endIcon={<ArrowForwardIosIcon sx={{ fontSize: 10 }} />}
            onClick={() => onOpenTeam(groups[0].id)}
            sx={{ minWidth: 0, color: 'text.secondary', fontSize: 11, textTransform: 'none' }}
          >
            管理
          </Button>
        )}
      </Box>

      {groups.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>
            还没有加入团队
          </Typography>
          <Typography sx={{ color: 'text.disabled', fontSize: 10, mt: 0.5 }}>
            去「团队管理」搜索并申请加入
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {groups.slice(0, 6).map((g) => (
            <Box
              key={g.id}
              sx={{
                p: 1.25,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: (theme) => alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.06 : 0.03),
                display: 'flex',
                flexDirection: 'column',
                gap: 0.75,
                transition: 'border-color .15s',
                '&:hover': { borderColor: '#F59E0B' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', flex: 1, minWidth: 0 }} noWrap>
                  {g.name}
                </Typography>
                <MemberCountBadge groupId={g.id} />
              </Box>
              {g.description && (
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>
                  {g.description}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {onOpenTeam && (
                  <Button
                    size="small"
                    startIcon={<OpenInNewIcon sx={{ fontSize: 12 }} />}
                    onClick={() => onOpenTeam(g.id)}
                    sx={{ fontSize: 10, textTransform: 'none', color: 'text.secondary', minWidth: 0, px: 1 }}
                  >
                    团队详情
                  </Button>
                )}
                {onOpenTaskboard && (
                  <Button
                    size="small"
                    startIcon={<ViewKanbanIcon sx={{ fontSize: 12 }} />}
                    onClick={() => onOpenTaskboard(g.id)}
                    sx={{ fontSize: 10, textTransform: 'none', color: '#06B6D4', minWidth: 0, px: 1 }}
                  >
                    协作看板
                  </Button>
                )}
              </Box>
            </Box>
          ))}
          {groups.length > 6 && (
            <Typography sx={{ fontSize: 10, color: 'text.disabled', textAlign: 'center', mt: 0.5 }}>
              还有 {groups.length - 6} 个团队,点击右上角「管理」查看全部
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}