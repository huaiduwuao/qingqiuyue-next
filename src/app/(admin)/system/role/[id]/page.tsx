import type { Metadata } from 'next';

export function generateStaticParams() {
  return [{ id: '0' }];
}

export const metadata: Metadata = { title: '角色配置' };

export default function RoleDetailPage() {
  return null;
}
