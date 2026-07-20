'use client';

import { useEffect } from 'react';
import { notFound } from 'next/navigation';
import RoleDetailClient from './RoleDetailClient';

// Next.js 15: 允许动态路由在静态导出模式下不使用 generateStaticParams
export const dynamicParams = true;

export default function RoleDetailPage() {
  return <RoleDetailClient />;
}
