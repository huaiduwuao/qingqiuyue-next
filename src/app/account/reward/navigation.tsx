import React from 'react';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import ViewKanbanRoundedIcon from '@mui/icons-material/ViewKanbanRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import type { WorkspaceNavGroup } from '../components/WorkspaceShell';

/**
 * 奖励中心的信息架构。此前 11 个入口平铺在一起,编号 1-11,两类完全不同的东西混在一处:
 *   - 悬赏协作:发需求 → 出意境 → 交实现 → 验收结算,按团队组织;
 *   - 赚取奖励:每日任务、邀请、会员福利、成就 —— 个人激励,和团队无关
 *     (但原来的团队切换器在这些页面上也会出现)。
 * 成就页面有实现却不在菜单里。现在按两组组织,子页面 id 同时是 URL 上的 ?tab=。
 */

export const REWARD_HOME_TAB = 'square';

export const REWARD_NAV: WorkspaceNavGroup[] = [
  {
    id: 'bounty',
    title: '悬赏协作',
    items: [
      { id: 'square', label: '赏金广场', description: '浏览并承接公开悬赏', icon: <HomeRoundedIcon /> },
      { id: 'workspace', label: '我的工作台', description: '我参与的需求、任务与团队', icon: <DashboardRoundedIcon /> },
      { id: 'demands', label: '需求', description: '发布悬赏需求并验收交付', icon: <AssignmentRoundedIcon /> },
      { id: 'conceptions', label: '意境', description: '为需求提交创意方案', icon: <AutoAwesomeRoundedIcon /> },
      { id: 'realizations', label: '实现', description: '提交需求的最终交付物', icon: <HandshakeRoundedIcon /> },
      { id: 'projects', label: '项目', description: '把多个需求组织成项目', icon: <FolderRoundedIcon /> },
      { id: 'board', label: '协作看板', description: '按状态推进团队任务', icon: <ViewKanbanRoundedIcon /> },
      { id: 'teams', label: '团队', description: '创建团队并邀请成员', icon: <GroupsRoundedIcon /> },
    ],
  },
  {
    id: 'earn',
    title: '赚取奖励',
    items: [
      { id: 'tasks', label: '任务中心', description: '完成每日任务领取积分', icon: <CheckCircleRoundedIcon /> },
      { id: 'invite', label: '邀请好友', description: '好友注册,双方都得奖励', icon: <PeopleRoundedIcon /> },
      { id: 'benefit', label: '会员福利', description: 'VIP 每月发放钻石', icon: <DiamondRoundedIcon /> },
      { id: 'achievements', label: '成就', description: '解锁成就领取积分', icon: <EmojiEventsRoundedIcon /> },
    ],
  },
];

export const REWARD_TAB_IDS: ReadonlySet<string> = new Set(REWARD_NAV.flatMap((g) => g.items.map((i) => i.id)));

/** 数据按团队隔离、需要团队切换器的子页面。 */
export const TEAM_SCOPED_TABS: ReadonlySet<string> = new Set(['demands', 'conceptions', 'realizations', 'projects']);
