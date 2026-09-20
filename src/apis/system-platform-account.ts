/**
 * 后台:自媒体平台账号管理 API(social_account)
 * 后端路由:`GET/POST /api/core/admin/platform-account/*` (cmd/core-api/main.go RegisterAdmin)
 *
 * 设计原则:
 *   - secret 字段不回显:返回 hasClientSecret / hasAccessToken / hasRefreshToken 等布尔标记
 *   - 写入时只改非空字段,后端 updateSelective 已处理
 *   - OAuth 授权(genAuthUrl / refreshAuth)在 Phase 2 接入,前端先预留调用
 */

import { adminClient } from '@/lib/api/client';

export interface PlatformAccount {
  id: number;
  platform: string;          // douyin/kuaishou/xiaohongshu/wxchannel/bilibili
  accountName: string;
  clientKey: string;
  hasClientSecret: boolean;
  redirectUri: string;
  scope: string;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  expiresAt?: number;        // Unix 秒
  refreshExpiresAt?: number;
  boundUserId: number;
  platformUserId: string;
  platformUserNickname: string;
  status: number;            // 1 启用 / 0 禁用
  authStatus: number;        // 0 未授权 / 1 已授权 / 2 已过期 / 3 凭据缺失
  remark: string;
  createTime: string;
  updateTime: string;
}

/** 平台列表(供前端下拉,后端 allowedPlatforms 同步) */
export const PLATFORMS = [
  { value: 'douyin', label: '抖音', color: '#FE2C55', hint: '抖音开放平台 → 应用详情 → client_key / client_secret。需企业资质审核。' },
  { value: 'kuaishou', label: '快手', color: '#FFA836', hint: '快手开放平台 → 我的应用 → AppID / AppSecret。需企业资质审核。' },
  { value: 'xiaohongshu', label: '小红书', color: '#FF2442', hint: '小红书创作者中心 → 合作 / 蒲公英 → 仅企业号可申请,不开放图文发布 API。' },
  { value: 'wxchannel', label: '微信视频号', color: '#07C160', hint: '视频号助手 → 开放生态。预留。' },
  { value: 'bilibili', label: 'B站', color: '#00A1D6', hint: 'B站开放平台 → 创作者。预留。' },
] as const;

export const platformLabel = (v: string) => PLATFORMS.find((p) => p.value === v)?.label || v || '(未设置)';

/** 鉴权状态文案 + 颜色 */
export const AUTH_STATUS_META: Record<number, { label: string; color: 'default' | 'success' | 'warning' | 'error' }> = {
  0: { label: '未授权', color: 'default' },
  1: { label: '已授权', color: 'success' },
  2: { label: '已过期', color: 'warning' },
  3: { label: '凭据缺失', color: 'error' },
};

// 后端 GET /admin/platform-account/list
export async function page(params: {
  page?: number;
  pageSize?: number;
  platform?: string;
  keyword?: string;
  status?: number;
}) {
  return adminClient<{ list?: PlatformAccount[]; total?: number }>('/admin/platform-account/list', { params });
}

// 后端 GET /admin/platform-account/getById
export async function getById(id: number) {
  return adminClient<PlatformAccount>('/admin/platform-account/getById', { params: { id } });
}

// 后端 POST /admin/platform-account/create
export async function create(params: {
  platform: string;
  accountName: string;
  clientKey: string;
  clientSecret?: string;
  redirectUri?: string;
  scope?: string;
  boundUserId?: number;
  status?: number;
  remark?: string;
}) {
  return adminClient<PlatformAccount>('/admin/platform-account/create', { method: 'POST', data: params });
}

// 后端 POST /admin/platform-account/updateById
export async function update(params: {
  id: number;
  platform: string;
  accountName: string;
  clientKey: string;
  clientSecret?: string;  // 留空表示不修改原值
  redirectUri?: string;
  scope?: string;
  boundUserId?: number;
  status?: number;
  remark?: string;
}) {
  return adminClient<PlatformAccount>('/admin/platform-account/updateById', { method: 'POST', data: params });
}

// 后端 POST /admin/platform-account/removeByIds
export async function remove(ids: number[]) {
  return adminClient('/admin/platform-account/removeByIds', { method: 'POST', data: { ids } });
}

// Phase 2:OAuth 授权相关(占位,后端实现后再启用)
export async function genAuthUrl(id: number) {
  return adminClient<{ url: string; state: string }>('/admin/platform-account/genAuthUrl', { method: 'POST', data: { id } });
}

export async function refreshAuth(id: number) {
  return adminClient<PlatformAccount>('/admin/platform-account/refreshAuth', { method: 'POST', data: { id } });
}