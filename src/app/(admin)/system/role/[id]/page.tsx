import type { Metadata } from 'next';

export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export const metadata: Metadata = { title: '角色配置' };

import RoleDetailPageClient from './RoleDetailPageClient';

export default function RoleDetailPage() {
  return <RoleDetailPageClient />;
}
