import { contentClient } from '@/lib/api/client';

// 专题后台接口:/api/content/topic/*(增删改仅内容运营)。
// 面向用户的专题广场、关注、作品流见 @/apis/community。

export type TopicKind = 'collection' | 'topic';

// 专题类型
export interface Topic {
  id: number;
  title: string;
  subtitle?: string;
  cover?: string;
  description?: string;
  contentType?: string;
  sort: number;
  status: number;
  viewCount: number;
  contentCount: number;
  kind?: TopicKind;
  ownerId?: number;
  followerCount?: number;
  postCount?: number;
  /** 自动收录规则的 JSON 字符串,见 TopicRule */
  rule?: string;
  /** 来源:manual 运营手建 / 用户话题;auto 由 internal/topiccurator 按数据自动生成 */
  source?: 'manual' | 'auto';
  /** 自动专题的幂等键(tag:<标签> / platform:<平台>) */
  autoKey?: string;
  /** 数据驱动的热度分(内容热度 + 近期新帖/新关注),专题广场按它排序 */
  hotScore?: number;
  createTime: string;
  updateTime: string;
}

/** 自动收录规则:手工收录的作品在前,命中规则的补在后面 */
export interface TopicRule {
  contentTypes?: string[];
  keywords?: string[];
  orderBy?: 'hot' | 'new';
  limit?: number;
  /** 非空时作品直接取 trending 索引里该平台的热榜(自动生成的"<平台> 今日热门"专题) */
  trendingPlatform?: string;
  trendingPeriod?: 'realtime' | 'day' | 'week';
}

/** 一轮自动生成的结果(POST /topic/curate) */
export interface CurateReport {
  builtAt: string;
  contents: number;
  tagCandidates: number;
  tagTopics: number;
  platformTopics: number;
  created: number;
  updated: number;
  skippedOff: number;
  scored: number;
  duration: string;
  error?: string;
}

export function parseTopicRule(s?: string): TopicRule {
  if (!s) return {};
  try {
    return JSON.parse(s) as TopicRule;
  } catch {
    return {};
  }
}

// 专题内容
export interface TopicContent {
  id: number;
  topicId: number;
  contentId: number;
  contentType?: string;
  sort: number;
}

// 专题详情(含手工收录的内容)
export interface TopicWithContents extends Topic {
  contents: any[];
}

// 创建专题请求
export interface CreateTopicReq {
  title: string;
  subtitle?: string;
  cover?: string;
  description?: string;
  contentType?: string;
  sort?: number;
  kind?: TopicKind;
  rule?: TopicRule;
}

// 更新专题请求:只改传了的字段
export interface UpdateTopicReq extends Partial<CreateTopicReq> {
  status?: number;
}

// 添加内容请求(内容 id 可能是超过 2^53 的字符串)
export interface AddContentReq {
  contentId: number | string;
  contentType?: string;
  sort?: number;
}

// 获取专题列表
export async function listTopics(params?: { page?: number; pageSize?: number; status?: number; kind?: TopicKind; keyword?: string; source?: 'manual' | 'auto' }) {
  return contentClient.get('/topic/list', { params });
}

// 立即跑一轮专题自动生成(按内容标签 / trending 平台热榜建合集,刷新全部专题热度分)。仅内容运营。
export async function curateTopics(): Promise<CurateReport> {
  return contentClient.post('/topic/curate');
}

// 获取热门专题
export async function getHotTopics(limit?: number) {
  return contentClient.get('/topic/hot', { params: { limit } });
}

// 获取专题详情(含内容)
export async function getTopic(id: number) {
  return contentClient.get(`/topic/${id}`);
}

/**
 * 创建专题(前台叫「意境」)。登录就能调:
 *   - 内容运营调 → 直接上线(status=1,归官方);
 *   - 普通用户调 → 进待审池(status=0,归自己),返回 pendingReview=true,
 *     要运营在「专题管理 · 待审」里通过之后才会出现在意境广场。
 */
export async function createTopic(data: CreateTopicReq): Promise<{ id: number; pendingReview: boolean }> {
  return contentClient.post('/topic', data);
}

/** 审核通过一个待审专题:status 0 → 1,并清零 owner_id 升级为官方权威专题。仅内容运营。 */
export async function approveTopic(id: number) {
  return contentClient.post(`/topic/${id}/approve`);
}

/** 驳回一个待审专题:status 0 → 2。仅内容运营。 */
export async function rejectTopic(id: number) {
  return contentClient.post(`/topic/${id}/reject`);
}

/** 把已通过的专题升级为官方权威专题(清零 owner_id)。仅内容运营。 */
export async function promoteTopic(id: number) {
  return contentClient.post(`/topic/${id}/promote`);
}

// 更新专题
export async function updateTopic(id: number, data: UpdateTopicReq) {
  return contentClient.put(`/topic/${id}`, data);
}

// 删除专题
export async function deleteTopic(id: number) {
  return contentClient.delete(`/topic/${id}`);
}

// 添加内容到专题
export async function addTopicContent(topicId: number, data: AddContentReq) {
  return contentClient.post(`/topic/${topicId}/content`, data);
}

// 从专题移除内容
export async function removeTopicContent(topicId: number, contentId: number | string) {
  return contentClient.delete(`/topic/${topicId}/content/${contentId}`);
}
