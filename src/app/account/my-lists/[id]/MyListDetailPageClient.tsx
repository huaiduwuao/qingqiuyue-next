import type { Metadata } from 'next';

export function generateStaticParams() {
  return [];
}

export const metadata: Metadata = { title: 'Loading...' };

import MyListDetailPageClient from './MyListDetailPageClient';

export default function MyListDetailPage() {
  return <MyListDetailPageClient />;
}
