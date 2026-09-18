/**
 * Dashboard 端 API —— 创作者中心、个人中心、活动中心、悬赏、VIP、直播礼物 等。
 * 之前都散落在前端 SEED/MY_WORKS/HOT_BOUNTIES 等常量里,现在统一从后端拉。
 * 后端实现见 qingqiuyue-go/internal/handler/dashboard_handler.go。
 *
 * 注:axios 拦截器统一包成 {code, msg, data},这里每个 API 都通过 unwrap() 拆出真正的 data。
 */
import { accountClient, adminClient } from '@/lib/api/client';
import { DemandItem } from '@/beans/reward';
import { gradient2 } from '@/constants/gradients';
import { ACCENT } from '@/constants/accents';
import type { PageParams, PageResult } from '@/beans/pagination';
import { normalizeLegacyPageResponse } from '@/hooks/usePagination';

/** 解开 axios 拦截器的包装层,拿到真正的后端 body */
function unwrap<T = any>(resp: any): T {
  if (!resp) return resp as T;
  const body = resp?.data ?? resp;
  if (body && typeof body === 'object' && 'code' in body && 'data' in body) {
    return body.data as T;
  }
  return body as T;
}

// 我的订单见 apis/payment.ts(GET /payment/orders)。
export interface PageData<T> { list: T[]; records?: T[]; total?: number; totalRow?: number; page?: number; size?: number }

export interface WipItem {
  id: string;
  title: string;
  type: string;
  progress: number;
  stage: 'draft' | 'transcoding' | 'reviewing';
  updatedAt: number;
  cover: string;
}
export async function getCreatorWipList(params?: PageParams): Promise<PageResult<WipItem>> {
  const res = await unwrap<PageData<WipItem>>(await accountClient('/creator/wip/list', { params }));
  return normalizeLegacyPageResponse(res as any);
}

// 合集(作品合集)不在这里:真实表是 PG 的 user_my_list,读写走 apis/my-list.ts
// (/api/content/my-list/*)。以前这里有个 getCollectionList() 请求
// /creator/collection/list,那个端点读的是 Doris user_content_collect 的 ref_id
// 分组,存不下合集的标题/封面/简介,已随 handler 一起删掉。

export interface HdVideo {
  id: string;
  title: string;
  cover: string;
  resolution: '4K' | '2K' | '1080P' | '720P';
  fps: number;
  hdr: boolean;
  duration: string;
  sizeMB: number;
  status: 'transcoding' | 'reviewing' | 'review_failed' | 'published' | 'failed' | 'scheduled';
  progress?: number;
  uploadedAt: number;
  views?: number;
  likes?: number;
  hasCover: boolean;
  review?: any;
  subtitles?: any[];
  audioTracks?: any[];
  failedReason?: string;
  failedStage?: 'transcode' | 'review';
  scheduledAt?: number;
  publishedAt?: number;
}
export async function getHdVideoList(params?: PageParams): Promise<PageResult<HdVideo>> {
  const res = await unwrap<PageData<HdVideo>>(await accountClient('/creator/hd/videos', { params }));
  return normalizeLegacyPageResponse(res as any);
}

export interface Reviewer {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  team: string;
  level: 1 | 2 | 3;
  title: string;
  reviewCount: number;
  passRate: number;
  online: boolean;
  currentLoad: number;
  maxLoad: number;
  specialties: string[];
}
export async function getReviewerList() {
  return unwrap<PageData<Reviewer>>(await accountClient('/creator/hd/reviewers'));
}

