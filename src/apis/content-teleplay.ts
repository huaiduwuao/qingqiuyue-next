import { contentClient } from '@/lib/api/client';
import {FilmItem, VideoItem} from "@/beans/content";

// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockData = [
  { id: 1, title: "Teleplay Title 1", subtitle: "Teleplay Subtitle 1", score: "9.0", fireScore: "8.5", age: "PG-13", category: "Drama", area: "USA", status: "published", content: "Teleplay content 1", type: "teleplay", cover: "https://example.com/teleplay1.jpg", url: "https://example.com/teleplay1.mp4", permission: "public" },
  { id: 2, title: "Teleplay Title 2", subtitle: "Teleplay Subtitle 2", score: "8.5", fireScore: "8.0", age: "PG-13", category: "Action", area: "China", status: "published", content: "Teleplay content 2", type: "teleplay", cover: "https://example.com/teleplay2.jpg", url: "https://example.com/teleplay2.mp4", permission: "public" },
  { id: 3, title: "Teleplay Title 3", subtitle: "Teleplay Subtitle 3", score: "8.0", fireScore: "7.5", age: "PG", category: "Comedy", area: "Korea", status: "draft", content: "Teleplay content 3", type: "teleplay", cover: "https://example.com/teleplay3.jpg", url: "https://example.com/teleplay3.mp4", permission: "public" },
];

export async function process(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient("client-content/teleplay/process", {
    method: "POST",
    data: params
  });
}

export async function updateAndPublish(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return contentClient("client-content/teleplay/updateAndPublish", {
    method: "POST",
    data: params
  });
}

export async function itemUpdate(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return contentClient("client-content/teleplay-item/update", {
    method: "POST",
    data: params
  });
}


export async function page(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { records: mockData, totalRow: mockData.length } };
  }
  return contentClient("client-content/teleplay/page", {
    params
  });
}

export async function remove(ids: number[]) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient("client-content/teleplay/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: FilmItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { id: Date.now(), ...params } };
  }
  return contentClient("client-content/teleplay/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: FilmItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return contentClient("client-content/teleplay/update", {
    method: "POST",
    data: params
  });
}


export async function detail(params: VideoItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: mockData[0] };
  }
  return contentClient("client-content/teleplay/detail", {
    params
  });
}

export async function itemList(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { records: [], totalRow: 0 } };
  }
  return contentClient("client-content/teleplay-item/list", {
    params
  });
}

