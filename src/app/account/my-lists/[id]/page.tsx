'use client';

import MyListDetailClient from './MyListDetailClient';

// Next.js 15: 允许动态路由在静态导出模式下不使用 generateStaticParams
export const dynamicParams = true;

export default function MyListDetailPage() {
  return <MyListDetailClient />;
}
