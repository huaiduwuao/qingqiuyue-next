'use client';

import React, { type ReactNode } from 'react';
import Box from '@mui/material/Box';

interface Props {
  children: ReactNode;
  minWidth?: number | string;
}

export default function ResponsiveTableWrapper({ children, minWidth = 720 }: Props) {
  return (
    <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <Box sx={{ minWidth: { xs: minWidth, md: 'auto' } }}>{children}</Box>
    </Box>
  );
}