export interface Activity {
  id: string;
  title: string;
  subtitle: string;
  desc: string;
  category: 'official' | 'topic' | 'challenge' | 'brand' | 'support';
  status: 'upcoming' | 'signup' | 'active' | 'judging' | 'ended';
  participation: 'none' | 'signed' | 'submitted' | 'shortlist' | 'won' | 'lost';
  gradient: string;
  organizer: string;
  heat: number;
  startAt: number;
  endAt: number;
  endLabel: string;
  totalReward: string;
  totalRewardValue: number;
  rules: string[];
  requirements: string[];
  prizes: { rank: string; count: number; reward: string; color: string }[];
  signupCount: number;
  submissionCount: number;
  totalViews: number;
  myWonReward?: string;
  myWonAt?: number;
  myRank?: number;
  submissions?: any[];
  leaderboard?: any[];
}
export async function getActivityList(params?: { category?: string; status?: string }): Promise<PageResult<Activity>> {
  const res = await unwrap<PageData<Activity>>(await accountClient('/creator/activity/list', { params }));
  return normalizeLegacyPageResponse(res as any);
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
export async function getMyWorks() {
  return unwrap<PageData<MyWork>>(await accountClient('/creator/my/works'));
}

export interface Bounty {
  id: string;
  title: string;
  category: string;
  /** 总赏金(分) */
  reward: number;
  /** 认领过任务的人数 */
  applicants: number;
  /** 距截止的天数;null 表示发布者没有设截止时间 */
  daysLeft: number | null;
  sponsor: string;
  sponsorAvatar?: string;
  sponsorId?: number;
  gradient: string;
  cover?: string;
  subtitle?: string;
  content?: string;
  status?: string;
  endTime?: string;
  openTaskCount?: number;
  totalTaskCount?: number;
  /** 发布时托管、尚未发出的赏金(分) */
  escrowCents?: number;
}

/** 赏金广场:所有人进行中的需求(demand/client/page?scope=market)。 */
export async function getHotBounties(params?: PageParams & {
  limit?: number;
  category?: string;
  keyword?: string;
  order?: 'reward' | 'deadline' | 'hot' | 'newest';
}): Promise<PageResult<Bounty>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? params?.limit ?? 6;
  const demandParams: Record<string, unknown> = { page, pageSize, scope: 'market' };
  if (params?.category) demandParams.category = params.category;
  if (params?.keyword) demandParams.keyword = params.keyword;
  if (params?.order) demandParams.order = params.order;
  const resp = unwrap<PageData<DemandItem>>(await accountClient('/demand/client/page', { params: demandParams }));
  const list = (resp?.list ?? resp?.records ?? []).map((d) => bountyFromDemand(d));
  return normalizeLegacyPageResponse({ list, total: resp?.total ?? resp?.totalRow ?? list.length, page, pageSize } as any);
}

export async function getBountyDetail(id: string | number) {
  const demand = unwrap<DemandItem>(await accountClient(`/demand/${id}`));
  if (!demand) return undefined;
  return bountyFromDemand(demand);
}

const CATEGORY_GRADIENT: Record<string, string> = {
  video: gradient2('#25F4EE', '#5DF7F2'),
  image: gradient2('#FFB400', '#FFD566'),
  novel: gradient2('#8B5CF6', '#C4B5FD'),
  art: gradient2('#FE2C55', '#FF6B8A'),
  music: gradient2('#5DDB96', '#25F4EE'),
  film: gradient2(ACCENT.purple.main, '#FE2C55'),
  script: gradient2('#FE2C55', '#FFB400'),
  live: gradient2('#25F4EE', '#FFB400'),
  voice: gradient2('#EC4899', '#F9A8D4'),
};

