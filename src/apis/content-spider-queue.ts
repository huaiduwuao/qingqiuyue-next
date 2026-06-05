import { contentClient } from '@/lib/api/client';

// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockData = [
  { id: 1, name: "Spider Queue 1", info: "Queue info 1", type: "spider", status: "pending", url: "https://example.com/queue1" },
  { id: 2, name: "Spider Queue 2", info: "Queue info 2", type: "spider", status: "running", url: "https://example.com/queue2" },
  { id: 3, name: "Spider Queue 3", info: "Queue info 3", type: "spider", status: "completed", url: "https://example.com/queue3" },
];


export async function page(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { records: mockData, totalRow: mockData.length } };
  }
  // Backend has /api/content/content/spiderQueue/client/page (note double "content")
  return contentClient("content/spiderQueue/client/page", { params });
}

export async function remove(ids: number[]) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient("content/spiderQueue/removeByIds", { method: "DELETE", data: { ids } });
}

export async function save(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { id: Date.now(), ...params } };
  }
  return contentClient("content/spiderQueue", { method: "POST", data: params });
}

export async function update(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return contentClient(`content/spiderQueue/${params.id}`, { method: "PUT", data: params });
}

export async function detail(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: mockData[0] };
  }
  return contentClient(`content/spiderQueue/${params.id}`, { params });
}
