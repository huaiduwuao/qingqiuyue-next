import { contentClient } from '@/lib/api/client';
import {ArticleItem} from "@/beans/content";

// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockData = [
  { id: 1, title: "Live Stream 1", subtitle: "Live Subtitle 1", info: "Live info 1", content: "Live content 1", type: "live", status: "live", cover: "https://example.com/live1.jpg", permission: "public" },
  { id: 2, title: "Live Stream 2", subtitle: "Live Subtitle 2", info: "Live info 2", content: "Live content 2", type: "live", status: "ended", cover: "https://example.com/live2.jpg", permission: "public" },
  { id: 3, title: "Live Stream 3", subtitle: "Live Subtitle 3", info: "Live info 3", content: "Live content 3", type: "live", status: "live", cover: "https://example.com/live3.jpg", permission: "public" },
];

export async function process(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient("client-content/live/process", {
    method: "POST",
    data: params
  });
}

export async function page(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { records: mockData, totalRow: mockData.length } };
  }
  return contentClient("client-content/live/page", {
    params
  });
}

export async function remove(ids: number[]) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient("client-content/live/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { id: Date.now(), ...params } };
  }
  return contentClient("client-content/live/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return contentClient("client-content/live/update", {
    method: "POST",
    data: params
  });
}

export async function detail(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: mockData[0] };
  }
  return contentClient("client-content/live/detail", {
    params
  });
}