function bountyFromDemand(demand: DemandItem): Bounty {
  const payNum = Number(demand.pay ?? 0);
  const endMs = demand.endTime ? new Date(demand.endTime).getTime() : null;
  const daysLeft = endMs == null ? null : Math.max(0, Math.ceil((endMs - Date.now()) / 86_400_000));
  const category = demand.category || 'video';
  return {
    id: String(demand.id),
    title: demand.title || '',
    category,
    reward: payNum > 0 ? Math.round(payNum * 100) : 0,
    applicants: demand.applicants ?? 0,
    daysLeft,
    sponsor: demand.username || '',
    sponsorAvatar: demand.avatar,
    sponsorId: (demand as any).createUser,
    gradient: CATEGORY_GRADIENT[category] ?? gradient2('#FE2C55', '#8B5CF6'),
    cover: demand.cover,
    subtitle: demand.subtitle,
    content: typeof demand.content === 'string' ? demand.content : '',
    status: demand.status,
    endTime: demand.endTime,
    openTaskCount: demand.openTaskCount ?? 0,
    totalTaskCount: demand.totalTaskCount ?? 0,
    escrowCents: demand.escrowCents ?? 0,
  };
}

export async function getContentActivityFeed(params?: { limit?: number }): Promise<PageResult<Activity>> {
  const res = await unwrap<PageData<Activity>>(await accountClient('/content/activity/feed', { params }));
  return normalizeLegacyPageResponse(res as any);
}

export interface GiftItem {
  id: string;
  name: string;
  icon: string;
  price: number;
  effect: 'small' | 'medium' | 'large' | 'huge';
  combo: boolean;
}
export async function getGiftList(): Promise<PageResult<GiftItem>> {
  const res = await unwrap<PageData<GiftItem>>(await accountClient('/live/gifts'));
  return normalizeLegacyPageResponse(res as any);
}

export interface LikePreview {
  id: string;
  title: string;
  cover: string;
  type: string;
}
/** 我赞过的内容(取 /account/likes/page 的最近几条作预览)。 */
export async function getLikesPreview(limit = 6): Promise<PageResult<LikePreview>> {
  const res = unwrap<PageData<any>>(await accountClient('/account/likes/page'));
  const list: LikePreview[] = (res?.list ?? []).slice(0, limit).map((c: any) => ({
    id: String(c.id),
    title: c.title ?? '',
    cover: c.cover ?? c.coverUrl ?? '',
    type: c.category ?? c.contentType ?? '',
  }));
  return normalizeLegacyPageResponse({ list, total: res?.total ?? list.length } as any);
}

// ========== 个人中心 5 大分区真实计数 ==========
export interface AccountStats {
  likesCount: number;
  favoritesCount: number;
  historyCount: number;
  watchlaterCount: number;
  worksCount: number;
}
export async function getAccountStats() {
  return unwrap<AccountStats>(await accountClient('/dashboard/account/stats'));
}

// ========== 个人中心 5 分区真实列表(给悬浮卡 → /home/recommend?tab=me 调) ==========
export interface MePageItem {
  id?: number | string;
  contentId?: number | string;
  title?: string;
  cover?: string;
  coverUrl?: string;
  author?: { id?: number; nickname?: string; avatar?: string };
  contentType?: string;
  [k: string]: any;
}
export interface MePageResp<T = MePageItem> {
  list: T[];
  records: T[];
  total: number;
  totalRow: number;
}
async function meGet<T = MePageItem>(path: string) {
  return unwrap<MePageResp<T>>(await accountClient(path));
}
export const getFavoritesPage   = () => meGet('/account/favorites/page');
export const getHistoryPage     = () => meGet('/account/history/page');
export const getLikesPage       = () => meGet('/account/likes/page');
export const getWatchlaterPage  = () => meGet('/account/watchlater/page');
export const getReservationsPage= () => meGet('/account/reservations/page');

// ========== 创作者数据洞察 ==========

// 数据趋势点(7d / 30d,前端切换 range 即可)
export interface TrendPoint {
  id: string;
  date: string; // "MM/DD"
  range: '7d' | '30d';
  views: number;
  likes: number;
  comments: number;
  fans: number;
}
export async function getCreatorTrend(params: { range: '7d' | '30d' }): Promise<PageResult<TrendPoint>> {
  const res = await unwrap<PageData<TrendPoint>>(await accountClient('/creator/trend', { params }));
  return normalizeLegacyPageResponse(res as any);
}

