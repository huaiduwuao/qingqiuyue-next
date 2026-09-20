import { contentClient } from '@/lib/api/client';

// 社区接口:content-api /api/content/community/*(Go: internal/communityapp)。
// 内容 id 超过 2^53,后端会转成字符串,所以 id 一律按 number | string 处理,不要 Number()。

export type Id = number | string;
export type TopicKind = 'collection' | 'topic';
export type FeedType = 'post' | 'publish' | 'comment' | 'like' | 'collect' | 'follow';
/** follow / friend:首页「关注」「好友」页签,只看关注的人 / 好友的动态 */
export type FeedTab = 'square' | 'following' | 'follow' | 'friend' | 'topic' | 'user';

export interface CommunityUser {
  id: Id;
  name: string;
  avatar: string;
  /** 平台运营的 AI 虚拟用户,前端统一标注 */
  isBot: boolean;
}

export interface ContentBrief {
  id: Id;
  title: string;
  cover: string;
  contentType: string;
  views: number;
  likes: number;
  comments: number;
}

export interface TopicBrief {
  id: Id;
  title: string;
  kind: TopicKind;
  postCount?: number;
}

export interface FeedItem {
  id: Id;
  type: FeedType;
  user: CommunityUser;
  actors: CommunityUser[];
  actorCount: number;
  text: string;
  target?: ContentBrief;
  targetUser?: CommunityUser;
  topics: TopicBrief[];
  likeCount: number;
  commentCount: number;
  liked: boolean;
  interactive: boolean;
  canDelete: boolean;
  createTime: string;
  activeTime: string;
}

export interface FeedComment {
  id: Id;
  feedId: Id;
  user: CommunityUser;
  replyTo?: CommunityUser;
  text: string;
  createTime: string;
  canDelete: boolean;
}

export interface CommunityTopic {
  id: Id;
  kind: TopicKind;
  title: string;
  subtitle: string;
  cover: string;
  description: string;
  contentType: string;
  official: boolean;
  owner?: CommunityUser;
  followerCount: number;
  postCount: number;
  contentCount: number;
  viewCount: number;
  hasContents: boolean;
  isFollowing: boolean;
  /** 数据自动生成的专题(按标签 / 平台热榜汇集),不是运营手建 */
  auto?: boolean;
  /** 数据驱动的热度分 */
  hotScore?: number;
}

export interface TopicContentItem {
  id: Id;
  title: string;
  subtitle: string;
  cover: string;
  contentType: string;
  views: number;
  likes: number;
  comments: number;
  pinned: boolean;
}

export interface Page<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  needLogin?: boolean;
}

// 拦截器已把 { code, msg, data } 剥到业务数据层,client 直接 resolve 业务数据本身
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return (await contentClient.get(url, { params })) as T;
}

export function fetchFeed(params: { tab: FeedTab; sort?: 'new' | 'hot'; topicId?: Id; userId?: Id; page: number; size?: number }) {
  return get<Page<FeedItem>>('/community/feed', params);
}

export function fetchFeedItem(id: Id) {
  return get<FeedItem>(`/community/feed/${id}`);
}

export async function createPost(data: { text: string; contentId?: Id; topicIds?: Id[] }): Promise<FeedItem> {
  return (await contentClient.post('/community/posts', data)) as FeedItem;
}

export function deleteFeed(id: Id) {
  return contentClient.delete(`/community/feed/${id}`);
}

export async function setFeedLike(id: Id, on: boolean): Promise<{ liked: boolean; likeCount: number }> {
  return on ? await contentClient.post(`/community/feed/${id}/like`) : await contentClient.delete(`/community/feed/${id}/like`);
}

export function fetchComments(feedId: Id, page = 1, size = 20) {
  return get<Page<FeedComment>>(`/community/feed/${feedId}/comments`, { page, size });
}

export async function addComment(feedId: Id, text: string, replyToUserId?: Id): Promise<FeedComment> {
  return (await contentClient.post(`/community/feed/${feedId}/comments`, { text, replyToUserId })) as FeedComment;
}

export function deleteComment(id: Id) {
  return contentClient.delete(`/community/comments/${id}`);
}

export function fetchTopics(params: { kind?: TopicKind; sort?: 'hot' | 'new'; keyword?: string; following?: boolean; page?: number; size?: number }) {
  const { following, ...rest } = params;
  return get<Page<CommunityTopic>>('/community/topics', { ...rest, following: following ? 1 : undefined });
}

export function suggestTopics(q: string) {
  return get<TopicBrief[]>('/community/topics/suggest', { q });
}

export function fetchTopic(id: Id) {
  return get<CommunityTopic>(`/community/topics/${id}`);
}

export function fetchTopicContents(id: Id, page: number, size = 24) {
  return get<Page<TopicContentItem>>(`/community/topics/${id}/contents`, { page, size });
}

// ─── 专题洞察(独立类型 + 独立路由) ──────────────────────────────────────
// 与 fetchTopic 拿到的 CommunityTopic 解耦:类型单独 export,接口单独走
// /community/topics/:id/insights。这样非 TFT 专题不需要在 CommunityTopic 里
// 多带个空数组字段,空数组就在前端组件内 return null。
export interface TopicInsightLineup {
  id: Id;
  title: string;
  cover: string;
  subtitle: string;
  vendor?: string;
  sourceUrl?: string;
  updateTime: string;
}
export interface TopicInsightVersion {
  version: string;
  releasedAt: string;
  summary: string;
  sourceUrl?: string;
}
export interface TopicInsight {
  kind: 'lineups' | 'versionHistory';
  title: string;
  hint?: string;
  lineups?: TopicInsightLineup[];
  versions?: TopicInsightVersion[];
}
export function fetchTopicInsights(id: Id) {
  return get<{ insights: TopicInsight[] }>(`/community/topics/${id}/insights`);
}

export async function setTopicFollow(id: Id, on: boolean): Promise<{ following: boolean; followerCount: number }> {
  return on ? await contentClient.post(`/community/topics/${id}/follow`) : await contentClient.delete(`/community/topics/${id}/follow`);
}

export function fetchContentTopics(contentId: Id) {
  return get<TopicBrief[]>(`/community/content/${contentId}/topics`);
}

// ─── 运营 ───

export interface SplitCount {
  real: number;
  bot: number;
}

export interface CommunityStats {
  since: string;
  feedByType: Record<string, SplitCount>;
  feedLikes: SplitCount;
  feedComments: SplitCount;
  topicFollows: SplitCount;
  userFollows: SplitCount;
  activeRealUsers: number;
  notices: Record<string, number>;
  topics: { official: number; userMade: number; newToday: number };
  bots: Record<string, number>;
}

export function fetchAdminFeed(params: { author?: 'real' | 'bot' | ''; type?: string; keyword?: string; page: number; size?: number }) {
  return get<Page<FeedItem>>('/community/admin/feed', params);
}

export function fetchCommunityStats() {
  return get<CommunityStats>('/community/admin/stats');
}
