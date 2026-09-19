import { accountClient } from '@/lib/api/client';

// 成长体系:签到、装扮(头像框/称号/名字颜色)、收货地址、行政区划。
// 后端 internal/growth + internal/shopapp,路径都在 /api/core 下。

// ========== 签到 ==========

export interface SignResult {
  points: number; // 本次获得(含连续签到奖励)
  balance: number;
  seriesDays: number;
  bonus: number; // 其中连续签到的额外奖励
}

export async function signIn(): Promise<SignResult> {
  return accountClient.post<SignResult>('/daily-task/sign', {});
}

/** 成长概览:积分、等级进度、签到状态 */
export interface GrowthSummary {
  point: number;
  totalPoint: number;
  level: number;
  levelName: string;
  levelMin: number;
  nextLevel?: number;
  nextLevelName?: string;
  nextMin?: number;
  levels: Array<{ level: number; name: string; min: number }>;
  signed: boolean;
  seriesDays: number;
  totalDays: number;
}

export async function getGrowthSummary(): Promise<GrowthSummary> {
  return accountClient<GrowthSummary>('/daily-task/growth');
}

// ========== 装扮 ==========

export type CosmeticKind = 'avatar_frame' | 'title' | 'name_color';

export const COSMETIC_LABEL: Record<CosmeticKind, string> = {
  avatar_frame: '头像框',
  title: '称号',
  name_color: '名字颜色',
};

export interface UserCosmetic {
  id: number;
  kind: CosmeticKind;
  itemId: number;
  name: string;
  value: string;
  equipped: boolean;
  source: 'mall' | 'achievement' | 'admin';
  expiresAt?: string;
  createdAt: string;
}

/** 一个用户对外展示的成长信息:戴着的装扮 + 等级 + VIP */
export interface UserDecor {
  userId: string;
  frame?: string;
  title?: string;
  nameColor?: string;
  level: number;
  levelName?: string;
  vip?: number;
  /** 创作者等级(2–5;1 级不下发)。Lv3 起可收打赏/礼物,Lv4 起可发付费内容 */
  creatorLevel?: number;
}

export async function getMyCosmetics(): Promise<UserCosmetic[]> {
  return (await accountClient<{ list: UserCosmetic[] }>('/user/cosmetics'))?.list ?? [];
}

/** 传 id 戴上;只传 kind 摘下这一类 */
export async function equipCosmetic(arg: { id: number } | { kind: CosmeticKind }): Promise<UserDecor> {
  return accountClient.post<UserDecor>('/user/cosmetics/equip', arg);
}

export async function getDecor(ids: Array<string | number>): Promise<UserDecor[]> {
  if (ids.length === 0) return [];
  return (await accountClient<{ list: UserDecor[] }>('/user/decor', { params: { ids: ids.join(',') } }))?.list ?? [];
}

// ========== 收货地址 ==========

export interface UserAddress {
  id?: number;
  receiver: string;
  phone: string;
  provinceCode?: string;
  cityCode?: string;
  areaCode?: string;
  province?: string;
  city?: string;
  area?: string;
  detail: string;
  isDefault?: boolean;
}

export const addressText = (a: UserAddress) =>
  `${a.receiver} ${a.phone} ${a.province ?? ''}${a.city ?? ''}${a.area ?? ''}${a.detail}`.trim();

export async function getAddresses(): Promise<UserAddress[]> {
  return (await accountClient<{ list: UserAddress[] }>('/user/address'))?.list ?? [];
}

export async function saveAddress(a: UserAddress): Promise<UserAddress> {
  return accountClient.post<UserAddress>('/user/address', a);
}

export async function deleteAddress(id: number) {
  return accountClient(`/user/address/${id}`, { method: 'DELETE' });
}

export interface Region {
  code: string;
  name: string;
}

export async function getRegions(level: 'provinces' | 'cities' | 'areas', parent?: string): Promise<Region[]> {
  return (await accountClient<{ list: Region[] }>(`/region/${level}`, { params: parent ? { parent } : undefined }))?.list ?? [];
}
