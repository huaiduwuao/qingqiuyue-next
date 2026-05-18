import { contentClient } from '@/lib/api/client';

// 模块横幅信息
export interface ModuleBannerInfo {
  id: number;
  moduleId: number;
  title: string;
  image: string;
  url?: string;
  sort?: number;
  status?: number;
}

// 获取横幅列表 - GET /content/module/banner/list
export async function listBanners(params?: { page?: number }) {
  return contentClient<{ list: ModuleBannerInfo[]; total: number }>('/module/banner/list', {
    method: 'GET',
    params,
  });
}

// 获取模块横幅 - GET /content/module/banner/module/{moduleId}
export async function getModuleBanners(moduleId: number) {
  return contentClient<ModuleBannerInfo[]>(`/module/banner/module/${moduleId}`, {
    method: 'GET',
  });
}
