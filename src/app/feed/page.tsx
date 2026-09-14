'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 动态已并入首页框架(左侧导航「动态」),旧链接跳过去。
export default function FeedRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/home/recommend?tab=feed${window.location.search.replace(/^\?/, '&')}`);
  }, [router]);
  return null;
}
