'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { homeClient } from '@/lib/api/client';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import { HomeSettingsDrawer } from '@/components/home/HomeSettingsDrawer';
import { MyHomePage } from '@/components/home/MyHomePage';
import SearchIcon from '@mui/icons-material/Search';
import DiamondIcon from '@mui/icons-material/Diamond';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import RecommendRoundedIcon from '@mui/icons-material/RecommendRounded';
import TravelExploreRoundedIcon from '@mui/icons-material/TravelExploreRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import TheatersRoundedIcon from '@mui/icons-material/TheatersRounded';
import SettingsIcon from '@mui/icons-material/Settings';
import { useApp } from '@/contexts/AppContext';
import { AvatarHoverPopup } from '@/components/account/AvatarHoverPopup';
import NoticeIconView, { DmIconView } from '@/components/NoticeIcon';
import { FeedPanel } from './panels/FeedPanel';
import { AIRecommendPanel } from './panels/AIRecommendPanel';
import { MockStatusBadge } from '@/components/debug/MockStatusBadge';
import HotRankingBar from '@/components/home/HotRankingBar';
// 客户端下载入口:跳到独立 /download 介绍页
import { LivePanel } from './panels/LivePanel';
import { TheaterPanel } from './panels/TheaterPanel';
import { DramaPanel } from './panels/DramaPanel';
import { ACCENT } from '@/constants/accents';
import { gradient2 } from '@/constants/gradients';
import HomeRecommendPage from './recommend/page';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { useResponsive } from '@/hooks/useResponsive';

