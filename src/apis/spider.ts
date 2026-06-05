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

// Mock data
const mockBatchJobs: BatchJob[] = [
  { id: 1, name: '笔趣阁爬取', domain: 'biquge.tw', url: 'https://www.biquge.tw', type: 'novel', status: 'running', progress: 65, totalUrls: 100, processedUrls: 65, createTime: '2026-05-27T10:00:00Z', updateTime: '2026-05-27T10:30:00Z' },
  { id: 2, name: '起点小说爬取', domain: 'qidian.com', url: 'https://www.qidian.com', type: 'novel', status: 'pending', progress: 0, totalUrls: 0, processedUrls: 0, createTime: '2026-05-27T09:00:00Z', updateTime: '2026-05-27T09:00:00Z' },
  { id: 3, name: '新闻网站爬取', domain: 'news.cn', url: 'https://www.news.cn', type: 'news', status: 'completed', progress: 100, totalUrls: 50, processedUrls: 50, createTime: '2026-05-26T14:00:00Z', updateTime: '2026-05-26T15:30:00Z' },
  { id: 4, name: '视频网站爬取', domain: 'bilibili.com', url: 'https://www.bilibili.com', type: 'video', status: 'paused', progress: 30, totalUrls: 80, processedUrls: 24, createTime: '2026-05-27T08:00:00Z', updateTime: '2026-05-27T08:45:00Z' },
  { id: 5, name: '动漫网站爬取', domain: 'dmzj.com', url: 'https://www.dmzj.com', type: 'anime', status: 'cancelled', progress: 10, totalUrls: 60, processedUrls: 6, createTime: '2026-05-25T16:00:00Z', updateTime: '2026-05-25T16:20:00Z' },
];

const mockWorkers: Worker[] = [
  { id: 'w1', name: 'Worker-1', status: 'idle', processedCount: 156, lastActiveTime: '2026-05-27T10:35:00Z' },
  { id: 'w2', name: 'Worker-2', status: 'busy', currentJobId: 1, currentUrl: 'https://www.biquge.tw/book/1234', processedCount: 89, lastActiveTime: '2026-05-27T10:35:30Z' },
  { id: 'w3', name: 'Worker-3', status: 'busy', currentJobId: 1, currentUrl: 'https://www.biquge.tw/book/5678', processedCount: 112, lastActiveTime: '2026-05-27T10:35:15Z' },
  { id: 'w4', name: 'Worker-4', status: 'idle', processedCount: 201, lastActiveTime: '2026-05-27T10:34:00Z' },
  { id: 'w5', name: 'Worker-5', status: 'offline', processedCount: 45, lastActiveTime: '2026-05-27T08:00:00Z' },
  { id: 'w6', name: 'Worker-6', status: 'idle', processedCount: 178, lastActiveTime: '2026-05-27T10:33:00Z' },
  { id: 'w7', name: 'Worker-7', status: 'busy', currentJobId: 4, currentUrl: 'https://www.bilibili.com/video/BV123', processedCount: 67, lastActiveTime: '2026-05-27T10:35:45Z' },
  { id: 'w8', name: 'Worker-8', status: 'idle', processedCount: 134, lastActiveTime: '2026-05-27T10:32:00Z' },
  { id: 'w9', name: 'Worker-9', status: 'offline', processedCount: 23, lastActiveTime: '2026-05-26T22:00:00Z' },
  { id: 'w10', name: 'Worker-10', status: 'idle', processedCount: 98, lastActiveTime: '2026-05-27T10:31:00Z' },
];

const mockSiteSlots: SiteSlot[] = [
  { id: 1, siteName: '笔趣阁', domain: 'biquge.tw', status: 'active', activeSlots: 2, maxSlots: 3, progress: 65, currentUrl: 'https://www.biquge.tw/book/1234', startTime: '2026-05-27T10:00:00Z' },
  { id: 2, siteName: '起点中文', domain: 'qidian.com', status: 'inactive', activeSlots: 0, maxSlots: 3, progress: 0 },
  { id: 3, siteName: '哔哩哔哩', domain: 'bilibili.com', status: 'scheduling', activeSlots: 1, maxSlots: 2, progress: 30, currentUrl: 'https://www.bilibili.com/video/BV123', startTime: '2026-05-27T08:00:00Z' },
];

