import { contentClient } from '@/lib/api/client';

export async function detail(params: Record<string, unknown>) {
  return contentClient("/module/moduleContentItem/client/detail", {
    params
  });
}
