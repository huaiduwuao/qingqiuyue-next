import { adminClient } from '@/lib/api/client';

export interface BotListParams {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  name?: string;
  keyword?: string;  // 模糊搜索 name/nickname
  status?: string;
}

function normalizePage(res: any) {
  const d = res?.data ?? {};
  return {
    ...res,
    data: {
      records: d.records ?? d.list ?? [],
      totalRow: d.totalRow ?? d.total ?? 0,
    },
  };
}

export async function page(params: BotListParams) {
  const res = await adminClient('/bot/list', { params });
  return normalizePage(res);
}

export async function get(id: number) {
  return adminClient(`/bot/${id}`);
}

export async function save(params: Record<string, unknown>) {
  return adminClient('/bot', { method: 'POST', data: params });
}

export async function update(params: Record<string, unknown>) {
  return adminClient(`/bot/${params.id}`, { method: 'PUT', data: params });
}

export async function remove(ids: number[]) {
  const list = Array.isArray(ids) ? ids : [ids];
  return Promise.all(list.map((id) => adminClient(`/bot/${id}`, { method: 'DELETE' })));
}

export async function pause(id: number) {
  return adminClient(`/bot/${id}/pause`, { method: 'POST' });
}

export async function resume(id: number) {
  return adminClient(`/bot/${id}/resume`, { method: 'POST' });
}

// 批量创建假人
export interface BatchCreateBotParams {
  count: number;                   // 数量 1-100
  prefix?: string;                 // 名称前缀
  personaPrompt?: string;          // 统一人设
  commentTemplates?: string[];     // 统一评论模板
  useLlmForComments?: boolean;     // 是否用 LLM
  llmModel?: string;               // LLM 模型
  commentIntervalMinutes?: number; // 评论间隔(分钟)
  initBalance?: number;            // 初始积分(分)
}

export interface BatchCreateBotResponse {
  successCount: number;
  failedCount: number;
  createdIds: number[];
  failedNames: string[];
}

export async function batchCreate(params: BatchCreateBotParams): Promise<BatchCreateBotResponse> {
  const res = await adminClient('/bot/batch', { method: 'POST', data: params });
  return res?.data ?? res;
}