'use client';

import React from 'react';
import Box from '@mui/material/Box';
import { ThemeProvider } from '@mui/material/styles';
import { douyinDarkTheme, douyinLightTheme } from '@/styles/creatorTheme';
import { useThemeMode } from '@/contexts/ThemeContext';

export default function RewardLayout({ children }: { children: React.ReactNode }) {
  const { mode, primaryColor } = useThemeMode();
  return (
    // 仅切换到 creatorTheme;不再嵌套 CssBaseline —— 全局已经走 ThemeContext,这里二次
    // 重置 box-sizing / body 背景等会和 account/layout 的 body 锁高叠加,放大客户端
    // 弹窗被挤压的问题。
    <ThemeProvider theme={(mode === 'light' ? douyinLightTheme : douyinDarkTheme)(primaryColor)}>
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
