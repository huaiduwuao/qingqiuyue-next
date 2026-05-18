import { contentClient } from '@/lib/api/client';
import {FilmItem, VideoItem} from "@/beans/content";

export async function process(params: any) {
  return contentClient("client-content/vshow/process", {
    method: "POST",
    data: params
  });
}

export async function page(params: any) {
  return contentClient("client-content/vshow/page", {
    params
  });
}

export async function itemUpdate(params: any) {
  return contentClient("client-content/vshow-item/update", {
    method: "POST",
    data: params
  });
}
export async function remove(ids: number[]) {
  return contentClient("client-content/vshow/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: FilmItem) {
  return contentClient("client-content/vshow/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: FilmItem) {
  return contentClient("client-content/vshow/update", {
    method: "POST",
    data: params
  });
}

export async function detail(params: VideoItem) {
  return contentClient("client-content/vshow/detail", {
    params
  });
}

export async function itemList(params: any) {
  return contentClient("client-content/vshow-item/list", {
    params
  });
}

export async function updateAndPublish(params: any) {
  return contentClient("client-content/vshow/updateAndPublish", {
    method: "POST",
    data: params
  });
}
