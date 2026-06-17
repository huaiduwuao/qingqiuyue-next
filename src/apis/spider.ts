import type {
  BatchJob,
  BatchStats,
  Worker,
  WorkerStats,
  SiteSlot,
  SiteSlotStats,
  CrawlTask,
  CrawlTaskDetail,
  Proxy,
  ProxyStats,
  TemplateAttr,
  TemplateDetail,
  AutoTemplateResult,
  CrawlStats,
  HealthStatus,
  CrawlTimeseries,
  ActivityFeed,
  SpiderSource,
} from '@/beans/spider';
import { spiderClient } from '@/lib/api/client';

// Batch Job APIs
export async function createBatch(params: { name: string; domain: string; url: string; type: string }): Promise<any> {
  return spiderClient('/batch', { method: 'POST', data: params });
}

export async function listBatch(params?: { pageNumber?: number; pageSize?: number; status?: string }): Promise<any> {
  return spiderClient('/batch', { params });
}

export async function getBatchDetail(id: number): Promise<any> {
  return spiderClient(`/batch/${id}`, { method: 'GET' });
}

export async function startBatch(id: number): Promise<any> {
  return spiderClient(`/batch/${id}/start`, { method: 'POST' });
}

export async function pauseBatch(id: number): Promise<any> {
  return spiderClient(`/batch/${id}/pause`, { method: 'POST' });
}

export async function resumeBatch(id: number): Promise<any> {
  return spiderClient(`/batch/${id}/resume`, { method: 'POST' });
}

export async function cancelBatch(id: number): Promise<any> {
  return spiderClient(`/batch/${id}/cancel`, { method: 'POST' });
}

export async function getBatchStats(id: number): Promise<any> {
  return spiderClient(`/batch/${id}/stats`, { method: 'GET' });
}

// Worker APIs
export async function listWorkers(params?: { pageNumber?: number; pageSize?: number; status?: string }): Promise<any> {
  return spiderClient('/workers', { params });
}

export async function getWorkerStats(): Promise<any> {
  return spiderClient('/workers/stats', { method: 'GET' });
}

// Site Slot APIs
export async function listSiteSlots(params?: { pageNumber?: number; pageSize?: number }): Promise<any> {
  return spiderClient('/sites/slots', { params });
}

export async function getSiteSlotStats(): Promise<any> {
  return spiderClient('/sites/slots/stats', { method: 'GET' });
}

// Source APIs
export async function listSources(params?: { pageNumber?: number; pageSize?: number }): Promise<any> {
  return spiderClient('/sources', { params });
}

export async function createSource(params: { name: string; domain: string; url: string; type: string }): Promise<any> {
  return spiderClient('/sources', { method: 'POST', data: params });
}

export async function updateSource(id: number, params: { name: string; domain: string; url: string; type: string }): Promise<any> {
  return spiderClient(`/sources/${id}`, { method: 'PUT', data: params });
}

export async function deleteSource(id: number): Promise<any> {
  return spiderClient(`/sources/${id}`, { method: 'DELETE' });
}

// Template APIs
export async function listTemplates(params?: { pageNumber?: number; pageSize?: number }): Promise<any> {
  return spiderClient('/templates', { params });
}

export async function createTemplate(params: { name: string; type: string; source: string }): Promise<any> {
  return spiderClient('/templates', { method: 'POST', data: params });
}

export async function updateTemplate(id: number, params: { name: string; type: string; source: string }): Promise<any> {
  return spiderClient(`/templates/${id}`, { method: 'PUT', data: params });
}

export async function deleteTemplate(id: number): Promise<any> {
  return spiderClient(`/templates/${id}`, { method: 'DELETE' });
}

// ─── Dashboard ───
export async function getHealth(): Promise<{ code: number; data: HealthStatus }> {
  return spiderClient('/health', { method: 'GET' });
}

export async function getCrawlStats(): Promise<{ code: number; data: CrawlStats }> {
  return spiderClient('/stats', { method: 'GET' });
}

export async function getCrawlTimeseries(): Promise<{ code: number; data: CrawlTimeseries }> {
  return spiderClient('/timeseries', { method: 'GET' });
}

