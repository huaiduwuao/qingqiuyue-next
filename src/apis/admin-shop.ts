import { adminClient } from '@/lib/api/client';

// 管理后台:商城商品、订单发货、礼物目录(/api/core/admin/shop/*,仅管理员)。
// 每个商品只标一种货币:装扮(头像框/称号/名字颜色)只收积分,实物可以标积分或钻石。积分永远换不到钻石。

export type DeliverType = 'physical' | 'avatar_frame' | 'title' | 'name_color';

export interface AdminMallItem {
  id?: number;
  name: string;
  desc: string;
  category: 'virtual' | 'privilege' | 'physical' | 'limited';
  emoji: string;
  gradient: string;
  points: number;
  originalPoints: number;
  stock: number; // -1 不限量
  totalRedeemed?: number;
  tag: string;
  currency: 'point' | 'diamond';
  priceCents: number; // 钻石商品的价格(分;1 钻 = 10 分)
  deliverType: DeliverType;
  cosmeticValue: string; // 装扮样式值:头像框/名字颜色填 CSS 渐变或颜色,称号填文字
  durationDays: number; // 装扮有效天数,0 = 永久
  status: 'active' | 'offline';
  sort: number;
}

export interface AdminRedemption {
  id: number;
  userId: number;
  itemId: number;
  itemName: string;
  points: number;
  currency: 'point' | 'diamond';
  amountCents: number;
  deliverType: DeliverType;
  isBot: boolean; // 假人订单由仓库流程自动发货
  status: 'pending' | 'shipped' | 'completed';
  serial: string;
  address?: string;
  tracking?: string;
  redeemedAt: string;
}

export interface AdminGift {
  id?: number;
  name: string;
  icon: string;
  price: number; // 分
  effect: 'small' | 'medium' | 'large' | 'huge';
  combo: boolean;
  status: 'active' | 'offline';
  sort: number;
}

// 后端 admin shop 接口返回 {list, total},与项目里 70+ 个 A 模式接口一致(如 system-dict)。
// axios 拦截器(client.ts)已经把 list/records、total/totalRow 互填别名,所以这里读 .list 即可。
type ListResp<T> = { list: T[]; records?: T[]; total: number; totalRow?: number };

export async function listMallItems(): Promise<AdminMallItem[]> {
  const r = await adminClient<ListResp<AdminMallItem>>('/admin/shop/mall/items');
  return r?.list ?? [];
}

export async function saveMallItem(item: AdminMallItem) {
  return item.id
    ? adminClient(`/admin/shop/mall/items/${item.id}`, { method: 'PUT', data: item })
    : adminClient('/admin/shop/mall/items', { method: 'POST', data: item });
}

export async function listRedemptions(status?: string): Promise<AdminRedemption[]> {
  const r = await adminClient<ListResp<AdminRedemption>>('/admin/shop/mall/redemptions', {
    params: status ? { status } : undefined,
  });
  return r?.list ?? [];
}

export async function shipRedemption(id: number, tracking: string) {
  return adminClient(`/admin/shop/mall/redemptions/${id}/ship`, { method: 'PUT', data: { tracking } });
}

export async function completeRedemption(id: number) {
  return adminClient(`/admin/shop/mall/redemptions/${id}/complete`, { method: 'PUT' });
}

export async function listGifts(): Promise<AdminGift[]> {
  const r = await adminClient<ListResp<AdminGift>>('/admin/shop/gifts');
  return r?.list ?? [];
}

export async function saveGift(gift: AdminGift) {
  return gift.id
    ? adminClient(`/admin/shop/gifts/${gift.id}`, { method: 'PUT', data: gift })
    : adminClient('/admin/shop/gifts', { method: 'POST', data: gift });
}
