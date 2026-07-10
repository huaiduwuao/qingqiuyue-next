'use client';

import React from 'react';
import Box from '@mui/material/Box';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { douyinDarkTheme, douyinLightTheme } from '@/styles/creatorTheme';
import { useThemeMode } from '@/contexts/ThemeContext';

export default function MsgLayout({ children }: { children: React.ReactNode }) {
  const { mode, primaryColor } = useThemeMode();
  return (
    <ThemeProvider theme={(mode === 'light' ? douyinLightTheme : douyinDarkTheme)(primaryColor)}>
      <CssBaseline />
      <Box sx={{ bgcolor: 'background.default', minHeight: 'calc(100dvh - var(--appbar-h, 66px))', color: 'text.primary' }}>
        {children}
      </Box>
    </ThemeProvider>
  );
}
