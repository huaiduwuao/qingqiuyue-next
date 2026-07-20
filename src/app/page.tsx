'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // 客户端重定向，避免 SSR 阶段重定向导致空白页
    router.replace('/home/recommend');
  }, [router]);

  return null;
}
