import type { Metadata } from 'next';
import RoleDetailPageClient from './RoleDetailPageClient';

export function generateStaticParams() {
  return [{ id: '0' }];
}

export const metadata: Metadata = { title: '角色配置' };

export default function RoleDetailPage() {
  return <RoleDetailPageClient />;
}
