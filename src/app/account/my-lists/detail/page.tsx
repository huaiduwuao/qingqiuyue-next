'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

function MyListDetailContent() {
  const searchParams = useSearchParams();
  const listId = searchParams.get('id');

  return (
    <Box sx={{ p: 3 }}>
      <Typography>My List Detail: {listId}</Typography>
    </Box>
  );
}

export default function MyListDetailPage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    }>
      <MyListDetailContent />
    </Suspense>
  );
}
