'use client';

import React, { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { relatedQueryOptions } from '@/components/detail/RelatedContent';
import { useApp } from '@/contexts/AppContext';

/** 底部没有"相关推荐"的详情页,不预取。 */
const NO_RELATED = ['/detail/topic-detail', '/detail/history-detail', '/detail/person-detail'];

/**
 * 详情页一打开就预取相关推荐。相关推荐渲染在详情内容下面,要等详情接口返回
 * 才挂载;不预取的话两个请求是串行的,推荐区总要晚一个往返才出来。
 */
function RelatedPrefetch() {
  const id = useSearchParams().get('id');
  const pathname = usePathname() ?? '';
  const queryClient = useQueryClient();
  const { currentUser } = useApp();
  const userId = currentUser?.id;

  useEffect(() => {
    if (!id || NO_RELATED.some((p) => pathname.startsWith(p))) return;
    void queryClient.prefetchQuery(relatedQueryOptions(id, userId));
  }, [id, pathname, userId, queryClient]);

  return null;
}

export default function DetailRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* useSearchParams 在静态导出下必须包在 Suspense 里 */}
      <Suspense fallback={null}>
        <RelatedPrefetch />
      </Suspense>
      {children}
    </>
  );
}
