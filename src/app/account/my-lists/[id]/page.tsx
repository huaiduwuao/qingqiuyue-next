import { notFound } from 'next/navigation';

export const revalidate = 0;

export function generateStaticParams() {
  return [];
}

export default function MyListDetailPage() {
  notFound();
}
