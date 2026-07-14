/**
 * Dashboard 端 API —— 创作者中心、个人中心、活动中心、悬赏、VIP、直播礼物 等。
 * 之前都散落在前端 SEED/MY_WORKS/HOT_BOUNTIES 等常量里,现在统一从后端拉。
 * 后端实现见 qingqiuyue-go/internal/handler/dashboard_handler.go。
 *
 * 注:axios 拦截器统一包成 {code, msg, data},这里每个 API 都通过 unwrap() 拆出真正的 data。
 */
import { accountClient } from '@/lib/api/client';
import { DemandItem } from '@/beans/reward';
import { gradient2 } from '@/constants/gradients';
import { ACCENT } from '@/constants/accents';

/** 解开 axios 拦截器的包装层,拿到真正的后端 body */
function unwrap<T = any>(resp: any): T {
  if (!resp) return resp as T;
  const body = resp?.data ?? resp;
  if (body && typeof body === 'object' && 'code' in body && 'data' in body) {
    return body.data as T;
  }
  return body as T;
}

// ========== 我的订单 ==========
export interface Order {
  id: string;
  type: 'recharge' | 'vip' | 'content' | 'gift';
  title: string;
  subtitle: string;
  amount: number;
  status: 'paid' | 'pending' | 'refunded' | 'cancelled';
  createdAt: number;
  payMethod: string;
}
export interface PageData<T> { list: T[]; records?: T[]; total?: number; totalRow?: number; page?: number; size?: number }
export async function getOrderList(params?: { page?: number; size?: number }) {
  return unwrap<PageData<Order>>(await accountClient('/order/list', { params }));
}

export interface WipItem {
  id: string;
  title: string;
  type: string;
  progress: number;
  stage: 'draft' | 'transcoding' | 'reviewing';
  updatedAt: number;
  cover: string;
}
export async function getCreatorWipList(params?: { page?: number; size?: number }) {
  return unwrap<PageData<WipItem>>(await accountClient('/creator/wip/list', { params }));
}

export interface CollectionWork {
  id: number;
  title: string;
  cover?: string;
  duration?: number | string;
  views?: number;
  type?: 'video' | 'image' | 'article';
}
export interface Collection {
  id: string;
  title: string;
  description?: string;
  cover: string;
  workCount: number;
  viewCount: number;
  isPublic: boolean;
  status?: 'active' | 'finished' | 'draft';
  autoSort?: boolean;
  category?: string;
  tags: string[];
  updateTime: number;
  works?: CollectionWork[];
}
export async function getCollectionList(params?: { page?: number; size?: number }) {
  return unwrap<PageData<Collection>>(await accountClient('/creator/collection/list', { params }));
}

export interface ProtectedWork {
  id: string;
  title: string;
  cover: string;
  fingerprint: string;
  status: 'monitoring' | 'disputed' | 'takenDown';
  monitorAt: number;
  takedowns: number;
  income: number;
}
export async function getProtectedList() {
  return unwrap<PageData<ProtectedWork>>(await accountClient('/creator/original/protected'));
}

export interface Infringement {
  id: string;
  workTitle: string;
  infringer: string;
  platform: string;
  url: string;
  status: 'detected' | 'noticed' | 'takedown' | 'pending';
  detectedAt: number;
  income: number;
}
export async function getInfringementList() {
  return unwrap<PageData<Infringement>>(await accountClient('/creator/original/infringements'));
}

