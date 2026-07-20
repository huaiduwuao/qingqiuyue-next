'use client';

import { useEffect } from 'react';
import MyListDetailClient from './MyListDetailClient';

export default function MyListDetailPage() {
  useEffect(() => {
    // 客户端渲染，避免 SSR 阶段执行
  }, []);

  return <MyListDetailClient />;
}
