import { contentClient } from '@/lib/api/client';
import {FilmItem, VideoItem} from "@/beans/content";

export async function process(params: any) {
  return contentClient("client-content/teleplay/process", {
    method: "POST",
    data: params
  });
}

export async function updateAndPublish(params: any) {
  return contentClient("client-content/teleplay/updateAndPublish", {
    method: "POST",
    data: params
  });
}

export async function itemUpdate(params: any) {
  return contentClient("client-content/teleplay-item/update", {
    method: "POST",
    data: params
  });
}

export async function page(params: any) {
  return contentClient("client-content/teleplay/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return Promise.all(ids.map((id) => contentClient(`content/${id}`, { method: "DELETE" })));
}

export async function save(params: FilmItem) {
  return contentClient("client-content/teleplay/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: FilmItem) {
  return contentClient("client-content/teleplay/update", {
    method: "POST",
    data: params
  });
}

export async function detail(params: VideoItem) {
  return contentClient("client-content/teleplay/detail", {
    params
  });
}

export async function itemList(params: any) {
  return contentClient("client-content/teleplay-item/list", {
    params
  });
}

