// Batch Job Types
export interface BatchJob {
  id?: number;
  name: string;
  domain: string;
  url: string;
  type: string;
  status?: 'pending' | 'running' | 'paused' | 'completed' | 'cancelled';
  progress?: number;
  totalUrls?: number;
  processedUrls?: number;
  createTime?: string;
  updateTime?: string;
}

export interface BatchStats {
  totalJobs: number;
  runningJobs: number;
  pendingJobs: number;
  completedJobs: number;
  cancelledJobs: number;
  totalUrlsProcessed: number;
}

// Worker Types
export interface Worker {
  id: string;
  name: string;
  status: 'idle' | 'busy' | 'offline';
  currentJobId?: number;
  currentUrl?: string;
  processedCount: number;
  lastActiveTime?: string;
}

export interface WorkerStats {
  totalWorkers: number;
  idleWorkers: number;
  busyWorkers: number;
  offlineWorkers: number;
}

// Site Slot Types
export interface SiteSlot {
  id: number;
  siteName: string;
  domain: string;
  status: 'active' | 'inactive' | 'scheduling';
  activeSlots: number;
  maxSlots: number;
  progress?: number;
  currentUrl?: string;
  startTime?: string;
}

export interface SiteSlotStats {
  totalSites: number;
  activeSites: number;
  totalSlots: number;
  usedSlots: number;
  availableSlots: number;
}

// ─── 单任务(Crawl Task) ───
export interface CrawlTask {
  id: string;
  sourceId?: number;
  sourceName?: string;
  startUrl: string;
  status: 'pending' | 'running' | 'stopped' | 'completed' | 'failed';
  maxDepth: number;
  maxPages: number;
  pagesCrawled: number;
  linksFound: number;
  itemsSaved: number;
  createdAt: string;
  updatedAt: string;
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