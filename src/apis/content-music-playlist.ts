import { contentClient } from '@/lib/api/client';
import {MusicItem} from "@/beans/content";

// Mock enabled for development
const MOCK_ENABLED = true;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockData = [
  { id: 1, name: "Music Playlist 1", info: "Playlist info 1", content: "Playlist content 1", type: "playlist", url: "https://example.com/playlist1", cover: "https://example.com/cover1.jpg", permission: "public", singerName: "Artist 1", albumName: "Album 1" },
  { id: 2, name: "Music Playlist 2", info: "Playlist info 2", content: "Playlist content 2", type: "playlist", url: "https://example.com/playlist2", cover: "https://example.com/cover2.jpg", permission: "public", singerName: "Artist 2", albumName: "Album 2" },
  { id: 3, name: "Music Playlist 3", info: "Playlist info 3", content: "Playlist content 3", type: "playlist", url: "https://example.com/playlist3", cover: "https://example.com/cover3.jpg", permission: "public", singerName: "Artist 3", albumName: "Album 3" },
  { id: 4, name: "Music Playlist 4", info: "Playlist info 4", content: "Playlist content 4", type: "playlist", url: "https://example.com/playlist4", cover: "https://example.com/cover4.jpg", permission: "public", singerName: "Artist 4", albumName: "Album 4" },
];

export async function process(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient("client-content/music-playlist/process", {
    method: "POST",
    data: params
  });
}

export async function page(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { records: mockData, totalRow: mockData.length } };
  }
  return contentClient("client-content/music-playlist/page", {
    params
  });
}

export async function remove(ids: number[]) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: null };
  }
  return contentClient("client-content/music-playlist/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: MusicItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: { id: Date.now(), ...params } };
  }
  return contentClient("client-content/music-playlist/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: MusicItem) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: params };
  }
  return contentClient("client-content/music-playlist/update", {
    method: "POST",
    data: params
  });
}


export async function getMusicList(params: any) {
  if (MOCK_ENABLED) {
    await delay(100);
    return { code: 200, data: mockData.slice(0, 2) };
  }
  return contentClient("client-content/music-playlist/musicList", {
    params
  });
}
