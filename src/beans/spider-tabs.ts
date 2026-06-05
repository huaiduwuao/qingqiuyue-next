/**
 * 共享的爬虫管理 tab 配置 —— account/content/spider/page.tsx 引用这里,
 * 避免新增/删除 tab 时需要改动 SpiderTab 枚举不同步。
 */

export type SpiderTab = {
  key: 'dashboard' | 'batch' | 'workers' | 'sites' | 'sources' | 'templates' | 'tasks' | 'proxies';
  label: string;
};

export const SPIDER_TABS: SpiderTab[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'batch', label: '任务管理' },
  { key: 'workers', label: 'Worker池' },
  { key: 'sites', label: '站点调度' },
  { key: 'sources', label: '源管理' },
  { key: 'templates', label: '模板管理' },
  { key: 'tasks', label: '单任务' },
  { key: 'proxies', label: '代理池' },
];