// 内容分布(各类型作品数量)
export interface ContentStat {
  id: string;
  type: string; // video/image/live/article/other
  label: string;
  count: number;
  color: string; // 主题色 token(primary.main / #8B5CF6 等)
}
export async function getCreatorContentDistribution() {
  return unwrap<PageData<ContentStat>>(await accountClient('/creator/content-distribution'));
}

// 粉丝画像(性别 / 年龄 / 地域)
export interface FanStat {
  id: string;
  category: 'gender' | 'age' | 'region';
  label: string;
  value: number; // 0~100,两位小数
  color: string;
}
export async function getCreatorFanPortrait() {
  return unwrap<PageData<FanStat>>(await accountClient('/creator/fan-portrait'));
}

// 实时热点(公共)
export interface HotTopic {
  id: string;
  title: string;
  desc: string;
  heat: number;
  tag: '活动' | '热点' | '挑战' | '话题';
  reward: string;
  participants: string;
  color: string;
  gradient: string;
}
export async function getCreatorHotTopics(params?: PageParams): Promise<PageResult<HotTopic>> {
  const res = await unwrap<PageData<HotTopic>>(await accountClient('/creator/hot-topics', { params }));
  return normalizeLegacyPageResponse(res as any);
}

// ========== 创作者档案(CreatorProfileHeader) ==========

export interface CreatorBadge {
  id: string;
  label: string;
  color: string;
}
export interface CreatorProfile {
  userId: number;
  nickname: string;
  douyinId: string;
  avatar: string;
  level: number;
  levelName: string;
  fans: number;
  follows: number;
  likes: number;
  works: number;
  signature: string;
  badges: string; // 后端存为 JSON 字符串,前端解析
}
export async function getCreatorProfile(): Promise<{
  profile: CreatorProfile;
  badges: CreatorBadge[];
}> {
  const data = unwrap<{ profile: CreatorProfile; badges: CreatorBadge[] }>(
    await accountClient('/creator/profile')
  );
  // 兜底:badges 字段可能为字符串(JSON)或数组
  if (data && typeof (data.profile as any)?.badges === 'string') {
    try {
      data.badges = JSON.parse((data.profile as any).badges);
    } catch {
      data.badges = [];
    }
  }
  return data;
}

// ========== 悬赏榜 + 分类 ==========

export interface RewardRanker {
  id: string;
  rank: number;
  name: string;
  initials: string;
  avatarColor: string;
  bounty: number; // 已接悬赏数
  income: number; // 累计收益(分)
  color: string;
}
export async function getRewardRanking(params?: PageParams): Promise<PageResult<RewardRanker>> {
  const res = await unwrap<PageData<RewardRanker>>(await accountClient('/reward/ranking', { params }));
  return normalizeLegacyPageResponse(res as any);
}

export interface RewardCategory {
  id: string;
  code: string;
  label: string;
  icon: string; // MUI icon 名
  color: string;
  sort: number;
  count: number; // 该分类当前悬赏数
}
export async function getRewardCategories() {
  return unwrap<PageData<RewardCategory>>(await accountClient('/reward/categories'));
}

// ============ 我的工作台统计 ============

export interface MyPointRecord {
  id: number;
  type: string;
  point: number;
  info: string;
  createTime: string;
}

export interface LevelInfo {
  level: number;              // 等级 0-5
  levelName: string;         // 等级名称
  totalSpendYuan: number;    // 累计消费(元)
  nextLevelSpendYuan: number; // 下一等级所需消费(元)
  progressPercent: number;    // 当前等级进度百分比
}

