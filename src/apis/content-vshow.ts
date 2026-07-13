import { contentClient } from '@/lib/api/client';
import {FilmItem} from "@/beans/content";

export async function process(params: Record<string, unknown>) {
  return contentClient("client-content/vshow/process", {
    method: "POST",
    data: params
  });
}

export async function page(params: Record<string, unknown>) {
  return contentClient("client-content/vshow/page", {
    params
  });
}

export async function itemUpdate(params: Record<string, unknown>) {
  return contentClient("client-content/vshow-item/update", {
    method: "POST",
    data: params
  });
}
export async function remove(ids: number[]) {
  return Promise.all(ids.map((id) => contentClient(`content/${id}`, { method: "DELETE" })));
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

export async function detail(params: { id?: string | number }) {
  return contentClient("client-content/vshow/detail", {
    params
  });
}

export async function itemList(params: Record<string, unknown>) {
  return contentClient("client-content/vshow-item/list", {
    params
  });
}

export async function updateAndPublish(params: Record<string, unknown>) {
  return contentClient("client-content/vshow/updateAndPublish", {
    method: "POST",
    data: params
  });
}
