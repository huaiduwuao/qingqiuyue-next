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
import { useApp } from '@/contexts/AppContext';
import { AccountContextProvider } from '@/contexts/AccountContext';
import { AvatarHoverPopup } from '@/components/account/AvatarHoverPopup';
import NoticeIconView, { DmIconView } from '@/components/NoticeIcon';
import { MobileMenuButton } from '@/components/layout/MobileSideMenu';
import { useResponsive } from '@/hooks/useResponsive';
import { MobileBottomNav, mobileTabForPath } from '@/components/layout/MobileBottomNav';
import GradientText from '@/components/reactbits/GradientText';

// 顶栏标题。以前这里还是一套「个人中心/内容管理/奖励中心/设置」抽屉导航,和首页侧边栏、工作台导航
// 叠成好几套;现在全站只有首页那一个侧边栏(MobileMenuButton),这里只管标题。
const ACCOUNT_PAGES = [
  { key: 'center', label: '个人中心', sub: '个人空间', path: '/account/center', accent: 'primary.main' },
  { key: 'content', label: '创作中心', sub: '发布 · 管理 · 数据 · 变现', path: '/account/content', accent: 'secondary.main' },
  { key: 'reward', label: '悬赏', sub: '赏金广场 · 任务 · 邀请', path: '/account/reward', accent: 'warning.main' },
  { key: 'msg', label: '消息', sub: '互动 · 系统 · 私信', path: '/account/msg', accent: 'primary.main' },
  { key: 'settings', label: '设置', sub: '账号与隐私', path: '/account/settings', accent: '#8B5CF6' },
  { key: 'wallet', label: '我的钱包', sub: '钻石 · 收支明细', path: '/account/wallet', accent: '#FE2C55' },
  { key: 'orders', label: '我的订单', sub: '充值与购买记录', path: '/account/orders', accent: '#5B8DEF' },
  { key: 'purchases', label: '我的购买', sub: '已购内容', path: '/account/purchases', accent: '#FF8A3D' },
  { key: 'vip', label: '会员中心', sub: '会员权益', path: '/account/vip', accent: '#D4AF37' },
  { key: 'points-mall', label: '积分商城', sub: '积分兑换', path: '/account/points-mall', accent: '#8B5CF6' },
  { key: 'creator-level', label: '创作者等级', sub: '等级与权益', path: '/account/creator-level', accent: 'secondary.main' },
  { key: 'my-lists', label: '我的合集', sub: '歌单 · 书架 · 收藏夹', path: '/account/my-lists', accent: 'primary.main' },
  { key: 'dashboard', label: '数据看板', sub: '概览', path: '/account/dashboard', accent: 'primary.main' },
  { key: 'social-monetize', label: '社交变现', sub: '平台账号收益', path: '/account/social-monetize', accent: 'secondary.main' },
  { key: 'quota', label: 'AI 额度', sub: '用量与配额', path: '/account/quota', accent: '#5B8DEF' },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccountContextProvider>
      <AccountLayoutContent>{children}</AccountLayoutContent>
    </AccountContextProvider>
  );
}

function AccountLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser } = useApp();
  const { isMobile } = useResponsive();
  const appBarRef = React.useRef<HTMLDivElement | null>(null);

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/home/recommend?tab=home');
    }
  };

  React.useEffect(() => {
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

  const isAccountSection = pathname.startsWith('/account');
  const isMsgPage = pathname.startsWith('/account/msg');
  const bottomTab = mobileTabForPath(pathname);
  const currentPage = ACCOUNT_PAGES.find((p) => pathname.startsWith(p.path)) || ACCOUNT_PAGES[0];

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyBg: body.style.backgroundColor,
    };
    // 注意:不要在这里写 body.style.height。MUI Dialog 打开时会测量 body 并加 padding-right 补偿
    // 滚动条;body 被钉死成固定高度时,客户端 WebView 里 Dialog 定位容器高度算错,Paper 被压出可视区
    // 或内部表单高度塌陷。body 高度交给外层 Box 的 `height: var(--app-height)` 控制,这里只锁 overflow。
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    // 跟主题走:var(--bg-body) 由 ThemeContext 在切 light/dark 时写入;
    // 这里不再用 'transparent'(否则 AppBar 透到 html 根 --background,跟主题脱节)
    body.style.backgroundColor = 'var(--bg-body)';
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.backgroundColor = prev.bodyBg;
    };
  }, []);

  if (!isAccountSection) {
    return <Box>{children}</Box>;
  }

  return (
    <Box data-app-shell sx={{ display: 'flex', flexDirection: 'column', height: 'var(--app-height, 100vh)', bgcolor: 'transparent', overflow: 'hidden' }}>
      <AppBar
        ref={appBarRef}
        position="sticky"
        elevation={0}
        sx={{
          // AppBar 背景:用 var(--bg-body, 默认 #0a0b14) 跟主题走;
          // 之前 transparent 在 dark 模式下透到 html 根 --background,显示成白
          bgcolor: 'var(--bg-body, #0a0b14)',
          color: 'text.primary',
          borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
          backdropFilter: 'blur(12px)',
          flexShrink: 0,
          // 刘海安全区
          pt: 'var(--sat, 0px)',
        }}
      >
        <Toolbar
          sx={{
            gap: 1.5,
            minHeight: { xs: 48, md: 64 },
            px: { xs: 0.5, md: 3 },
          }}
        >
          {/* 手机左上角:创作/悬赏/消息是底部 tab 的一级页 → 全局侧边栏(和首页同一个);
              其余是二级页 → 返回。不再有第二套抽屉。 */}
          {isMobile && (bottomTab ? (
            <MobileMenuButton />
          ) : (
            <IconButton onClick={handleBack} aria-label="返回" sx={{ color: 'text.primary' }}>
              <ArrowBackIcon />
            </IconButton>
          ))}

          {/* Page title */}
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
              <Typography component="div" sx={{ fontSize: 17, fontWeight: 700, color: 'text.primary', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                <GradientText animationSpeed={9}>{currentPage.label}</GradientText>
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                {currentPage.sub}
              </Typography>
            </Box>
          </Box>

          {/* Mobile page title (compact) */}
          <Box
            sx={{
              display: { xs: 'block', md: 'none' },
              flex: 1,
              minWidth: 0,
              ml: 0.5,
            }}
          >
            <Box sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2, color: 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentPage.label}
            </Box>
          </Box>

          <Box sx={{ flex: 1 }} />

          {/* 桌面右侧:返回 + 通知/私信 + 头像。手机上这些都不放(返回在左上角,消息/我的在底部导航) */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.25 }}>
            <IconButton
              onClick={handleBack}
              size="small"
              aria-label="返回"
              sx={{ color: 'text.secondary' }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            {!isMsgPage && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <NoticeIconView />
                <DmIconView />
              </Box>
            )}
          </Box>

          {/* 手机上不放右上角头像:底部导航有「我的」 */}
          <AvatarHoverPopup
            anchor={
              <IconButton size="small" sx={{ ml: 0.5, p: 0.25, display: { xs: 'none', md: 'inline-flex' } }} onClick={() => router.push('/account/center')}>
                <Avatar
                  src={currentUser?.avatar}
                  sx={{
                    width: { xs: 28, md: 32 },
                    height: { xs: 28, md: 32 },
                    background: 'linear-gradient(135deg, #FE2C55 0%, #8B5CF6 100%)',
                    fontSize: 13,
                    fontWeight: 700,
                    border: '2px solid',
                    borderColor: 'transparent',
                  }}
                >
                  {currentUser?.name?.[0] || 'U'}
                </Avatar>
              </IconButton>
            }
          />
        </Toolbar>

        {/* Gradient accent strip */}
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
      {/* 创作 / 悬赏 / 消息是手机底部导航的落点,这三处也挂底栏(其余账号子页是二级页,不挂) */}
      {bottomTab && <MobileBottomNav active={bottomTab} />}
    </Box>
  );
}
