import { adminClient } from '@/lib/api/client';
import {ArticleItem} from "@/beans/content";

export async function page(params: any) {
  return adminClient("urls/list", { params });
}

export async function remove(ids: number[]) {
  return adminClient(`urls`, { method: "DELETE", data: { ids } });
}

export async function save(params: ArticleItem) {
  return adminClient("urls", { method: "POST", data: params });
}

export async function update(params: ArticleItem) {
  return adminClient(`urls/${params.id}`, { method: "PUT", data: params });
}

export async function detail(params: ArticleItem) {
  return adminClient(`urls/${params.id}`, { params });
}
