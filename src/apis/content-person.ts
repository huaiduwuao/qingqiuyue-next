import { contentClient } from '@/lib/api/client';

// 人物详情(PERSON)。走通用的 /client-content/:type/detail,
// 后端额外挂 works:按 metadata.streamer_id 明确关联到这个人的作品。
export async function detail(params: { id?: string | number }) {
  return contentClient('client-content/person/detail', {
    params,
  });
}
