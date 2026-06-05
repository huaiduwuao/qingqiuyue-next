import { adminClient } from '@/lib/api/client';
import {ArticleItem} from "@/beans/content";

export async function process(params: any) {
  return adminClient("website/process", { method: "POST", data: params });
}

export async function page(params: any) {
  return adminClient("website/page", { params });
}

export async function remove(ids: number[]) {
  return adminClient("website/removeByIds", { method: "DELETE", data: { ids } });
}

export async function save(params: ArticleItem) {
  return adminClient("website", { method: "POST", data: params });
}

export async function update(params: ArticleItem) {
  return adminClient(`website/${params.id}`, { method: "PUT", data: params });
}

export async function detail(params: ArticleItem) {
  return adminClient(`website/${params.id}`, { params });
}
