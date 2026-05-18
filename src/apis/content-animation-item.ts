import { contentClient } from '@/lib/api/client';
import {NovelChapterItem} from "@/beans/content";


export async function page(params: any) {
  return contentClient("client-content/animation-item/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return contentClient("client-content/animation-item/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: NovelChapterItem) {
  return contentClient("client-content/animation-item/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: NovelChapterItem) {
  return contentClient("client-content/animation-item/update", {
    method: "POST",
    data: params
  });
}

export async function get(params: NovelChapterItem) {
  return contentClient("client-content/animation-item/get", {
    params
  });
}
