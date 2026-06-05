'use client';

import React from 'react';
import Link from 'next/link';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import SettingsIcon from '@mui/icons-material/Settings';

const NAV_ITEMS = [
  { key: 'content', label: '内容管理', path: '/account/content', icon: <VideoLibraryIcon sx={{ fontSize: 18 }} />, accent: 'secondary.main' },
  { key: 'reward', label: '悬赏中心', path: '/account/reward', icon: <CardGiftcardIcon sx={{ fontSize: 18 }} />, accent: 'warning.main' },
  { key: 'settings', label: '设置', path: '/account/settings', icon: <SettingsIcon sx={{ fontSize: 18 }} />, accent: '#8B5CF6' },
];

export function AccountNavIcons() {
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: 100,
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        gap: 0.75,
        p: 0.75,
        borderRadius: 2,
        bgcolor: 'rgba(10, 10, 15, 0.7)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      {NAV_ITEMS.map((item) => (
        <Tooltip key={item.key} title={item.label} placement="right" arrow>
          <Box
            component={Link}
            href={item.path}
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.7)',
              textDecoration: 'none',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: `${item.accent}1A`,
                color: item.accent,
                transform: 'scale(1.05)',
              },
            }}
          >
            {item.icon}
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}
