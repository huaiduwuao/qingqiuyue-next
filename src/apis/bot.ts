import { adminClient } from '@/lib/api/client';

export interface BotListParams {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  name?: string;
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

export async function save(params: any) {
  return adminClient('/bot', { method: 'POST', data: params });
}

export async function update(params: any) {
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