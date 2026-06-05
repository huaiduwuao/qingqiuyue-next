import { adminClient } from '@/lib/api/client';
import {ArticleItem} from "@/beans/content";

// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockData = [
  { id: 1, title: "URL Resource 1", subtitle: "URL Subtitle 1", info: "URL info 1", content: "URL content 1", type: "url", status: "active", cover: "https://example.com/url1.jpg", permission: "public" },
  { id: 2, title: "URL Resource 2", subtitle: "URL Subtitle 2", info: "URL info 2", content: "URL content 2", type: "url", status: "active", cover: "https://example.com/url2.jpg", permission: "public" },
  { id: 3, title: "URL Resource 3", subtitle: "URL Subtitle 3", info: "URL info 3", content: "URL content 3", type: "url", status: "inactive", cover: "https://example.com/url3.jpg", permission: "public" },
];

export async function page(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { records: mockData, totalRow: mockData.length } };
  }
  return adminClient("urls/list", { params });
}

export async function remove(ids: number[]) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return adminClient(`urls`, { method: "DELETE", data: { ids } });
}

export async function save(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { id: Date.now(), ...params } };
  }
  return adminClient("urls", { method: "POST", data: params });
}

export async function update(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return adminClient(`urls/${params.id}`, { method: "PUT", data: params });
}

export async function detail(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: mockData[0] };
  }
  return adminClient(`urls/${params.id}`, { params });
}
