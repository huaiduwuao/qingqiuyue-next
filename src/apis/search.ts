import { contentClient, adminClient } from '@/lib/api/client';

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

// ── 搜索联想 ──
// 创作者联想 → GET /api/core/user/suggest?keyword=(core-api UserHandler.Suggest,读 user 表 LIKE)
export interface SuggestCreator {
  id: number;
  name: string;
  nickname?: string;
  avatar?: string;
  bio?: string;
  verified?: boolean;
  followers?: number;
}
export async function suggestCreators(keyword: string): Promise<SuggestCreator[]> {
  if (!keyword.trim()) return [];
  const res = await adminClient('/user/suggest', { params: { keyword } });
  return (res?.data ?? []) as SuggestCreator[];
}

// 话题联想 → GET /api/content/module/content/suggest?keyword=(content-api moduleContentHandler.List,走 Doris topic 表)
export interface SuggestTopic {
  id: number;
  title: string;
  name?: string;
  description?: string;
  coverGradient?: string;
  discussCount?: number;
  viewCount?: number;
  hot?: boolean;
}
export async function suggestTopics(keyword: string): Promise<SuggestTopic[]> {
  if (!keyword.trim()) return [];
  const res = await contentClient('/module/content/suggest', { params: { keyword } });
  // moduleContentHandler.List 走 Doris,返回 { data: { records/list: [...], totalRow/total: N } }
  const data = res?.data;
  return (data?.records ?? data?.list ?? []) as SuggestTopic[];
}
