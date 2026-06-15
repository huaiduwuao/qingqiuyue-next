import { contentClient } from '@/lib/api/client';

// 真全文搜索 → content-api GET /api/content/search(PG pg_trgm,Redis 缓存,无 ES)
// 返回 { list: [{id,title,cover,author,contentType,score}], total }
export const searchContent = (kw: string, opts?: { type?: string; size?: number }) =>
  contentClient('/search', { params: { kw, type: opts?.type, size: opts?.size } });

// 大数据排行 → GET /api/content/analytics/hot(读 Doris dws_item_hot)
export const hotRank = (params?: { type?: string; size?: number }) =>
  contentClient('/analytics/hot', { params });
