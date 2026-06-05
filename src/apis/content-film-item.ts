import { contentClient } from '@/lib/api/client';

// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockData = [
  { id: 1, title: "Film Item 1", subtitle: "Subtitle 1", info: "Film info 1", content: "Film content 1", type: "film", status: "published", cover: "https://example.com/cover1.jpg", permission: "public", url: "https://example.com/film1.mp4" },
  { id: 2, title: "Film Item 2", subtitle: "Subtitle 2", info: "Film info 2", content: "Film content 2", type: "film", status: "published", cover: "https://example.com/cover2.jpg", permission: "public", url: "https://example.com/film2.mp4" },
  { id: 3, title: "Film Item 3", subtitle: "Subtitle 3", info: "Film info 3", content: "Film content 3", type: "film", status: "draft", cover: "https://example.com/cover3.jpg", permission: "public", url: "https://example.com/film3.mp4" },
];


export async function remove(ids: number[]) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient("client-content/film-item/removeByIds", {
    method: "DELETE",
    data: ids
  });
}


export async function save(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { id: Date.now(), ...params } };
  }
  return contentClient("client-content/film-item/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return contentClient("client-content/film-item/update", {
    method: "POST",
    data: params
  });
}

export async function get(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: mockData[0] };
  }
  return contentClient("client-content/film-item/get", {
    params
  });
}
