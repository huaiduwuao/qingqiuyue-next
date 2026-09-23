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
import { normalizePageResponse } from '@/beans/pagination';
import { toEntityId, type EntityId } from '@/lib/id';

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
  return normalizePageResponse(res);
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
  return normalizePageResponse(res);
}

export async function getWorkerStats(): Promise<any> {
  return spiderClient('/workers/stats', { method: 'GET' });
}

// Site Slot APIs
export async function listSiteSlots(params?: PageParams): Promise<PageResult<any>> {
  const res = await spiderClient('/sites/slots', { params });
  return normalizePageResponse(res);
}

export async function getSiteSlotStats(): Promise<any> {
  return spiderClient('/sites/slots/stats', { method: 'GET' });
}

// Source APIs
export async function listSources(params?: PageParams): Promise<PageResult<any>> {
  const res = await spiderClient('/sources', { params });
  return normalizePageResponse(res);
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
  return normalizePageResponse(res);
}

/**
 * 模板新建 / 保存。后端 TemplateRequest 绑的是 source_id(数字或字符串,源 id 可能超 2^53)和 config:
 * 以前发 source(源名称)和 content,后端都不认 —— 新建的模板不挂任何源,编辑器里「保存」的整段配置
 * 也从来没写进去。这里统一换成后端要的字段名。
 */
export interface TemplateWrite {
  name: string;
  type: string;
  /** 关联的爬虫源 id(源管理里的 id,原样透传,别 Number()) */
  sourceId?: EntityId | null;
  /** raw JSON content(覆盖 module_template.content 整段),发给后端的 config;后端会校验 */
  content?: string;
}
/** @deprecated 用 TemplateWrite */
export type TemplateUpdate = TemplateWrite;

function templateBody(params: TemplateWrite) {
  const sourceId = toEntityId(params.sourceId);
  return {
    name: params.name,
    type: params.type,
    ...(sourceId !== null ? { source_id: sourceId } : {}),
    ...(params.content ? { config: params.content } : {}),
  };
}

export async function createTemplate(params: TemplateWrite): Promise<any> {
  return spiderClient('/templates', { method: 'POST', data: templateBody(params) });
}

export async function updateTemplate(id: number, params: TemplateWrite): Promise<any> {
  return spiderClient(`/templates/${id}`, { method: 'PUT', data: templateBody(params) });
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
  return normalizePageResponse(res);
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
  return normalizePageResponse(res);
}

export async function getTaskLinks(id: string): Promise<PageResult<unknown>> {
  const res = await spiderClient(`/tasks/${id}/links`, { method: 'GET' });
  return normalizePageResponse(res);
}

