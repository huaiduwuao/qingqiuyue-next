'use client';

/**
 * 我的工作台 —— 当前登录用户在悬赏协作里的全貌:
 * 我发布的需求、我交付的实现、我所在的团队、我认领的任务、积分流水。
 * 每个面板的"全部"按钮切到对应的子页面。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useApp } from '@/contexts/AppContext';
import PersonalHero from './PersonalHero';
import PersonalTeamGrid from './PersonalTeamGrid';
import PersonalDemandPanel from './PersonalDemandPanel';
import PersonalRealizationPanel from './PersonalRealizationPanel';
import PersonalTaskPanel from './PersonalTaskPanel';
import PointRecordPanel from './PointRecordPanel';

export interface PersonalWorkspaceProps {
  onOpenDemandTab?: () => void;
  onOpenDemandDetail?: (demandId: number) => void;
  onOpenRealizationTab?: () => void;
  onOpenTaskboardTab?: (teamId?: number) => void;
  onOpenTeamTab?: (teamId?: number) => void;
}

export default function PersonalWorkspace({
  onOpenDemandTab,
  onOpenDemandDetail,
  onOpenRealizationTab,
  onOpenTaskboardTab,
  onOpenTeamTab,
}: PersonalWorkspaceProps) {
  const { currentUser } = useApp();
  const currentUserId = currentUser?.id ?? null;

  if (!currentUserId) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
          请先登录后查看个人工作台
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <PersonalHero />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(0, 1fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <PersonalDemandPanel
            currentUserId={currentUserId}
            onOpenTab={onOpenDemandTab}
            onOpenDetail={onOpenDemandDetail}
          />
          <PersonalRealizationPanel
            currentUserId={currentUserId}
            onOpenTab={onOpenRealizationTab}
          />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <PersonalTeamGrid onOpenTeam={onOpenTeamTab} onOpenTaskboard={onOpenTaskboardTab} />
          <PersonalTaskPanel
            currentUserId={currentUserId}
            onOpenTaskboard={onOpenTaskboardTab}
          />
          <PointRecordPanel currentUserId={currentUserId} />
        </Box>
      </Box>
    </Box>
  );
}