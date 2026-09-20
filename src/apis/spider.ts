import type {
  CrawlTaskDetail,
  Proxy,
  ProxyStats,
  TemplateDetail,
  AutoTemplateResult,
  CrawlStats,
  HealthStatus,
  CrawlTimeseries,
  ActivityFeed,
  SpiderSource,
} from '@/beans/spider';
import { spiderClient } from '@/lib/api/client';
import type { PageParams, PageResult } from '@/beans/pagination';
import { normalizeLegacyPageResponse } from '@/hooks/usePagination';

// Hourly Stats API
export interface HourlyStats {
  lastTickUtc: string;
  nextTickUtc: string;
  intervalSec: number;
  enabled: boolean;
  sourceCount: number;
  perSourceLimit: number;
  concurrency: number;
  categoryConcurrency: number;
  cooldownErrors: number;
  cooldownMinutes: number;
  healthySources: number;
  skippedSources: number;
  sources?: Array<{
    sourceId: number;
    name: string;
    category: string;
    apiName: string;
    lastRunAt: string;
    lastSuccessAt: string;
    lastErrorAt: string;
    lastError: string;
    consecErrors: number;
    totalRuns: number;
    totalNewItems: number;
    skippedCooldown: boolean;
  }>;
}

export async function getHourlyStats(): Promise<HourlyStats> {
  return spiderClient('/hourly/stats', { method: 'GET' });
}

export async function triggerHourlyRefresh(): Promise<any> {
  return spiderClient('/hourly/refresh', { method: 'POST' });
}

// Batch Job APIs
export async function createBatch(params: { name: string; domain: string; url: string; type: string }): Promise<any> {
  return spiderClient('/batch', { method: 'POST', data: params });
}

