import { contentClient } from '@/lib/api/client';
import {PictureItem} from "@/beans/content";

export async function page(params: any) {
  return contentClient("client-content/picture-detail/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return contentClient("client-content/picture-detail/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: PictureItem) {
  return contentClient("client-content/picture-detail/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: PictureItem) {
  return contentClient("client-content/picture-detail/update", {
    method: "POST",
    data: params
  });
}
