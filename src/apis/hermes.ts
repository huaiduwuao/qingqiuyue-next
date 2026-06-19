import { adminClient, contentClient, imClient } from '@/lib/api/client';

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

// ===== Admin (/api/core/hermes/*) =====
export async function page(params: any) {
  const res = await adminClient('/hermes/list', { params });
  return normalizePage(res);
}

export async function get(id: number) {
  return adminClient(`/hermes/${id}`);
}

export async function save(params: any) {
  return adminClient('/hermes', { method: 'POST', data: params });
}

export async function update(params: any) {
  return adminClient(`/hermes/${params.id}`, { method: 'PUT', data: params });
}

export async function remove(ids: number[]) {
  const list = Array.isArray(ids) ? ids : [ids];
  return Promise.all(list.map((id) => adminClient(`/hermes/${id}`, { method: 'DELETE' })));
}

export async function publish(id: number) {
  return adminClient(`/hermes/${id}/publish`, { method: 'POST' });
}

export async function unpublish(id: number) {
  return adminClient(`/hermes/${id}/unpublish`, { method: 'POST' });
}

export async function pause(id: number) {
  return adminClient(`/hermes/${id}/pause`, { method: 'POST' });
}

export async function resume(id: number) {
  return adminClient(`/hermes/${id}/resume`, { method: 'POST' });
}

export async function instanceStatus() {
  return adminClient('/hermes/instance/status');
}

export async function instanceSync() {
  return adminClient('/hermes/instance/sync', { method: 'POST' });
}

// ===== Client (/api/content/hermes/client/*) =====
export async function clientPage(params: any) {
  const res = await contentClient('/hermes/client/page', { params });
  return normalizePage(res);
}

export async function clientDetail(id: number | string) {
  return contentClient(`/hermes/client/${id}`);
}

export async function clientGreeting(id: number | string) {
  return contentClient(`/hermes/client/${id}/greeting`);
}

export async function clientHistory(id: number | string) {
  return contentClient(`/hermes/client/${id}/history`);
}

// ===== Chat (/api/realtime/hermes/*) =====
export async function chat(agentId: string, message: string) {
  return imClient<{ text: string; code?: string | number; msg?: string; data?: { text: string } }>(
    '/hermes/chat',
    { method: 'POST', data: { agentId, message } },
  );
}

export const hermesApi = {
  page,
  get,
  save,
  update,
  remove,
  publish,
  unpublish,
  pause,
  resume,
  instanceStatus,
  instanceSync,
  clientPage,
  clientDetail,
  clientGreeting,
  clientHistory,
  chat,
};

export default hermesApi;