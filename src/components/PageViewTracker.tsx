'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageView } from '@/lib/track';

// 每次路由变化上报一次 PV,后台「站点流量」的 PV/UV/热门页面都来自这里。
// 管理后台(/system)不算站点流量。
export default function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname && !pathname.startsWith('/system')) trackPageView(pathname);
  }, [pathname]);
  return null;
}
