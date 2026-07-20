import type { Metadata } from 'next';
import MyListDetailClient from './MyListDetailClient';

export const generateStaticParams = (() => []) as () => { id: string }[];

export const metadata: Metadata = { title: 'My List' };

export default function MyListDetailPage() {
  return <MyListDetailClient />;
}
