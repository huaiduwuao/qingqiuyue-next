import { contentClient } from '@/lib/api/client';
import {NovelChapterItem} from "@/beans/content";

export async function page(params: Record<string, unknown>) {
  return contentClient("client-content/novel-chapter/page", {
    params
  });
}

export async function correctLastRead(params: Record<string, unknown>) {
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

export async function addShelf(params: Record<string, unknown>) {
  return contentClient('client-content/novel-bookshelf/add', {
    method: "POST",
    data: params
  });
}

export async function getNovel(params: Record<string, unknown>) {
  return contentClient(`client-content/novel/get`, {
    params
  });
}

/** 小说阅读进度(按设备 id 记,登录后跨设备取最近一条)。没有记录时返回 null。 */
export async function getNovelProgress(params: { bookId: string; deviceId: string }) {
  return contentClient('novel-progress', { params });
}

export async function saveNovelProgress(data: {
  bookId: string;
  deviceId: string;
  chapterId: string;
  page: number;
  para?: number;
  offset?: number;
  updatedAt?: number;
}) {
  return contentClient('novel-progress', { method: 'POST', data });
}
