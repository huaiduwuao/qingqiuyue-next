import { contentClient } from '@/lib/api/client';
import {ArticleItem} from "@/beans/content";

export async function page(params: Record<string, unknown>) {
  return contentClient("client-content/news/page", {
    params
  });
}

export async function process(params: Record<string, unknown>) {
  return contentClient("client-content/news/process", {
    method: "POST",
    data: params
  });
}

export async function suggest(params: ArticleItem) {
  return contentClient("client-content/news/suggest", {
    params
  });
}

export async function remove(ids: number[]) {
  return Promise.all(ids.map((id) => contentClient(`content/${id}`, { method: "DELETE" })));
}

export async function save(params: ArticleItem) {
  return contentClient("client-content/news/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: ArticleItem) {
  return contentClient("client-content/news/update", {
    method: "POST",
    data: params
  });
}

export async function detail(params: { id?: string | number }) {
  return contentClient("client-content/news/detail", {
    params
  });
}
