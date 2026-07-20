import { notFound } from 'next/navigation';

export function generateStaticParams() {
  // 返回占位符参数，客户端会根据实际 id 加载数据
  return [{ id: '0' }];
}

export default function MyListDetailPage() {
  notFound();
}