// ─── Proxies ───
export async function listProxies(): Promise<PageResult<Proxy>> {
  const res = await spiderClient('/proxies', { method: 'GET' });
  return normalizePageResponse(res);
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
// 通用内容补全框架(/api/spider/content/backfill/*)
//
// 给任意已收录内容补抓缺失的章节正文 / 音频 / 漫画页 / 播放直链。
// 后端按 content_type 自动选抓取方式(NOVEL 抓章节正文、MUSIC 存音频、
// FILM 只嗅探直链不下载),调用方不需要关心类型。
// =====================================================================

export interface ContentBackfillStartResult {
  task_id: number;
  status: string;
  source_name: string;
  /** 被补全的内容 id(回带,省得从 source_name 里反解)。 */
  content_id?: number;
  progress_url: string;
}

export interface ContentBackfillRecentItem {
  task_id: number;
  status: string;
  source_name: string;
  items_saved: number;
  started_at?: string;
  updated_at?: string;
  /** crawl_job.progress 反序列化后的快照,stats 里有 found / inserted / updated / failed / sources_used */
  stats?: {
    phase?: string;
    errors?: number;
    error_list?: string[];
    stats?: Record<string, number>;
    last_error?: string;
    elapsed_sec?: number;
  };
}

/** 触发一次内容补全。异步返回 task_id,不阻塞;进度走 status / 最近任务列表看。
 *
 * forceDomains: 当内容的 source 是版权站(七猫/起点这类只给目录不给正文的),
 * 框架会走 catalog-only 短路,不会去试别的正文源。传 force_domains 把指定域名
 * 强行插进候选源,用来把 bqg616 这种正文源接上。
 */
export async function startContentBackfill(params: {
  contentId: string;
  strategies?: string[];
  authorHint?: string;
  maxItems?: number;
  forceDomains?: string[];
}): Promise<ContentBackfillStartResult> {
  return spiderClient('/content/backfill', {
    method: 'POST',
    data: {
      content_id: params.contentId,
      strategies: params.strategies,
      author_hint: params.authorHint,
      max_items: params.maxItems,
      force_domains: params.forceDomains?.length ? params.forceDomains : undefined,
    },
  });
}

/** 查单次补全任务状态。 */
export async function getContentBackfillStatus(taskId: number): Promise<any> {
  return spiderClient(`/content/backfill/${taskId}/status`, { method: 'GET' });
}

/** 最近的内容补全任务(运营看历史用)。 */
export async function listContentBackfillRecent(params?: { page?: number; pageSize?: number }): Promise<{
  list: ContentBackfillRecentItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  return spiderClient('/content/backfill/recent', { method: 'GET', params });
}

/** 一条内容的章节入库情况。非正文类(MUSIC/VIDEO/...)不会有对应条目。 */
export interface ContentItemStats {
  /** readable(全入库) / partial_text(部分) / catalog_only(只有目录) / external_only(连目录都没有) */
  status: string;
  /** 站内已入库正文的章节数 */
  readyItems: number;
  /** 目录里的总章节数 */
  totalItems: number;
}

// =====================================================================
// 候选源池(/api/spider/content/backfill/candidates/*)
//
// 后端在补全任务跑完后,discover 搜出的"这本书在别家源站也有"会写到
// module_content_backfill_candidate,运营在这里确认后由 cron 转成
// module_source + module_template,触发新一轮补全走新源。
//
// 状态机:
//   pending   默认(discover 写入)
//   confirmed 运营点确认 → cron 转 applied(下一步建源+触发补全)
//   rejected  运营点拒绝 → 后续 discover 允许重写覆盖
//   applied   已被 cron 转成源(终态)
// =====================================================================

export interface ContentBackfillCandidate {
  id: number;
  module_content_id: number;
  provider: string;
  label: string;
  page_url: string;
  author: string;
  /** 0~100,越大越像正主(后端 = 子串命中 0~70 + 作者完全相等 +30) */
  score: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'applied';
  created_at?: string;
}

/** 拉一本书的候选源列表(默认只 pending/confirmed/applied)。 */
export async function listContentBackfillCandidates(params: {
  contentId: string;
  status?: string;
}): Promise<{ list: ContentBackfillCandidate[]; total: number }> {
  return spiderClient('/content/backfill/candidates', {
    method: 'GET',
    params: { content_id: params.contentId, status: params.status ?? 'pending,confirmed,applied' },
  });
}

/** 运营点确认 — status='confirmed',下一轮 cron(30s) 转 applied 并建源。 */
export async function confirmContentBackfillCandidate(id: number): Promise<{ id: number; status: string }> {
  return spiderClient(`/content/backfill/candidates/${id}/confirm`, { method: 'PATCH' });
}

/** 运营点拒绝 — status='rejected';允许后续 discover 重写覆盖。 */
export async function rejectContentBackfillCandidate(id: number): Promise<{ id: number; status: string }> {
  return spiderClient(`/content/backfill/candidates/${id}/reject`, { method: 'PATCH' });
}

/**
 * 批量查内容的章节入库情况 —— 补全页把"这条还缺多少章"摆在搜索结果上。
 *
 * 后端实时从内容库算(与站内「站内 N/M 章」角标同一份判定),不依赖
 * module_content.chapter_count 那一列(它是脏的,全库为 0)。
 *
 * 返回的键是**字符串**形式的 id:内容 id 是 BIGINT 且超过 2^53,
 * JS 的 Number 会截断,所以只能用 String(item.id) 取。
 */
export async function getContentItemStats(ids: Array<string | number>): Promise<Record<string, ContentItemStats>> {
  if (!ids.length) return {};
  const res = await spiderClient('/content/backfill/item-stats', {
    method: 'GET',
    params: { ids: ids.map(String).join(',') },
  });
  return (res as any)?.stats ?? {};
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
// 后端绑 source_id(必填),以前发 sourceId 永远 400
export async function exportTemplates(params: { sourceId: EntityId; format?: string; template?: string[] }): Promise<any> {
  const { sourceId, ...rest } = params;
  return spiderClient('/templates/export', { method: 'POST', data: { ...rest, source_id: toEntityId(sourceId) } });
}
export async function testTemplate(params: {
  url: string;
  type?: string;            // list | detail | chapter
  templateId?: number;      // 有则按该模板的选择器/浏览器/JS 跑
  selector?: string;        // 没存模板时直接试选择器
  jsExtract?: string;
  maxItems?: number;
}): Promise<any> {
  return spiderClient('/templates/test', {
    method: 'POST',
    data: {
      url: params.url,
      type: params.type,
      template_id: params.templateId,
      selector: params.selector,
      js_extract: params.jsExtract,
      max_items: params.maxItems,
    },
    timeout: 120_000, // 可能要开无头浏览器,给足时间
  });
}
export async function listTemplateAttrs(templateId: number): Promise<{ items: any[]; total: number }> {
  return spiderClient(`/templates/${templateId}/attrs`, { method: 'GET' });
}
export async function getHourlySourceHealth(sourceId: EntityId): Promise<HourlySourceHealth> {
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


// ============ 章节修复(多源聚合) ============

export interface RepairChapterDiff {
  chapter_no: number;
  title: string;
  verdict: 'ok' | 'conflict' | 'only_one_source' | 'suspect' | 'missing';
  action: 'keep' | 'fill' | 'replace' | 'skip';
  before_len: number;
  after_len: number;
  source?: string;
  rivals?: { source: string; len: number; head: string }[];
  note?: string;
}

export interface RepairReport {
  content_id: number;
  title: string;
  content_type: string;
  existing: number;
  existing_ready: number;
  aggregated: number;
  by_verdict: Record<string, number>;
  coverage: Record<string, number>;
  diffs: RepairChapterDiff[];
  errors?: string[];
  dry_run: boolean;
  applied?: { filled: number; updated: number; skipped: number; failed: number };
  sources: string[];
}

export interface RepairSourceOption {
  id: number; name: string; domain: string; category: string;
  /**
   * 取数方式,由后端按模板推出来:
   *   browser  模板开了 browser.enabled —— 渲染后执行 js_extract(hash SPA)
   *   static   直出 HTML —— 走 item_container_selector / content_selector,快得多
   * 以前只有"配了 js_extract"的源才算数,直出站全被滤掉,下拉里常常只有一个源 ——
   * 而多源比对至少要有两个源才谈得上交叉验证。
   */
  mode?: 'browser' | 'static' | string;
  has_js_extract: boolean;
}

/** 列出能做修复取数的源(渲染型 + 直出型)。 */
export async function listRepairSources(): Promise<{ list: RepairSourceOption[] }> {
  return spiderClient('/content/repair/candidates', { method: 'GET' });
}

/**
 * 对一本书跑多源修复诊断/应用。dryRun=true 只出报告。
 *
 * 走后端的异步模式:先拿 task_id,再轮询 /content/repair/{task_id}。
 * 以前是一个同步请求等到底 —— 可 APISIX 给 spider-api 的读超时只有 300s,
 * 一本书双源两百章就要四分多钟,「0 = 全书」必断;断开时后端 ctx 被取消,
 * 应用修复会停在半路,书被改了一半,前端只看到「请求失败」。
 */
export async function repairChapters(params: {
  contentId: string;
  domains?: string[];
  dryRun?: boolean;
  maxChapters?: number;
  applyVerdicts?: string[];
}): Promise<RepairReport> {
  const started = await spiderClient<{ task_id?: number; taskId?: number }>('/content/repair', {
    method: 'POST',
    data: {
      content_id: params.contentId,
      domains: params.domains?.length ? params.domains : undefined,
      dry_run: params.dryRun ?? true,
      max_chapters: params.maxChapters,
      apply_verdicts: params.applyVerdicts,
      async: true,
    },
  });
  const taskId = Number(started?.task_id ?? started?.taskId);
  if (!taskId) throw new Error('修复任务没有返回 task_id');

  // 后端任务自己的上限是 30 分钟,这里多等一点
  const deadline = Date.now() + 35 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    // 跑完返回报告;还在跑返回 202 + {status}
    const r = await spiderClient<RepairReport & { status?: string; error_msg?: string; errorMsg?: string }>(
      `/content/repair/${taskId}`,
      { method: 'GET' },
    );
    if (r && Array.isArray(r.diffs)) return r;
    if (r?.status === 'failed') throw new Error(r.error_msg || r.errorMsg || '修复任务失败');
    if (r?.status === 'completed') throw new Error('任务已结束,但报告没有取到(可能已过期),请重新诊断');
  }
  throw new Error('修复超过 35 分钟仍未结束,请稍后到任务列表查看');
}
