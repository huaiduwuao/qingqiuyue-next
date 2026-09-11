'use client';

import React, { Suspense } from 'react';
import Box from '@mui/material/Box';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { douyinDarkTheme, douyinLightTheme } from '@/styles/creatorTheme';
import { useThemeMode } from '@/contexts/ThemeContext';
import { WorkspaceShell } from '../components/WorkspaceShell';
import RightSidebar from './_components/RightSidebar';
import { ActiveTabProvider, useActiveTab } from './ActiveTabContext';
import { CONTENT_HOME_TAB, contentNavFor, useIsContentStaff } from './navigation';

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  const { mode, primaryColor } = useThemeMode();
  return (
    <ThemeProvider theme={(mode === 'light' ? douyinLightTheme : douyinDarkTheme)(primaryColor)}>
      <CssBaseline />
      {/* useUrlTab 读取 ?tab=,静态导出要求放在 Suspense 边界内 */}
      <Suspense fallback={null}>
        <ActiveTabProvider>
          <CreatorWorkspace>{children}</CreatorWorkspace>
        </ActiveTabProvider>
      </Suspense>
    </ThemeProvider>
  );
}

function CreatorLogo() {
  return (
    <Box
      aria-hidden
      sx={{
        width: 32,
        height: 32,
        borderRadius: 1,
        background: 'linear-gradient(135deg, #25F4EE 0%, #FE2C55 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 18,
        color: 'background.default',
      }}
    >
      清
    </Box>
  );
}

function CreatorWorkspace({ children }: { children: React.ReactNode }) {
  const { activeTab, setActiveTab } = useActiveTab();
  const isStaff = useIsContentStaff();
  return (
    <WorkspaceShell
      title="创作者中心"
      logo={<CreatorLogo />}
      groups={contentNavFor(isStaff)}
      selected={activeTab}
      onSelect={(id) => setActiveTab(id)}
      // 通知 / 活动 / 日历只在工作台首页展示,其它子页面自带密集的操作界面。
      aside={activeTab === CONTENT_HOME_TAB ? <RightSidebar /> : undefined}
    >
      {children}
    </WorkspaceShell>
  );
}
