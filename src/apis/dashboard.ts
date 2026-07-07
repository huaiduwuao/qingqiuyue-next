/**
 * Dashboard 端 API —— 创作者中心、个人中心、活动中心、悬赏、VIP、直播礼物 等。
 * 之前都散落在前端 SEED/MY_WORKS/HOT_BOUNTIES 等常量里,现在统一从后端拉。
 * 后端实现见 qingqiuyue-go/internal/handler/dashboard_handler.go。
 *
 * 注:axios 拦截器统一包成 {code, msg, data},这里每个 API 都通过 unwrap() 拆出真正的 data。
 */
import { accountClient } from '@/lib/api/client';

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

export interface Collection {
  id: string;
  title: string;
  cover: string;
  workCount: number;
  viewCount: number;
  isPublic: boolean;
  tags: string[];
  updateTime: number;
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
}
export async function getHotBounties(params?: { limit?: number }) {
  return unwrap<PageData<Bounty>>(await accountClient('/reward/bounty/hot', { params }));
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