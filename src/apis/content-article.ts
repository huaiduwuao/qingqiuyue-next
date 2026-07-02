import {ArticleItem} from "@/beans/content";

export async function page(params: Record<string, unknown>) {
  const { contentClient } = await import('@/lib/api/client');
  return contentClient("client-content/article/page", { params });
}

export async function process(params: Record<string, unknown>) {
  const { contentClient } = await import('@/lib/api/client');
  return contentClient("client-content/article/process", { method: "POST", data: params });
}

export async function suggest(params: ArticleItem) {
  const { contentClient } = await import('@/lib/api/client');
  return contentClient("client-content/article/suggest", { params });
}

export async function remove(ids: number[]) {
  const { contentClient } = await import('@/lib/api/client');
  return Promise.all(ids.map((id) => contentClient(`content/${id}`, { method: "DELETE" })));
}

export async function save(params: ArticleItem) {
  const { contentClient } = await import('@/lib/api/client');
  return contentClient("client-content/article/save", { method: "POST", data: params });
}

export async function update(params: ArticleItem) {
  const { contentClient } = await import('@/lib/api/client');
  return contentClient("client-content/article/update", { method: "POST", data: params });
}

export async function detail(params: ArticleItem) {
  const { contentClient } = await import('@/lib/api/client');
  return contentClient("client-content/article/detail", { params });
}