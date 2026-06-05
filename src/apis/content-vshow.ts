import { contentClient } from '@/lib/api/client';
import {FilmItem, VideoItem} from "@/beans/content";

// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockData = [
  { id: 1, title: "VShow Title 1", subtitle: "VShow Subtitle 1", score: "9.0", fireScore: "8.5", age: "PG-13", category: "Variety", area: "China", status: "published", content: "VShow content 1", type: "vshow", cover: "https://example.com/vshow1.jpg", url: "https://example.com/vshow1.mp4", permission: "public" },
  { id: 2, title: "VShow Title 2", subtitle: "VShow Subtitle 2", score: "8.5", fireScore: "8.0", age: "PG-13", category: "Talk Show", area: "USA", status: "published", content: "VShow content 2", type: "vshow", cover: "https://example.com/vshow2.jpg", url: "https://example.com/vshow2.mp4", permission: "public" },
  { id: 3, title: "VShow Title 3", subtitle: "VShow Subtitle 3", score: "8.0", fireScore: "7.5", age: "PG", category: "Game Show", area: "Korea", status: "draft", content: "VShow content 3", type: "vshow", cover: "https://example.com/vshow3.jpg", url: "https://example.com/vshow3.mp4", permission: "public" },
];

export async function process(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient("client-content/vshow/process", {
    method: "POST",
    data: params
  });
}

export async function page(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { records: mockData, totalRow: mockData.length } };
  }
  return contentClient("client-content/vshow/page", {
    params
  });
}

export async function itemUpdate(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return contentClient("client-content/vshow-item/update", {
    method: "POST",
    data: params
  });
}
export async function remove(ids: number[]) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient("client-content/vshow/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: FilmItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { id: Date.now(), ...params } };
  }
  return contentClient("client-content/vshow/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: FilmItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return contentClient("client-content/vshow/update", {
    method: "POST",
    data: params
  });
}

export async function detail(params: VideoItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: mockData[0] };
  }
  return contentClient("client-content/vshow/detail", {
    params
  });
}

export async function itemList(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { records: [], totalRow: 0 } };
  }
  return contentClient("client-content/vshow-item/list", {
    params
  });
}

export async function updateAndPublish(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return contentClient("client-content/vshow/updateAndPublish", {
    method: "POST",
    data: params
  });
}
