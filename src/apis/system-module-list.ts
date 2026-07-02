import { contentClient } from '@/lib/api/client';

export async function page(params: Record<string, unknown>) {
  return contentClient("/module/list", {
    params
  });
}

export async function detail(params: Record<string, unknown>) {
  return contentClient(`/module/${params.id}`, {
    params
  });
}

export async function list(params: Record<string, unknown>) {
  return contentClient("/module/list", {
    params
  });
}

export async function remove(ids: number[]) {
  return contentClient("/module/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: Record<string, unknown>) {
  return contentClient("/module", {
    method: "POST",
    data: params
  });
}

export async function update(params: Record<string, unknown>) {
  return contentClient(`/module/${params.id}`, {
    method: "PUT",
    data: params
  });
}
