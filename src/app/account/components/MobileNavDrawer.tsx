'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Avatar from '@mui/material/Avatar';
import CloseIcon from '@mui/icons-material/Close';
import HomeIcon from '@mui/icons-material/Home';
import LogoutIcon from '@mui/icons-material/Logout';
import Link from 'next/link';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';

interface NavPage {
  key: string;
  label: string;
  shortLabel?: string;
  path: string;
  icon: React.ReactElement;
  accent: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  pages: NavPage[];
  currentPath: string;
}

export default function MobileNavDrawer({ open, onClose, pages, currentPath }: Props) {
  const { currentUser } = useApp();
  const { logout } = useAuth();

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{ display: { xs: 'block', md: 'none' } }}
    >
      <Box sx={{ width: 280, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Brand header */}
        <Box
          sx={{
            p: 2,
            background: 'linear-gradient(135deg, rgba(254, 44, 85, 0.08) 0%, rgba(37, 244, 238, 0.05) 100%)',
            borderBottom: '1px solid',
            borderColor: 'divider',
            position: 'relative',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                background: 'linear-gradient(135deg, #FE2C55 0%, #FFB400 50%, #25F4EE 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.primary',
                fontWeight: 700,
                fontSize: 14,
                fontFamily: 'monospace',
              }}
            >
              青
            </Box>
            <Box sx={{ flex: 1, lineHeight: 1.1 }}>
              <Box sx={{ fontSize: 14, fontWeight: 700 }}>清秋月</Box>
              <Box sx={{ fontSize: 10, color: 'text.secondary', letterSpacing: 0.5 }}>QINGQIUYUE</Box>
            </Box>
            <IconButton onClick={onClose} size="small" aria-label="关闭">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar
              src={currentUser?.avatar}
              sx={{
                width: 36,
                height: 36,
                background: 'linear-gradient(135deg, #FE2C55 0%, #8B5CF6 100%)',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {currentUser?.name?.[0] || 'U'}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
                {currentUser?.name || '未登录'}
              </Typography>
              <Typography sx={{ fontSize: 10, color: 'text.secondary', lineHeight: 1.2 }}>
                {currentUser?.email || 'ID: 10086'}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider />

        {/* Nav pages */}
        <Box sx={{ flex: 1, py: 1, overflow: 'auto' }}>
          {pages.map((p) => {
            const isActive = currentPath.startsWith(p.path);
            return (
              <Box
                key={p.key}
                component={Link}
                href={p.path}
                onClick={onClose}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  mx: 1.5,
                  px: 1.5,
                  py: 1.25,
                  borderRadius: 1.5,
                  textDecoration: 'none',
                  position: 'relative',
                  color: isActive ? p.accent : 'text.primary',
                  bgcolor: isActive ? `${p.accent}14` : 'transparent',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: isActive ? `${p.accent}1F` : 'action.hover' },
                }}
              >
                {isActive && (
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: '20%',
                      bottom: '20%',
                      width: 3,
                      borderRadius: 2,
                      bgcolor: p.accent,
                    }}
                  />
                )}
                <Box
                  sx={{
                    color: isActive ? p.accent : 'text.secondary',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {p.icon}
                </Box>
                <Typography sx={{ fontSize: 14, fontWeight: isActive ? 600 : 400, flex: 1 }}>
                  {p.label}
                </Typography>
                {isActive && (
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: p.accent,
                      boxShadow: `0 0 6px ${p.accent}`,
                    }}
                  />
                )}
              </Box>
            );
          })}

          <Divider sx={{ my: 1.5, mx: 2 }} />

          <Box
            component={Link}
            href="/home/recommend?tab=home"
            onClick={onClose}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              mx: 1.5,
              px: 1.5,
              py: 1.25,
              borderRadius: 1.5,
              textDecoration: 'none',
              color: 'text.secondary',
              '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
            }}
          >
            <HomeIcon fontSize="small" />
            <Typography sx={{ fontSize: 14 }}>返回首页</Typography>
          </Box>
        </Box>

        <Divider />

        <Box sx={{ p: 1.5 }}>
          <Box
            onClick={() => {
              onClose();
              logout();
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              px: 1.5,
              py: 1.25,
              borderRadius: 1.5,
              cursor: 'pointer',
              color: 'error.main',
              transition: 'all 0.2s',
              '&:hover': { bgcolor: 'rgba(244, 67, 54, 0.08)' },
            }}
          >
            <LogoutIcon fontSize="small" />
            <Typography sx={{ fontSize: 14, fontWeight: 500 }}>退出登录</Typography>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}
