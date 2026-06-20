'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Box from '@mui/material/Box';
import { PersonalCenterCard } from './PersonalCenterCard';

export interface AvatarHoverPopupProps {
  anchor: React.ReactElement;
  width?: number;
}

export function AvatarHoverPopup({ anchor, width = 320 }: AvatarHoverPopupProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
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
        position: 'fixed',
        top: 60,
        right: 0,
        // 不再写 bottom:0(那样会强制撑满整个屏幕高度,内容短时空一大块),
        // 改用 maxHeight + 自适应高度,内容多时才出现滚动条。
        width,
        maxHeight: 'calc(100vh - 60px)',
        zIndex: 9999,
        bgcolor: 'rgba(10, 10, 15, 0.96)',
        backdropFilter: 'blur(16px)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        borderTopLeftRadius: 2,
        borderBottomLeftRadius: 2,
        boxShadow: '-12px 0 32px rgba(0,0,0,0.5)',
        p: 2,
        overflowY: 'auto',
        animation: 'pc-slide-in 0.22s ease-out',
        '@keyframes pc-slide-in': {
          '0%': { transform: 'translateX(20px)', opacity: 0 },
          '100%': { transform: 'translateX(0)', opacity: 1 },
        },
      }}
    >
      <PersonalCenterCard compact />
    </Box>
  );

  return (
    <>
      <Box
        onMouseEnter={() => {
          clearCloseTimer();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        sx={{ display: 'inline-flex' }}
      >
        {anchor}
      </Box>
      {mounted && popup && createPortal(popup, document.body)}
    </>
  );
}
