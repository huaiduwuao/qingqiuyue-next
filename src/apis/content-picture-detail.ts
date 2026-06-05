import { contentClient } from '@/lib/api/client';
import {PictureItem} from "@/beans/content";

// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockData = [
  { id: 1, url: "https://example.com/pic1.jpg", info: "Picture info 1", name: "Picture 1", createTime: "2024-01-01", cover: "https://example.com/pic1.jpg", permission: "public" },
  { id: 2, url: "https://example.com/pic2.jpg", info: "Picture info 2", name: "Picture 2", createTime: "2024-01-02", cover: "https://example.com/pic2.jpg", permission: "public" },
  { id: 3, url: "https://example.com/pic3.jpg", info: "Picture info 3", name: "Picture 3", createTime: "2024-01-03", cover: "https://example.com/pic3.jpg", permission: "public" },
  { id: 4, url: "https://example.com/pic4.jpg", info: "Picture info 4", name: "Picture 4", createTime: "2024-01-04", cover: "https://example.com/pic4.jpg", permission: "public" },
];


export async function page(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { records: mockData, totalRow: mockData.length } };
  }
  return contentClient("client-content/picture-detail/page", {
    params
  });
}

export async function remove(ids: number[]) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient("client-content/picture-detail/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: PictureItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { id: Date.now(), ...params } };
  }
  return contentClient("client-content/picture-detail/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: PictureItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return contentClient("client-content/picture-detail/update", {
    method: "POST",
    data: params
  });
}
