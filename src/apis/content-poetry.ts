// 唐诗宋词 API client —— 复用 article-detail 已验证的 client-content/<type>/detail 模式。
//
// 后端路由是泛型的(/api/content/client-content/poetry/*),不需要后端新增端点;
// 内容详情由 content-api 的 ClientContentHandler.Detail 统一处理。
import { ArticleItem } from "@/beans/content";

export async function page(params: Record<string, unknown>) {
  const { contentClient } = await import('@/lib/api/client');
  return contentClient("client-content/poetry/page", { params });
}

export async function detail(params: { id?: string | number }) {
  const { contentClient } = await import('@/lib/api/client');
  return contentClient("client-content/poetry/detail", { params });
}

// PoetryItem —— 复用 ArticleItem 作为基础形状(后端返回结构对齐 Doris module_content)。
// title=诗题, author=作者, content=诗正文, tags=逗号分隔标签, cover=空(诗词无封面)。
export type PoetryItem = ArticleItem;

/**
 * 诗词详情响应(由后端 ClientContentHandler.Detail 透出)。
 *
 * 字段与 article/detail 对齐 —— view/like/collect/comment 都是 Doris module_content
 * 列聚合,authorId 来自 module_content.user_id(创作者,用于打赏的 creatorId)。
 * metadata 是 JSON 字符串,前端再解析,取 dynasty/rhythmic/form/lines。
 */
export interface PoetryDetail {
  id: number | string;
  title: string;
  author?: string;
  content?: string;
  tags?: string | string[];
  sourceLabel?: string;
  /** 创作者 id,用于打赏/相关推荐,见 DetailFooter。 */
  authorId?: number | string;
  viewCount?: number;
  likeCount?: number;
  collectCount?: number;
  commentCount?: number;
  /** 朝代 · 词牌 · 体裁 串成一行,诗词页不展示真实发布时间(数据里没有创作年)。 */
  publishTime?: string;
  cover?: string;
  subtitle?: string;
  category?: string;
  status?: string;
  metadata?: string | Record<string, unknown>;
  /** DetailFooter 用的付费/解锁信息,免费内容为 null/undefined。 */
  paywall?: unknown;
}