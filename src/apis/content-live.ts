import { contentClient } from '@/lib/api/client';
import {ArticleItem} from "@/beans/content";

export async function process(params: any) {
  return contentClient("client-content/live/process", {
    method: "POST",
    data: params
  });
}

export async function page(params: any) {
  return contentClient("client-content/live/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return Promise.all(ids.map((id) => contentClient(`content/${id}`, { method: "DELETE" })));
}

export async function save(params: ArticleItem) {
  return contentClient("client-content/live/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: ArticleItem) {
  return contentClient("client-content/live/update", {
    method: "POST",
    data: params
  });
}

export async function detail(params: ArticleItem) {
  return contentClient("client-content/live/detail", {
    params
  });
}
