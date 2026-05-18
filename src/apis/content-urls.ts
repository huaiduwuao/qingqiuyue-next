import { contentClient } from '@/lib/api/client';
import {ArticleItem} from "@/beans/content";

export async function page(params: any) {
  return contentClient("client-content/urls/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return contentClient("client-content/urls/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: ArticleItem) {
  return contentClient("client-content/urls/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: ArticleItem) {
  return contentClient("client-content/urls/update", {
    method: "POST",
    data: params
  });
}

export async function detail(params: ArticleItem) {
  return contentClient("client-content/urls/detail", {
    params
  });
}
