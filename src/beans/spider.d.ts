// ─── 任务队列(后端 internal/crawler/dispatch.go)───
// 规则任务进 crawl_job 队列(status=queued),由 Worker 认领执行。字段是后端原样的 snake_case。

export type BatchStatus = 'pending' | 'running' | 'paused' | 'completed' | 'cancelled';
export type BatchSiteStatus = 'pending' | 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';

export interface BatchJob {
  id: number;
  name: string;
  description?: string;
  status: BatchStatus;
  max_pages: number;
  incremental: boolean;
  total_sites: number;
  success_site: number;
  failed_site: number;
  queued_sites: number;
  running_sites: number;
  paused_sites: number;
  progress: number; // 0-100
  pages_crawled: number;
  items_saved: number;
  created_at: number; // unix 秒
  started_at: number;
  completed_at: number;
}

export interface BatchSiteResult {
  site_id: number;
  source_id: string | number;
  site_name: string;
  domain: string;
  url: string;
  status: BatchSiteStatus;
  task_id?: string;
  worker_id?: string;
  pages_crawled: number;
  items_found: number;
  items_saved: number;
  error?: string;
}

export interface BatchJobDetail extends Omit<BatchJob, 'queued_sites' | 'running_sites' | 'paused_sites' | 'progress' | 'pages_crawled' | 'items_saved'> {
  results: BatchSiteResult[];
}

export interface CreateBatchParams {
  name: string;
  description?: string;
  source_ids?: string[];
  sources?: { name?: string; url?: string; domain?: string; type?: string }[];
  max_pages?: number;
  incremental?: boolean;
  start?: boolean;
}

export type WorkerKind = 'crawl' | 'loop' | 'browser';
export type WorkerState = 'idle' | 'busy' | 'draining' | 'offline';

export interface WorkerTaskView {
  taskId: string;
  source: string;
  url: string;
  phase: string;
  pages: number;
  items: number;
  startedAt: number;
}

export interface Worker {
  id: string;
  name: string;
  kind: WorkerKind;
  launcher: string; // embedded / container / manual
  host: string;
  version: string;
  desired: 'active' | 'draining';
  state: WorkerState;
  slots: number;
  running: number;
  processed: number;
  failed: number;
  tasks: WorkerTaskView[];
  stale: boolean;
  since_beat: number;
  started_at?: string;
  last_beat?: string;
}

export interface WorkerStats {
  totalWorkers: number; // 在线
  idleWorkers: number;
  busyWorkers: number;
  drainingWorkers: number;
  offlineWorkers: number;
  totalSlots: number;
  usedSlots: number;
  queued: number;
  running: number;
  paused: number;
}

/** core-api /ops/spider-workers:后台拉起的 Worker 容器 */
export interface WorkerContainer {
  name: string;
  id: string;
  image: string;
  state: string;
  status: string;
  workerId: string;
  stale: boolean;
  cpuPerc: number;
  memMB: number;
}

export interface SourceHealth {
  sourceId: string | number;
  name: string;
  lastRunAt: string;
  lastSuccessAt: string;
  lastErrorAt: string;
  lastError: string;
  consecErrors: number;
  totalRuns: number;
  totalNewItems: number;
  skippedCooldown: boolean;
}

export interface SiteRow {
  domain: string;
  source_id: string | number;
  name: string;
  category: string;
  link: string;
  enabled: boolean;
  paused: boolean;
  max_concurrent: number;
  priority: number;
  running: number;
  queued: number;
  last_task_id?: string;
  last_task_status?: string;
  last_task_at?: string;
  last_task_items: number;
  hourly?: SourceHealth | null;
}

export interface SiteStats {
  totalSites: number;
  enabledSites: number;
  pausedSites: number;
  activeSites: number;
  siteSlots: number;
  usedSlots: number;
  queued: number;
  running: number;
}

// ─── 单任务(Crawl Task) ───
export interface CrawlTask {
  id: string;
  sourceId?: number;
  sourceName?: string;
  startUrl: string;
  status: 'pending' | 'queued' | 'running' | 'stopping' | 'stopped' | 'completed' | 'failed' | 'paused' | 'stalled' | 'killed' | 'skipped';
  maxDepth: number;
  maxPages: number;
  pagesCrawled: number;
  linksFound: number;
  itemsSaved: number;
  errorMsg?: string;
  /** 规则任务才有:运行中为实时值,结束后为最终快照 */
  progress?: CrawlProgress;
  createdAt: string;
  updatedAt: string;
  /** rule / chapter_backfill / hourly_refresh …;队列任务(rule)才有 workerId / domain */
  type?: string;
  workerId?: string;
  domain?: string;
  attempts?: number;
}

