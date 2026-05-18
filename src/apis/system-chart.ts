import { adminClient } from '@/lib/api/client';

// 图表数据
export interface ChartData {
  labels?: string[];
  values?: number[];
  series?: { name: string; data: number[] }[];
}

// 图表概览
export interface ChartOverview {
  date: string;
  value: number;
  change?: number;
}

// 日内容
export interface ChartDayContent {
  title: string;
  value: number;
}

// 日排行
export interface ChartDayTop {
  rank: number;
  title: string;
  value: number;
}

// 图表查询参数
export interface ChartQuery {
  date?: string;
  startDate?: string;
  endDate?: string;
  type?: string;
}

// 获取仪表盘数据
export async function getChartData(type?: string) {
  return adminClient<ChartData>('/chart/data', {
    method: 'GET',
    params: type ? { type } : undefined,
  });
}

// 获取图表概览列表
export async function listChartOverviews(params?: { date?: string; startDate?: string; endDate?: string }) {
  return adminClient<ChartOverview[]>('/chart/overview/list', {
    method: 'GET',
    params,
  });
}

// 获取日内容列表
export async function listChartDayContents(date: string) {
  return adminClient<ChartDayContent[]>('/chart/daycontent/list', {
    method: 'GET',
    params: { date },
  });
}

// 获取日排行列表
export async function listChartDayTops(date: string) {
  return adminClient<ChartDayTop[]>('/chart/daytop/list', {
    method: 'GET',
    params: { date },
  });
}

// 获取搜索列表
export async function listChartSearches(params: { date?: string; type?: string }) {
  return adminClient<any[]>('/chart/search/list', {
    method: 'GET',
    params,
  });
}

// 获取日搜索列表
export async function listChartDaySearches(params: { page?: number; pageSize?: number; date?: string }) {
  return adminClient<{ list: any[]; total: number }>('/chart/day-search/list', {
    method: 'GET',
    params,
  });
}

// 获取月度列表
export async function listChartMonths(params: { date?: string; type?: string }) {
  return adminClient<any[]>('/chart/month/list', {
    method: 'GET',
    params,
  });
}

// 获取内容雷达列表
export async function listChartContentRadars(params?: { type?: string; status?: string }) {
  return adminClient<any[]>('/chart/radar/list', {
    method: 'GET',
    params,
  });
}

// 创建内容雷达
export async function createChartContentRadar(data: any) {
  return adminClient('/chart/radar', {
    method: 'POST',
    data,
  });
}

// 更新内容雷达
export async function updateChartContentRadar(id: number, data: any) {
  return adminClient(`/api/chart/radar/${id}`, {
    method: 'PUT',
    data,
  });
}

// 删除内容雷达
export async function deleteChartContentRadar(id: number) {
  return adminClient(`/api/chart/radar/${id}`, {
    method: 'DELETE',
  });
}
