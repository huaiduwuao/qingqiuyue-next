'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

function RoleDetailContent() {
  const searchParams = useSearchParams();
  const roleId = searchParams.get('id');

  return (
    <Box sx={{ p: 3 }}>
      <Typography>角色配置详情: {roleId}</Typography>
    </Box>
  );
}

export default function RoleDetailPage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    }>
      <RoleDetailContent />
    </Suspense>
  );
}