/** 规则爬取进度(后端 ProgressSnapshot) */
export interface CrawlProgress {
  phase: 'queued' | 'discovering' | 'categories' | 'home' | 'incremental' | 'done' | 'stopped' | 'failed';
  /** 0-100;-1 = 还估不出来 */
  percent: number;
  categoriesTotal: number;
  categoriesDone: number;
  currentUrl: string;
  /** 实际发出的页面请求数 */
  pagesCrawled: number;
  /** 0 = 不限 */
  pageBudget: number;
  itemsFound: number;
  itemsNew: number;
  chaptersNew: number;
  errors: number;
  lastError?: string;
  /** 回填任务的逐条失败明细(后端 backfill_job.go 写入) */
  error_list?: string[];
  /** 回填任务的统计计数(如 covers/audios/updated) */
  stats?: Record<string, number>;
  startedAt: string;
  updatedAt: string;
  elapsedSec: number;
}

export interface CrawlTaskStats {
  pagesCrawled: number;
  linksFound: number;
  itemsSaved: number;
}

export interface CrawlTaskItem {
  id: number;
  taskId: string;
  url: string;
  title: string;
  cover?: string;
  source?: string;
  crawledAt: string;
}

export interface CrawlTaskLink {
  id: number;
  taskId: string;
  url: string;
  source?: string;
  depth: number;
  foundAt: string;
}

export interface CrawlTaskDetail extends CrawlTask {
  stats: CrawlTaskStats;
  isRunning: boolean;
  items: CrawlTaskItem[];
  links: CrawlTaskLink[];
}

// ─── 代理(Proxy) ───
export interface Proxy {
  id: string;
  url: string;
  type: 'http' | 'https' | 'socks5';
  active: boolean;
  successCount: number;
  failCount: number;
}

export interface ProxyStats {
  total: number;
  active: number;
  successRate: number;
  failCount: number;
}

// ─── 模板属性(TemplateAttr) ───
export interface TemplateAttr {
  id: number;
  templateId: number;
  name: string;
  type: string;
  code: string;
  content: string;
  remark?: string;
  createdAt?: string;
}

export interface TemplateDetail {
  id: number;
  name: string;
  type: string;
  source: string;
  attrs: TemplateAttr[];
  version: string;
  status: 'ENABLED' | 'DISABLED';
  createTime: string;
}

export interface AutoTemplateRule {
  code: 'title' | 'link' | 'cover' | 'content' | 'description' | 'date' | 'container' | 'item';
  selector: string;
  attr?: string;
  isArray?: boolean;
  source: 'llm' | 'heuristic' | 'generic';
  confidence: number;
}

export interface AutoTemplateResult {
  rules: AutoTemplateRule[];
  previewItems: { title: string; link: string; cover?: string }[];
}

// ─── Dashboard ───
export interface CrawlStats {
  runningEngines: number;
  totalPages: number;
  totalLinks: number;
  totalItems: number;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  engines: number;
  uptime: number;
}

export interface CrawlTimeseriesPoint {
  hour: string;       // "00" - "23"
  pages: number;
  items: number;
  links: number;
  errors: number;
}

export interface CrawlTimeseries {
  hourly: CrawlTimeseriesPoint[];
  updatedAt: string;
}

export type ActivitySeverity = 'info' | 'success' | 'warning' | 'error';
export type ActivityType = 'task' | 'item' | 'error' | 'proxy' | 'template' | 'source';

export interface ActivityEvent {
  id: number;
  time: string;        // ISO
  type: ActivityType;
  severity: ActivitySeverity;
  title: string;
  detail?: string;
}

export interface ActivityFeed {
  events: ActivityEvent[];
  updatedAt: string;
}

// ─── 源(Source) ───
export interface SpiderSource {
  id: number;
  name: string;
  domain: string;
  url: string;
  type: string;
  status: 'active' | 'inactive' | 'paused';
  itemCount: number;
  successRate?: number;
  avgSpeed?: number;
  lastCrawlAt?: string;
  createTime: string;
}