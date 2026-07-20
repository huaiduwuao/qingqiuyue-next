'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// (main)/home 之前没 page.tsx,/home 路径会 404;这里用客户端重定向解决。
export default function HomeIndexPage() {
  const router = useRouter();

  useEffect(() => {
    // 客户端重定向，避免 SSR 阶段重定向导致空白页
    router.replace('/home/recommend');
  }, [router]);

  return null;
}
