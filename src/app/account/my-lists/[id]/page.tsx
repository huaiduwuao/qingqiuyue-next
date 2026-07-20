import type { Metadata } from 'next';
import MyListDetailPageClient from './MyListDetailPageClient';

export function generateStaticParams() {
  return [{ id: '0' }];
}

export const metadata: Metadata = { title: 'Loading...' };

export default function MyListDetailPage() {
  return <MyListDetailPageClient />;
}
