'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 收藏夹详情页已下线(依赖的 user_my_list_content 表线上不存在,见 ../page.tsx)。
 * 旧链接统一转到「我的 · 收藏」。
 */
export default function MyListDetailRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/home/recommend?tab=me&mainTab=collect');
  }, [router]);
  return null;
}
