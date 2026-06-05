'use client';

import React, { useEffect } from 'react';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import { usePathname, useRouter } from 'next/navigation';
import MenuIcon from '@mui/icons-material/Menu';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import SettingsIcon from '@mui/icons-material/Settings';
import { useApp } from '@/contexts/AppContext';
import { AccountContextProvider } from '@/contexts/AccountContext';
import { AvatarHoverPopup } from '@/components/account/AvatarHoverPopup';
import NoticeIconView, { DmIconView } from '@/components/NoticeIcon';
import MobileNavDrawer from './components/MobileNavDrawer';

const ACCOUNT_PAGES = [
  { key: 'center', label: '个人中心', sub: '个人空间', path: '/account/center', icon: <PersonIcon sx={{ fontSize: 18 }} />, accent: 'primary.main' },
  { key: 'content', label: '内容管理', sub: '创作者工作台', path: '/account/content', icon: <VideoLibraryIcon sx={{ fontSize: 18 }} />, accent: 'secondary.main' },
  { key: 'reward', label: '悬赏中心', sub: '赏金猎人工作台', path: '/account/reward', icon: <CardGiftcardIcon sx={{ fontSize: 18 }} />, accent: 'warning.main' },
  { key: 'settings', label: '设置', sub: '账号与隐私', path: '/account/settings', icon: <SettingsIcon sx={{ fontSize: 18 }} />, accent: '#8B5CF6' },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccountContextProvider>
      <AccountLayoutContent>{children}</AccountLayoutContent>
    </AccountContextProvider>
  );
}

function AccountLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser } = useApp();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const appBarRef = React.useRef<HTMLDivElement | null>(null);

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/home/recommend');
    }
  };

  React.useEffect(() => {
    const el = appBarRef.current;
    if (!el) return;
    const update = () => {
      const h = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--appbar-h', `${h}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isAccountSection = pathname.startsWith('/account');
  const isMsgPage = pathname.startsWith('/account/msg');
  const currentPage = isMsgPage
    ? { key: 'msg', label: '消息中心', sub: '互动 · 系统 · 私信', path: '/account/msg', icon: null, accent: 'primary.main' }
    : ACCOUNT_PAGES.find((p) => pathname.startsWith(p.path)) || ACCOUNT_PAGES[0];

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      bodyBg: body.style.backgroundColor,
    };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.height = '100dvh';
    body.style.backgroundColor = '#0a0a0f';
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
      body.style.backgroundColor = prev.bodyBg;
    };
  }, []);

  if (!isAccountSection) {
    return <Box>{children}</Box>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', bgcolor: '#0a0a0f', overflow: 'hidden' }}>
      <AppBar
        ref={appBarRef}
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'rgba(10, 10, 15, 0.85)',
          color: 'text.primary',
          borderBottom: 'none',
          backdropFilter: 'blur(12px)',
          flexShrink: 0,
        }}
      >
        <Toolbar
          sx={{
            gap: 1.5,
            minHeight: 64,
            px: { xs: 1.5, md: 3 },
          }}
        >
          <IconButton
            size="small"
            onClick={() => setDrawerOpen(true)}
            sx={{ display: { xs: 'inline-flex', md: 'none' }, color: 'text.primary' }}
            aria-label="打开菜单"
          >
            <MenuIcon />
          </IconButton>

          {/* Page title */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Box
              sx={{
                width: 4,
                height: 18,
                borderRadius: 2,
                background: `linear-gradient(180deg, ${currentPage.accent} 0%, ${currentPage.accent}80 100%)`,
                boxShadow: `0 0 8px ${currentPage.accent}66`,
                flexShrink: 0,
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 17, fontWeight: 700, color: 'text.primary', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                {currentPage.label}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                {currentPage.sub}
              </Typography>
            </Box>
          </Box>

          {/* Mobile page title (compact) */}
          <Box
            sx={{
              display: { xs: 'block', md: 'none' },
              flex: 1,
              minWidth: 0,
              ml: 0.5,
            }}
          >
            <Box sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2, color: 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentPage.label}
            </Box>
            <Box
              component="span"
              sx={{
                display: 'inline-block',
                px: 0.5,
                py: 0.125,
                mt: 0.25,
                borderRadius: 0.5,
                bgcolor: `${currentPage.accent}1A`,
                color: currentPage.accent,
                fontSize: 9,
                fontWeight: 600,
                lineHeight: 1,
              }}
            >
              {currentPage.label}
            </Box>
          </Box>

          <Box sx={{ flex: 1 }} />

          {/* Right actions */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.25 }}>
            <IconButton
              onClick={handleBack}
              size="small"
              aria-label="返回"
              sx={{ color: 'rgba(255,255,255,0.7)' }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            {!isMsgPage && (
              <>
                <NoticeIconView />
                <DmIconView />
              </>
            )}
          </Box>

          <AvatarHoverPopup
            anchor={
              <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }}>
                <Avatar
                  src={currentUser?.avatar}
                  sx={{
                    width: { xs: 28, md: 32 },
                    height: { xs: 28, md: 32 },
                    background: 'linear-gradient(135deg, #FE2C55 0%, #8B5CF6 100%)',
                    fontSize: 13,
                    fontWeight: 700,
                    border: '2px solid',
                    borderColor: '#0a0a0f',
                  }}
                >
                  {currentUser?.name?.[0] || 'U'}
                </Avatar>
              </IconButton>
            }
          />
        </Toolbar>

        {/* Gradient accent strip */}
        <Box
          sx={{
            height: 2,
            background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 33%, #25F4EE 66%, #8B5CF6 100%)',
            flexShrink: 0,
          }}
        />
      </AppBar>

      <MobileNavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        pages={ACCOUNT_PAGES}
        currentPath={pathname}
      />

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {children}
      </Box>
    </Box>
  );
}
