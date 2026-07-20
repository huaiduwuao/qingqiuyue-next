'use client';

import React, { use } from 'react';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

export default function MyListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const listId = searchParams.get('id') || id;

  return (
    <Box sx={{ p: 3 }}>
      <Typography>My List Detail: {listId}</Typography>
    </Box>
  );
}
