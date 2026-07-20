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
  // 包裹所有子页面以支持 useSearchParams() 等需要 Suspense 的 hooks
  return (
    <Suspense fallback={<LoadingFallback />}>
      {children}
    </Suspense>
  );
}
