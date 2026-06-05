import { contentClient } from '@/lib/api/client';
import {PictureAlbumItem} from "@/beans/content";

// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockData = [
  { id: 1, name: "Picture Album 1", info: "Album info 1", type: "album", url: "https://example.com/album1", cover: "https://example.com/album1.jpg", permission: "public" },
  { id: 2, name: "Picture Album 2", info: "Album info 2", type: "album", url: "https://example.com/album2", cover: "https://example.com/album2.jpg", permission: "public" },
  { id: 3, name: "Picture Album 3", info: "Album info 3", type: "album", url: "https://example.com/album3", cover: "https://example.com/album3.jpg", permission: "public" },
  { id: 4, name: "Picture Album 4", info: "Album info 4", type: "album", url: "https://example.com/album4", cover: "https://example.com/album4.jpg", permission: "public" },
];


export async function process(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient("client-content/picture-album/process", {
    method: "POST",
    data: params
  });
}

export async function page(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { records: mockData, totalRow: mockData.length } };
  }
  return contentClient("client-content/picture-album/page", {
    params
  });
}

export async function detail(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: mockData[0] };
  }
  return contentClient("client-content/picture-album/detail", {
    params
  });
}


export async function suggest(params: PictureAlbumItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: mockData.slice(0, 2) };
  }
  return contentClient("client-content/picture-album/suggest", {
    params
  });
}

export async function remove(ids: number[]) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient("client-content/picture-album/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: PictureAlbumItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { id: Date.now(), ...params } };
  }
  return contentClient("client-content/picture-album/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: PictureAlbumItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return contentClient("client-content/picture-album/update", {
    method: "POST",
    data: params
  });
}