const SIDE_NAV: { key: string; label: string; path?: string; icon: React.ReactNode; accent: string; dividerBefore?: boolean }[] = [
  { key: 'home', label: '精选', path: '/home/recommend?tab=home', icon: <HomeRoundedIcon sx={{ fontSize: 18 }} />, accent: 'primary.main' },
  { key: 'recommend', label: '推荐', path: '/home/recommend?tab=recommend', icon: <RecommendRoundedIcon sx={{ fontSize: 18 }} />, accent: 'secondary.main' },
  { key: 'ai', label: 'AI 搜索', path: '/home/recommend?tab=ai', icon: <TravelExploreRoundedIcon sx={{ fontSize: 18 }} />, accent: ACCENT.blue.main },
  { key: 'follow', label: '关注', path: '/home/recommend?tab=follow', icon: <FavoriteRoundedIcon sx={{ fontSize: 18 }} />, accent: 'primary.main' },
  { key: 'friend', label: '朋友', path: '/home/recommend?tab=friend', icon: <GroupsRoundedIcon sx={{ fontSize: 18 }} />, accent: 'warning.main' },
  { key: 'me', label: '我的', path: '/home/recommend?tab=me', icon: <PersonRoundedIcon sx={{ fontSize: 18 }} />, accent: ACCENT.purple.main },
  { key: 'live', label: '直播', path: '/home/recommend?tab=live', icon: <LiveTvRoundedIcon sx={{ fontSize: 18 }} />, accent: 'primary.main' },
  // 内容管理/悬赏中心:router.push 同页跳转(不开新标签),保留历史栈可返回
  { key: 'content', label: '内容管理', path: '/account/content', icon: <VideoLibraryIcon sx={{ fontSize: 18 }} />, accent: 'secondary.main' },
  { key: 'reward', label: '悬赏中心', path: '/account/reward', icon: <CardGiftcardIcon sx={{ fontSize: 18 }} />, accent: 'warning.main' },
  { key: 'theater', label: '放映厅', path: '/home/recommend?tab=theater', icon: <MovieRoundedIcon sx={{ fontSize: 18 }} />, accent: ACCENT.purple.main, dividerBefore: true },
  { key: 'drama', label: '短剧', path: '/home/recommend?tab=drama', icon: <TheatersRoundedIcon sx={{ fontSize: 18 }} />, accent: 'secondary.main' },
];

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab') || 'home';
  const urlSection = searchParams.get('section') || 'recommend';
  const [activeNav, setActiveNav] = useState(urlTab);
  const [meOpen, setMeOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement | null>(null);
  // 搜索框状态提升到 Layout，便于导航时清空
  const [searchDraft, setSearchDraft] = useState('');
  const searchDraftRef = useRef('');

  // 响应式 Hook
  const { isMobile, isTablet, isLandscape, isDesktop } = useResponsive();

  // 同步 URL ?tab= → activeNav,这样从详情页返回时保留 tab
  useEffect(() => {
    setActiveNav(urlTab);
  }, [urlTab]);

  // 离开 home 时把主滚动条位置存到 sessionStorage,回来时还原(无动画,即设即生效)
  useEffect(() => {
    const key = `home-scroll:${pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const saved = sessionStorage.getItem(key);
    if (saved && mainRef.current) {
      mainRef.current.scrollTop = Number(saved);
    }
    const el = mainRef.current;
    const onScroll = () => {
      if (el) sessionStorage.setItem(key, String(el.scrollTop));
    };
    el?.addEventListener('scroll', onScroll, { passive: true });
    return () => el?.removeEventListener('scroll', onScroll);
  }, [pathname, searchParams]);

  const handleNavChange = useCallback((key: string) => {
    // 导航前清空搜索框状态
    setSearchDraft('');
    searchDraftRef.current = '';
    setActiveNav(key);
    const nav = SIDE_NAV.find(n => n.key === key);
    if (nav?.path) {
      router.push(nav.path, { scroll: false });
    }
  }, [router]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      bodyBg: body.style.backgroundColor,
    };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.height = '100dvh';
    body.style.backgroundColor = 'var(--bg-body, transparent)';
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
      body.style.backgroundColor = prev.bodyBg;
    };
  }, []);

  // 是否显示底部导航（移动端或平板竖屏）
  const showBottomNav = isMobile || (isTablet && !isLandscape);
  // 平板横屏时隐藏左侧栏
  const hideLeftSidebar = isTablet && isLandscape;

  return (
    <Box sx={{ height: '100dvh', bgcolor: 'var(--bg-body, transparent)', color: 'var(--text-primary, currentColor)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TopBar
        searchDraft={searchDraft}
        setSearchDraft={setSearchDraft}
        searchDraftRef={searchDraftRef}
        isMobile={isMobile}
        isTablet={isTablet}
      />
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <LeftSidebar
          activeNav={activeNav}
          onNavChange={handleNavChange}
          meOpen={meOpen}
          onMeOpenChange={setMeOpen}
          hideOnLandscape={hideLeftSidebar}
        />
        <Box component="main" ref={mainRef} sx={{
          flex: 1,
          minWidth: 0,
          overflow: 'auto',
          overscrollBehavior: 'contain',
          // 移动端底部留出滚动空间（避免被底部导航遮挡）
          pb: showBottomNav ? 'calc(var(--bottom-nav-height, 56px) + 8px)' : 0,
        }}>
          {activeNav === 'me' ? <MyHomePage />
           : activeNav === 'ai' ? <AIRecommendPanel />
           : activeNav === 'home' ? <FeedPanel tab="home" />
           : activeNav === 'recommend' ? <HomeRecommendPage />
           : activeNav === 'follow' ? <FeedPanel tab="follow" />
           : activeNav === 'friend' ? <FeedPanel tab="friend" />
           : activeNav === 'live' ? <LivePanel />
           : activeNav === 'theater' ? <TheaterPanel />
           : activeNav === 'drama' ? <DramaPanel />
           : <Box sx={{ p: 3 }}>{children}</Box>}
        </Box>
        {/* recommend 页面自己处理右侧栏，home 使用外部侧边栏 */}
        {/* 移动端隐藏右侧栏 */}
        {activeNav === 'home' && !isMobile && <RightSidebar section={urlSection} />}
      </Box>
      {/* 底部导航栏（移动端） */}
      <MobileBottomNav activeNav={activeNav} onNavChange={handleNavChange} />
      <MockStatusBadge />
    </Box>
  );
}

function TopBar({
  searchDraft,
  setSearchDraft,
  searchDraftRef,
  isMobile,
  isTablet,
}: {
  searchDraft: string;
  setSearchDraft: (v: string) => void;
  searchDraftRef: React.MutableRefObject<string>;
  isMobile: boolean;
  isTablet: boolean;
}) {
  const { currentUser } = useApp();
  const router = useRouter();

  const submit = () => {
    const q = searchDraftRef.current.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  // 移动端隐藏次要按钮
  const showExtraButtons = !isMobile;

  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        height: { xs: 52, md: 60 },
        px: { xs: 1.5, sm: 2, md: 3 },
        bgcolor: 'var(--bg-topbar, transparent)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color, transparent)',
        flexShrink: 0,
        // Safe Area 顶部适配
        paddingTop: 'var(--sat)',
      }}
    >
      <Logo isCompact={isMobile} />
      <Box sx={{ flex: 1, maxWidth: { xs: 'none', md: 480 }, mx: { xs: 1, md: 2 }, minWidth: 0 }}>
        <TextField
          fullWidth
          size="small"
          value={searchDraft}
          onChange={(e) => { setSearchDraft(e.target.value); searchDraftRef.current = e.target.value; }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={isMobile ? "搜索..." : "搜索你感兴趣的内容、创作者或话题"}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: 'var(--text-muted, currentColor)' }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Button
                    disableElevation
                    size="small"
                    onClick={submit}
                    sx={{
                      minWidth: 0,
                      px: 1.25,
                      py: 0.25,
                      borderRadius: 1,
                      bgcolor: 'primary.main',
                      color: 'var(--text-primary, currentColor)',
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'none',
                      lineHeight: 1.4,
                      boxShadow: 'none',
                      // 让涟漪在 primary.main 上更明显
                      '& .MuiTouchRipple-child': { bgcolor: 'currentColor' },
                      '&:hover': { bgcolor: 'primary.main', filter: 'brightness(1.1)' },
                    }}
                  >
                    搜索
                  </Button>
                </InputAdornment>
              ),
              sx: {
                bgcolor: 'var(--border-color, transparent)',
                color: 'var(--text-primary, currentColor)',
                fontSize: { xs: 12, md: 13 },
                borderRadius: 2,
                '& input::placeholder': { color: 'var(--text-muted, currentColor)', opacity: 1 },
                '& fieldset': { borderColor: 'var(--border-strong, transparent)' },
                '&:hover fieldset': { borderColor: 'var(--text-disabled, currentColor)' },
                '&.Mui-focused fieldset': { borderColor: 'var(--brand-color, #FE2C55)' },
              },
            },
          }}
        />
      </Box>
      <Box sx={{ flex: { xs: 0, md: 1 } }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.25, sm: 0.5, md: 0.5 } }}>
        {/* 充钻石 - 仅桌面端显示 */}
        <Tooltip title="充钻石">
          <Box
            component={Link}
            href="/recharge"
            sx={{
              display: showExtraButtons ? 'inline-flex' : 'none',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              borderRadius: 2,
              textDecoration: 'none',
              color: 'var(--text-secondary, currentColor)',
              '&:hover': { bgcolor: 'var(--border-color, transparent)' },
            }}
          >
            <DiamondIcon sx={{ fontSize: 16, color: 'secondary.light' }} />
            <Typography sx={{ fontSize: 12 }}>充钻石</Typography>
          </Box>
        </Tooltip>
        <Tooltip title="客户端">
          <Box
            component={Link}
            href="/download"
            prefetch={false}
            sx={{
              display: showExtraButtons ? 'inline-flex' : 'none',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              borderRadius: 2,
              textDecoration: 'none',
              color: 'var(--text-secondary, currentColor)',
              '&:hover': { bgcolor: 'var(--border-color, transparent)' },
            }}
          >
            <CloudDownloadIcon sx={{ fontSize: 16 }} />
            <Typography sx={{ fontSize: 12 }}>客户端</Typography>
          </Box>
        </Tooltip>
        <Tooltip title="壁纸">
          <Box
            component={Link}
            href="/wallpaper"
            sx={{
              display: showExtraButtons ? 'inline-flex' : 'none',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              borderRadius: 2,
              textDecoration: 'none',
              color: 'var(--text-secondary, currentColor)',
              '&:hover': { bgcolor: 'var(--border-color, transparent)' },
            }}
          >
            <AutoAwesomeIcon sx={{ fontSize: 16, color: 'warning.main' }} />
            <Typography sx={{ fontSize: 12 }}>壁纸</Typography>
          </Box>
        </Tooltip>
        <NoticeIconView />
        <DmIconView />
        {currentUser ? (
          <AvatarHoverPopup
            anchor={
              <IconButton size="small" sx={{ p: 0.5, ml: 0.5 }}>
                <Avatar
                  src={currentUser?.avatar}
                  sx={{
                    width: { xs: 28, md: 32 },
                    height: { xs: 28, md: 32 },
                    background: gradient2('#FE2C55', ACCENT.purple.main),
                    fontSize: { xs: 11, md: 13 },
                    fontWeight: 700,
                  }}
                >
                  {currentUser?.name?.[0] || 'U'}
                </Avatar>
              </IconButton>
            }
          />
        ) : (
          <Button
            size="small"
            variant="contained"
            color="primary"
            onClick={() => {
              const here = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/home/recommend';
              sessionStorage.setItem('login_redirect', here);
              router.push('/user/login');
            }}
            sx={{
              ml: 1.5,
              textTransform: 'none',
              fontSize: 13,
              fontWeight: 600,
              px: 2.25,
              borderRadius: 999,
            }}
          >
            登录
          </Button>
        )}
      </Box>
    </Box>
  );
}

function Logo({ isCompact = false }: { isCompact?: boolean }) {
  return (
    <Box
      component={Link}
      href="/home/recommend?tab=home"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minWidth: isCompact ? 'auto' : 180,
        position: 'relative',
        cursor: 'pointer',
        textDecoration: 'none',
        flexShrink: 0,
      }}
    >
      <Box sx={{ position: 'relative', width: isCompact ? 32 : 40, height: isCompact ? 32 : 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '1px solid',
              borderColor: 'var(--brand-color, transparent)',
              animation: `moon-ripple 3.6s ease-out ${i * 1.2}s infinite`,
              '@keyframes moon-ripple': {
                '0%': { transform: 'scale(0.4)', opacity: 0.8 },
                '100%': { transform: 'scale(1.6)', opacity: 0 },
              },
            }}
          />
        ))}
        <Box
          sx={{
            width: isCompact ? 18 : 22,
            height: isCompact ? 18 : 22,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #F5E6A8 0%, #D4AF37 60%, #8B6F1F 100%)',
            boxShadow: '0 0 12px rgba(212, 175, 55, 0.5), inset -3px -3px 6px rgba(0,0,0,0.4)',
            position: 'relative',
            zIndex: 1,
          }}
        />
      </Box>
      {/* 移动端隐藏文字 */}
      {!isCompact && (
        <Box sx={{ lineHeight: 1.1, position: 'relative' }}>
          <Box
            sx={{
              fontFamily: '"Ma Shan Zheng", "STKaiti", "KaiTi", "STXingkai", "华文行楷", serif',
              fontSize: 22,
              color: 'var(--text-primary, currentColor)',
              lineHeight: 1,
              letterSpacing: 4,
              textShadow: '0 0 8px rgba(212, 175, 55, 0.3)',
            }}
          >
            清秋月
          </Box>
          <Box
            sx={{
              fontFamily: '"ZCOOL XiaoWei", "Songti SC", "STSong", "SimSun", serif',
              fontSize: 9,
              color: 'var(--brand-color, currentColor)',
              letterSpacing: 1.5,
              mt: 0.25,
              lineHeight: 1,
              fontStyle: 'italic',
            }}
          >
            十年清秋 · 问心明月
          </Box>
        </Box>
      )}
    </Box>
  );
}


function LeftSidebar({ activeNav, onNavChange, meOpen, onMeOpenChange, hideOnLandscape = false }: { activeNav: string; onNavChange: (k: string) => void; meOpen: boolean; onMeOpenChange: (v: boolean) => void; hideOnLandscape?: boolean }) {
  const router = useRouter();
  const settingsBtnRef = React.useRef<HTMLDivElement | null>(null);
  return (
    <Box
      component="nav"
      sx={{
        width: 220,
        flexShrink: 0,
        height: 'calc(100dvh - 60px)',
        display: { xs: 'none', md: hideOnLandscape ? 'none' : 'flex' },
        flexDirection: 'column',
        borderRight: '1px solid var(--border-color, transparent)',
        bgcolor: 'var(--bg-sidebar, transparent)',
      }}
    >
      <Box sx={{ flex: 1, py: 1.5, overflow: 'auto' }}>
        {SIDE_NAV.map((n) => {
          const isActive = activeNav === n.key;
          // 整页路由(内容管理/悬赏中心):push 同页跳转,不开新标签,返回键可回首页
          const isFullRoute = !!n.path && !n.path.includes('?tab=');
          const itemSx = {
            position: 'relative' as const,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            mx: 1.5,
            px: 1.5,
            py: 1,
            borderRadius: 1.5,
            cursor: 'pointer',
            color: isActive ? 'var(--text-primary, currentColor)' : 'var(--text-secondary, currentColor)',
            bgcolor: isActive ? 'var(--border-color, transparent)' : 'transparent',
            transition: 'all 0.15s',
            textDecoration: 'none',
            '&:hover': { bgcolor: 'var(--bg-hover, transparent)', color: 'var(--text-primary, currentColor)' },
          };
          const inner = (
            <>
              {isActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    right: 6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: 'var(--brand-color, #FE2C55)',
                    boxShadow: '0 0 6px var(--brand-color, #FE2C55)',
                  }}
                />
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', color: isActive ? n.accent : 'inherit' }}>
                {n.icon}
              </Box>
              <Typography sx={{ fontSize: 13, fontWeight: isActive ? 600 : 400, flex: 1 }}>{n.label}</Typography>
            </>
          );
          return (
            <React.Fragment key={n.key}>
              {n.dividerBefore && (
                <Divider sx={{ my: 1, mx: 2, borderColor: 'var(--border-color, transparent)' }} />
              )}
              <Box
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (isFullRoute && n.path) {
                    router.push(n.path);
                  } else {
                    onNavChange(n.key);
                  }
                }}
                sx={itemSx}
              >
                {inner}
              </Box>
            </React.Fragment>
          );
        })}
      </Box>
      <Box sx={{ p: 1.5, borderTop: '1px solid var(--border-color, transparent)' }}>
        <Box
          ref={settingsBtnRef}
          onClick={() => onMeOpenChange(!meOpen)}
          aria-label="设置"
          sx={{
            width: '100%',
            height: 32,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: meOpen ? ACCENT.purple.main : 'var(--text-muted, currentColor)',
            bgcolor: meOpen ? ACCENT.purple.soft12 : 'transparent',
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': { bgcolor: ACCENT.purple.soft12, color: ACCENT.purple.main },
          }}
        >
          <SettingsIcon sx={{ fontSize: 16 }} />
        </Box>
      </Box>
      <HomeSettingsDrawer open={meOpen} onClose={() => onMeOpenChange(false)} />
    </Box>
  );
}

function RightSidebar({ section }: { section: string }) {
  return (
    <Box
      component="aside"
      sx={{
        width: 320,
        flexShrink: 0,
        display: { xs: 'none', lg: 'flex' },
        p: 2,
        height: 'calc(100dvh - 60px)',
        overflowY: 'auto',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      {/* 全网热搜:Phase 3 从 Doris 拉全量热榜,每小时自动刷新 */}
      <HotRankingBar
        section={section === 'recommend' ? undefined : section}
        title="内容榜单"
        maxItems={10}
        expandable
        showTypeTabs={false}
      />
    </Box>
  );
}
