/**
 * C 端用户自媒体账号 API(social_account)
 *
 * 后端路由:`POST /api/core/share/account/*`(cmd/core-api/main.go RegisterUserAccountRoutes)
 *
 * 用户在创作者中心自备抖音 / 快手 / 小红书开放平台 client_key / client_secret 接入清秋月;
 * 清秋月用本人账号把站内作品一键发布出去。作品归属清秋月,视频素材由用户先在三方创作者中心
 * 上传后,回填 video_id,清秋月直接 POST /video/create/ 提交。
 */

import { adminClient } from '@/lib/api/client';

export interface ShareAccount {
  id: number;
  platform: string;          // douyin / kuaishou / xiaohongshu / youtube / tiktok
  accountName: string;
  clientKey: string;
  hasClientSecret: boolean;
  redirectUri: string;
  scope: string;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  expiresAt?: number;        // Unix 秒
  refreshExpiresAt?: number;
  boundUserId: number;       // 始终 = 当前用户
  platformUserId: string;
  platformUserNickname: string;
  status: number;            // 1 启用 / 0 禁用
  authStatus: number;        // 0 未授权 / 1 已授权 / 2 已过期 / 3 凭据缺失
  remark: string;
  createTime: string;
  updateTime: string;
  /** 海外平台没自备应用:用清秋月平台应用授权(此时没有 secret 是正常的) */
  usesBuiltinApp?: boolean;
}

/** 平台列表(后端 allowedPlatforms 同步) */
export const PLATFORMS = [
  { value: 'douyin', label: '抖音', color: '#FE2C55', hint: '抖音开放平台 → 我的应用 → 网站应用 → client_key / client_secret。授权回调域名必须是清秋月部署域名。' },
  { value: 'kuaishou', label: '快手', color: '#FFA836', hint: '快手开放平台 → 我的应用 → 网站应用 → AppID / AppSecret。授权回调域名必须是清秋月部署域名。' },
  { value: 'xiaohongshu', label: '小红书', color: '#FF2442', hint: '小红书创作者中心 → 蒲公英 / 合作。仅企业号可申请;不开放图文/视频发布 API,只能拿账号信息用于展示。' },
  { value: 'youtube', label: 'YouTube', color: '#FF0000', hint: '点「一键绑定」用 Google 账号授权即可,清秋月代为上传(竖屏 ≤3 分钟自动归为 Shorts)。也可以填自己的 Google Cloud OAuth 客户端。' },
  { value: 'tiktok', label: 'TikTok', color: '#25F4EE', hint: '点「一键绑定」用 TikTok 账号授权即可。应用未过审期间只能「仅自己可见」发布,且要求账号设为私密。' },
] as const;

/** 海外平台:可用清秋月平台应用一键绑定,clientKey 可不填 */
export const INTL_PLATFORMS = ['youtube', 'tiktok'];
export const isIntlPlatform = (v: string) => INTL_PLATFORMS.includes(v);

export const platformLabel = (v: string) => PLATFORMS.find((p) => p.value === v)?.label || v || '(未设置)';

/** 鉴权状态文案 + 颜色 */
export const AUTH_STATUS_META: Record<number, { label: string; color: 'default' | 'success' | 'warning' | 'error' }> = {
  0: { label: '未授权', color: 'default' },
  1: { label: '已授权', color: 'success' },
  2: { label: '已过期', color: 'warning' },
  3: { label: '凭据缺失', color: 'error' },
};

// 后端 POST /share/account/list
export async function page(params: {
  page?: number;
  pageSize?: number;
  platform?: string;
  keyword?: string;
}) {
  return adminClient<{ list?: ShareAccount[]; total?: number; page?: number }>(
    '/share/account/list',
    { method: 'POST', data: params }
  );
}

// 后端 POST /share/account/create
// clientSecret 必填:用户自备凭证,空值后端会拒(YouTube / TikTok 在清秋月配了平台应用时可都留空)。
export async function create(params: {
  platform: string;
  accountName: string;
  clientKey: string;
  clientSecret: string;
  redirectUri?: string;
  scope?: string;
  remark?: string;
}) {
  return adminClient<ShareAccount>('/share/account/create', { method: 'POST', data: params });
}

// 后端 POST /share/account/updateById
// clientSecret 留空 = 后端不修改原值;只有用户主动想换 secret 时才传。
export async function update(params: {
  id: number;
  platform: string;
  accountName: string;
  clientKey: string;
  clientSecret?: string;
  redirectUri?: string;
  scope?: string;
  remark?: string;
}) {
  return adminClient<ShareAccount>('/share/account/updateById', { method: 'POST', data: params });
}

// 后端 POST /share/account/removeByIds
export async function remove(ids: number[]) {
  return adminClient('/share/account/removeByIds', { method: 'POST', data: { ids } });
}

// 后端 POST /share/account/genAuthUrl
// 返回的 url 是三方授权页 URL,前端 window.open 跳过去;成功后三方回跳
// /api/core/socialshare/callback/:platform?code=...&state=...,后端再 302 回
// /account/content?tab=accounts&auth=ok/fail&platform=...。
export async function genAuthUrl(id: number) {
  return adminClient<{ url: string }>('/share/account/genAuthUrl', { method: 'POST', data: { id } });
}

// 后端 POST /share/account/refreshAuth
export async function refreshAuth(id: number) {
  return adminClient<ShareAccount>('/share/account/refreshAuth', { method: 'POST', data: { id } });
}
/** 后端 GET /share/platforms 的一项 */
export interface SharePlatformInfo {
  platform: string;
  /** 清秋月已配好平台应用:绑定只需授权 */
  builtinApp: boolean;
  /** 平台应用未过审:发出去只能私享 / 仅自己可见 */
  privateOnly: boolean;
  /** 回调地址(自备应用时填到开放平台后台) */
  redirectUri: string;
}

// 后端 GET /share/platforms
export async function platforms() {
  return adminClient<SharePlatformInfo[]>('/share/platforms');
}

// 后端 POST /share/account/bind:YouTube / TikTok 用清秋月平台应用一键绑定,返回新账号 + 授权地址
export async function bind(platform: string, accountName?: string) {
  return adminClient<{ account: ShareAccount; url: string }>('/share/account/bind', {
    method: 'POST',
    data: { platform, accountName },
  });
}
