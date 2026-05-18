import { contentClient } from '@/lib/api/client';


export async function page(params: any) {
  return contentClient("client-content/spider-queue/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return contentClient("client-content/spider-queue/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: any) {
  return contentClient("client-content/spider-queue/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: any) {
  return contentClient("client-content/spider-queue/update", {
    method: "POST",
    data: params
  });
}

export async function detail(params: any) {
  return contentClient("client-content/spider-queue/detail", {
    params
  });
}
