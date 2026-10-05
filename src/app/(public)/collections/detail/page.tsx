'use client';

// 合集详情 /collections/detail?id=<合集 id>[&token=<分享口令>]
//
// id 走查询参数而不是 /collections/[id]:生产是 output:'export' 静态导出,动态段没法导出。
// 付费合集任何人可看简介和前几个作品,买断后看全部;私密合集要带分享口令(/my-list/shared 也用同一个视图)。

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import PublicTopBar from '@/components/layout/PublicTopBar';
import CollectionDetailView from '@/components/collection/CollectionDetailView';

function CollectionDetailContent() {
  const params = useSearchParams();
  const id = params.get('id') || '';
  const token = params.get('token') || '';
  const returnTo = `/collections/detail?id=${encodeURIComponent(id)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <PublicTopBar title="合集" maxWidth="md" />
      <CollectionDetailView key={`${id}|${token}`} listId={id} token={token || undefined} returnTo={returnTo} />
    </Box>
  );
}

export default function CollectionDetailPage() {
  return (
    <Suspense fallback={null}>
      <CollectionDetailContent />
    </Suspense>
  );
}