const mockBatchStats: BatchStats = {
  totalJobs: 12,
  runningJobs: 2,
  pendingJobs: 5,
  completedJobs: 3,
  cancelledJobs: 2,
  totalUrlsProcessed: 1250,
};

const mockWorkerStats: WorkerStats = {
  totalWorkers: 10,
  idleWorkers: 4,
  busyWorkers: 3,
  offlineWorkers: 3,
};

const mockSiteSlotStats: SiteSlotStats = {
  totalSites: 5,
  activeSites: 2,
  totalSlots: 15,
  usedSlots: 3,
  availableSlots: 12,
};

// Mock mode disabled - use json-server for mock data
const MOCK_ENABLED = false;

// Helper function to simulate delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Batch Job APIs
export async function createBatch(params: { name: string; domain: string; url: string; type: string }): Promise<any> {
  await delay(300);
  if (MOCK_ENABLED) {
    const newJob: BatchJob = {
      id: mockBatchJobs.length + 1,
      ...params,
      status: 'pending',
      progress: 0,
      createTime: new Date().toISOString(),
    };
    mockBatchJobs.unshift(newJob);
    return { code: 200, data: newJob };
  }
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/batch', { method: 'POST', data: params });
}

export async function listBatch(params?: { pageNumber?: number; pageSize?: number; status?: string }): Promise<any> {
  await delay(300);
  if (MOCK_ENABLED) {
    return { code: 200, data: { list: mockBatchJobs, total: mockBatchJobs.length } };
  }
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/batch', { params });
}

export async function getBatchDetail(id: number): Promise<any> {
  await delay(300);
  if (MOCK_ENABLED) {
    return { code: 200, data: mockBatchJobs.find(j => j.id === id) || mockBatchJobs[0] };
  }
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/batch/${id}`, { method: 'GET' });
}

export async function startBatch(id: number): Promise<any> {
  await delay(300);
  if (MOCK_ENABLED) {
    const job = mockBatchJobs.find(j => j.id === id);
    if (job) job.status = 'running';
    return { code: 200, data: { success: true } };
  }
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/batch/${id}/start`, { method: 'POST' });
}

export async function pauseBatch(id: number): Promise<any> {
  await delay(300);
  if (MOCK_ENABLED) {
    const job = mockBatchJobs.find(j => j.id === id);
    if (job) job.status = 'paused';
    return { code: 200, data: { success: true } };
  }
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/batch/${id}/pause`, { method: 'POST' });
}

export async function resumeBatch(id: number): Promise<any> {
  await delay(300);
  if (MOCK_ENABLED) {
    const job = mockBatchJobs.find(j => j.id === id);
    if (job) job.status = 'running';
    return { code: 200, data: { success: true } };
  }
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/batch/${id}/resume`, { method: 'POST' });
}

export async function cancelBatch(id: number): Promise<any> {
  await delay(300);
  if (MOCK_ENABLED) {
    const job = mockBatchJobs.find(j => j.id === id);
    if (job) job.status = 'cancelled';
    return { code: 200, data: { success: true } };
  }
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/batch/${id}/cancel`, { method: 'POST' });
}

export async function getBatchStats(id: number): Promise<any> {
  await delay(300);
  if (MOCK_ENABLED) {
    return { code: 200, data: mockBatchStats };
  }
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/batch/${id}/stats`, { method: 'GET' });
}

// Worker APIs
export async function listWorkers(params?: { pageNumber?: number; pageSize?: number; status?: string }): Promise<any> {
  await delay(300);
  if (MOCK_ENABLED) {
    return { code: 200, data: { list: mockWorkers, total: mockWorkers.length } };
  }
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/workers', { params });
}

export async function getWorkerStats(): Promise<any> {
  await delay(300);
  if (MOCK_ENABLED) {
    return { code: 200, data: mockWorkerStats };
  }
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/workers/stats', { method: 'GET' });
}

// Site Slot APIs
export async function listSiteSlots(params?: { pageNumber?: number; pageSize?: number }): Promise<any> {
  await delay(300);
  if (MOCK_ENABLED) {
    return { code: 200, data: { list: mockSiteSlots, total: mockSiteSlots.length } };
  }
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/sites/slots', { params });
}

export async function getSiteSlotStats(): Promise<any> {
  await delay(300);
  if (MOCK_ENABLED) {
    return { code: 200, data: mockSiteSlotStats };
  }
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/sites/slots/stats', { method: 'GET' });
}

