// Server Component - 支持静态导出
import { generateStaticParams as roleGenerateStaticParams } from '@/app/(admin)/system/role/[id]/page.utils';
import RoleDetailClient from './RoleDetailClient';

export { roleGenerateStaticParams as generateStaticParams };

export default function RoleDetailPage() {
  return <RoleDetailClient />;
}
