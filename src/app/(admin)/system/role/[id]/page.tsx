'use client';

import { useEffect } from 'react';
import RoleDetailClient from './RoleDetailClient';

// 静态导出模式需要此函数
export function generateStaticParams() {
  return [];
}

export default function RoleDetailPage() {
  useEffect(() => {
    // 客户端渲染，避免 SSR 阶段执行
  }, []);

  return <RoleDetailClient />;
}
