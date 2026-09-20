// 数字人专题订阅 API —— 与后端 subscription_handler.go 对齐。
//
// 路由(挂在 content-api 的 api 组下,前缀是 /api/content):
//   GET    /api/content/digital-human/subscription             列出当前用户的订阅
//   POST   /api/content/digital-human/subscription             新增(同 target 视为幂等)
//   PUT    /api/content/digital-human/subscription/:id/toggle  启停切换,body 必须带 {enabled}
//   DELETE /api/content/digital-human/subscription/:id         删除
//
// 全部走 contentClient:四个接口都要登录态(handler 用 middleware.GetUserID),
// 裸 fetch 不带会话,拿到的只会是 401。
//
// target_type ∈ {subcategory, vendor, topic}
// enabled=1 才推送(见 dispatcher.findRecipients)

import { contentClient } from '@/lib/api/client';

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

/** enabled 是切换后的目标值(handler 直接把它写进 enabled 列,不做取反)。 */
export async function toggleSubscription(id: number, enabled: boolean) {
  return contentClient.put(`/digital-human/subscription/${id}/toggle`, { enabled: enabled ? 1 : 0 });
}

export async function deleteSubscription(id: number) {
  return contentClient.delete(`/digital-human/subscription/${id}`);
}