import type { Metadata } from 'next';
import RoleDetailClient from './RoleDetailClient';

export const generateStaticParams = (() => []) as () => { id: string }[];

export const metadata: Metadata = { title: 'Role Config' };

export default function RoleDetailPage() {
  return <RoleDetailClient />;
}
