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
  createTime: string;
  updateTime: string;
}

/** 自动收录规则:手工收录的作品在前,命中规则的补在后面 */
export interface TopicRule {
  contentTypes?: string[];
  keywords?: string[];
  orderBy?: 'hot' | 'new';
  limit?: number;
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
export async function listTopics(params?: { page?: number; pageSize?: number; status?: number; kind?: TopicKind; keyword?: string }) {
  return contentClient.get('/topic/list', { params });
}

// 获取热门专题
export async function getHotTopics(limit?: number) {
  return contentClient.get('/topic/hot', { params: { limit } });
}

// 获取专题详情(含内容)
export async function getTopic(id: number) {
  return contentClient.get(`/topic/${id}`);
}

// 创建专题
export async function createTopic(data: CreateTopicReq) {
  return contentClient.post('/topic', data);
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
