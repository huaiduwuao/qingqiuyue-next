'use client';

// 历史专题详情入口 —— /detail/history-detail?id=<id>&kind=figure|event
//
// 复用 DetailLayout + DetailRenderer;通过 ?kind 参数区分人物 / 事件 view,
// 但更细的派发仍由 DetailRenderer 按 subcategory_code 决定。
//
// 该页面让用户能直接从 URL 进入历史专题详情(从首页 tab / 卡片点过来);
// 同时保留 news-detail 的老路径(走 NewsView,与现状一致)。

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { detail as contentDetail } from '@/apis/content-news';
import { DetailLayout } from '@/components/detail/DetailLayout';
import { DetailRenderer } from '@/components/detail/views/DetailRenderer';
import { SubscribeButton } from '@/components/subscription/SubscribeButton';
import { track, recordHistory } from '@/lib/track';

function HistoryDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const kind = searchParams.get('kind') ?? 'figure';

  const query = useQuery({
    queryKey: ['detail', 'news', id],
    queryFn: () => contentDetail({ id: id! }).then((r) => r as any),
    enabled: !!id,
  });

  React.useEffect(() => {
    if (id) {
      track(id, 'view', 'NEWS');
      recordHistory(id);
    }
  }, [id]);

  const sub = `history.${kind}`;

  return (
    <DetailLayout
      title={query.data?.title || '历史详情'}
      contentId={id ?? ''}
      query={query}
      rightActions={
        id ? (
          <SubscribeButton
            targetType="subcategory"
            targetKey={sub}
            variant="icon"
          />
        ) : undefined
      }
      slots={(data) => ({
        right: <DetailRenderer data={data} sub={data.subcategory_code ?? sub} />,
      })}
    />
  );
}

export default function HistoryDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <HistoryDetailContent />
    </React.Suspense>
  );
}