export async function getRecentActivity(): Promise<{ code: number; data: ActivityFeed }> {
  return spiderClient('/activity', { method: 'GET' });
}

// ─── Tasks ───
export async function listTasks(params?: { pageNumber?: number; pageSize?: number; status?: string }): Promise<any> {
  return spiderClient('/tasks', { params });
}

export async function getTaskDetail(id: string): Promise<{ code: number; data: CrawlTaskDetail }> {
  return spiderClient(`/tasks/${id}`, { method: 'GET' });
}

export async function createTask(params: { source_id?: number; start_url: string; max_depth?: number; max_pages?: number; proxy_url?: string }): Promise<any> {
  return spiderClient('/tasks', { method: 'POST', data: params });
}

export async function stopTask(id: string): Promise<any> {
  return spiderClient(`/tasks/${id}/stop`, { method: 'POST' });
}

export async function deleteTask(id: string): Promise<any> {
  return spiderClient(`/tasks/${id}`, { method: 'DELETE' });
}

export async function getTaskItems(id: string): Promise<{ code: number; data: { list: any[]; total: number } }> {
  return spiderClient(`/tasks/${id}/items`, { method: 'GET' });
}

export async function getTaskLinks(id: string): Promise<{ code: number; data: { list: any[]; total: number } }> {
  return spiderClient(`/tasks/${id}/links`, { method: 'GET' });
}

// ─── Proxies ───
export async function listProxies(): Promise<{ code: number; data: { list: Proxy[]; total: number } }> {
  return spiderClient('/proxies', { method: 'GET' });
}

export async function getProxyStats(): Promise<{ code: number; data: ProxyStats }> {
  return spiderClient('/proxies/stats', { method: 'GET' });
}

export async function addProxy(params: { url: string; type: 'http' | 'https' | 'socks5' }): Promise<any> {
  return spiderClient('/proxies', { method: 'POST', data: params });
}

export async function toggleProxy(id: string, active: boolean): Promise<any> {
  return spiderClient(`/proxies/${id}`, { method: 'PUT', data: { active } });
}

export async function deleteProxy(id: string): Promise<any> {
  return spiderClient(`/proxies/${id}`, { method: 'DELETE' });
}

// ─── Template Attrs ───
export async function getTemplateDetail(id: number): Promise<{ code: number; data: TemplateDetail }> {
  return spiderClient(`/templates/${id}`, { method: 'GET' });
}

export async function addTemplateAttr(templateId: number, attr: { name: string; type: string; code: string; content: string; remark?: string }): Promise<any> {
  return spiderClient(`/templates/${templateId}/attrs`, { method: 'POST', data: attr });
}

export async function updateTemplateAttr(attrId: number, patch: Partial<{ name: string; type: string; code: string; content: string; remark: string }>): Promise<any> {
  return spiderClient(`/templates/attrs/${attrId}`, { method: 'PUT', data: patch });
}

export async function deleteTemplateAttr(attrId: number): Promise<any> {
  return spiderClient(`/templates/attrs/${attrId}`, { method: 'DELETE' });
}

export async function autoGenerateTemplate(params: { url: string; type?: string }): Promise<{ code: number; data: AutoTemplateResult }> {
  return spiderClient('/templates/auto-generate', { method: 'POST', data: params });
}

// ─── Source 详情 ───
export async function getSourceDetail(id: number): Promise<{ code: number; data: SpiderSource }> {
  return spiderClient(`/sources/${id}`, { method: 'GET' });
}

// ─── Sites 控制 ───
export async function pauseSite(id: number): Promise<any> {
  return spiderClient(`/sites/${id}/pause`, { method: 'POST' });
}

export async function resumeSite(id: number): Promise<any> {
  return spiderClient(`/sites/${id}/resume`, { method: 'POST' });
}

// ─── Batch 批量操作 ───
export async function batchOperate(params: { action: 'start' | 'pause' | 'resume' | 'cancel'; batch_ids: number[] }): Promise<any> {
  return spiderClient('/batch/operate', { method: 'POST', data: params });
}
