import { contentClient } from '@/lib/api/client';

// 数据全部读 Doris module_content,Phase 3 启用后 24 类均有真实数据

// GET /api/content/home/hot?type=&size= —— 某类型的热门 topN
export interface HotItem {
  id: number;
  title: string;
  cover?: string;
  category: string;
  source?: string;
  views?: number;
  likes?: number;
  author?: string;
  createdAt?: string;
}

export async function fetchHot(params: { type?: string; size?: number } = {}) {
  return contentClient('/home/hot', { params });
}

// GET /api/content/home/recommend?types=&size= —— 多类型混合推荐
export async function fetchRecommend(params: { types?: string; size?: number } = {}) {
  return contentClient('/home/recommend', { params });
}

// GET /api/content/home/detail?id= —— 单条详情 catch-all(供详情页)
export async function fetchDetailByID(id: number) {
  return contentClient('/home/detail', { params: { id } });
}