export interface TakedownRecord {
  id: string;
  workTitle: string;
  infringer: string;
  platform: string;
  reason: string;
  reqAt: number;
  completedAt: number;
  status: 'takenDown' | 'rejected' | 'appealing';
  refund: number;
}
export async function getTakedownList() {
  return unwrap<PageData<TakedownRecord>>(await accountClient('/creator/original/takedowns'));
}

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
export async function getHdVideoList(params?: { page?: number; size?: number }) {
  return unwrap<PageData<HdVideo>>(await accountClient('/creator/hd/videos', { params }));
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
export async function getActivityList(params?: { category?: string; status?: string }) {
  return unwrap<PageData<Activity>>(await accountClient('/creator/activity/list', { params }));
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
  reward: number;
  applicants: number;
  daysLeft: number;
  sponsor: string;
  gradient: string;
  cover?: string;
}
export async function getHotBounties(params?: {
  limit?: number;
  category?: string;
  keyword?: string;
  order?: 'reward' | 'deadline' | 'hot' | 'newest';
  page?: number;
  size?: number;
}) {
  // 后端暂无 /reward/bounty/hot，从 demand/client/page 爬取真实数据并映射为 Bounty
  const page = params?.page ?? 1;
  const size = params?.size ?? params?.limit ?? 6;
  const demandParams: any = {
    page,
    pageSize: size,
    status: 'PUBLISHED',
  };
  if (params?.category) demandParams.category = params.category;
  if (params?.keyword) demandParams.keyword = params.keyword;
  const resp = unwrap<PageData<DemandItem>>(await accountClient('/demand/client/page', { params: demandParams }));
  const list = (resp?.list ?? resp?.records ?? []).map((d) => bountyFromDemand(d));
  return { list, total: resp?.total ?? list.length, page, size } as PageData<Bounty>;
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
  const reward = payNum > 0 ? Math.round(payNum * 100) : 0;
  const endTime = demand.endTime ? new Date(demand.endTime).getTime() : 0;
  const now = Date.now();
  const daysLeft = endTime > now ? Math.max(1, Math.ceil((endTime - now) / (1000 * 60 * 60 * 24))) : (endTime === 0 ? 14 : 0);
  const applicants = demand.completedCount ?? 0;
  const category = demand.category || 'video';
  return {
    id: String(demand.id),
    title: demand.title || '',
    category,
    reward,
    applicants,
    daysLeft,
    sponsor: demand.username || '青丘',
    gradient: CATEGORY_GRADIENT[category] ?? gradient2('#FE2C55', '#8B5CF6'),
    cover: demand.cover,
  };
}

export async function getRewardActivities() {
  return unwrap<PageData<Activity>>(await accountClient('/reward/activity/list'));
}

export async function getContentActivityFeed(params?: { limit?: number }) {
  return unwrap<{ list: Activity[]; records?: Activity[] }>(await accountClient('/content/activity/feed', { params }));
}

export interface GiftItem {
  id: string;
  name: string;
  icon: string;
  price: number;
  effect: 'small' | 'medium' | 'large' | 'huge';
  combo: boolean;
}
export async function getGiftList() {
  return unwrap<PageData<GiftItem>>(await accountClient('/live/gifts'));
}

export interface LikePreview {
  id: string;
  title: string;
  cover: string;
  type: string;
}
export async function getLikesPreview() {
  return unwrap<PageData<LikePreview>>(await accountClient('/account/likes/preview'));
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
  return unwrap<AccountStats>(await accountClient('/account/stats'));
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

export interface VipTier {
  id: string;
  name: string;
  price: number;
  origPrice: number;
  badge: string;
  color: string;
  benefits: string[];
}
export interface VipTask {
  id: string;
  title: string;
  reward: string;
  done: boolean;
}
export interface VipInfo {
  tiers: VipTier[];
  tasks: VipTask[];
  benefits: string[];
}
export async function getVipInfo() {
  return unwrap<VipInfo>(await accountClient('/vip/tiers'));
}

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
export async function getCreatorTrend(params: { range: '7d' | '30d' }) {
  return unwrap<PageData<TrendPoint>>(await accountClient('/creator/trend', { params }));
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
export async function getCreatorHotTopics(params?: { limit?: number }) {
  return unwrap<PageData<HotTopic>>(await accountClient('/creator/hot-topics', { params }));
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

// ========== 存证(original 页面用) ==========

export interface Certificate {
  id: string;
  userId: number;
  contentId: number;
  contentTitle: string;
  cover: string;
  contentType: string;
  fingerprint: string; // sha256 hex
  blockchainHash: string; // sha256 hex
  certificateNo: string; // QY-DBC-2026-XXXXXXXX
  level: string;
  status: string;
  infringeCount: number;
  totalViews: number;
  duration: string;
  registeredAt: number;
}
export async function applyOriginalCertificate(contentIds: number[]) {
  return unwrap<PageData<Certificate>>(
    await accountClient.post('/original/apply', { contentIds })
  );
}
export async function getCertificateList() {
  return unwrap<PageData<Certificate>>(await accountClient('/certificate/list'));
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
export async function getRewardRanking(params?: { limit?: number }) {
  return unwrap<PageData<RewardRanker>>(await accountClient('/reward/ranking', { params }));
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
  currentPoint: number;        // 当前可用灵气
  totalPoint: number;          // 累计获得灵气
  level: number;
  levelName: string;
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

export async function listMyPointRecords(params?: { page?: number; pageSize?: number }): Promise<PointRecordList> {
  return unwrap<PointRecordList>(await accountClient('/reward/point-records', { params }));
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
export async function getAdminTrend(params?: { days?: number }) {
  return unwrap<PageData<AdminTrendPoint>>(await accountClient('/admin/dashboard/trend', { params }));
}

export interface AdminContentDist {
  type: string;
  count: number;
  percent: number;
  color: string;
}
export async function getAdminContentDistribution() {
  return unwrap<PageData<AdminContentDist>>(await accountClient('/admin/dashboard/content-distribution'));
}

// ========== 首页推荐(关注 / 朋友) ==========

export interface RecommendWork {
  id: string;
  title: string;
  cover: string;
  duration: number;
  views: number;
  likes: number;
  publishedAt: number;
  status: string;
  hashtags: string; // 逗号分隔
}
export async function getHomeRecommendFollow(params?: { page?: number; size?: number }) {
  return unwrap<PageData<RecommendWork>>(
    await accountClient('/home/recommend/follow', { params })
  );
}
export async function getHomeRecommendFriend(params?: { page?: number; size?: number }) {
  return unwrap<PageData<RecommendWork>>(
    await accountClient('/home/recommend/friend', { params })
  );
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
export async function redeemPointMallItem(itemId: number) {
  return unwrap<{ record: PointMallRecord; balance: number }>(
    await accountClient.post('/user/point/mall/redeem', { itemId })
  );
}

export interface PointMallRecord {
  id: number;
  itemId: number;
  itemName: string;
  emoji: string;
  gradient: string;
  points: number;
  status: 'pending' | 'shipped' | 'completed';
  redeemedAt: string;
  serial?: string;
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
export async function getTopPerformingContent(params?: { days?: 7 | 30; limit?: number }) {
  return unwrap<PageData<TopPerformingItem>>(
    await accountClient('/creator/content/top-performing', { params })
  );
}

// ========== 共创中心(co-create) ==========

export interface CoCreatePartner {
  id: number;
  name: string;
  avatar: string;
  niche: string;
  fans: number;
  verified?: boolean;
  matchScore: number;
}

export interface CoCreateCollab {
  id: number;
  partner: CoCreatePartner;
  type: 'jointPost' | 'assetShare' | 'topicCollab';
  status: 'active' | 'pending' | 'completed' | 'declined';
  revenueSplit: number;
  topic: string;
  progress: number;
  startedAt: number;
  lastActivityAt: number;
  totalEarnings: number;
  jointViews: number;
}

export interface CoCreateInvite {
  id: number;
  direction: 'incoming' | 'outgoing';
  partner: CoCreatePartner;
  type: 'jointPost' | 'assetShare' | 'topicCollab';
  revenueSplit: number;
  message: string;
  createdAt: number;
}

export async function getCoCreateCollabs() {
  return unwrap<PageData<CoCreateCollab>>(await accountClient('/co-create/collabs'));
}
export async function getCoCreateInvites(direction: 'incoming' | 'outgoing') {
  return unwrap<PageData<CoCreateInvite>>(
    await accountClient(`/co-create/invites`, { params: { direction } })
  );
}
export async function getRecommendedCoCreatePartners(params?: { keyword?: string }) {
  return unwrap<PageData<CoCreatePartner>>(
    await accountClient('/co-create/recommend', { params })
  );
}

export async function acceptCoCreateInvite(id: number) {
  return unwrap(await accountClient.post('/co-create/accept', { id }));
}
export async function rejectCoCreateInvite(id: number) {
  return unwrap(await accountClient.post('/co-create/reject', { id }));
}
export async function cancelCoCreateInvite(id: number) {
  return unwrap(await accountClient.post('/co-create/cancel', { id }));
}
export async function finishCoCreate(id: number) {
  return unwrap(await accountClient.post('/co-create/finish', { id }));
}
export async function sendCoCreateInvite(body: {
  projectId: string;
  userId: number;
  role: string;
  type?: CoCreateCollab['type'];
  revenueSplit?: number;
  message?: string;
}) {
  return unwrap(await accountClient.post('/co-create/invite', body));
}

// ========== 充值包 / 权益 / 活动(recharge 页) ==========

export interface DiamondPackage {
  id: string;
  diamonds: number;
  bonus?: number;
  price: number; // 元
  originalPrice?: number;
  badge?: 'recommend' | 'hot' | 'bonus' | 'first';
  desc: string;
  perDiamond: string;
  sort?: number;
  enabled?: boolean;
}
export async function getDiamondPackages() {
  return unwrap<{ list: DiamondPackage[] }>(await accountClient('/recharge/packages'));
}

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
export async function getDiamondActivity() {
  return unwrap<DiamondActivity>(await accountClient('/recharge/activity'));
}