import { contentClient } from '@/lib/api/client';

// 真全文搜索 → content-api GET /api/content/search(Doris title LIKE + metadata 结构化筛选,Redis 缓存)
// 返回 { list: [{id,title,cover,author,contentType,score}], total }
// 除关键词 kw 外,支持按导演/演员/歌手/专辑/作者/类型/年代筛选(全可选,后端 AND 关系)。
export interface SearchOptions {
  type?: string;
  size?: number;
  actor?: string;
  director?: string;
  artist?: string;
  album?: string;
  author?: string;
  genre?: string;
  year?: string | number;
}

export const searchContent = (kw: string, opts?: SearchOptions) =>
  contentClient('/search', { params: { kw, ...opts } });

// 大数据排行 → GET /api/content/analytics/hot(读 Doris dws_item_hot)
export const hotRank = (params?: { type?: string; size?: number }) =>
  contentClient('/analytics/hot', { params });
