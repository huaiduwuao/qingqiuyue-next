import { contentClient } from '@/lib/api/client';
import {ArticleItem} from "@/beans/content";

// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockData = [
  { id: 1, title: "Todo Queue 1", subtitle: "Todo Subtitle 1", info: "Todo info 1", content: "Todo content 1", type: "todo", status: "pending", cover: "https://example.com/todo1.jpg", permission: "public" },
  { id: 2, title: "Todo Queue 2", subtitle: "Todo Subtitle 2", info: "Todo info 2", content: "Todo content 2", type: "todo", status: "completed", cover: "https://example.com/todo2.jpg", permission: "public" },
  { id: 3, title: "Todo Queue 3", subtitle: "Todo Subtitle 3", info: "Todo info 3", content: "Todo content 3", type: "todo", status: "pending", cover: "https://example.com/todo3.jpg", permission: "public" },
];

export async function process(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  // 后端:/api/content/content/todoQueue/process (双 content)
  return contentClient("content/todoQueue/process", { method: "POST", data: params });
}

export async function page(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { records: mockData, totalRow: mockData.length } };
  }
  return contentClient("content/todoQueue/client/page", { params });
}

export async function remove(ids: number[]) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient("content/todoQueue/removeByIds", { method: "DELETE", data: { ids } });
}

export async function save(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { id: Date.now(), ...params } };
  }
  return contentClient("content/todoQueue", { method: "POST", data: params });
}

export async function update(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return contentClient(`content/todoQueue/${params.id}`, { method: "PUT", data: params });
}

export async function detail(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: mockData[0] };
  }
  return contentClient(`content/todoQueue/${params.id}`, { params });
}
