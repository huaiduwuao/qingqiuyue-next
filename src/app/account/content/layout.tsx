'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import { douyinDarkTheme } from '@/styles/creatorTheme';
import CreatorSidebar, { MENU_ITEMS } from './components/CreatorSidebar';
import RightSidebar from './components/RightSidebar';

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Determine selected menu from pathname: /account/content/{route}
  const segments = (pathname || '').split('/').filter(Boolean);
  const section = segments[segments.length - 1];
  const selected =
    MENU_ITEMS.find((m) => m.route === section)?.id ||
    (segments[segments.length - 1] === 'content' ? 'content' : 'content');

  const handleSelect = (id: string) => {
    const item = MENU_ITEMS.find((m) => m.id === id);
    if (item) {
      if (id === 'content') {
        router.push('/account/content');
      } else {
        router.push(`/account/content/${item.route}`);
      }
    }
    setDrawerOpen(false);
  };

  return (
    <ThemeProvider theme={douyinDarkTheme}>
      <CssBaseline />
      {/* Mobile hamburger - floating button */}
      <IconButton
        onClick={() => setDrawerOpen(true)}
        sx={{
          display: { xs: 'inline-flex', md: 'none' },
          position: 'fixed',
          bottom: 16,
          left: 16,
          zIndex: 1100,
          bgcolor: 'primary.main',
          color: 'text.primary',
          width: 48,
          height: 48,
          boxShadow: '0 4px 16px rgba(254, 44, 85, 0.4)',
          '&:hover': { bgcolor: 'primary.dark' },
        }}
      >
        <MenuIcon />
      </IconButton>

      {/* Mobile Drawer for sidebar */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: 220, bgcolor: 'background.paper' },
        }}
      >
        <Box sx={{ position: 'absolute', right: 8, top: 8 }}>
          <IconButton size="small" onClick={() => setDrawerOpen(false)} sx={{ color: 'text.secondary' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <CreatorSidebar selected={selected} onSelect={handleSelect} />
      </Drawer>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          bgcolor: 'background.default',
          color: 'text.primary',
          overflow: { md: 'hidden' },
          height: 'calc(100dvh - var(--appbar-h, 66px))',
          minHeight: 0,
        }}
      >
        {/* Desktop sidebar - hidden on mobile */}
        <Box sx={{ display: { xs: 'none', md: 'block' }, flexShrink: 0, height: '100%' }}>
          <CreatorSidebar selected={selected} onSelect={handleSelect} />
        </Box>

        {/* Main content area */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflow: 'auto',
            p: { xs: 1.5, md: 3 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {children}
        </Box>

        {/* Right sidebar */}
        <Box
          sx={{
            display: { xs: 'none', lg: 'block' },
            p: 3,
            pl: 0,
            overflow: 'auto',
            height: '100%',
            flexShrink: 0,
          }}
        >
          <RightSidebar />
        </Box>
      </Box>

      {/* Mobile right sidebar (below content) */}
      <Box sx={{ display: { xs: 'block', lg: 'none' }, px: 1.5, pb: 3, bgcolor: 'background.default' }}>
        <RightSidebar />
      </Box>
    </ThemeProvider>
  );
}
