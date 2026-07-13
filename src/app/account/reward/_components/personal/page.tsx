'use client';

/**
 * 我的工作台 — 跨团队聚合个人数据。
 *
 * 与其它 tab 的区别:这里不依赖 props.groupId(团队切换器),
 * 直接拉「当前登录用户」的所有数据,让用户一眼看到自己的全貌。
 *
 * 数据来源(全部走现成 API):
 *   - 我的积分/等级:userPointMe({ type: 'reward' })
 *   - 我的团队:listGroups({ status: AGREE })
 *   - 我的需求:listDemands({ pageSize })           // 不传 groupId -> 后端按登录用户过滤
 *   - 我的实现:listRealizations({ userId, pageSize })
 *   - 我的项目:listProjects({ pageSize })          // 同上,不传 groupId
 *   - 我的任务:listTasks({ assigneeId, claimerId }) // 任务板"我的任务"同款
 *
 * 每个面板里的"跳转到 XX 管理"按钮会把 tabKey 切到对应模块,并把
 * selectedGroupId/groupId 等状态带到对应页面,实现真正的"快速跳转"。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useApp } from '@/contexts/AppContext';
import type { GroupInfo } from '@/apis/reward-group';
import PersonalHero from './PersonalHero';
import PersonalTeamGrid from './PersonalTeamGrid';
import PersonalDemandPanel from './PersonalDemandPanel';
import PersonalRealizationPanel from './PersonalRealizationPanel';
import PersonalProjectPanel from './PersonalProjectPanel';
import PersonalTaskPanel from './PersonalTaskPanel';
import PointRecordPanel from './PointRecordPanel';

export interface PersonalWorkspaceProps {
  groups: GroupInfo[];
  selectedGroupId: number | '';
  onOpenDemandTab?: (groupId: number) => void;
  onOpenDemandDetail?: (groupId: number, demandId: number) => void;
  onOpenRealizationTab?: (groupId: number) => void;
  onOpenProjectTab?: (groupId: number) => void;
  onOpenTaskboardTab?: (groupId: number) => void;
  onOpenGroupTab?: (groupId: number) => void;
}

export default function PersonalWorkspace({
  groups,
  onOpenDemandTab,
  onOpenDemandDetail,
  onOpenRealizationTab,
  onOpenProjectTab,
  onOpenTaskboardTab,
  onOpenGroupTab,
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
      <PersonalHero groups={groups} />

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
            groups={groups}
            currentUserId={currentUserId}
            onOpenTab={onOpenDemandTab}
            onOpenDetail={onOpenDemandDetail}
          />
          <PersonalRealizationPanel
            groups={groups}
            currentUserId={currentUserId}
            onOpenTab={onOpenRealizationTab}
          />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <PersonalTeamGrid
            groups={groups}
            onOpenTeam={onOpenGroupTab}
            onOpenTaskboard={onOpenTaskboardTab}
          />
          <PersonalProjectPanel
            groups={groups}
            currentUserId={currentUserId}
            onOpenTab={onOpenProjectTab}
          />
          <PersonalTaskPanel
            currentUserId={currentUserId}
            groups={groups}
            onOpenTaskboard={onOpenTaskboardTab}
          />
          <PointRecordPanel currentUserId={currentUserId} />
        </Box>
      </Box>
    </Box>
  );
}