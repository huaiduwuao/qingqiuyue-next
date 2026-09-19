import { contentClient } from '@/lib/api/client';

import type { HomeSection } from '@/lib/homeSections';

// 首页频道(那排页签)的账号侧存档:内容在 PG user_home_section(Go: handler/home_section.go)。
// 未登录时后端返回 needLogin,前端就只用本机 localStorage 那一层。

export interface HomeSectionsResp {
  list: HomeSection[];
  needLogin: boolean;
}

// GET /api/content/home/sections
export async function fetchMySections(): Promise<HomeSectionsResp> {
  const resp: any = await contentClient('/home/sections');
  return {
    list: (resp?.list ?? []) as HomeSection[],
    needLogin: !!resp?.needLogin,
  };
}

// PUT /api/content/home/sections —— 整批替换(顺序就是数组顺序)
export async function saveMySections(sections: HomeSection[]): Promise<HomeSection[]> {
  const resp: any = await contentClient('/home/sections', {
    method: 'PUT',
    data: { sections },
  });
  return (resp?.list ?? []) as HomeSection[];
}
