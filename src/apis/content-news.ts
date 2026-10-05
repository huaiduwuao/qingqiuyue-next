import { contentClient } from '@/lib/api/client';

export async function page(params: Record<string, unknown>) {
  return contentClient("client-content/news/page", {
    params
  });
}

export async function process(params: Record<string, unknown>) {
  return contentClient("client-content/news/process", {
    method: "POST",
    data: params
  });
}

export async function remove(ids: number[]) {
  return Promise.all(ids.map((id) => contentClient(`content/${id}`, { method: "DELETE" })));
}

export async function detail(params: { id?: string | number }) {
  return contentClient("client-content/news/detail", {
    params
  });
}
