'use client';

import React from 'react';
import Box from '@mui/material/Box';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { douyinDarkTheme } from '@/styles/creatorTheme';

export default function RewardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={douyinDarkTheme}>
      <CssBaseline />
      <Box
        sx={{
          bgcolor: 'background.default',
          color: 'text.primary',
          minHeight: '100vh',
        }}
      >
        {children}
      </Box>
    </ThemeProvider>
  );
}
