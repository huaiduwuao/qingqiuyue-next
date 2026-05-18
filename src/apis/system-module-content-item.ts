import { contentClient } from '@/lib/api/client';

export async function detail(params: any) {
  return contentClient("/module/moduleContentItem/client/detail", {
    params
  });
}
