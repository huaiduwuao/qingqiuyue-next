'use client';

import React from 'react';
import Box from '@mui/material/Box';
import { PersonalCenterCard } from '@/components/account/PersonalCenterCard';

export default function AccountCenterPage() {
  return (
    <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 66px))', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <Box sx={{ maxWidth: 720, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
        <PersonalCenterCard />
      </Box>
    </Box>
  );
}
