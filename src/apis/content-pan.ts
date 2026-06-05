import { adminClient } from '@/lib/api/client';
import {ArticleItem} from "@/beans/content";

// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockData = [
  { id: 1, title: "Pan Resource 1", subtitle: "Pan Subtitle 1", info: "Pan info 1", content: "Pan content 1", type: "pan", status: "shared", cover: "https://example.com/pan1.jpg", permission: "public" },
  { id: 2, title: "Pan Resource 2", subtitle: "Pan Subtitle 2", info: "Pan info 2", content: "Pan content 2", type: "pan", status: "shared", cover: "https://example.com/pan2.jpg", permission: "public" },
  { id: 3, title: "Pan Resource 3", subtitle: "Pan Subtitle 3", info: "Pan info 3", content: "Pan content 3", type: "pan", status: "private", cover: "https://example.com/pan3.jpg", permission: "public" },
];

export async function process(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return adminClient("pan/process", { method: "POST", data: params });
}

export async function page(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { records: mockData, totalRow: mockData.length } };
  }
  return adminClient("pan/page", { params });
}

export async function remove(ids: number[]) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return adminClient("pan/removeByIds", { method: "DELETE", data: { ids } });
}

export async function save(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { id: Date.now(), ...params } };
  }
  return adminClient("pan", { method: "POST", data: params });
}

export async function update(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return adminClient(`pan/${params.id}`, { method: "PUT", data: params });
}

export async function detail(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: mockData[0] };
  }
  return adminClient(`pan/${params.id}`, { params });
}
