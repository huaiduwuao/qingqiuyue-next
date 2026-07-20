import type { Metadata } from 'next';

export function generateStaticParams() {
  return [{ id: '0' }];
}

export const metadata: Metadata = { title: 'Loading...' };

export default function MyListDetailPage() {
  return null;
}
