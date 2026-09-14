'use client';

import React, { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import { PersonalCenterCard } from './PersonalCenterCard';

export interface AvatarHoverPopupProps {
  anchor: React.ReactElement;
  width?: number;
}

export function AvatarHoverPopup({ anchor, width = 320 }: AvatarHoverPopupProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 250);
  };

  const popup = open && (
    <Box
      onMouseEnter={clearCloseTimer}
      onMouseLeave={scheduleClose}
      sx={{
        // 相对头像定位(父级是 relative 的 inline-flex),不再 fixed 贴屏幕右缘 ——
        // 那样在导航用 Container 居中的页面(如 /topic)头像不在屏幕最右,
        // 悬浮框却贴到屏幕最右,两者就错位了。
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width,
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: 'calc(100vh - 80px)',
        zIndex: 9999,
        bgcolor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(10, 10, 15, 0.96)' : 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(16px)',
        border: (theme) =>
          theme.palette.mode === 'dark'
            ? '1px solid rgba(255,255,255,0.08)'
            : '1px solid rgba(0,0,0,0.08)',
        borderRadius: 2,
        boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
        p: 2,
        overflowY: 'auto',
        animation: 'pc-fade-in 0.18s ease-out',
        '@keyframes pc-fade-in': {
          '0%': { transform: 'translateY(-6px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
      }}
    >
      <PersonalCenterCard compact />
    </Box>
  );

  return (
    <Box
      onMouseEnter={() => {
        clearCloseTimer();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      sx={{ position: 'relative', display: 'inline-flex' }}
    >
      {anchor}
      {popup}
    </Box>
  );
}
