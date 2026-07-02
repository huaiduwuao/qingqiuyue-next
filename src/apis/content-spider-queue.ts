import { contentClient } from '@/lib/api/client';

export async function page(params: Record<string, unknown>) {
  // Backend has /api/content/content/spiderQueue/client/page (note double "content")
  return contentClient("content/spiderQueue/client/page", { params });
}

export async function remove(ids: number[]) {
  const arr = Array.isArray(ids) ? ids : [ids];
  return Promise.all(arr.map((id) => contentClient(`content/spiderQueue/${id}`, { method: 'DELETE' })));
}

export async function save(params: Record<string, unknown>) {
  return contentClient("content/spiderQueue", { method: "POST", data: params });
}

export async function update(params: Record<string, unknown>) {
  return contentClient(`content/spiderQueue/${params.id}`, { method: "PUT", data: params });
}

export async function detail(params: Record<string, unknown>) {
  return contentClient(`content/spiderQueue/${params.id}`, { params });
}
