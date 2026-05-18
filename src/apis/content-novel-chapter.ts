import { contentClient } from '@/lib/api/client';
import {NovelChapterItem} from "@/beans/content";


export async function page(params: any) {
  return contentClient("client-content/novel-chapter/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return contentClient("client-content/novel-chapter/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function sync(params: NovelChapterItem) {
  return contentClient("client-content/novel-chapter/sync", {
    method: "POST",
    data: params
  });
}

export async function save(params: NovelChapterItem) {
  return contentClient("client-content/novel-chapter/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: NovelChapterItem) {
  return contentClient("client-content/novel-chapter/update", {
    method: "POST",
    data: params
  });
}

export async function correctLastRead(params: any) {
  return contentClient("client-content/novel-bookshelf/correctLastRead", {
    method: "POST",
    data: params
  });
}

export async function get(params: NovelChapterItem) {
  return contentClient("client-content/novel-chapter/detail", {
    params
  });
}

export async function addShelf(params: any) {
  return contentClient('client-content/novel-bookshelf/add', {
    method: "POST",
    data: params
  });
}

export async function getNovel(params: any) {
  return contentClient(`client-content/novel/get`, {
    params
  });
}
