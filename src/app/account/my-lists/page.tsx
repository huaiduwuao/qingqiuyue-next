'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 自建收藏夹页面已下线。
 *
 * 它依赖的 Doris 表 user_my_list / user_my_list_content 线上根本不存在:列表永远是空的,
 * 新建收藏夹必定失败。收藏只有一份真相 —— user_content_collect(type=collect),详情页的
 * 收藏按钮写的就是它 —— 在「我的 · 收藏」里查看。旧链接和书签统一转过去。
 */
export default function MyListsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/home/recommend?tab=me&mainTab=collect');
  }, [router]);
  return null;
}
