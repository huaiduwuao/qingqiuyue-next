'use client';

import React from 'react';
import Box from '@mui/material/Box';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { douyinDarkTheme } from '@/styles/creatorTheme';

export default function MsgLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={douyinDarkTheme}>
      <CssBaseline />
      <Box sx={{ bgcolor: 'background.default', minHeight: 'calc(100dvh - var(--appbar-h, 66px))', color: 'text.primary' }}>
        {children}
      </Box>
    </ThemeProvider>
  );
}
