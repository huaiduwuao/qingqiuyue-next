'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PersonIcon from '@mui/icons-material/Person';
import HomeIcon from '@mui/icons-material/Home';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';

interface UserMenuProps {
  variant?: 'icon' | 'full';
}

export function UserMenu({ variant = 'icon' }: UserMenuProps) {
  const { currentUser } = useApp();
  const { logout } = useAuth();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
    router.push('/user/login');
  };

  if (!currentUser) {
    return (
      <Box sx={{ display: 'flex', gap: 1 }}>
        <IconButton onClick={() => router.push('/user/login')} aria-label="登录">
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: 'primary.main',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            登
          </Avatar>
        </IconButton>
      </Box>
    );
  }

  const menuContent = (
    <>
      <Box sx={{ px: 2, py: 1.5, minWidth: 180 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {currentUser.name || '用户'}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {currentUser.email || '未设置邮箱'}
        </Typography>
      </Box>
      <Divider />
      <MenuItem component={Link} href="/account/center" onClick={handleMenuClose}>
        <ListItemIcon>
          <PersonIcon fontSize="small" />
        </ListItemIcon>
        个人中心
      </MenuItem>
      <MenuItem component={Link} href="/account/content" onClick={handleMenuClose}>
        <ListItemIcon>
          <HomeIcon fontSize="small" />
        </ListItemIcon>
        内容管理
      </MenuItem>
      <MenuItem component={Link} href="/account/settings" onClick={handleMenuClose}>
        <ListItemIcon>
          <SettingsIcon fontSize="small" />
        </ListItemIcon>
        设置
      </MenuItem>
      <Divider />
      <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
        <ListItemIcon>
          <LogoutIcon fontSize="small" color="error" />
        </ListItemIcon>
        退出登录
      </MenuItem>
    </>
  );

  if (variant === 'full') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {currentUser.name || '用户'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {currentUser.email || '未设置邮箱'}
          </Typography>
        </Box>
        <IconButton onClick={handleMenuOpen}>
          <Avatar src={currentUser.avatar} sx={{ width: 40, height: 40 }}>
            {currentUser.name?.[0] || 'U'}
          </Avatar>
        </IconButton>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
          {menuContent}
        </Menu>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <IconButton onClick={handleMenuOpen} aria-label="用户菜单">
        <Avatar src={currentUser.avatar} sx={{ width: 36, height: 36 }}>
          {currentUser.name?.[0] || 'U'}
        </Avatar>
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        {menuContent}
      </Menu>
    </Box>
  );
}
