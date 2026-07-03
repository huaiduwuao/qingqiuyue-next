'use client';

import React, { useState, useMemo, memo, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import InputBase from '@mui/material/InputBase';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Link from 'next/link';
import Drawer from '@mui/material/Drawer';
import { usePathname } from 'next/navigation';
import HomeIcon from '@mui/icons-material/Home';
import SearchIcon from '@mui/icons-material/Search';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import MovieIcon from '@mui/icons-material/Movie';
import StarIcon from '@mui/icons-material/Star';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import MenuIcon from '@mui/icons-material/Menu';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import type { MenuItem as MenuItemType } from '@/beans/system';

const LEFT_SIDEBAR_WIDTH = 200;

const CATEGORY_ICON_MAP: Record<string, React.ReactNode> = {
  home: <HomeIcon />,
  hot: <WhatshotIcon />,
  movie: <MovieIcon />,
  star: <StarIcon />,
  music: <MusicNoteIcon />,
  live: <LiveTvIcon />,
};

// Memoized category items to prevent unnecessary re-renders
const CATEGORIES = [
  { id: 'home', name: '推荐', icon: 'home', path: '/home/recommend' },
  { id: 'reward', name: '悬赏', icon: 'hot', path: '/home/reward' },
];

// Memoized category button component
const CategoryButton = memo(({ cat, selected, onClose }: { cat: typeof CATEGORIES[0]; selected?: boolean; onClose?: () => void }) => (
  <ListItem key={cat.id} disablePadding>
    <ListItemButton
      component={Link}
      href={cat.path}
      selected={selected}
      onClick={onClose}
      sx={{ mx: 1, borderRadius: 2 }}
    >
      <ListItemIcon sx={{ minWidth: 36 }}>
        {CATEGORY_ICON_MAP[cat.icon] || <HomeIcon />}
      </ListItemIcon>
      <ListItemText primary={cat.name} />
    </ListItemButton>
  </ListItem>
));
CategoryButton.displayName = 'CategoryButton';

// Memoized menu item button component
const MenuItemButton = memo(({ item, onClose }: { item: MenuItemType; onClose?: () => void }) => (
  <ListItem key={item.id || item.path} disablePadding>
    <ListItemButton
      component={Link}
      href={item.path || '/'}
      onClick={onClose}
      sx={{ mx: 1, borderRadius: 2 }}
    >
      <ListItemText primary={item.name} />
    </ListItemButton>
  </ListItem>
));
MenuItemButton.displayName = 'MenuItemButton';

export function MainLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const pathname = usePathname();
  const { currentUser, menuData } = useApp();
  const { logout } = useAuth();
  const { mode, toggleTheme } = useThemeMode();

  // Menu data is fetched by AuthContext via checkAuth, no additional fetch needed

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
  };

  // Memoized drawer content
  const drawerContent = useMemo(() => (
    <Box sx={{ width: LEFT_SIDEBAR_WIDTH, height: '100%', bgcolor: 'background.paper' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box component="img" src="/yue_icon.svg" sx={{ width: 40, height: 40 }} />
      </Box>
      <Divider />
      <List sx={{ py: 2 }}>
        {CATEGORIES.map((cat) => (
          <CategoryButton key={cat.id} cat={cat} selected={pathname === cat.path} onClose={() => setMobileOpen(false)} />
        ))}
      </List>
      <Divider />
      <List sx={{ py: 2 }}>
        {menuData.slice(0, 10).map((item) => (
          <MenuItemButton key={item.id || item.path} item={item} onClose={() => setMobileOpen(false)} />
        ))}
      </List>
    </Box>
  ), [menuData, pathname]);

  // Memoized desktop sidebar content
  const sidebarContent = useMemo(() => (
    <>
      <List sx={{ py: 2 }}>
        {CATEGORIES.map((cat) => (
          <CategoryButton key={cat.id} cat={cat} selected={pathname === cat.path} />
        ))}
      </List>
      <Divider />
      <List sx={{ py: 2 }}>
        {menuData.slice(0, 10).map((item) => (
          <MenuItemButton key={item.id || item.path} item={item} />
        ))}
      </List>
    </>
  ), [menuData, pathname]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }} suppressHydrationWarning>
      {/* Top Header */}
      <AppBar position="fixed" elevation={0} sx={{ bgcolor: 'background.paper', color: 'text.primary' }}>
        <Toolbar sx={{ gap: 2 }}>
          {/* Mobile Menu Button */}
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: { xs: 'auto', md: 160 } }}>
            <Box component="img" src="/yue_icon.svg" sx={{ width: 56, height: 56 }} />
          </Box>

          {/* Search - hide on mobile */}
          <Box
            sx={{
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              bgcolor: 'action.hover',
              px: 2,
              py: 0.5,
              flex: 1,
              maxWidth: 500,
            }}
          >
            <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
            <InputBase
              placeholder="搜索感兴趣的内容..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              sx={{ flex: 1 }}
            />
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Right Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={toggleTheme} color="inherit">
              {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>

            <IconButton onClick={handleMenuOpen}>
              <Avatar src={currentUser?.avatar} sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}>
                {currentUser?.name?.[0] || 'U'}
              </Avatar>
            </IconButton>
          </Box>

          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
            <Box sx={{ px: 2, py: 1, minWidth: 160 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {currentUser?.name || '用户'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {currentUser?.email || '未设置邮箱'}
              </Typography>
            </Box>
            <Divider />
            <MenuItem component={Link} href="/account/center" onClick={handleMenuClose}>
              <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
              个人中心
            </MenuItem>
            <MenuItem component={Link} href="/account/content" onClick={handleMenuClose}>
              <ListItemIcon><HomeIcon fontSize="small" /></ListItemIcon>
              内容管理
            </MenuItem>
            <MenuItem component={Link} href="/account/reward" onClick={handleMenuClose}>
              <ListItemIcon><WhatshotIcon fontSize="small" /></ListItemIcon>
              悬赏中心
            </MenuItem>
            <MenuItem component={Link} href="/account/settings" onClick={handleMenuClose}>
              <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
              设置
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
              <ListItemIcon><ExitToAppIcon fontSize="small" /></ListItemIcon>
              退出登录
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1, pt: '64px' }}>
        {/* Left Sidebar - Desktop only */}
        <Box
          sx={{
            display: { xs: 'none', md: 'block' },
            width: LEFT_SIDEBAR_WIDTH,
            flexShrink: 0,
            borderRight: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            position: 'fixed',
            top: 64,
            bottom: 0,
            left: 0,
            overflow: 'auto',
          }}
        >
          {sidebarContent}
        </Box>

        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: LEFT_SIDEBAR_WIDTH },
          }}
        >
          {drawerContent}
        </Drawer>

        {/* Main Content */}
        <Box
          sx={{
            flex: 1,
            minHeight: 'calc(100vh - 64px)',
            bgcolor: 'background.default',
            p: 3,
            ml: { md: `${LEFT_SIDEBAR_WIDTH}px` },
          }}
        >
          {children}
        </Box>
      </Box>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
