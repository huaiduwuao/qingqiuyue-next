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