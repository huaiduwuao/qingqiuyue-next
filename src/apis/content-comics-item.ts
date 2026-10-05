import { contentClient } from '@/lib/api/client';

export async function page(params: Record<string, unknown>) {
  return contentClient("client-content/comics-item/page", {
    params
  });
}
