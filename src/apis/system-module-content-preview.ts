import { contentClient } from '@/lib/api/client';

export async function get(params: any) {
  return contentClient("/module/moduleContentPreview/client/detail", {
    params
  });
}
