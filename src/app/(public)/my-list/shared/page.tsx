'use client';

// 私密合集的公开访问页 /my-list/shared?token=<share_token>
//
// 口令走查询参数而不是 /shared/[token] 路由段:站点生产是 output:'export' 静态导出,
// 动态段必须有 generateStaticParams() 才能导出,而分享口令在构建期根本不存在
// (第一次带这个页面的构建就是这么失败的)。站内其它凭 id 打开的详情页也都是查询参数。
//
// 入口:合集主在「合集管理」开启 share-token 后,把这个链接发给访客,无需登录即可访问。
// 页面与 /collections/detail 共用 CollectionDetailView:付费合集未买断只看前几个作品,
// 「用 N 钻解锁合集」买断后看全部。

import React from 'react';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import PublicTopBar from '@/components/layout/PublicTopBar';
import CollectionDetailView from '@/components/collection/CollectionDetailView';

function SharedListContent() {
  const token = useSearchParams().get('token') || '';
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <PublicTopBar />
      <CollectionDetailView
        key={token}
        token={token}
        returnTo={`/my-list/shared?token=${encodeURIComponent(token)}`}
      />
    </Box>
  );
}

export default function SharedListPage() {
  return (
    <React.Suspense fallback={null}>
      <SharedListContent />
    </React.Suspense>
  );
}
