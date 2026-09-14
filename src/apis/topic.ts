import { contentClient } from '@/lib/api/client';

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
  createTime: string;
  updateTime: string;
}

// 专题内容
export interface TopicContent {
  id: number;
  topicId: number;
  contentId: number;
  contentType?: string;
  sort: number;
}

// 专题详情(含内容)
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
}

// 更新专题请求
export interface UpdateTopicReq {
  title?: string;
  subtitle?: string;
  cover?: string;
  description?: string;
  contentType?: string;
  sort?: number;
  status?: number;
}

// 添加内容请求
export interface AddContentReq {
  contentId: number;
  contentType?: string;
  sort?: number;
}

// 获取专题列表
export async function listTopics(params?: { page?: number; pageSize?: number; status?: number }) {
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
export async function removeTopicContent(topicId: number, contentId: number) {
  return contentClient.delete(`/topic/${topicId}/content/${contentId}`);
}
