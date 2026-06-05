import { contentClient } from '@/lib/api/client';
import {NovelChapterItem} from "@/beans/content";

// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockData = [
  { id: 1, title: "Teleplay Episode 1", name: "Episode 1", num: "1", url: "https://example.com/ep1", moduleContentId: "1", collected: false, content: "Episode 1 content", novelName: "Test Teleplay", novelId: 1, fullContent: "Full content here", permission: "public" },
  { id: 2, title: "Teleplay Episode 2", name: "Episode 2", num: "2", url: "https://example.com/ep2", moduleContentId: "1", collected: true, content: "Episode 2 content", novelName: "Test Teleplay", novelId: 1, fullContent: "Full content here", permission: "public" },
  { id: 3, title: "Teleplay Episode 3", name: "Episode 3", num: "3", url: "https://example.com/ep3", moduleContentId: "1", collected: false, content: "Episode 3 content", novelName: "Test Teleplay", novelId: 1, fullContent: "Full content here", permission: "public" },
];


export async function page(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { records: mockData, totalRow: mockData.length } };
  }
  return contentClient("client-content/teleplay-item/page", {
    params
  });
}

export async function remove(ids: number[]) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient("client-content/teleplay-item/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function sync(params: NovelChapterItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { id: Date.now(), ...params } };
  }
  return contentClient("client-content/teleplay-item/sync", {
    method: "POST",
    data: params
  });
}

export async function save(params: NovelChapterItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { id: Date.now(), ...params } };
  }
  return contentClient("client-content/teleplay-item/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: NovelChapterItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return contentClient("client-content/teleplay-item/update", {
    method: "POST",
    data: params
  });
}

export async function get(params: NovelChapterItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: mockData[0] };
  }
  return contentClient("client-content/teleplay-item/get", {
    params
  });
}
