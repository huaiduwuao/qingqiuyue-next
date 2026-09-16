'use client';

import React, { memo, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { motion, useReducedMotion } from 'motion/react';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import RecommendRoundedIcon from '@mui/icons-material/RecommendRounded';
import DynamicFeedRoundedIcon from '@mui/icons-material/DynamicFeedRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import { useResponsive } from '@/hooks/useResponsive';

// Tab 配置
interface TabItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const MOBILE_TABS: TabItem[] = [
  { key: 'home', label: '精选', icon: <HomeRoundedIcon />, path: '/home/recommend?tab=home' },
  { key: 'recommend', label: '推荐', icon: <RecommendRoundedIcon />, path: '/home/recommend?tab=recommend' },
  // 原来这里是「任务」→ /home/queue,但那个路由没有页面。换成排行榜,手机端也能进榜单。
  { key: 'rank', label: '榜单', icon: <EmojiEventsRoundedIcon />, path: '/home/recommend?tab=rank' },
  // 关注/朋友已并入「动态」(页内切 广场/关注/朋友)
  { key: 'feed', label: '动态', icon: <DynamicFeedRoundedIcon />, path: '/home/recommend?tab=feed' },
  { key: 'me', label: '我的', icon: <PersonRoundedIcon />, path: '/home/recommend?tab=me' },
];

export const BOTTOM_NAV_HEIGHT = 56;

interface MobileBottomNavProps {
  activeNav: string;
  onNavChange: (key: string) => void;
}

/**
 * 移动端底部导航。
 *
 * - 只在 < md(900px)显示,与侧栏 `{ xs:'none', md:'flex' }` 互补,不再有
 *   "既没侧栏又没底栏"的中间地带(之前按 768/1024 + 横竖屏判断,平板横屏两个都没有)。
 * - 挂载时把自身高度(56 + 底部安全区)写进 :root 的 --bottom-nav-inset,
 *   浮窗数字人 / 首页 main 的底部留白都读这个变量,卸载后归零。
 * - 选中态是一颗用 motion layoutId 在 tab 之间滑动的胶囊(React Bits 的 GooeyNav/Dock 思路),
 *   图标带弹簧缩放;prefers-reduced-motion 下退化为瞬切。
 */
export const MobileBottomNav = memo(function MobileBottomNav({ activeNav, onNavChange }: MobileBottomNavProps) {
  const { isMobile } = useResponsive();
  const theme = useTheme();
  const reduced = useReducedMotion();

  // ⚠️ Hooks 必须在任何条件 return 之前无条件调用(Rules of Hooks)。
  useEffect(() => {
    if (!isMobile || typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--bottom-nav-inset', `calc(${BOTTOM_NAV_HEIGHT}px + var(--sab, 0px))`);
    return () => {
      root.style.setProperty('--bottom-nav-inset', '0px');
    };
  }, [isMobile]);

  if (!isMobile) return null;

  const pillColor = alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.22 : 0.14);
  const spring = reduced ? { duration: 0 } : { type: 'spring' as const, stiffness: 520, damping: 36, mass: 0.8 };

  return (
    <Box
      component="nav"
      data-mobile-bottom-nav
      aria-label="底部导航"
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        // Safe Area:底部 Home 指示条 + 横屏时左右圆角区
        pb: 'var(--sab, 0px)',
        pl: 'var(--sal, 0px)',
        pr: 'var(--sar, 0px)',
        bgcolor: 'var(--bg-topbar, rgba(255, 255, 255, 0.92))',
        backdropFilter: 'blur(18px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(18px) saturate(1.4)',
        borderTop: '1px solid var(--border-color, rgba(0, 0, 0, 0.08))',
        boxShadow: '0 -8px 24px rgba(0,0,0,0.06)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'stretch', height: BOTTOM_NAV_HEIGHT }}>
        {MOBILE_TABS.map((tab) => {
          const active = tab.key === activeNav;
          return (
            <Box
              key={tab.key}
              component="button"
              type="button"
              onClick={() => onNavChange(tab.key)}
              aria-current={active ? 'page' : undefined}
              aria-label={tab.label}
              sx={{
                flex: 1,
                minWidth: 0,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                border: 0,
                background: 'transparent',
                color: active ? 'var(--brand-color, #FE2C55)' : 'var(--text-muted, rgba(0, 0, 0, 0.45))',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                transition: 'color 0.2s ease',
                fontFamily: 'inherit',
                '&:active': { color: 'var(--brand-color, #FE2C55)' },
              }}
            >
              {active && (
                <motion.span
                  layoutId="qq-bottom-nav-pill"
                  transition={spring}
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 5,
                    left: '50%',
                    marginLeft: -24,
                    width: 48,
                    height: 30,
                    borderRadius: 15,
                    background: pillColor,
                  }}
                />
              )}
              <motion.span
                animate={reduced ? undefined : { scale: active ? 1.12 : 1, y: active ? -1 : 0 }}
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 22 }}
                style={{ position: 'relative', zIndex: 1, display: 'flex', lineHeight: 0 }}
              >
                {React.isValidElement(tab.icon)
                  ? React.cloneElement(tab.icon as React.ReactElement<{ sx?: object }>, { sx: { fontSize: 24 } })
                  : tab.icon}
              </motion.span>
              <Typography
                component="span"
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  fontSize: 10,
                  fontWeight: active ? 700 : 500,
                  lineHeight: 1,
                  letterSpacing: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
});
