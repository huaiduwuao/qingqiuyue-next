import React from 'react';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import ViewKanbanRoundedIcon from '@mui/icons-material/ViewKanbanRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import type { WorkspaceNavGroup } from '../components/WorkspaceShell';

/**
 * 奖励中心的信息架构。两类东西分两组:
 *   - 悬赏协作:意境里提需求 → 个人或团队认领、交付 → 验收通过成为一条「实现」→ 结账分账;
 *   - 赚取奖励:每日任务、邀请、会员福利、成就 —— 个人激励。
 *
 * 这里以前还有「意境」「项目」两个入口和一个"当前团队"切换器,都来自模板:那几张表没有归属、没有钱、
 * 彼此也不相连,而且需求页要求先选团队才肯列出我的需求。意境现在就是内容社区里的意境(/topic),
 * 需求可以发在意境里;项目没有对应的真实概念,删掉了。子页面 id 同时是 URL 上的 ?tab=。
 */

export const REWARD_HOME_TAB = 'square';

export const REWARD_NAV: WorkspaceNavGroup[] = [
  {
    id: 'bounty',
    title: '悬赏协作',
    items: [
      { id: 'square', label: '赏金广场', description: '浏览并承接公开悬赏', icon: <HomeRoundedIcon /> },
      { id: 'workspace', label: '我的工作台', description: '我发布的需求、认领的任务、所在的团队', icon: <DashboardRoundedIcon /> },
      { id: 'demands', label: '我的需求', description: '发布悬赏需求、验收交付、结账', icon: <AssignmentRoundedIcon /> },
      { id: 'board', label: '任务看板', description: '我认领的、我发布的、团队认领的任务', icon: <ViewKanbanRoundedIcon /> },
      { id: 'realizations', label: '实现', description: '验收通过的交付与分到的赏金', icon: <HandshakeRoundedIcon /> },
      { id: 'teams', label: '团队', description: '结队接需求,按份额分账', icon: <GroupsRoundedIcon /> },
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

