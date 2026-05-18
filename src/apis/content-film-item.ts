import { contentClient } from '@/lib/api/client';


export async function remove(ids: number[]) {
  return contentClient("client-content/film-item/removeByIds", {
    method: "DELETE",
    data: ids
  });
}


export async function save(params: any) {
  return contentClient("client-content/film-item/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: any) {
  return contentClient("client-content/film-item/update", {
    method: "POST",
    data: params
  });
}

export async function get(params: any) {
  return contentClient("client-content/film-item/get", {
    params
  });
}
