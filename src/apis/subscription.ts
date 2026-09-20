// 数字人专题订阅 API —— 与后端 subscription_handler.go 对齐。
//
// 路由(都在 content-api):
//   GET    /api/digital-human/subscription          列出当前用户的订阅
//   POST   /api/digital-human/subscription          新增(同 target 视为幂等)
//   PUT    /api/digital-human/subscription/:id/toggle  启停切换
//   DELETE /api/digital-human/subscription/:id      删除
//
// target_type ∈ {subcategory, vendor, topic}
// enabled=1 才推送(见 dispatcher.findRecipients)

import { contentClient } from '@/lib/api/client';
import { API_PREFIX } from '@/lib/api/prefix';

export type SubscriptionTargetType = 'subcategory' | 'vendor' | 'topic';

export interface SubscriptionItem {
  id: number;
  user_id: number;
  target_type: SubscriptionTargetType;
  target_key: string;
  enabled: boolean | number;
  create_time?: string;
}

export interface CreateSubscriptionPayload {
  target_type: SubscriptionTargetType;
  target_key: string;
}

export async function listSubscriptions(): Promise<{ list: SubscriptionItem[] } | SubscriptionItem[]> {
  return contentClient('/digital-human/subscription', { method: 'GET' });
}

export async function createSubscription(payload: CreateSubscriptionPayload) {
  return contentClient.post('/digital-human/subscription', payload);
}

export async function toggleSubscription(id: number) {
  return fetch(`${API_PREFIX}/api/content/digital-human/subscription/${id}/toggle`, {
    method: 'PUT',
  }).then((r) => r.json());
}

export async function deleteSubscription(id: number) {
  return fetch(`${API_PREFIX}/api/content/digital-human/subscription/${id}`, {
    method: 'DELETE',
  }).then((r) => r.json());
}