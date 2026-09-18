'use client';

/** 我的工作台 · 我的团队:我在队的团队、我的角色与份额、战绩;点开进团队主页,或直接看团队任务。 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import GroupsIcon from '@mui/icons-material/Groups';
import { myTeams, yuan } from '@/apis/team';

const ROLE_LABEL: Record<string, string> = { owner: '队长', admin: '管理员', member: '成员' };

interface Props {
  onOpenTeam?: (teamId?: number) => void;
  onOpenTaskboard?: (teamId?: number) => void;
}

export default function PersonalTeamGrid({ onOpenTeam, onOpenTaskboard }: Props) {
  const query = useQuery({ queryKey: ['team', 'mine'], queryFn: () => myTeams().then((r) => r.list || []) });
  const teams = query.data || [];
  const invites = teams.filter((t) => t.myStatus === 'invited').length;

  return (
    <Box sx={{ p: 2, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
        <GroupsIcon sx={{ fontSize: 18, color: 'warning.main' }} />
        <Typography sx={{ fontSize: 14, fontWeight: 700, flex: 1 }}>我的团队</Typography>
        {invites > 0 && <Chip size="small" color="warning" label={`${invites} 个邀请`} onClick={() => onOpenTeam?.()} />}
        <Button size="small" variant="text" sx={{ textTransform: 'none' }} onClick={() => onOpenTeam?.()}>
          全部
        </Button>
      </Box>
      {teams.filter((t) => t.myStatus === 'active').length === 0 ? (
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
          还没有加入团队。结队可以一起认领任务,赏金按份额分。
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {teams
            .filter((t) => t.myStatus === 'active')
            .map((t) => (
              <Box
                key={t.id}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, border: 1, borderColor: 'divider', minWidth: 0 }}
              >
                <Box sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onOpenTeam?.(t.id)}>
                  <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>
                    {t.name}
                  </Typography>
                  <Typography noWrap sx={{ fontSize: 11.5, color: 'text.secondary' }}>
                    {ROLE_LABEL[t.myRole]} · 份额 {t.myShare} · {t.memberCount} 人 · 交付 {t.realizedCount} · ¥{yuan(t.earnedCents)}
                  </Typography>
                </Box>
                <Button size="small" variant="text" sx={{ textTransform: 'none', flexShrink: 0 }} onClick={() => onOpenTaskboard?.(t.id)}>
                  任务
                </Button>
              </Box>
            ))}
        </Box>
      )}
    </Box>
  );
}
