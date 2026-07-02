import { contentClient } from '@/lib/api/client';
import {ArticleItem} from "@/beans/content";

export async function process(params: Record<string, unknown>) {
  // 后端:/api/content/content/todoQueue/process (双 content)
  return contentClient("content/todoQueue/process", { method: "POST", data: params });
}

export async function page(params: Record<string, unknown>) {
  return contentClient("content/todoQueue/client/page", { params });
}

export async function remove(ids: number[]) {
  return contentClient("content/todoQueue/removeByIds", { method: "DELETE", data: { ids } });
}

export async function save(params: ArticleItem) {
  return contentClient("content/todoQueue", { method: "POST", data: params });
}

export async function update(params: ArticleItem) {
  return contentClient(`content/todoQueue/${params.id}`, { method: "PUT", data: params });
}

export async function detail(params: ArticleItem) {
  return contentClient(`content/todoQueue/${params.id}`, { params });
}