// Source APIs
export async function listSources(params?: { pageNumber?: number; pageSize?: number }): Promise<any> {
  await delay(300);
  if (MOCK_ENABLED) {
    return { code: 200, data: { list: mockSources, total: mockSources.length } };
  }
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/sources', { params });
}

export async function createSource(params: { name: string; domain: string; url: string; type: string }): Promise<any> {
  await delay(300);
  if (MOCK_ENABLED) {
    const newSource = { id: mockSources.length + 1, ...params, status: 'active', itemCount: 0, createTime: new Date().toISOString() };
    mockSources.unshift(newSource);
    return { code: 200, data: newSource };
  }
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/sources', { method: 'POST', data: params });
}

export async function updateSource(id: number, params: { name: string; domain: string; url: string; type: string }): Promise<any> {
  await delay(300);
  if (MOCK_ENABLED) {
    const source = mockSources.find(s => s.id === id);
    if (source) Object.assign(source, params);
    return { code: 200, data: source };
  }
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/sources/${id}`, { method: 'PUT', data: params });
}

export async function deleteSource(id: number): Promise<any> {
  await delay(300);
  if (MOCK_ENABLED) {
    const index = mockSources.findIndex(s => s.id === id);
    if (index > -1) mockSources.splice(index, 1);
    return { code: 200, data: { success: true } };
  }
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/sources/${id}`, { method: 'DELETE' });
}

// Template APIs
export async function listTemplates(params?: { pageNumber?: number; pageSize?: number }): Promise<any> {
  await delay(300);
  if (MOCK_ENABLED) {
    return { code: 200, data: { list: mockTemplates, total: mockTemplates.length } };
  }
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/templates', { params });
}

export async function createTemplate(params: { name: string; type: string; source: string }): Promise<any> {
  await delay(300);
  if (MOCK_ENABLED) {
    const newTemplate = { id: mockTemplates.length + 1, ...params, attrs: 0, items: 0, createTime: new Date().toISOString() };
    mockTemplates.unshift(newTemplate);
    return { code: 200, data: newTemplate };
  }
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/templates', { method: 'POST', data: params });
}

export async function updateTemplate(id: number, params: { name: string; type: string; source: string }): Promise<any> {
  await delay(300);
  if (MOCK_ENABLED) {
    const template = mockTemplates.find(t => t.id === id);
    if (template) Object.assign(template, params);
    return { code: 200, data: template };
  }
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/templates/${id}`, { method: 'PUT', data: params });
}

export async function deleteTemplate(id: number): Promise<any> {
  await delay(300);
  if (MOCK_ENABLED) {
    const index = mockTemplates.findIndex(t => t.id === id);
    if (index > -1) mockTemplates.splice(index, 1);
    return { code: 200, data: { success: true } };
  }
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/templates/${id}`, { method: 'DELETE' });
}

// ─── Dashboard ───
export async function getHealth(): Promise<{ code: number; data: HealthStatus }> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/health', { method: 'GET' });
}

export async function getCrawlStats(): Promise<{ code: number; data: CrawlStats }> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/stats', { method: 'GET' });
}

export async function getCrawlTimeseries(): Promise<{ code: number; data: CrawlTimeseries }> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/timeseries', { method: 'GET' });
}

export async function getRecentActivity(): Promise<{ code: number; data: ActivityFeed }> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/activity', { method: 'GET' });
}

// ─── Tasks ───
export async function listTasks(params?: { pageNumber?: number; pageSize?: number; status?: string }): Promise<any> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/tasks', { params });
}

export async function getTaskDetail(id: string): Promise<{ code: number; data: CrawlTaskDetail }> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/tasks/${id}`, { method: 'GET' });
}

export async function createTask(params: { source_id?: number; start_url: string; max_depth?: number; max_pages?: number; proxy_url?: string }): Promise<any> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/tasks', { method: 'POST', data: params });
}

export async function stopTask(id: string): Promise<any> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/tasks/${id}/stop`, { method: 'POST' });
}

export async function deleteTask(id: string): Promise<any> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/tasks/${id}`, { method: 'DELETE' });
}

export async function getTaskItems(id: string): Promise<{ code: number; data: { list: any[]; total: number } }> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/tasks/${id}/items`, { method: 'GET' });
}

