import { adminClient } from '@/lib/api/client';
import {ArticleItem} from "@/beans/content";

// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockData = [
  { id: 1, title: "Website 1", subtitle: "Website Subtitle 1", info: "Website info 1", content: "Website content 1", type: "website", status: "active", cover: "https://example.com/site1.jpg", permission: "public" },
  { id: 2, title: "Website 2", subtitle: "Website Subtitle 2", info: "Website info 2", content: "Website content 2", type: "website", status: "active", cover: "https://example.com/site2.jpg", permission: "public" },
  { id: 3, title: "Website 3", subtitle: "Website Subtitle 3", info: "Website info 3", content: "Website content 3", type: "website", status: "inactive", cover: "https://example.com/site3.jpg", permission: "public" },
];

export async function process(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return adminClient("website/process", { method: "POST", data: params });
}

export async function page(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { records: mockData, totalRow: mockData.length } };
  }
  return adminClient("website/page", { params });
}

export async function remove(ids: number[]) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return adminClient("website/removeByIds", { method: "DELETE", data: { ids } });
}

export async function save(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { id: Date.now(), ...params } };
  }
  return adminClient("website", { method: "POST", data: params });
}

export async function update(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return adminClient(`website/${params.id}`, { method: "PUT", data: params });
}

export async function detail(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: mockData[0] };
  }
  return adminClient(`website/${params.id}`, { params });
}
