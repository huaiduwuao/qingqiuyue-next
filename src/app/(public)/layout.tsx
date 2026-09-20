'use client';

import { Suspense, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

function LoadingFallback() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
      <Typography color="text.secondary">加载中...</Typography>
    </Box>
  );
}

export default function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  // 包裹所有子页面以支持 useSearchParams() 等需要 Suspense 的 hooks。
  // 统一加 minHeight: var(--app-height),避免短内容页面(比如 /u 用户主页)在
  // 客户端 WebView 里高度不撑满屏、底部出现大片空白。ViewportFix 已经把
  // --app-height 写成 innerHeight,在老 WebView 里比 100vh 更准。
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Box sx={{ minHeight: 'var(--app-height, 100vh)', bgcolor: 'var(--bg-body, transparent)' }}>
        {children}
      </Box>
    </Suspense>
  );
}
