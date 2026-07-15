import { adminClient, contentClient, imClient } from '@/lib/api/client';
import type { PageParams, PageResult } from '@/beans/pagination';
import { normalizeLegacyPageResponse } from '@/hooks/usePagination';

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

export interface HermesDiscoverCandidate {
  containerId: string;
  containerName: string;
  image: string;
  command?: string;
  networkIp?: string;
  port?: number;
  baseUrl?: string;
  action: 'imported' | 'updated' | 'skipped';
  reason?: string;
  instanceId?: number;
}

export interface HermesDiscoverResult {
  scanned: number;
  candidates: number;
  imported: number;
  updated: number;
  skipped: number;
  items: HermesDiscoverCandidate[];
}

// ===== Admin (/api/core/hermes/*) =====
// --- Agent ---
export interface HermesListParams extends PageParams {
  name?: string;
  status?: string;
  instanceId?: number;
}

export async function page(params: HermesListParams): Promise<PageResult<HermesInstanceItem>> {
  const res = await adminClient('/hermes/list', { params });
  return normalizeLegacyPageResponse((res as any)?.data ?? res);
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
export interface HermesInstanceListParams extends PageParams {
  name?: string;
  status?: string;
  [key: string]: any;
}

export async function instancePage(params: HermesInstanceListParams = {}): Promise<PageResult<HermesInstanceItem>> {
  const res = await adminClient('/hermes/instance/list', { params });
  return normalizeLegacyPageResponse((res as any)?.data ?? res);
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

export async function instanceDiscover() {
  return adminClient<HermesDiscoverResult>('/hermes/instance/discover', { method: 'POST' });
}

// ===== Memory Admin (/api/core/hermes/memory/*) =====

export interface HermesMemoryAdminItem {
  id: number;
  userId: number;
  agentId: string;
  scope: string;
  content: string;
  sourceNodeId: string;
  sourceHermesInstanceId: number;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface HermesMemoryAdminListParams extends PageParams {
  userId?: number;
  agentId?: string;
  scope?: string;
  keyword?: string;
}

export async function memoryAdminPage(params: HermesMemoryAdminListParams = {}): Promise<PageResult<HermesMemoryAdminItem>> {
  const res = await adminClient('/hermes/memory/list', { params });
  return normalizeLegacyPageResponse((res as any)?.data ?? res);
}

export async function memoryAdminDelete(id: number) {
  return adminClient(`/hermes/memory/${id}`, { method: 'DELETE' });
}

export async function memoryAdminBatchDelete(ids: number[]) {
  return adminClient('/hermes/memory/batch', { method: 'DELETE', data: { ids } });
}

// ===== Conversation Admin (/api/core/hermes/conversation/*) =====

export interface HermesConversationAdminItem {
  id: string;
  userId: number;
  agentId: string;
  title: string;
  hermesSessionId: string;
  summary?: string;
  metadata?: Record<string, any>;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface HermesConversationAdminListParams extends PageParams {
  userId?: number;
  agentId?: string;
}

export async function conversationAdminPage(params: HermesConversationAdminListParams = {}): Promise<PageResult<HermesConversationAdminItem>> {
  const res = await adminClient('/hermes/conversation/list', { params });
  return normalizeLegacyPageResponse((res as any)?.data ?? res);
}

export interface HermesConversationMessage {
  id: number;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  emotion?: Record<string, number>;
  action?: string;
  toolCalls?: any[];
  createTime: string;
}

export interface HermesConversationMessagesResp {
  conversationId: string;
  messages: HermesConversationMessage[];
  totalRow: number;
}

export async function conversationAdminMessages(conversationId: string, limit = 50) {
  const res = await adminClient<HermesConversationMessagesResp>(
    `/hermes/conversation/${conversationId}/messages`,
    { params: { limit } },
  );
  return res?.data ?? res;
}

export async function conversationAdminDelete(conversationId: string) {
  return adminClient(`/hermes/conversation/${conversationId}`, { method: 'DELETE' });
}

// ===== Client (/api/content/hermes/client/*) =====
export async function clientPage(params: PageParams): Promise<PageResult<any>> {
  const res = await contentClient('/hermes/client/page', { params });
  return normalizeLegacyPageResponse((res as any)?.data ?? res);
}

export async function clientDetail(id: number | string) {
  return contentClient(`/hermes/client/${id}`);
}

export async function clientGreeting(id: number | string) {
  return contentClient(`/hermes/client/${id}/greeting`);
}

export async function clientHistory(id: number | string, conversationId?: string) {
  return contentClient(`/hermes/client/${id}/history`, {
    params: conversationId ? { conversationId } : {},
  });
}

// ===== Chat (/api/realtime/hermes/*) =====
export async function chat(agentId: string, message: string, conversationId?: string) {
  return imClient<{ text: string; conversationId?: string; code?: string | number; msg?: string; data?: { text: string; conversationId?: string } }>(
    '/hermes/chat',
    { method: 'POST', data: { agentId, message, conversationId } },
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
  instanceDiscover,
  clientPage,
  clientDetail,
  clientGreeting,
  clientHistory,
  chat,
  // Memory Admin
  memoryAdminPage,
  memoryAdminDelete,
  memoryAdminBatchDelete,
  // Conversation Admin
  conversationAdminPage,
  conversationAdminMessages,
  conversationAdminDelete,
};

export default hermesApi;
