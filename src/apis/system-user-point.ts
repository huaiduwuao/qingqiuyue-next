import { adminClient } from '@/lib/api/client';

// 积分接口(/api/core/point/*)。查询默认是登录用户本人;管理员可以带 userId 查看他人。

/** 积分余额(user_point) */
export interface UserPointResp {
  userId: number;
  point: number; // 可用积分
  totalPoint: number; // 累计获得
}

/** 积分流水(user_point_record):point 为正是获得,为负是消耗 */
export interface PointRecordInfo {
  id: number;
  userId: number;
  point: number;
  type: string;
  info?: string;
  sourceType?: string;
  sourceId?: number;
  createTime?: string;
}

/** 成就(后端 AchievementVO) */
export interface AchievementInfo {
  id: number;
  name: string;
  info?: string;
  icon?: string;
  unlocked?: boolean;
  unlock_time?: number; // Unix 秒
  reward_point?: number;
}

export interface UserPointQuery {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  userId?: number;
  type?: string;
}

export interface PointRecordListResp {
  records?: PointRecordInfo[];
  list?: PointRecordInfo[];
  total?: number;
  totalRow?: number;
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

export interface UserActivityListResp {
  list: UserActivityInfo[];
  total: number;
}

/** 积分余额;没有积分账户时后端返回 null */
export async function getUserPoint(userId?: number) {
  return adminClient<UserPointResp | null>('/point/user', {
    method: 'GET',
    params: userId ? { userId } : undefined,
  });
}

/** 积分流水;管理员不传 userId 时返回全部用户的流水 */
export async function listPointRecords(params?: UserPointQuery) {
  return adminClient<PointRecordListResp>('/point/records', {
    method: 'GET',
    params,
  });
}

/** 成就列表(含当前用户的解锁状态) */
export async function listAchievements(userId?: number) {
  return adminClient<AchievementInfo[]>('/point/achievements', {
    method: 'GET',
    params: userId ? { userId } : undefined,
  });
}

/** 管理员给用户授予成就,并发放成就积分 */
export async function grantAchievement(userId: number, achievementId: number) {
  return adminClient('/point/unlock', {
    method: 'POST',
    params: { userId, achievementId },
  });
}

/** 管理员调整积分:正数发放、负数扣减,记一条 admin_adjust 流水 */
export async function adjustUserPoint(data: { userId: number; point: number; info?: string }) {
  return adminClient<UserPointResp>('/point/adjust', {
    method: 'POST',
    data,
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
export async function createUserActivity(data: unknown) {
  return adminClient<UserActivityInfo>('/user-activity', {
    method: 'POST',
    data,
  });
}
