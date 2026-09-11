import { adminClient } from '@/lib/api/client';

// 管理后台:积分商城商品、兑换单发货、直播礼物目录(/api/core/admin/shop/*,仅管理员)。

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
  deliverType: 'diamond' | 'physical';
  deliverAmount: number; // 钻石类发放的钱包金额(分)
  status: 'active' | 'offline';
  sort: number;
}

export interface AdminRedemption {
  id: number;
  userId: number;
  itemId: number;
  itemName: string;
  points: number;
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

type ListResp<T> = { data?: { list?: T[] } };

export async function listMallItems(): Promise<AdminMallItem[]> {
  const res = (await adminClient('/admin/shop/mall/items')) as ListResp<AdminMallItem>;
  return res?.data?.list ?? [];
}

export async function saveMallItem(item: AdminMallItem) {
  return item.id
    ? adminClient(`/admin/shop/mall/items/${item.id}`, { method: 'PUT', data: item })
    : adminClient('/admin/shop/mall/items', { method: 'POST', data: item });
}

export async function listRedemptions(status?: string): Promise<AdminRedemption[]> {
  const res = (await adminClient('/admin/shop/mall/redemptions', { params: status ? { status } : undefined })) as ListResp<AdminRedemption>;
  return res?.data?.list ?? [];
}

export async function shipRedemption(id: number, tracking: string) {
  return adminClient(`/admin/shop/mall/redemptions/${id}/ship`, { method: 'PUT', data: { tracking } });
}

export async function completeRedemption(id: number) {
  return adminClient(`/admin/shop/mall/redemptions/${id}/complete`, { method: 'PUT' });
}

export async function listGifts(): Promise<AdminGift[]> {
  const res = (await adminClient('/admin/shop/gifts')) as ListResp<AdminGift>;
  return res?.data?.list ?? [];
}

export async function saveGift(gift: AdminGift) {
  return gift.id
    ? adminClient(`/admin/shop/gifts/${gift.id}`, { method: 'PUT', data: gift })
    : adminClient('/admin/shop/gifts', { method: 'POST', data: gift });
}
