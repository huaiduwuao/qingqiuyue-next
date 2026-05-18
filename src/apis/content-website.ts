import { contentClient } from '@/lib/api/client';
import {ArticleItem} from "@/beans/content";

export async function process(params: any) {
  return contentClient("client-content/website/process", {
    method: "POST",
    data: params
  });
}

export async function page(params: any) {
  return contentClient("client-content/website/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return contentClient("client-content/website/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: ArticleItem) {
  return contentClient("client-content/website/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: ArticleItem) {
  return contentClient("client-content/website/update", {
    method: "POST",
    data: params
  });
}

export async function detail(params: ArticleItem) {
  return contentClient("client-content/website/detail", {
    params
  });
}
