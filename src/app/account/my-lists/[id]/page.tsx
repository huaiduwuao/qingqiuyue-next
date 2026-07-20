// Server Component - 支持静态导出
import { generateStaticParams as listGenerateStaticParams } from '@/app/account/my-lists/[id]/page.utils';
import MyListDetailClient from './MyListDetailClient';

export { listGenerateStaticParams as generateStaticParams };

export default function MyListDetailPage() {
  return <MyListDetailClient />;
}
