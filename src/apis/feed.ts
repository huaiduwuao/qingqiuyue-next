import { apiClient } from '@/lib/api/client';

// 动态类型
export interface Feed {
  id: number;
  userId: number;
  type: string;
  targetId?: number;
  targetType?: string;
  content?: string;
  createTime: string;
  userName?: string;
  userNickname?: string;
  userAvatar?: string;
  targetTitle?: string;
}

// 创建动态请求
export interface CreateFeedReq {
  type: string;
  targetId?: number;
  targetType?: string;
  content?: string;
}

// 动态列表请求
export interface FeedListReq {
  page?: number;
  pageSize?: number;
  userId?: number;
  type?: string;
}

// 获取动态列表
export async function listFeeds(params?: FeedListReq) {
  return apiClient.get('/feed/list', { params });
}

// 获取关注用户的动态
export async function getFollowingFeeds(params?: { page?: number; pageSize?: number }) {
  return apiClient.get('/feed/following', { params });
}

// 获取某用户的动态
export async function getUserFeeds(userId: number, params?: { page?: number; pageSize?: number }) {
  return apiClient.get(`/feed/user/${userId}`, { params });
}

// 获取动态详情
export async function getFeed(id: number) {
  return apiClient.get(`/feed/${id}`);
}

// 创建动态
export async function createFeed(data: CreateFeedReq) {
  return apiClient.post('/feed', data);
}

// 删除动态
export async function deleteFeed(id: number) {
  return apiClient.delete(`/feed/${id}`);
}
