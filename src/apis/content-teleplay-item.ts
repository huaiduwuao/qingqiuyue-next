import { contentClient } from '@/lib/api/client';
import {NovelChapterItem} from "@/beans/content";


export async function page(params: any) {
  return contentClient("client-content/teleplay-item/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return contentClient("client-content/teleplay-item/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function sync(params: NovelChapterItem) {
  return contentClient("client-content/teleplay-item/sync", {
    method: "POST",
    data: params
  });
}

export async function save(params: NovelChapterItem) {
  return contentClient("client-content/teleplay-item/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: NovelChapterItem) {
  return contentClient("client-content/teleplay-item/update", {
    method: "POST",
    data: params
  });
}

export async function get(params: NovelChapterItem) {
  return contentClient("client-content/teleplay-item/get", {
    params
  });
}