export interface MyStats {
  completedDemands: number;    // 我参与且最终 COMPLETED 的需求数
  settledDemands: number;      // 我参与且已 SETTLED 的需求数
  approvedTasks: number;       // 我的已 approved 任务数
  pendingTasks: number;        // 我正在做(claimed/submitted)的任务数
  totalIncomeYuan: number;     // 累计收入(元)
  pendingIncomeYuan: number;   // 待收收入(元)
  todayRewardYuan: number;     // 今日赏金(元)
  rankingPosition: number;     // 排行榜名次(0=未上榜)
  adoptedCount: number;        // 已采纳数(= approvedTasks)
  levelInfo: LevelInfo;       // 用户等级信息(基于累计消费)
  recentRecords: MyPointRecord[];
}

export async function getMyStats(): Promise<MyStats> {
  return unwrap<MyStats>(await accountClient('/reward/my-stats'));
}

export interface PointRecord {
  id: number;
  userId: number;
  point: number;
  type: string;
  info: string;
  sourceType: string;     // demand_settle/achievement/...
  sourceId: number;
  createTime: string;
  sourceTitle?: string;   // 来源标题(需求名/任务名)
  sourceUrl?: string;     // 前端跳转路径
}

export interface PointRecordList {
  list: PointRecord[];
  records: PointRecord[];
  total: number;
  totalRow: number;
  page: number;
  size: number;
}

export async function listMyPointRecords(params?: PageParams): Promise<PageResult<PointRecord>> {
  const res = await unwrap<PointRecordList>(await accountClient('/reward/point-records', { params }));
  return normalizeLegacyPageResponse(res as any);
}

// ========== 后台 dashboard(/admin/system/dashboard/analysis) ==========

export interface AdminStats {
  totalUsers: number;
  totalUsersGrowth: number;
  totalContent: number;
  totalContentGrowth: number;
  todayRevenue: number; // 单位:分
  todayRevenueGrowth: number;
  totalOrders: number;
  totalOrdersGrowth: number;
  newUsersToday: number;
  activeUsersToday: number;
  conversionRate: number;
}
export async function getAdminStats() {
  return unwrap<AdminStats>(await accountClient('/admin/dashboard/stats'));
}

export interface AdminTrendPoint {
  statDate: string;
  users: number;
  content: number;
  revenue: number;
  orders: number;
  activeUsers: number;
}
export async function getAdminTrend(params?: { days?: number }): Promise<PageResult<AdminTrendPoint>> {
  const res = await unwrap<PageData<AdminTrendPoint>>(await accountClient('/admin/dashboard/trend', { params }));
  return normalizeLegacyPageResponse(res as any);
}

export interface AdminContentDist {
  type: string;
  count: number;
  percent: number;
  color: string;
}
export async function getAdminContentDistribution(): Promise<PageResult<AdminContentDist>> {
  const res = await unwrap<PageData<AdminContentDist>>(await accountClient('/admin/dashboard/content-distribution'));
  return normalizeLegacyPageResponse(res as any);
}

// ========== CMS 后台配置(8 张公共表 CRUD) ==========

const cmsBase = '/admin/dashboard-config';

function client() {
  // 这里直接调用 accountClient,wrap 返回 promise;
  // 方法用 async,避免顶层 await。
  return accountClient;
}

