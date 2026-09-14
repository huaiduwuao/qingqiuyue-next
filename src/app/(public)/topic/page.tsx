'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 专题广场已并入首页框架(左侧导航「专题」),旧链接跳过去。
export default function TopicRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/home/recommend?tab=topic');
  }, [router]);
  return null;
}
