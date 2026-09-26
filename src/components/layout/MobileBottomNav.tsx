'use client';

import React, { memo, useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { motion, useReducedMotion } from 'motion/react';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import AddBoxRoundedIcon from '@mui/icons-material/AddBoxRounded';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import ChatBubbleRoundedIcon from '@mui/icons-material/ChatBubbleRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { useResponsive } from '@/hooks/useResponsive';
import { useMessageUnread } from '@/components/NoticeIcon';

export type MobileTabKey = 'home' | 'create' | 'bounty' | 'msg' | 'me';

interface TabItem {
  key: MobileTabKey;
  label: string;
  icon: React.ReactNode;
  path: string;
}

/** 首页里上次停在哪个页签(精选/推荐/榜单/动态…),从别的底部 tab 点回「首页」时回到那里。 */
export const HOME_LAST_URL_KEY = 'qq-home-last-url';
const HOME_DEFAULT = '/home/recommend?tab=home';

// 和大多数 App 一样的五个一级入口。精选/推荐/榜单/动态是「首页」里的顶部页签,
// 直播/放映厅/短剧/意境/AI 等收进首页左上角的侧边栏(home/layout 的 MobileSideMenu)。
const MOBILE_TABS: TabItem[] = [
  { key: 'home', label: '首页', icon: <HomeRoundedIcon />, path: HOME_DEFAULT },
  { key: 'create', label: '创作', icon: <AddBoxRoundedIcon />, path: '/account/content?tab=hd-publish' },
  { key: 'bounty', label: '悬赏', icon: <CardGiftcardRoundedIcon />, path: '/account/reward?tab=square' },
  { key: 'msg', label: '消息', icon: <ChatBubbleRoundedIcon />, path: '/account/msg' },
  { key: 'me', label: '我的', icon: <PersonRoundedIcon />, path: '/home/recommend?tab=me' },
];

/** /account 下哪些页面是底部 tab 的落点(这些页面上也显示底部导航)。 */
export function mobileTabForPath(pathname: string): MobileTabKey | null {
  if (pathname.startsWith('/account/content')) return 'create';
  if (pathname.startsWith('/account/reward')) return 'bounty';
  if (pathname.startsWith('/account/msg')) return 'msg';
  return null;
}

export const BOTTOM_NAV_HEIGHT = 56;

// 页面临时要整屏(私信会话页的输入框在最底下)时把底栏收起:计数而不是布尔,多处同时要求也不会互相打架。
let hideCount = 0;
const hideListeners = new Set<() => void>();
const subscribeHide = (fn: () => void) => {
  hideListeners.add(fn);
  return () => { hideListeners.delete(fn); };
};
const getHidden = () => hideCount > 0;

/** 在 hide 为真期间隐藏手机底部导航(并把 --bottom-nav-inset 归零)。 */
export function useHideMobileBottomNav(hide: boolean) {
  useEffect(() => {
    if (!hide) return;
    hideCount += 1;
    hideListeners.forEach((fn) => fn());
    return () => {
      hideCount -= 1;
      hideListeners.forEach((fn) => fn());
    };
  }, [hide]);
}

interface MobileBottomNavProps {
  active: MobileTabKey;
}

/**
 * 移动端底部导航:首页 / 创作 / 悬赏 / 消息 / 我的。
 *
 * - 只在 < md(900px)显示,与侧栏 `{ xs:'none', md:'flex' }` 互补。
 * - 首页(home/layout)和 /account 下的创作、悬赏、消息三个落点页都挂它,所以自己负责跳转。
 * - 挂载时把自身高度(56 + 底部安全区)写进 :root 的 --bottom-nav-inset,
 *   浮窗数字人 / 首页 main / 工作台的底部留白都读这个变量,卸载或被隐藏时归零。
 * - 选中态是一颗用 motion layoutId 在 tab 之间滑动的胶囊,图标带弹簧缩放;
 *   prefers-reduced-motion 下退化为瞬切。
 */
export const MobileBottomNav = memo(function MobileBottomNav({ active }: MobileBottomNavProps) {
  const { isMobile } = useResponsive();
  const theme = useTheme();
  const router = useRouter();
  const reduced = useReducedMotion();
  const hidden = useSyncExternalStore(subscribeHide, getHidden, () => false);
  const unread = useMessageUnread();
  const shown = isMobile && !hidden;

  // ⚠️ Hooks 必须在任何条件 return 之前无条件调用(Rules of Hooks)。
  useEffect(() => {
    if (!shown || typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--bottom-nav-inset', `calc(${BOTTOM_NAV_HEIGHT}px + var(--sab, 0px))`);
    return () => {
      root.style.setProperty('--bottom-nav-inset', '0px');
    };
  }, [shown]);

  if (!shown) return null;

  const go = (tab: TabItem) => {
    if (tab.key === active && tab.key !== 'home') return;
    let path = tab.path;
    if (tab.key === 'home') {
      // 已经在首页:回到精选;从别处回来:回到上次看的那个页签
      if (active === 'home') path = HOME_DEFAULT;
      else {
        try {
          const last = sessionStorage.getItem(HOME_LAST_URL_KEY);
          // 只认首页页签;旧版本可能记下过 ?tab=me(那是「我的」,不是首页)
          if (last && last.startsWith('/home/') && !/[?&]tab=me(&|$)/.test(last)) path = last;
        } catch { /* 隐私模式 */ }
      }
    }
    router.push(path, { scroll: false });
  };

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
          const isActive = tab.key === active;
          const icon = React.isValidElement(tab.icon)
            ? React.cloneElement(tab.icon as React.ReactElement<{ sx?: object }>, { sx: { fontSize: 24 } })
            : tab.icon;
          return (
            <Box
              key={tab.key}
              component="button"
              type="button"
              onClick={() => go(tab)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.key === 'msg' && unread > 0 ? `消息,${unread} 条未读` : tab.label}
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
                color: isActive ? 'var(--brand-color, #FE2C55)' : 'var(--text-muted, rgba(0, 0, 0, 0.45))',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                transition: 'color 0.2s ease',
                fontFamily: 'inherit',
                '&:active': { color: 'var(--brand-color, #FE2C55)' },
              }}
            >
              {isActive && (
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
                animate={reduced ? undefined : { scale: isActive ? 1.12 : 1, y: isActive ? -1 : 0 }}
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 22 }}
                style={{ position: 'relative', zIndex: 1, display: 'flex', lineHeight: 0 }}
              >
                {tab.key === 'msg' ? (
                  <Badge
                    badgeContent={unread}
                    max={99}
                    color="error"
                    sx={{ '& .MuiBadge-badge': { fontSize: 9, height: 15, minWidth: 15, px: 0.4, top: 2, right: -2 } }}
                  >
                    {icon}
                  </Badge>
                ) : icon}
              </motion.span>
              <Typography
                component="span"
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 500,
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
