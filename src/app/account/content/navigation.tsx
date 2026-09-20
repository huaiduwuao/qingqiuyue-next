import React from 'react';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import PublishRoundedIcon from '@mui/icons-material/PublishRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import VideoLibraryRoundedIcon from '@mui/icons-material/VideoLibraryRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import MonetizationOnRoundedIcon from '@mui/icons-material/MonetizationOnRounded';
import CopyrightRoundedIcon from '@mui/icons-material/CopyrightRounded';
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
import { useAuthority } from '@/contexts/AuthContext';
import type { WorkspaceNavGroup } from '../components/WorkspaceShell';

/**
 * 创作者中心的信息架构:按创作者的成长路径分组 —— 创作 → 增长 → 变现,
 * 运营人员额外有「管理」。每个入口带一句说明,新创作者不用逐个点开猜用途。
 *
 * 子页面 id 同时是 URL 上的 ?tab= 取值,改名要保留兼容映射(CONTENT_TAB_ALIASES)。
 */

export const CONTENT_HOME_TAB = 'content';

/** 可以看到审核工作台、直接发布的角色(与后端 middleware.HasContentStaffRole 一致)。 */
export const CONTENT_STAFF_ROLES = ['AUDITOR', 'OPERATOR', 'ADMIN', 'SUPER_ADMIN'];

interface ContentNavGroup extends WorkspaceNavGroup {
  staffOnly?: boolean;
}

export const CONTENT_NAV: ContentNavGroup[] = [
  {
    id: 'home',
    items: [{ id: CONTENT_HOME_TAB, label: '工作台', description: '新手指引与今日概览', icon: <DashboardRoundedIcon /> }],
  },
  {
    id: 'create',
    title: '创作',
    items: [
      { id: 'hd-publish', label: '发布作品', description: '视频、图文、小说等 13 种类型', icon: <PublishRoundedIcon /> },
      { id: 'works', label: '作品管理', description: '草稿、审核状态与单篇数据', icon: <MovieRoundedIcon /> },
      { id: 'collection', label: '合集', description: '把作品编排成系列与专辑', icon: <CollectionsRoundedIcon /> },
      { id: 'shortdrama-gen', label: 'AI 短剧生成', description: '从剧本到成片的生成工作流', icon: <VideoLibraryRoundedIcon /> },
    ],
  },
  {
    id: 'grow',
    title: '增长',
    items: [
      { id: 'data', label: '数据中心', description: '播放、互动与粉丝画像', icon: <InsightsRoundedIcon /> },
      { id: 'activity', label: '活动与话题', description: '参加平台活动获取曝光', icon: <EventRoundedIcon /> },
      { id: 'creator', label: '等级与权益', description: '升级解锁更多创作特权', icon: <EmojiEventsRoundedIcon /> },
      { id: 'accounts', label: '平台账号', description: '绑定你自己的抖音/快手/小红书开放平台账号', icon: <HubRoundedIcon /> },
      { id: 'share', label: '分发记录', description: '一键分享到抖音/快手的发布历史与状态', icon: <ShareRoundedIcon /> },
    ],
  },
  {
    id: 'earn',
    title: '变现',
    items: [
      { id: 'monetize', label: '收益中心', description: '付费作品、打赏收入与提现', icon: <MonetizationOnRoundedIcon /> },
      { id: 'original', label: '原创保护', description: '原创声明与侵权处理', icon: <CopyrightRoundedIcon /> },
    ],
  },
  {
    id: 'manage',
    title: '管理',
    staffOnly: true,
    items: [{ id: 'hd-review', label: '审核工作台', description: '处理创作者提交的内容', icon: <RateReviewRoundedIcon /> }],
  },
];

export const CONTENT_TAB_IDS: ReadonlySet<string> = new Set(CONTENT_NAV.flatMap((g) => g.items.map((i) => i.id)));

export const STAFF_TAB_IDS: ReadonlySet<string> = new Set(
  CONTENT_NAV.filter((g) => g.staffOnly).flatMap((g) => g.items.map((i) => i.id)),
);

/** 旧的按类型发布入口(image-publish 等)统一到发布页。 */
export const CONTENT_TAB_ALIASES: Readonly<Record<string, string>> = Object.fromEntries(
  ['image', 'image-mv', 'article', 'novel', 'news', 'music', 'comics', 'vshow', 'teleplay', 'film', 'animation', 'live'].map(
    (t) => [`${t}-publish`, 'hd-publish'],
  ),
);

/** 当前用户可见的导航。 */
export function contentNavFor(isStaff: boolean): WorkspaceNavGroup[] {
  return CONTENT_NAV.filter((g) => !g.staffOnly || isStaff);
}

/** 当前用户是否为内容运营人员(审核员 / 运营 / 管理员)。 */
export function useIsContentStaff(): boolean {
  const { hasAuthority } = useAuthority();
  return CONTENT_STAFF_ROLES.some((role) => hasAuthority(role));
}
