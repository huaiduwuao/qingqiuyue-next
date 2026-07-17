'use client';

import React, { memo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Paper from '@mui/material/Paper';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import RecommendRoundedIcon from '@mui/icons-material/RecommendRounded';
import TravelExploreRoundedIcon from '@mui/icons-material/TravelExploreRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { useResponsive } from '@/hooks/useResponsive';

// Tab 配置
interface TabItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  showOnDesktop?: boolean; // 部分 Tab 在桌面端侧边栏也显示
}

const MOBILE_TABS: TabItem[] = [
  { key: 'home', label: '精选', icon: <HomeRoundedIcon />, path: '/home/recommend?tab=home' },
  { key: 'recommend', label: '推荐', icon: <RecommendRoundedIcon />, path: '/home/recommend?tab=recommend' },
  { key: 'ai', label: 'AI搜索', icon: <TravelExploreRoundedIcon />, path: '/home/recommend?tab=ai' },
  { key: 'follow', label: '关注', icon: <FavoriteRoundedIcon />, path: '/home/recommend?tab=follow' },
  { key: 'me', label: '我的', icon: <PersonRoundedIcon />, path: '/home/recommend?tab=me' },
];

interface MobileBottomNavProps {
  activeNav: string;
  onNavChange: (key: string) => void;
}

export const MobileBottomNav = memo(function MobileBottomNav({
  activeNav,
  onNavChange,
}: MobileBottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile, isTablet, isLandscape } = useResponsive();

  // 判断是否应该显示底部导航
  // 移动端始终显示，平板竖屏显示，平板横屏隐藏，桌面端隐藏
  const shouldShow = isMobile || (isTablet && !isLandscape);
  const shouldHide = !shouldShow;

  if (shouldHide) {
    return null;
  }

  // 找到当前激活的 Tab 索引
  const currentIndex = MOBILE_TABS.findIndex((t) => t.key === activeNav);
  const value = currentIndex >= 0 ? currentIndex : 0;

  const handleChange = useCallback(
    (_: React.SyntheticEvent, newValue: number) => {
      const tab = MOBILE_TABS[newValue];
      if (tab) {
        onNavChange(tab.key);
        // 路由已经在 HomeLayout 中通过 handleNavChange 处理
      }
    },
    [onNavChange]
  );

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        // Safe Area 底部适配
        paddingBottom: 'var(--sab, env(safe-area-inset-bottom, 0px))',
        // iOS Home Indicator 区域视觉提示
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: isMobile ? 134 : 0,
          height: isMobile ? 5 : 0,
          borderRadius: '5px 5px 0 0',
          bgcolor: 'rgba(128, 128, 128, 0.3)',
          transition: 'all 0.3s ease',
        },
      }}
      elevation={0}
    >
      <BottomNavigation
        showLabels
        value={value}
        onChange={handleChange}
        sx={{
          height: 56,
          bgcolor: 'var(--bg-topbar, rgba(255, 255, 255, 0.92))',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid var(--border-color, rgba(0, 0, 0, 0.08))',
          // 暗色模式适配
          [`.${/* OK */ ''}`]: {},
          '& .MuiBottomNavigationAction-root': {
            color: 'var(--text-muted, rgba(0, 0, 0, 0.45))',
            minWidth: 'auto',
            py: 1,
            transition: 'color 0.2s ease',
            '&.Mui-selected': {
              color: 'var(--brand-color, #FE2C55)',
            },
            '&:hover': {
              backgroundColor: 'var(--bg-hover, rgba(0, 0, 0, 0.04))',
            },
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: 10,
            fontWeight: 500,
            mt: 0.25,
            letterSpacing: 0,
            transition: 'font-size 0.2s ease, font-weight 0.2s ease',
            '&.Mui-selected': {
              fontSize: 10,
              fontWeight: 700,
            },
          },
          '& .MuiSvgIcon-root': {
            fontSize: 24,
            transition: 'font-size 0.2s ease',
          },
        }}
      >
        {MOBILE_TABS.map((tab) => (
          <BottomNavigationAction
            key={tab.key}
            label={tab.label}
            icon={tab.icon}
            sx={{
              flex: 1,
              maxWidth: 'unset',
              // 激活状态的图标放大效果
              '&.Mui-selected': {
                '& .MuiSvgIcon-root': {
                  fontSize: 26,
                },
              },
            }}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
});
