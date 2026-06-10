'use client';

import React, { useEffect } from 'react';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import { usePathname, useRouter } from 'next/navigation';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import { useApp } from '@/contexts/AppContext';
import { AvatarHoverPopup } from '@/components/account/AvatarHoverPopup';
import NoticeIconView, { DmIconView } from '@/components/NoticeIcon';

const USER_PAGES = [
  { key: 'points', label: '我的积分', sub: '积分 · 成就 · 等级 · 商城', path: '/user/points', icon: <PersonIcon sx={{ fontSize: 18 }} />, accent: 'primary.main' },
];

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserLayoutContent>{children}</UserLayoutContent>
  );
}

function UserLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser } = useApp();
  const appBarRef = React.useRef<HTMLDivElement | null>(null);

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/home/recommend');
    }
  };

  useEffect(() => {
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

  const currentPage = USER_PAGES.find((p) => pathname.startsWith(p.path)) || USER_PAGES[0];

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
              {currentPage.sub}
            </Box>
          </Box>

          <Box sx={{ flex: 1 }} />

          <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.25 }}>
            <IconButton
              onClick={handleBack}
              size="small"
              aria-label="返回"
              sx={{ color: 'rgba(255,255,255,0.7)' }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <NoticeIconView />
            <DmIconView />
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

        <Box
          sx={{
            height: 2,
            background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 33%, #25F4EE 66%, #8B5CF6 100%)',
            flexShrink: 0,
          }}
        />
      </AppBar>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {children}
      </Box>
    </Box>
  );
}
