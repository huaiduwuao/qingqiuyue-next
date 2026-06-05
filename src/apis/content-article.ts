// Mock enabled for development
import {ArticleItem} from "@/beans/content";

const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockData = [
  { id: 1, title: "Article Title 1", subtitle: "Subtitle 1", info: "Article info 1", content: "Article content 1", type: "news", status: "published", cover: "https://example.com/cover1.jpg", permission: "public" },
  { id: 2, title: "Article Title 2", subtitle: "Subtitle 2", info: "Article info 2", content: "Article content 2", type: "news", status: "published", cover: "https://example.com/cover2.jpg", permission: "public" },
  { id: 3, title: "Article Title 3", subtitle: "Subtitle 3", info: "Article info 3", content: "Article content 3", type: "news", status: "draft", cover: "https://example.com/cover3.jpg", permission: "public" },
  { id: 4, title: "Article Title 4", subtitle: "Subtitle 4", info: "Article info 4", content: "Article content 4", type: "article", status: "published", cover: "https://example.com/cover4.jpg", permission: "public" },
];

export async function page(params: any) {
  if (MOCK_ENABLED) {
    await delay(300);
    return {
      code: 200,
      data: { list: mockData, total: mockData.length },
    };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient("client-content/article/page", { params });
}

export async function process(params: any) {
  if (MOCK_ENABLED) {
    await delay(300);
    return { code: 200, data: { success: true } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient("client-content/article/process", { method: "POST", data: params });
}

export async function suggest(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(300);
    return { code: 200, data: mockData[0] };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient("client-content/article/suggest", { params });
}

export async function remove(ids: number[]) {
  if (MOCK_ENABLED) {
    await delay(300);
    return { code: 200, data: { success: true } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient("client-content/article/removeByIds", { method: "DELETE", data: ids });
}

export async function save(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(300);
    return { code: 200, data: { id: mockData.length + 1, ...params } };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient("client-content/article/save", { method: "POST", data: params });
}

export async function update(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(300);
    return { code: 200, data: params };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient("client-content/article/update", { method: "POST", data: params });
}

export async function detail(params: ArticleItem) {
  if (MOCK_ENABLED) {
    await delay(300);
    return { code: 200, data: mockData[0] };
  }
  const { contentClient } = await import('@/lib/api/client');
  return contentClient("client-content/article/detail", { params });
}