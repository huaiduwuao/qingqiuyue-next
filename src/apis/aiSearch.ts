import { homeClient } from '@/lib/api/client';

// AI 搜索 → content-api POST /api/home/ai/search(internal/handler/home_ai_search.go)
// 模型先把一句话拆成检索词和类型,再到站内找;mode=keyword 表示模型没配或调用失败,
// 结果只是按原话做的关键词匹配,前端要如实说明。
export interface AISearchItem {
  id: number;
  title: string;
  cover: string;
  contentType: string;
  author?: string;
  /** 入选原因,按实际命中的字段生成(标题/作者/标签/简介) */
  reason: string;
  /** 命中的检索词 */
  keyword: string;
}

export interface AISearchResult {
  query: string;
  mode: 'ai' | 'keyword';
  answer: string;
  intent: { keywords: string[]; types: string[] };
  items: AISearchItem[];
}

export async function aiSearch(q: string): Promise<AISearchResult> {
  const data = (await homeClient.post<AISearchResult>('/ai/search', { q })) as AISearchResult | undefined;
  if (!data || !Array.isArray(data.items)) throw new Error('返回数据格式异常');
  return {
    query: data.query ?? q,
    mode: data.mode === 'ai' ? 'ai' : 'keyword',
    answer: data.answer ?? '',
    intent: {
      keywords: data.intent?.keywords ?? [],
      types: data.intent?.types ?? [],
    },
    // 旧版后端不回 contentType/reason,按原来的做法兜底
    items: data.items.map((it) => ({ ...it, contentType: it.contentType || 'VIDEO', reason: it.reason || '', keyword: it.keyword || '' })),
  };
}
