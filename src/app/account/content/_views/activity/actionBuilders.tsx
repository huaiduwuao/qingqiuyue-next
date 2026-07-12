// 活动页 - 主操作按钮构造器(包含 JSX,必须 .tsx)
// 拆出来让 helpers.ts 可以保持纯 TS,避免 webpack 解析 ./helpers 时
// 命中 helpers.ts 失败后放弃兜底 .tsx 的解析顺序问题。

import React from 'react';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import type { Activity } from './data';

export interface PrimaryAction {
  label: string;
  kind: 'signup' | 'submit' | 'view';
  icon: React.ReactElement;
  variant: 'contained' | 'outlined';
  color: string;
  disabled?: boolean;
}

/**
 * 卡片/Drawer 底部主按钮:根据参与状态 + 活动状态判定。
 */
export function getPrimaryAction(a: Activity): PrimaryAction {
  if (a.participation === 'won') {
    return {
      label: '查看获奖详情',
      kind: 'view',
      icon: <WorkspacePremiumRoundedIcon sx={{ fontSize: 14 }} />,
      variant: 'contained',
      color: '#FFD700',
    };
  }
  if (a.status === 'ended' || a.status === 'judging') {
    return {
      label: a.status === 'judging' ? '评审中,等待公示' : '查看活动结果',
      kind: 'view',
      icon: <AutorenewRoundedIcon sx={{ fontSize: 14 }} />,
      variant: 'outlined',
      color: '#9CA3AF',
      disabled: a.status === 'judging',
    };
  }
  if (a.status === 'upcoming') {
    return {
      label: '即将开始,敬请期待',
      kind: 'view',
      icon: <ScheduleRoundedIcon sx={{ fontSize: 14 }} />,
      variant: 'outlined',
      color: '#8B5CF6',
      disabled: true,
    };
  }
  if (a.participation === 'none') {
    return {
      label: '立即报名',
      kind: 'signup',
      icon: <HowToRegRoundedIcon sx={{ fontSize: 14 }} />,
      variant: 'contained',
      color: '#FE2C55',
    };
  }
  if (a.status === 'active') {
    return {
      label: a.submissions.length === 0 ? '投稿作品' : '继续投稿',
      kind: 'submit',
      icon: <UploadFileRoundedIcon sx={{ fontSize: 14 }} />,
      variant: 'contained',
      color: '#FE2C55',
    };
  }
  return {
    label: '查看详情',
    kind: 'view',
    icon: <VisibilityRoundedIcon sx={{ fontSize: 14 }} />,
    variant: 'outlined',
    color: 'text.secondary',
  };
}