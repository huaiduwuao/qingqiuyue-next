'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RoleDetailClient from './RoleDetailClient';

export default function RoleDetailPage() {
  const router = useRouter();

  useEffect(() => {
    // 客户端渲染，避免 SSR 阶段执行
  }, []);

  return <RoleDetailClient />;
}
