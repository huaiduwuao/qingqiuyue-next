import { contentClient } from '@/lib/api/client';
import {NovelChapterItem} from "@/beans/content";

// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockData = [
  { id: 1, title: "Comics Chapter 1", name: "Chapter 1", num: "1", url: "https://example.com/ch1", moduleContentId: "1", collected: false, content: "Chapter 1 content", novelName: "Test Comics", novelId: 1, fullContent: "Full content here", permission: "public" },
  { id: 2, title: "Comics Chapter 2", name: "Chapter 2", num: "2", url: "https://example.com/ch2", moduleContentId: "1", collected: true, content: "Chapter 2 content", novelName: "Test Comics", novelId: 1, fullContent: "Full content here", permission: "public" },
  { id: 3, title: "Comics Chapter 3", name: "Chapter 3", num: "3", url: "https://example.com/ch3", moduleContentId: "1", collected: false, content: "Chapter 3 content", novelName: "Test Comics", novelId: 1, fullContent: "Full content here", permission: "public" },
  { id: 4, title: "Comics Chapter 4", name: "Chapter 4", num: "4", url: "https://example.com/ch4", moduleContentId: "1", collected: false, content: "Chapter 4 content", novelName: "Test Comics", novelId: 1, fullContent: "Full content here", permission: "public" },
];


export async function page(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { records: mockData, totalRow: mockData.length } };
  }
  return contentClient("client-content/comics-item/page", {
    params
  });
}

export async function remove(ids: number[]) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient("client-content/comics-item/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: NovelChapterItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { id: Date.now(), ...params } };
  }
  return contentClient("client-content/comics-item/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: NovelChapterItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return contentClient("client-content/comics-item/update", {
    method: "POST",
    data: params
  });
}

export async function get(params: NovelChapterItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: mockData[0] };
  }
  return contentClient("client-content/comics-item/get", {
    params
  });
}
