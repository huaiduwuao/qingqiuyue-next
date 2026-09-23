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

// 站内结果少于 8 条时,后端把关键词交给全网检索(spider-api internal/discover),响应里带
// discover 状态:queued/running 表示几秒后重搜会有新收录的作品,done 表示全网已找过。
export interface DiscoverState {
  keyword: string;
  status: 'queued' | 'running' | 'done';
  found: number;
  indexed: number;
  merged: number;
  at: string;
}

export const isDiscoverPending = (d?: DiscoverState | null) => d?.status === 'queued' || d?.status === 'running';

// 类型猜测(用户没选分类时,后端按搜索点击回流/站内高热/关键词特征猜他想找的类型,
// 并据此收窄全网检索的源)。guessed_type 非空时前端可提示「猜你想找小说,已优先展示」。
export interface GuessState {
  type: string;        // NOVEL/FILM/MUSIC…
  confidence: number;  // 0..1,≥0.6 后端才采纳
  source: string;      // click / hot-exact / keyword
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
  return (res ?? []) as SuggestCreator[];
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
  // moduleContentHandler.List 走 Doris;拦截器剥壳后拿到的就是 { records/list: [...], totalRow/total: N }
  const data: any = await contentClient('/module/content/suggest', { params: { keyword } });
  return (data?.records ?? data?.list ?? []) as SuggestTopic[];
}
