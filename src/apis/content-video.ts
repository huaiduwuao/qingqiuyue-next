import { contentClient } from '@/lib/api/client';
// 内容类型
export type ContentType = 'music' | 'novel' | 'video' | 'film' | 'teleplay' | 'animation' | 'comics' | 'article' | 'news' | 'picture-album' | 'picture-detail' | 'live' | 'website' | 'pan' | 'vshow' | 'animation-item' | 'teleplay-item' | 'comics-item' | 'film-item' | 'vshow-item';

// 获取内容详情
export async function detail(contentType: ContentType, params: { id: string | number } | string | number) {
  const id = typeof params === 'object' ? params.id : params;
  return contentClient(`client-content/${contentType}/detail`, {
    method: 'GET',
    params: { id },
  });
}