// activity
export const cmsActivity = {
  list: async () => unwrap<{ list: any[] }>(await client()(`${cmsBase}/activity`)),
  save: async (item: any) => unwrap(await client().post(`${cmsBase}/activity`, item)),
  remove: async (id: string) => unwrap(await client().delete(`${cmsBase}/activity/${id}`)),
};
export const cmsGift = {
  list: async () => unwrap<{ list: any[] }>(await client()(`${cmsBase}/gift`)),
  save: async (item: any) => unwrap(await client().post(`${cmsBase}/gift`, item)),
  remove: async (id: string) => unwrap(await client().delete(`${cmsBase}/gift/${id}`)),
};
export const cmsHotTopic = {
  list: async () => unwrap<{ list: any[] }>(await client()(`${cmsBase}/hot-topic`)),
  save: async (item: any) => unwrap(await client().post(`${cmsBase}/hot-topic`, item)),
  remove: async (id: string) => unwrap(await client().delete(`${cmsBase}/hot-topic/${id}`)),
};
export const cmsReviewer = {
  list: async () => unwrap<{ list: any[] }>(await client()(`${cmsBase}/reviewer`)),
  save: async (item: any) => unwrap(await client().post(`${cmsBase}/reviewer`, item)),
  remove: async (id: string) => unwrap(await client().delete(`${cmsBase}/reviewer/${id}`)),
};
export const cmsBounty = {
  list: async () => unwrap<{ list: any[] }>(await client()(`${cmsBase}/bounty`)),
  save: async (item: any) => unwrap(await client().post(`${cmsBase}/bounty`, item)),
  remove: async (id: string) => unwrap(await client().delete(`${cmsBase}/bounty/${id}`)),
};
export const cmsCategory = {
  list: async () => unwrap<{ list: any[] }>(await client()(`${cmsBase}/category`)),
  save: async (item: any) => unwrap(await client().post(`${cmsBase}/category`, item)),
  remove: async (id: string) => unwrap(await client().delete(`${cmsBase}/category/${id}`)),
};
export const cmsRanker = {
  list: async () => unwrap<{ list: any[] }>(await client()(`${cmsBase}/ranker`)),
  save: async (item: any) => unwrap(await client().post(`${cmsBase}/ranker`, item)),
  remove: async (id: string) => unwrap(await client().delete(`${cmsBase}/ranker/${id}`)),
};
export const cmsVip = {
  get: async () => unwrap<{ tiers: any[]; tasks: any[]; benefits: any[] }>(await client()(`${cmsBase}/vip`)),
  save: async (data: { tiers: any[]; tasks: any[]; benefits: any[] }) =>
    unwrap(await client().put(`${cmsBase}/vip`, data)),
};

// ========== 积分商城(用户中心 points 页) ==========

export interface PointMallItem {
  id: number;
  name: string;
  desc: string;
  category: 'virtual' | 'privilege' | 'physical' | 'limited';
  emoji: string;
  gradient: string;
  points: number;
  originalPoints?: number;
  stock: number; // -1 = 无限
  totalRedeemed: number;
  tag?: 'HOT' | 'NEW' | '限时' | '独家';
  /** physical:实物,需要收货地址;其余是装扮,兑换后立即到账并自动佩戴 */
  deliverType?: 'physical' | 'avatar_frame' | 'title' | 'name_color';
  /** point:用积分(points);diamond:用钻石(priceCents,分;1 钻 = 10 分) */
  currency?: 'point' | 'diamond';
  priceCents?: number;
  /** 装扮的样式值:头像框/名字颜色是 CSS 渐变或颜色,称号是文字 */
  cosmeticValue?: string;
  /** 装扮有效天数,0 = 永久 */
  durationDays?: number;
}
export async function getPointMallItems() {
  return unwrap<{ list: PointMallItem[]; total: number }>(
    await accountClient('/user/point/mall/items')
  );
}
export async function getPointMallHistory() {
  return unwrap<{ list: PointMallRecord[]; total: number; lifetime: number }>(
    await accountClient('/user/point/mall/history')
  );
}
/** 兑换/购买商品;实物需要收货地址:addressId(地址簿)或 address(自由文本)二选一 */
export async function redeemPointMallItem(itemId: number, address?: string, addressId?: number) {
  return unwrap<{ record: PointMallRecord; balance: number }>(
    await accountClient.post('/user/point/mall/redeem', { itemId, address, addressId })
  );
}

export interface PointMallRecord {
  id: number;
  itemId: number;
  itemName: string;
  emoji: string;
  gradient: string;
  points: number;
  currency?: 'point' | 'diamond';
  amountCents?: number;
  deliverType?: string;
  status: 'pending' | 'shipped' | 'completed';
  redeemedAt: string;
  serial?: string;
  address?: string;
  tracking?: string;
}

