// 活动中心页面用到的类型定义 + 状态/类别元数据 + 工具函数。
// 注意:这里不放业务数据(活动列表/我的作品),全部从后端 /api/core/creator/* 拉。
// 真实数据接入见 ../activity/page.tsx。

export type ActivityStatus =
  | 'upcoming'
  | 'signup'
  | 'active'
  | 'judging'
  | 'ended';

export type ActivityCategory =
  | 'official'
  | 'topic'
  | 'challenge'
  | 'brand'
  | 'support';

export type ParticipationStatus =
  | 'none'
  | 'signed'
  | 'submitted'
  | 'shortlist'
  | 'won'
  | 'lost';

export type CategoryMeta = {
  label: string;
  color: string;
  bg: string;
};

export const CATEGORY_META: Record<ActivityCategory, CategoryMeta> = {
  official:  { label: '平台官方', color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.14)' },
  topic:     { label: '话题挑战', color: '#25F4EE', bg: 'rgba(37, 244, 238, 0.14)' },
  challenge: { label: '创作挑战', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.14)' },
  brand:     { label: '品牌联名', color: '#FFB400', bg: 'rgba(255, 180, 0, 0.14)' },
  support:   { label: '扶持计划', color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.14)' },
};

export type StatusMeta = {
  label: string;
  color: string;
  bg: string;
};

export const STATUS_META: Record<ActivityStatus, StatusMeta> = {
  upcoming: { label: '即将开始', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.14)' },
  signup:   { label: '报名中',   color: '#25F4EE', bg: 'rgba(37, 244, 238, 0.14)' },
  active:   { label: '进行中',   color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.14)' },
  judging:  { label: '评审中',   color: '#FFB400', bg: 'rgba(255, 180, 0, 0.14)' },
  ended:    { label: '已结束',   color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.14)' },
};

export type PartMeta = {
  label: string;
  color: string;
  bg: string;
};

export const PART_META: Record<ParticipationStatus, PartMeta> = {
  none:      { label: '未报名',   color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.14)' },
  signed:    { label: '已报名',   color: '#25F4EE', bg: 'rgba(37, 244, 238, 0.14)' },
  submitted: { label: '已投稿',   color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.14)' },
  shortlist: { label: '已入围',   color: '#FFB400', bg: 'rgba(255, 180, 0, 0.14)' },
  won:       { label: '已获奖',   color: '#FFD700', bg: 'rgba(255, 215, 0, 0.18)' },
  lost:      { label: '未获奖',   color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.14)' },
};

export interface PrizeTier {
  rank: string;
  count: number;
  reward: string;
  color: string;
}

export interface ActivitySubmission {
  id: string;
  workId: string;
  workTitle: string;
  workCover: string;
  workDuration: number;
  views: number;
  likes: number;
  votes: number;
  rank?: number;
  prize?: string;
  submittedAt: number;
}

export interface LeaderboardEntry {
  rank: number;
  creatorName: string;
  avatarColor: string;
  initials: string;
  workTitle: string;
  views: number;
  votes: number;
  isMe?: boolean;
}

export interface Activity {
  id: string;
  title: string;
  subtitle: string;
  desc: string;
  category: ActivityCategory;
  status: ActivityStatus;
  participation: ParticipationStatus;
  gradient: string;
  cover?: string;
  organizer: string;
  heat: number;
  startAt: number;
  endAt: number;
  endLabel: string;
  totalReward: string;
  totalRewardValue: number;
  rules: string[];
  requirements: string[];
  prizes: PrizeTier[];
  signupCount: number;
  submissionCount: number;
  totalViews: number;
  myWonReward?: string;
  myWonAt?: number;
  myRank?: number;
  submissions: ActivitySubmission[];
  leaderboard: LeaderboardEntry[];
}

export interface MyWork {
  id: string;
  title: string;
  cover: string;
  duration: number;
  views: number;
  likes: number;
  publishedAt: number;
  status: 'published';
  hashtags: string[];
}

export function formatBigNumber(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}w`;
  return n.toLocaleString();
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * ensureArray — 后端字段防御。
 *
 * 后端老 DTO 经常把数组字段返成 null/对象/字符串(尤其 mock 阶段),
 * 直接 `.map()` 会炸"xxx.map is not a function"。在数据入口处一次性
 * 规范化,下游所有 `.map/.some/.length` 都安全。`?? []` 只挡 null/undefined,
 * 挡不住"传成别的类型"——必须用 Array.isArray 判定。
 *
 * 用法:const rules = ensureArray<string>(a.rules);
 */
export function ensureArray<T>(x: unknown): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}


