import { adminClient } from '@/lib/api/client';

// 用户积分信息
export interface UserPointInfo {
  userId: number;
  points: number;
  level?: number;
  rank?: number;
}

// 积分记录信息
export interface PointRecordInfo {
  id: number;
  userId: number;
  type: string;
  points: number;
  balance: number;
  description?: string;
  createTime?: string;
}

// 成就信息
export interface AchievementInfo {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  unlocked?: boolean;
  unlockedTime?: string;
}

// 用户活动信息
export interface UserActivityInfo {
  id: number;
  userId: number;
  type: string;
  content?: string;
  status?: string;
  createTime?: string;
}

// 用户积分查询参数
export interface UserPointQuery {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  userId?: number;
  type?: string;
  name?: string;
}

// 用户积分响应
export interface UserPointResp {
  userId: number;
  points: number;
}

// 积分记录列表响应
export interface PointRecordListResp {
  records?: PointRecordInfo[];
  list: PointRecordInfo[];
  total: number;
  totalRow?: number;
  success?: boolean;
}

// 成就列表响应
export interface AchievementListResp {
  list: AchievementInfo[];
  total: number;
}

// 用户活动列表响应
export interface UserActivityListResp {
  list: UserActivityInfo[];
  total: number;
}

// 获取用户积分
export async function getUserPoint(userId?: number) {
  return adminClient<UserPointResp>(`/point/user`, {
    method: 'GET',
    params: userId ? { userId } : undefined,
  });
}

// 获取积分记录列表
export async function listPointRecords(params?: UserPointQuery) {
  return adminClient<PointRecordListResp>('/point/records', {
    method: 'GET',
    params,
  });
}

// 获取用户成就列表
export async function listAchievements(userId?: number) {
  return adminClient<AchievementListResp>('/point/achievements', {
    method: 'GET',
    params: userId ? { userId } : undefined,
  });
}

// 解锁成就
export async function unlockAchievement(userId: number, achievementId: number) {
  return adminClient('/point/unlock', {
    method: 'POST',
    params: { userId, achievementId },
  });
}

// 获取用户活动列表
export async function listUserActivities(params?: any) {
  return adminClient<UserActivityListResp>('/user-activity/list', {
    method: 'GET',
    params,
  });
}

// 创建用户活动
export async function createUserActivity(data: any) {
  return adminClient<UserActivityInfo>('/user-activity', {
    method: 'POST',
    data,
  });
}

// Aliases for missing exports
export const page = listPointRecords;
export const remove = async (ids: number[]) => {
  return adminClient('/point/remove', { method: 'DELETE', data: ids });
};
export const save = createUserActivity;
export const update = async (params: any) => {
  return adminClient('/point/update', { method: 'PUT', data: params });
};