// ========== 创作者 · 优质作品榜 ==========

export interface TopPerformingItem {
  id: number;
  rank: number;
  type: 'video' | 'image' | 'live';
  title: string;
  thumbnail: string;
  views: number;
  likes: number;
  comments: number;
  completion: number;
  delta: number; // 7 日环比 %
  publishedAt: string;
  duration?: string;
}
export async function getTopPerformingContent(params?: PageParams & { days?: 7 | 30 }): Promise<PageResult<TopPerformingItem>> {
  const res = await unwrap<PageData<TopPerformingItem>>(await accountClient('/creator/content/top-performing', { params }));
  return normalizeLegacyPageResponse(res as any);
}

// ========== 权益 / 活动(recharge 页;套餐见 apis/payment.ts 的 getDiamondPackages) ==========

export interface DiamondBenefit {
  icon: 'crown' | 'flash' | 'gift' | 'badge' | 'support' | 'theater';
  title: string;
  desc: string;
  sort?: number;
}
export async function getDiamondBenefits() {
  return unwrap<{ list: DiamondBenefit[] }>(await accountClient('/recharge/benefits'));
}

export interface DiamondActivity {
  title: string;
  subtitle: string;
  endsAt: string;
  rules: string[];
}
/** 没有折扣档位时后端返回 null,页面据此隐藏活动区块。 */
export async function getDiamondActivity() {
  return unwrap<DiamondActivity | null>(await accountClient('/recharge/activity'));
}

// ========== 创作者数据大盘 ==========

export interface CreatorStats {
  totalViews: number;
  totalLikes: number;
  totalFavorites: number;
  totalShares: number;
  totalEarnings: number;
  todayViews: number;
  weekViews: number;
  monthViews: number;
  newFans: number;
}

export interface TrendData {
  date: string;
  views: number;
  likes: number;
  share: number;
}

export interface ContentStats {
  contentId: number;
  title: string;
  coverUrl: string;
  views: number;
  likes: number;
  favorites: number;
  shares: number;
  duration: number;
  publishTime: string;
}

export interface FanProfile {
  totalFans: number;
  activeFans: number;
  totalFollows: number;
  fanSource: Record<string, number>;
  genderRatio: Record<string, number>;
  ageDist: Record<string, number>;
}

export interface RankInfo {
  categoryRank: number;
  categoryTotal: number;
  cityRank: number;
  cityTotal: number;
  weekGrowthRank: number;
  growthPercent: number;
}

export interface DashboardOverview {
  stats: CreatorStats;
  trend: TrendData[];
  contents: ContentStats[];
  fans: FanProfile;
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  return unwrap<DashboardOverview>(await adminClient('/creator-stats/overview'));
}

export async function getCreatorStats(): Promise<CreatorStats> {
  return unwrap<CreatorStats>(await adminClient('/creator-stats/stats'));
}

export async function getTrendData(days: number = 7): Promise<{ trend: TrendData[] }> {
  return unwrap<{ trend: TrendData[] }>(await adminClient('/creator-stats/trend', { params: { days } }));
}

export async function getContentStats(limit: number = 10): Promise<{ contents: ContentStats[] }> {
  return unwrap<{ contents: ContentStats[] }>(await adminClient('/creator-stats/content', { params: { limit } }));
}

export async function getFanProfile(): Promise<FanProfile> {
  return unwrap<FanProfile>(await adminClient('/creator-stats/fans'));
}

export async function getRankInfo(category: string = 'general'): Promise<RankInfo> {
  return unwrap<RankInfo>(await adminClient('/creator-stats/rank', { params: { category } }));
}

// 格式化数字
export function formatCount(n: number): string {
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '亿';
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  return n.toLocaleString();
}

// 格式化金额（分→元）
export function formatMoney(fen: number): string {
  return (fen / 100).toFixed(2);
}