export async function getTaskLinks(id: string): Promise<{ code: number; data: { list: any[]; total: number } }> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/tasks/${id}/links`, { method: 'GET' });
}

// ─── Proxies ───
export async function listProxies(): Promise<{ code: number; data: { list: Proxy[]; total: number } }> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/proxies', { method: 'GET' });
}

export async function getProxyStats(): Promise<{ code: number; data: ProxyStats }> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/proxies/stats', { method: 'GET' });
}

export async function addProxy(params: { url: string; type: 'http' | 'https' | 'socks5' }): Promise<any> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/proxies', { method: 'POST', data: params });
}

export async function toggleProxy(id: string, active: boolean): Promise<any> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/proxies/${id}`, { method: 'PUT', data: { active } });
}

export async function deleteProxy(id: string): Promise<any> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/proxies/${id}`, { method: 'DELETE' });
}

// ─── Template Attrs ───
export async function getTemplateDetail(id: number): Promise<{ code: number; data: TemplateDetail }> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/templates/${id}`, { method: 'GET' });
}

export async function addTemplateAttr(templateId: number, attr: { name: string; type: string; code: string; content: string; remark?: string }): Promise<any> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/templates/${templateId}/attrs`, { method: 'POST', data: attr });
}

export async function updateTemplateAttr(attrId: number, patch: Partial<{ name: string; type: string; code: string; content: string; remark: string }>): Promise<any> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/templates/attrs/${attrId}`, { method: 'PUT', data: patch });
}

export async function deleteTemplateAttr(attrId: number): Promise<any> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/templates/attrs/${attrId}`, { method: 'DELETE' });
}

export async function autoGenerateTemplate(params: { url: string; type?: string }): Promise<{ code: number; data: AutoTemplateResult }> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/templates/auto-generate', { method: 'POST', data: params });
}

// ─── Source 详情 ───
export async function getSourceDetail(id: number): Promise<{ code: number; data: SpiderSource }> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/sources/${id}`, { method: 'GET' });
}

// ─── Sites 控制 ───
export async function pauseSite(id: number): Promise<any> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/sites/${id}/pause`, { method: 'POST' });
}

export async function resumeSite(id: number): Promise<any> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient(`/sites/${id}/resume`, { method: 'POST' });
}

// ─── Batch 批量操作 ───
export async function batchOperate(params: { action: 'start' | 'pause' | 'resume' | 'cancel'; batch_ids: number[] }): Promise<any> {
  const { spiderClient } = await import('@/lib/api/client');
  return spiderClient('/batch/operate', { method: 'POST', data: params });
}

// Mock data for sources and templates
const mockSources = [
  { id: 1, name: '笔趣阁', domain: 'biquge.tw', url: 'https://www.biquge.tw', type: 'novel', status: 'active', itemCount: 1250, createTime: '2026-05-20T10:00:00Z' },
  { id: 2, name: '起点中文', domain: 'qidian.com', url: 'https://www.qidian.com', type: 'novel', status: 'active', itemCount: 3400, createTime: '2026-05-18T08:00:00Z' },
  { id: 3, name: '哔哩哔哩', domain: 'bilibili.com', url: 'https://www.bilibili.com', type: 'video', status: 'inactive', itemCount: 890, createTime: '2026-05-15T14:00:00Z' },
  { id: 4, name: '腾讯新闻', domain: 'news.qq.com', url: 'https://news.qq.com', type: 'news', status: 'active', itemCount: 2100, createTime: '2026-05-10T09:00:00Z' },
  { id: 5, name: '网易音乐', domain: 'music.163.com', url: 'https://music.163.com', type: 'music', status: 'paused', itemCount: 456, createTime: '2026-05-05T16:00:00Z' },
];

const mockTemplates = [
  { id: 1, name: '小说模板', type: 'novel', source: '笔趣阁', attrs: 15, items: 2340, createTime: '2026-05-20T10:00:00Z' },
  { id: 2, name: '视频模板', type: 'video', source: '哔哩哔哩', attrs: 22, items: 1250, createTime: '2026-05-18T08:00:00Z' },
  { id: 3, name: '新闻模板', type: 'news', source: '腾讯新闻', attrs: 18, items: 5600, createTime: '2026-05-15T14:00:00Z' },
  { id: 4, name: '音乐模板', type: 'music', source: '网易音乐', attrs: 12, items: 890, createTime: '2026-05-10T09:00:00Z' },
  { id: 5, name: '动漫模板', type: 'animation', source: '樱花动漫', attrs: 20, items: 670, createTime: '2026-05-05T16:00:00Z' },
];