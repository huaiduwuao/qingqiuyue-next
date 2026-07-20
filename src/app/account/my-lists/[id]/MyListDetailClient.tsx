'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

export default function MyListDetailClient() {
  const params = useParams();
  const router = useRouter();
  const listId = params.id as string;

  return (
    <Box sx={{ p: 3 }}>
      <Typography>My List Detail: {listId}</Typography>
    </Box>
  );
}
