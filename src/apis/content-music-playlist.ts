import { contentClient } from '@/lib/api/client';
import {MusicItem} from "@/beans/content";

export async function process(params: any) {
  return contentClient("client-content/music-playlist/process", {
    method: "POST",
    data: params
  });
}

export async function page(params: any) {
  return contentClient("client-content/music-playlist/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return contentClient("client-content/music-playlist/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: MusicItem) {
  return contentClient("client-content/music-playlist/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: MusicItem) {
  return contentClient("client-content/music-playlist/update", {
    method: "POST",
    data: params
  });
}

export async function getMusicList(params: any) {
  return contentClient("client-content/music-playlist/musicList", {
    params
  });
}
