import { contentClient } from '@/lib/api/client';
import {ArticleItem} from "@/beans/content";

// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockData = [
  { id: 1, title: "News Title 1", subtitle: "News Subtitle 1", info: "News info 1", content: "News content 1", type: "news", status: "published", cover: "https://example.com/news1.jpg", permission: "public" },
  { id: 2, title: "News Title 2", subtitle: "News Subtitle 2", info: "News info 2", content: "News content 2", type: "news", status: "published", cover: "https://example.com/news2.jpg", permission: "public" },
  { id: 3, title: "News Title 3", subtitle: "News Subtitle 3", info: "News info 3", content: "News content 3", type: "news", status: "draft", cover: "https://example.com/news3.jpg", permission: "public" },
  { id: 4, title: "News Title 4", subtitle: "News Subtitle 4", info: "News info 4", content: "News content 4", type: "news", status: "published", cover: "https://example.com/news4.jpg", permission: "public" },
];


export async function page(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { records: mockData, totalRow: mockData.length } };
  }
  return contentClient("client-content/news/page", {
    params
  });
}

export async function process(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient("client-content/news/process", {
    method: "POST",
    data: params
  });
}

export async function suggest(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: mockData.slice(0, 2) };
  }
  return contentClient("client-content/news/suggest", {
    params
  });
}

export async function remove(ids: number[]) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient("client-content/news/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { id: Date.now(), ...params } };
  }
  return contentClient("client-content/news/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return contentClient("client-content/news/update", {
    method: "POST",
    data: params
  });
}

export async function detail(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: mockData[0] };
  }
  return contentClient("client-content/news/detail", {
    params
  });
}