export async function listBatch(params?: PageParams & { status?: string }): Promise<PageResult<any>> {
  const res = await spiderClient('/batch', { params });
  return normalizeLegacyPageResponse(res);
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
export async function listWorkers(params?: PageParams & { status?: string }): Promise<PageResult<any>> {
  const res = await spiderClient('/workers', { params });
  return normalizeLegacyPageResponse(res);
}

export async function getWorkerStats(): Promise<any> {
  return spiderClient('/workers/stats', { method: 'GET' });
}

// Site Slot APIs
export async function listSiteSlots(params?: PageParams): Promise<PageResult<any>> {
  const res = await spiderClient('/sites/slots', { params });
  return normalizeLegacyPageResponse(res);
}

export async function getSiteSlotStats(): Promise<any> {
  return spiderClient('/sites/slots/stats', { method: 'GET' });
}

// Source APIs
export async function listSources(params?: PageParams): Promise<PageResult<any>> {
  const res = await spiderClient('/sources', { params });
  return normalizeLegacyPageResponse(res);
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
export async function listTemplates(params?: PageParams): Promise<PageResult<any>> {
  const res = await spiderClient('/templates', { params });
  return normalizeLegacyPageResponse(res);
}

export async function createTemplate(params: { name: string; type: string; source: string }): Promise<any> {
  return spiderClient('/templates', { method: 'POST', data: params });
}

export interface TemplateUpdate {
  name: string;
  type: string;
  source?: string;
  /** raw JSON content(覆盖 module_template.content 整段) */
  content?: string;
}
export async function updateTemplate(id: number, params: TemplateUpdate): Promise<any> {
  return spiderClient(`/templates/${id}`, { method: 'PUT', data: params });
}

export async function deleteTemplate(id: number): Promise<any> {
  return spiderClient(`/templates/${id}`, { method: 'DELETE' });
}

// ─── Dashboard ───
export async function getHealth(): Promise<HealthStatus> {
  return spiderClient('/health', { method: 'GET' });
}

export async function getCrawlStats(): Promise<CrawlStats> {
  return spiderClient('/stats', { method: 'GET' });
}

export async function getCrawlTimeseries(): Promise<CrawlTimeseries> {
  return spiderClient('/timeseries', { method: 'GET' });
}

export async function getRecentActivity(): Promise<ActivityFeed> {
  return spiderClient('/activity', { method: 'GET' });
}

// ─── Tasks ───
export async function listTasks(params?: PageParams & { status?: string; type?: string }): Promise<PageResult<any>> {
  const res = await spiderClient('/tasks', { params });
  return normalizeLegacyPageResponse(res);
}

export async function getTaskDetail(id: string): Promise<CrawlTaskDetail> {
  return spiderClient(`/tasks/${id}`, { method: 'GET' });
}

// source_id:后端 CrawlRequest / RuleCrawlRequest 声明为字符串(源 id 是超 2^53 的
// BIGINT)。以前传 number,JSON 解码直接失败,带源的任务一律创建不了。
export async function createTask(params: { source_id?: string; start_url: string; max_depth?: number; max_pages?: number; proxy_url?: string }): Promise<any> {
  return spiderClient('/tasks', { method: 'POST', data: params });
}

export async function createRuleTask(params: { source_id: string; start_url: string; max_pages?: number; incremental?: boolean; proxy_url?: string }): Promise<any> {
  return spiderClient('/tasks/rule', { method: 'POST', data: params });
}

export async function stopTask(id: string): Promise<any> {
  return spiderClient(`/tasks/${id}/stop`, { method: 'POST' });
}

export async function deleteTask(id: string): Promise<any> {
  return spiderClient(`/tasks/${id}`, { method: 'DELETE' });
}

export async function getTaskItems(id: string): Promise<PageResult<unknown>> {
  const res = await spiderClient(`/tasks/${id}/items`, { method: 'GET' });
  return normalizeLegacyPageResponse(res);
}

export async function getTaskLinks(id: string): Promise<PageResult<unknown>> {
  const res = await spiderClient(`/tasks/${id}/links`, { method: 'GET' });
  return normalizeLegacyPageResponse(res);
}

// ─── Proxies ───
export async function listProxies(): Promise<PageResult<Proxy>> {
  const res = await spiderClient('/proxies', { method: 'GET' });
  return normalizeLegacyPageResponse(res);
}

export async function getProxyStats(): Promise<ProxyStats> {
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
export async function getTemplateDetail(id: number): Promise<TemplateDetail> {
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

export async function autoGenerateTemplate(params: { url: string; type?: string }): Promise<AutoTemplateResult> {
  return spiderClient('/templates/auto-generate', { method: 'POST', data: params });
}

// ─── Source 详情 ───
export async function getSourceDetail(id: number): Promise<SpiderSource> {
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

// ─── G2:产品级通用入口 ───
// 后端 internal/crawler/universal.go

/** 小说"搜索即匹配正文源并批量回补章节正文"。
 *  输入书名(可选作者),后端在已配置的小说源里按配置的选择器找书,找到后
 *  自动调用 RuleEngine.CrawlNovel + CrawlChapters,章节正文写到 MinIO。 */
export interface SearchAndCrawlResult {
  success: boolean;
  keyword: string;
  matchedSource?: string;
  sourceId?: number;
  novelId?: number;
  bookURL?: string;
  chaptersAdded?: number;
  skipped?: string[];
  error?: string;
  elapsedSeconds?: number;
}

export async function searchAndCrawlNovel(params: {
  keyword: string;
  author?: string;
  sourceId?: number;
  maxChapters?: number;
}): Promise<SearchAndCrawlResult> {
  return spiderClient('/universal/novel/search-and-crawl', { method: 'POST', data: params });
}

/** 影视"输入任意小影视站 URL → 嗅探 → 返回 .m3u8/.mp4 直链"。
 *  后端用 cloakBrowser 打开页面,从 SSR/网络监听/全页正则三种方式找直链。 */
export interface ResolveStreamResult {
  success: boolean;
  inputUrl: string;
  realUrl?: string;
  playUrl?: string;
  coverUrl?: string;
  title?: string;
  author?: string;
  durationSec?: number;
  width?: number;
  height?: number;
  method?: 'browser_parse' | 'url_regex' | 'm3u8_direct' | 'fallback';
  error?: string;
  elapsedMs?: number;
}

export async function resolveStream(params: {
  url: string;
  configId?: number;
  extraWaitMs?: number;
}): Promise<ResolveStreamResult> {
  return spiderClient('/universal/stream/resolve', { method: 'POST', data: params });
}

// =====================================================================
// 全站批量任务"产品级"入口(POST /api/spider/sites/full-site)
//
// 设计原则:站点无关,后端根据 body 里的 source_domain 自动找 module_source 并创建
// batch_job。新站点只要在 module_source + module_template 已注册,这里就能直接触发,
// 不需要前端为每个站点各写一行。
// =====================================================================

export interface StartFullSiteParams {
  /** 已注册的模块源域名,如 "www.yfsp.tv" / "v.qq.com" 等 */
  source_domain: string;
  /** 备注,会写到 batch_job.description */
  notes?: string;
  /** 0 = 走 module_template.crawl_policy.max_pages */
  max_pages?: number;
  /** 达此数量提前结束,0 = 不限(后端 BatchHandler 已有 page budget 兜底) */
  max_items?: number;
}

export interface StartFullSiteResult {
  success: boolean;
  batch_id: number;
  source_id: number;
  source_name: string;
  message?: string;
  started_at: number; // unix seconds
}

export async function startFullSite(params: StartFullSiteParams): Promise<StartFullSiteResult> {
  return spiderClient('/sites/full-site', { method: 'POST', data: params });
}

// =====================================================================
// 通用流解析配置 CRUD(/api/spider/stream-parsers/*)
//
// 站点无关:对应后端 module_stream_parser(Doris)任意行的增删改查;Spider
// StreamResolver 用它做平台分发(/api/content/stream/resolve),BrowserParser
// 用它读 browser_config.custom_detail_script 抽 m3u8。前端运营调整都从这里进,
// 不需要 psql。
// =====================================================================

export interface StreamParserDTO {
  id: number;
  name: string;
  platform: string;
  urlPattern: string;
  apiEndpoint?: string;
  method?: string;
  headers?: string;
  paramsTemplate?: string;
  responseParseScript?: string;
  m3u8UrlField?: string;
  qualityField?: string;
  qualitySortKey?: string;
  priority?: number;
  remark?: string;
  engine?: string;
  browserConfig?: string;
}

export interface StreamParserInput {
  name: string;
  platform?: string;
  urlPattern?: string;
  apiEndpoint?: string;
  method?: string;
  headers?: string;
  paramsTemplate?: string;
  responseParseScript?: string;
  m3u8UrlField?: string;
  qualityField?: string;
  qualitySortKey?: string;
  priority?: number;
  remark?: string;
  engine?: string;
  browserConfig?: string;
}

export interface ListStreamParsersParams {
  name?: string;
  platform?: string;
  engine?: string;
}

export async function listStreamParsers(params?: ListStreamParsersParams): Promise<{ items: StreamParserDTO[]; total: number }> {
  return spiderClient('/stream-parsers', { method: 'GET', params });
}
export async function getStreamParser(id: number): Promise<StreamParserDTO> {
  return spiderClient(`/stream-parsers/${id}`, { method: 'GET' });
}
export async function createStreamParser(body: StreamParserInput): Promise<StreamParserDTO> {
  return spiderClient('/stream-parsers', { method: 'POST', data: body });
}
export async function updateStreamParser(id: number, body: StreamParserInput): Promise<StreamParserDTO> {
  return spiderClient(`/stream-parsers/${id}`, { method: 'PUT', data: body });
}
export async function deleteStreamParser(id: number): Promise<{ status: string }> {
  return spiderClient(`/stream-parsers/${id}`, { method: 'DELETE' });
}

// =====================================================================
// Dashboard / Analytics 通用统计
//
// 类型导出:跟文件顶部 region "通用入口"(HourlyStats / CrawlTimeseries / ActivityFeed
// / CrawlStats)共享;这里再补一些扩展数据形状,只声明类型不重写函数名,
// 避免与老导出冲突。

export interface CrawlTimeseriesPoint {
  hour: string;
  pages: number;
  items: number;
  links: number;
  errors: number;
}

export interface ActivityEvent {
  id: number;
  time: string;
  type: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  title: string;
  detail?: string;
}

export interface HourlySourceHealth {
  sourceId: number;
  name: string;
  category: string;
  apiName: string;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastError?: string;
  consecErrors: number;
  totalRuns: number;
  totalNewItems: number;
  skippedCooldown: boolean;
}

export interface HourlyStatsResponse {
  lastTickUtc: string;
  nextTickUtc: string;
  intervalSec: number;
  enabled: boolean;
  sourceCount: number;
  perSourceLimit: number;
  concurrency: number;
  categoryConcurrency: number;
  cooldownErrors: number;
  cooldownMinutes: number;
  healthySources: number;
  skippedSources: number;
  sources?: HourlySourceHealth[];
}

// =====================================================================
// 内容侧统计(Doris module_content 反查) — 新页面用
//
// 区别于老 CrawlStats(任务级统计):这里是"已抓到多少条内容、按分类/源聚合"。
// =====================================================================

export interface ContentStats {
  totalItems: number;
  totalSources: number;
  categoryCounts: Record<string, number>;
}
export interface ContentStatsEnhanced extends ContentStats {
  perSource: Array<{ sourceId: number; count: number; lastCrawlAt: string }>;
  recentActivity: ActivityEvent[];
}
export interface ContentTrend {
  bucket: string;
  count: number;
}
export interface ContentItem {
  id: number;
  title: string;
  cover?: string;
  sourceUrl?: string;
  moduleContentId?: number;
  category?: string;
  crawledAt?: string;
  source?: string;
}
export interface ContentListParams {
  sourceId?: number;
  category?: string;
  page?: number;
  pageSize?: number;
}

export async function getContentStats(): Promise<ContentStats> {
  return spiderClient('/content/stats', { method: 'GET' });
}
export async function getEnhancedStats(): Promise<ContentStatsEnhanced> {
  return spiderClient('/content/stats/enhanced', { method: 'GET' });
}
export async function getContentTrend(): Promise<{ items: ContentTrend[] }> {
  return spiderClient('/content/trend', { method: 'GET' });
}
export async function getContentList(params?: ContentListParams): Promise<{ items: ContentItem[]; total: number; page?: number }> {
  return spiderClient('/content/list', { method: 'GET', params });
}
export async function getContentDetail(id: number): Promise<any> {
  return spiderClient(`/content/detail/${id}`, { method: 'GET' });
}

// 工具接口(模板/单源健康/清理)
export async function exportTemplates(params?: { sourceId?: number }): Promise<any> {
  return spiderClient('/templates/export', { method: 'POST', data: params ?? {} });
}
export async function testTemplate(params: { url: string; type?: string }): Promise<any> {
  return spiderClient('/templates/test', { method: 'POST', data: params });
}
export async function listTemplateAttrs(templateId: number): Promise<{ items: any[]; total: number }> {
  return spiderClient(`/templates/${templateId}/attrs`, { method: 'GET' });
}
export async function getHourlySourceHealth(sourceId: number): Promise<HourlySourceHealth> {
  return spiderClient('/hourly/source-health', { method: 'GET', params: { sourceId } });
}
export async function cleanupTrackingURLs(): Promise<{ removed: number }> {
  return spiderClient('/cleanup/tracking-urls', { method: 'POST' });
}
export async function cleanupInvalidData(): Promise<{ removed: number }> {
  return spiderClient('/cleanup/invalid-data', { method: 'POST' });
}

// 任务快照:WebSocket 实时推送的 ProgressSnapshot 结构
export interface ProgressSnapshot {
  phase: 'queued' | 'discovering' | 'categories' | 'home' | 'incremental' | 'done' | 'stopped' | 'failed' | string;
  percent: number;
  categoriesTotal: number;
  categoriesDone: number;
  currentUrl: string;
  pagesCrawled: number;
  pageBudget: number;
  itemsFound: number;
  itemsNew: number;
  chaptersNew: number;
  errors: number;
  lastError?: string;
  startedAt?: string;
  updatedAt?: string;
  elapsedSec: number;
}
