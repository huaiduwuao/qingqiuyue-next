// 活动中心页面用到的类型定义 + 状态/类别元数据 + 工具函数。
// 注意:这里不放业务数据(活动列表/我的作品),全部从后端 /api/core/creator/* 拉。
// 真实数据接入见 ../activity/page.tsx。

import { gradient2 } from '@/constants/gradients';

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

// 一些可重用的色板(给"我的作品"列表缺 cover 时 fallback)
export const G_RED = gradient2('#FE2C55', '#FFB400');
export const G_CYAN = gradient2('#25F4EE', '#5DF7F2');
export const G_PURPLE = gradient2('#8B5CF6', '#FE2C55');
export const G_AMBER = gradient2('#FFB400', '#FFD566');
export const G_GREEN = gradient2('#5DDB96', '#25F4EE');

export function relativeTime(ts: number, ref = Date.now()): string {
  const diff = ref - ts;
  const abs = Math.abs(diff);
  const future = diff < 0;
  const m = Math.floor(abs / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return future ? `${d} 天后` : `${d} 天前`;
  if (h > 0) return future ? `${h} 小时后` : `${h} 小时前`;
  if (m > 0) return future ? `${m} 分钟后` : `${m} 分钟前`;
  return future ? '即将' : '刚刚';
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
// ========== 网络异常兜底数据 ==========
// 正常情况 UI 全部走 useQuery 拉后端 /api/core/creator/*,这里仅在 API 失败时 fallback。
// 数据与之前的 SEED 一致,仅作为离线兜底,真实接入后会从后端拉。

export const MY_WORKS: MyWork[] = [
  { id: 'w-101', title: '618 大牌口红 5 折真香!', cover: G_RED, duration: 58, views: 124320, likes: 8420, publishedAt: Date.now() - 86400000 * 4, status: 'published', hashtags: ['#我的618', '#美妆'] },
  { id: 'w-102', title: '我的购物车清单 | 618 必买好物', cover: G_PURPLE, duration: 92, views: 86140, likes: 5210, publishedAt: Date.now() - 86400000 * 2, status: 'published', hashtags: ['#我的618', '#好物分享'] },
  { id: 'w-201', title: '给老爸的一封信 | 第一次说我爱你', cover: G_PURPLE, duration: 184, views: 482000, likes: 38120, publishedAt: Date.now() - 86400000 * 8, status: 'published', hashtags: ['#给老爸的一句话'] },
  { id: 'w-301', title: '原神 | 雷电将军舞蹈 cover', cover: G_PURPLE, duration: 184, views: 286400, likes: 24100, publishedAt: Date.now() - 86400000 * 9, status: 'published', hashtags: ['#次元壁挑战', '#原神'] },
  { id: 'w-401', title: '什么是复利?| 1 分钟搞懂', cover: G_AMBER, duration: 58, views: 48240, likes: 3810, publishedAt: Date.now() - 86400000 * 50, status: 'published', hashtags: ['#财经科普'] },
  { id: 'w-501', title: '夏日清晨咖啡馆 vlog', cover: G_CYAN, duration: 76, views: 32840, likes: 2140, publishedAt: Date.now() - 86400000 * 1, status: 'published', hashtags: ['#vlog', '#夏天'] },
  { id: 'w-502', title: '北海道 8 天 7 夜 | day1', cover: G_GREEN, duration: 142, views: 18240, likes: 1280, publishedAt: Date.now() - 86400000 * 6, status: 'published', hashtags: ['#旅行', '#日本'] },
  { id: 'w-503', title: '我家附近的早餐店 | KFC 大早餐', cover: G_AMBER, duration: 48, views: 12840, likes: 920, publishedAt: Date.now() - 86400000 * 3, status: 'published', hashtags: ['#美食探店', '#KFC'] },
];

const now = Date.now();
const day = 86400000;

export const ACTIVITIES: Activity[] = [
  { id: 'act-618', title: '618 创作激励计划', subtitle: '瓜分千万流量,最高奖 10w 现金', desc: '618 大促期间,平台投入 1000w 创作激励金 + 1 亿曝光流量。', category: 'official', status: 'active', participation: 'submitted', gradient: G_RED, organizer: '平台官方', heat: 9862, startAt: now - 6 * day, endAt: now + 12 * day, endLabel: '06/18 23:59', totalReward: '¥1000w + 1亿流量', totalRewardValue: 10000000, rules: [], requirements: ['#我的618 话题', '≥ 30 秒', '原创', '最多 5 部'], prizes: [], signupCount: 18420, submissionCount: 42810, totalViews: 286_400_000, myRank: 47, submissions: [], leaderboard: [] },
  { id: 'act-vlog', title: '夏日 vlog 挑战赛', subtitle: '记录夏天的一切,iPhone 16 Pro 等你赢', desc: '夏天有什么不一样?', category: 'challenge', status: 'signup', participation: 'signed', gradient: G_CYAN, organizer: '清秋月视频组', heat: 7241, startAt: now + 2 * day, endAt: now + 25 * day, endLabel: '07/01 23:59', totalReward: 'iPhone 16 Pro × 3', totalRewardValue: 30000, rules: [], requirements: ['#夏日vlog 话题', '1-5 分钟', '@官方账号'], prizes: [], signupCount: 4280, submissionCount: 0, totalViews: 0, submissions: [], leaderboard: [] },
  { id: 'act-father', title: '父亲节话题:#给老爸的一句话', subtitle: '说出口的话不多,记录下来就够', desc: '父亲节。', category: 'topic', status: 'active', participation: 'won', gradient: G_PURPLE, organizer: '内容运营', heat: 4128, startAt: now - 9 * day, endAt: now - 2 * day, endLabel: '06/04 已结束', totalReward: '¥30,000 + 流量包', totalRewardValue: 30000, rules: [], requirements: ['#给老爸的一句话 话题', '形式不限'], prizes: [], signupCount: 2810, submissionCount: 1820, totalViews: 18_400_000, myRank: 3, submissions: [], leaderboard: [] },
  { id: 'act-newstar', title: '新星扶持计划', subtitle: '万粉以下创作者专属流量包', desc: '专为新人创作者打造的长期扶持计划。', category: 'support', status: 'active', participation: 'signed', gradient: G_AMBER, organizer: '创作者成长营', heat: 5420, startAt: now - 90 * day, endAt: now + 365 * day, endLabel: '长期开放', totalReward: '¥5,000 起 / 月', totalRewardValue: 60000, rules: [], requirements: ['粉丝 ≤ 1w', '每月 ≥ 4 部作品', '原创内容'], prizes: [], signupCount: 12480, submissionCount: 38240, totalViews: 86_200_000, submissions: [], leaderboard: [] },
  { id: 'act-travel', title: '旅行打卡活动', subtitle: '一站一句话,留下你的旅行印象', desc: '夏季旅行旺季开启!', category: 'topic', status: 'signup', participation: 'none', gradient: G_GREEN, organizer: '旅行频道', heat: 3820, startAt: now + 5 * day, endAt: now + 38 * day, endLabel: '07/15 23:59', totalReward: '¥30,000 + 双人机票', totalRewardValue: 30000, rules: [], requirements: ['#我的旅行打卡 话题', '原创实拍', '≥ 3 张地标'], prizes: [], signupCount: 1820, submissionCount: 0, totalViews: 0, submissions: [], leaderboard: [] },
];
