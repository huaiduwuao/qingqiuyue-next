import { adminClient } from '@/lib/api/client';
import {ArticleItem} from "@/beans/content";

export async function process(params: any) {
  return adminClient("pan/process", { method: "POST", data: params });
}

export async function page(params: any) {
  return adminClient("pan/page", { params });
}

export async function remove(ids: number[]) {
  return adminClient("pan/removeByIds", { method: "DELETE", data: { ids } });
}

export async function save(params: ArticleItem) {
  return adminClient("pan", { method: "POST", data: params });
}

export async function update(params: ArticleItem) {
  return adminClient(`pan/${params.id}`, { method: "PUT", data: params });
}

export async function detail(params: ArticleItem) {
  return adminClient(`pan/${params.id}`, { params });
}
