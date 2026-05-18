import { contentClient } from '@/lib/api/client';
import {ArticleItem} from "@/beans/content";


export async function page(params: any) {
  return contentClient("client-content/article/page", {
    params
  });
}

export async function process(params: any) {
  return contentClient("client-content/article/process", {
    method: "POST",
    data: params
  });
}

export async function suggest(params: ArticleItem) {
  return contentClient("client-content/article/suggest", {
    params
  });
}

export async function remove(ids: number[]) {
  return contentClient("client-content/article/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: ArticleItem) {
  return contentClient("client-content/article/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: ArticleItem) {
  return contentClient("client-content/article/update", {
    method: "POST",
    data: params
  });
}

export async function detail(params: ArticleItem) {
  return contentClient("client-content/article/detail", {
    params
  });
}
