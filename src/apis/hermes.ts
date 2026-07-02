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

// ===== Types =====
export interface HermesInstanceItem {
  id: number;
  name: string;
  code: string;
  baseUrl: string;
  description?: string;
  region: string;
  maxConcurrent: number;
  status: 'active' | 'paused' | 'offline';
  healthStatus: 'unknown' | 'healthy' | 'unhealthy';
  lastHealthAt?: string;
  agentCount?: number;
  createTime: string;
  updateTime: string;
}

export interface HermesInstanceHealthResp {
  ok: boolean;
  agentCount: number;
  baseUrl: string;
  message: string;
}

export interface HermesInstanceSyncResp {
  imported: number;
  skipped: number;
}

// ===== Admin (/api/core/hermes/*) =====
// --- Agent ---
export interface HermesListParams {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  name?: string;
  status?: string;
  instanceId?: number;
}

export async function page(params: HermesListParams) {
  // 后端 GET /list 接受 instance_id 作为过滤参数
  const res = await adminClient('/hermes/list', { params });
  return normalizePage(res);
}

export async function get(id: number) {
  return adminClient(`/hermes/${id}`);
}

export async function save(params: Record<string, unknown>) {
  // 接受 instanceId(可选) — 后端 POST /
  return adminClient('/hermes', { method: 'POST', data: params });
}

export async function update(params: Record<string, unknown>) {
  // 接受 instanceId(可选) — 后端 PUT /:id
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

// --- Instance (legacy single-instance, kept for backward compatibility) ---
export async function instanceStatus() {
  return adminClient('/hermes/instance/status');
}

export async function instanceSync() {
  return adminClient('/hermes/instance/sync', { method: 'POST' });
}

// --- Instance (CRUD on hermes containers) ---
export interface HermesInstanceListParams {
  page?: number;
  pageSize?: number;
  pageNumber?: number;
  current?: number;
  name?: string;
  status?: string;
  [key: string]: any;
}

export async function instancePage(params: HermesInstanceListParams = {}) {
  const res = await adminClient('/hermes/instance/list', { params });
  return normalizePage(res);
}

export async function instanceGet(id: number) {
  return adminClient(`/hermes/instance/${id}`);
}

export async function instanceSave(data: unknown) {
  return adminClient('/hermes/instance', { method: 'POST', data });
}

export async function instanceUpdate(data: { id: number } & Record<string, unknown>) {
  return adminClient(`/hermes/instance/${data.id}`, { method: 'PUT', data });
}

export async function instanceRemove(id: number) {
  return adminClient(`/hermes/instance/${id}`, { method: 'DELETE' });
}

export async function instanceHealth(id: number) {
  return adminClient<HermesInstanceHealthResp>(`/hermes/instance/${id}/health`, { method: 'POST' });
}

export async function instanceSyncAgents(id: number) {
  return adminClient<HermesInstanceSyncResp>(`/hermes/instance/${id}/sync`, { method: 'POST' });
}

// ===== Client (/api/content/hermes/client/*) =====
export async function clientPage(params: Record<string, unknown>) {
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
  instancePage,
  instanceGet,
  instanceSave,
  instanceUpdate,
  instanceRemove,
  instanceHealth,
  instanceSyncAgents,
  clientPage,
  clientDetail,
  clientGreeting,
  clientHistory,
  chat,
};

export default hermesApi;
