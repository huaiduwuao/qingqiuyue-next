'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
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
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import TheatersRoundedIcon from '@mui/icons-material/TheatersRounded';
import SettingsIcon from '@mui/icons-material/Settings';
import WhatshotIcon from '@mui/icons-material/Whatshot';
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
import { useContentNavigate } from '@/lib/contentRoute';
import { ACCENT } from '@/constants/accents';
import { gradient2, IMAGE_OVERLAY } from '@/constants/gradients';

const SIDE_NAV: { key: string; label: string; path?: string; icon: React.ReactNode; accent: string; dividerBefore?: boolean }[] = [
  { key: 'home', label: '精选', path: '/home/recommend?tab=home', icon: <HomeRoundedIcon sx={{ fontSize: 18 }} />, accent: 'primary.main' },
  { key: 'recommend', label: '推荐', path: '/home/recommend?tab=recommend', icon: <RecommendRoundedIcon sx={{ fontSize: 18 }} />, accent: 'secondary.main' },
  { key: 'ai', label: 'AI 搜索', path: '/home/recommend?tab=ai', icon: <TravelExploreRoundedIcon sx={{ fontSize: 18 }} />, accent: ACCENT.blue.main },
  { key: 'follow', label: '关注', path: '/home/recommend?tab=follow', icon: <FavoriteRoundedIcon sx={{ fontSize: 18 }} />, accent: 'primary.main' },
  { key: 'friend', label: '朋友', path: '/home/recommend?tab=friend', icon: <GroupsRoundedIcon sx={{ fontSize: 18 }} />, accent: 'warning.main' },
  { key: 'me', label: '我的', path: '/home/recommend?tab=me', icon: <PersonRoundedIcon sx={{ fontSize: 18 }} />, accent: ACCENT.purple.main },
  { key: 'live', label: '直播', path: '/home/recommend?tab=live', icon: <LiveTvRoundedIcon sx={{ fontSize: 18 }} />, accent: 'primary.main' },
  // 内容管理/悬赏中心:router.replace 同页替换当前路由,不开新标签页、不留历史栈
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
  const [activeNav, setActiveNav] = useState(urlTab);
  const [meOpen, setMeOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement | null>(null);

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
    setActiveNav(key);
    const next = pathname + '?tab=' + key;
    router.replace(next, { scroll: false });
  }, [pathname, router]);

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

  return (
    <Box sx={{ height: '100dvh', bgcolor: 'var(--bg-body, transparent)', color: 'var(--text-primary, currentColor)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TopBar />
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <LeftSidebar activeNav={activeNav} onNavChange={handleNavChange} meOpen={meOpen} onMeOpenChange={setMeOpen} />
        <Box component="main" ref={mainRef} sx={{ flex: 1, minWidth: 0, overflow: 'auto', overscrollBehavior: 'contain' }}>
          {activeNav === 'me' ? <MyHomePage />
           : activeNav === 'ai' ? <AIRecommendPanel />
           : activeNav === 'home' ? <FeedPanel tab="home" />
           : activeNav === 'recommend' ? children
           : activeNav === 'follow' ? <FeedPanel tab="follow" />
           : activeNav === 'friend' ? <FeedPanel tab="friend" />
           : activeNav === 'live' ? <LivePanel />
           : activeNav === 'theater' ? <TheaterPanel />
           : activeNav === 'drama' ? <DramaPanel />
           : children}
        </Box>
        {activeNav === 'home' && <RightSidebar />}
      </Box>
      <MockStatusBadge />
    </Box>
  );
}

function TopBar() {
  const { currentUser } = useApp();
  const router = useRouter();
  const [draft, setDraft] = useState('');

  const submit = () => {
    const q = draft.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: 60,
        px: 3,
        bgcolor: 'var(--bg-topbar, transparent)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color, transparent)',
        flexShrink: 0,
      }}
    >
      <Logo />
      <Box sx={{ flex: 1, maxWidth: 480, mx: 2 }}>
        <TextField
          fullWidth
          size="small"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="搜索你感兴趣的内容、创作者或话题"
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
                fontSize: 13,
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
      <Box sx={{ flex: 1 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title="充钻石">
          <Box
            component={Link}
            href="/recharge"
            sx={{
              display: 'inline-flex',
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
              display: 'inline-flex',
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
              display: 'inline-flex',
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
              <IconButton size="small" sx={{ p: 0.5, ml: 1 }}>
                <Avatar
                  src={currentUser?.avatar}
                  sx={{
                    width: 32,
                    height: 32,
                    background: gradient2('#FE2C55', ACCENT.purple.main),
                    fontSize: 13,
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

function Logo() {
  return (
    <Box
      component={Link}
      href="/home/recommend?tab=home"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minWidth: 180,
        position: 'relative',
        cursor: 'pointer',
        textDecoration: 'none',
        flexShrink: 0,
      }}
    >
      <Box sx={{ position: 'relative', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #F5E6A8 0%, #D4AF37 60%, #8B6F1F 100%)',
            boxShadow: '0 0 12px rgba(212, 175, 55, 0.5), inset -3px -3px 6px rgba(0,0,0,0.4)',
            position: 'relative',
            zIndex: 1,
          }}
        />
      </Box>
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
    </Box>
  );
}


function LeftSidebar({ activeNav, onNavChange, meOpen, onMeOpenChange }: { activeNav: string; onNavChange: (k: string) => void; meOpen: boolean; onMeOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const settingsBtnRef = React.useRef<HTMLDivElement | null>(null);
  return (
    <Box
      component="nav"
      sx={{
        width: 220,
        flexShrink: 0,
        height: 'calc(100dvh - 60px)',
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        borderRight: '1px solid var(--border-color, transparent)',
        bgcolor: 'var(--bg-sidebar, transparent)',
      }}
    >
      <Box sx={{ flex: 1, py: 1.5, overflow: 'auto' }}>
        {SIDE_NAV.map((n) => {
          const isActive = activeNav === n.key;
          // 整页路由(内容管理/悬赏中心):replace 替换当前路由,不压历史栈、不开新标签
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
                onClick={() => (isFullRoute && n.path ? router.replace(n.path) : onNavChange(n.key))}
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

type SideTab = 'hot' | 'comment' | 'related';

function RightSidebar() {
  const [tab, setTab] = useState<SideTab>('hot');

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
      <Box
        sx={{
          borderRadius: 2,
          bgcolor: 'var(--bg-surface, transparent)',
          border: '1px solid var(--border-color, transparent)',
          overflow: 'hidden',
        }}
      >
        {/* 头部 + tab 切换 */}
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.5, pb: 0.5 }}>
          <WhatshotIcon sx={{ fontSize: 16, color: 'primary.main', mr: 0.75 }} />
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, currentColor)', flex: 1 }}>
            实时动态
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'var(--text-muted, currentColor)' }}>实时</Typography>
        </Box>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          sx={{
            minHeight: 32,
            '& .MuiTab-root': {
              minHeight: 32,
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-secondary, currentColor)',
              textTransform: 'none',
              py: 0.5,
            },
            '& .Mui-selected': { color: 'var(--brand-color, currentColor) !important', fontWeight: 700 },
            '& .MuiTabs-indicator': { backgroundColor: 'primary.main', height: 2 },
          }}
        >
          <Tab value="hot" label="热门" />
          <Tab value="comment" label="评论" />
          <Tab value="related" label="相关" />
        </Tabs>

        <Box sx={{ p: 1.5, pt: 1 }}>
          {tab === 'hot' && <HotTab />}
          {tab === 'comment' && <CommentTab />}
          {tab === 'related' && <RelatedTab />}
        </Box>
      </Box>

      {/* 全网热搜:Phase 3 从 Doris 拉全量热榜,每小时自动刷新 */}
      <HotRankingBar
        contentType="NEWS"
        title="全网热搜"
        maxItems={10}
        expandable
      />
    </Box>
  );
}

function HotTab() {
  const navigate = useContentNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['home', 'side', 'hot'],
    queryFn: () =>
      homeClient
        .get<{
          list: Array<{
            id: number;
            title: string;
            category: string;
            cover: string;
            views: number;
          }>;
        }>('/side/hot')
        .then((r) => r.data),
    staleTime: 60_000,
  });
  const items = data?.list ?? [];

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              aspectRatio: '16/9',
              borderRadius: 1.5,
              bgcolor: 'action.hover',
            }}
          />
        ))}
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary', p: 1, display: 'block' }}>
        暂无热门
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {items.map((c, i) => (
        <Box
          key={c.id}
          onClick={() => navigate(c.category.toUpperCase(), c.id)}
          sx={{
            position: 'relative',
            aspectRatio: '16/9',
            borderRadius: 1.5,
            background: gradientByType(c.category),
            overflow: 'hidden',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            '&:hover': { transform: 'translateY(-2px)' },
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at 30% 30%, rgba(0,0,0,0.18), transparent 60%)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: 6,
              left: 6,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: i === 0 ? 'primary.main' : i === 1 ? '#FF8A3D' : 'warning.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 800,
              color: 'text.primary',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            }}
          >
            {i + 1}
          </Box>
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              p: 1,
              background: IMAGE_OVERLAY.TO_TOP,
            }}
          >
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, currentColor)', lineHeight: 1.2 }}>
              {c.title}
            </Typography>
            <Typography
              sx={{
                fontSize: 10,
                color: 'var(--text-secondary, currentColor)',
                mt: 0.25,
                lineHeight: 1.2,
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {c.views >= 10000 ? `${(c.views / 10000).toFixed(1)}万播放` : `${c.views} 播放`}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

const GRADIENT_BY_TYPE: Record<string, string> = {
  film: 'linear-gradient(135deg, #FE2C55 0%, #8B5CF6 100%)',
  teleplay: 'linear-gradient(135deg, #8B5CF6 0%, #2D1B4E 100%)',
  music: 'linear-gradient(135deg, #FFB400 0%, #8B0000 100%)',
};

function gradientByType(contentType: string): string {
  return GRADIENT_BY_TYPE[contentType] ?? 'linear-gradient(135deg, #2D1B4E 0%, transparent 100%)';
}

function CommentTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['home', 'side', 'comments'],
    queryFn: () => homeClient.get<{ list: any[] }>('/side/comments').then((r) => r.data),
  });
  const list = data?.list || [];

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {[0, 1, 2].map((i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1 }}>
            <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'var(--bg-hover, transparent)' }} />
            <Box sx={{ flex: 1 }}>
              <Box sx={{ width: '60%', height: 10, borderRadius: 0.5, bgcolor: 'var(--bg-hover, transparent)', mb: 0.5 }} />
              <Box sx={{ width: '90%', height: 10, borderRadius: 0.5, bgcolor: 'var(--bg-hover, transparent)' }} />
            </Box>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {list.map((c) => (
        <Box key={c.id} sx={{ display: 'flex', gap: 1 }}>
          <Avatar src={c.avatar} sx={{ width: 28, height: 28, fontSize: 11, bgcolor: 'var(--border-color, transparent)' }}>
            {c.user?.[0] || 'U'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary, currentColor)' }}>
                {c.user}
              </Typography>
              <Typography sx={{ fontSize: 9, color: 'var(--text-muted, currentColor)' }}>{c.time}</Typography>
            </Box>
            <Typography sx={{ fontSize: 11, color: 'var(--text-secondary, currentColor)', lineHeight: 1.4, mb: 0.25 }}>
              {c.text}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'var(--text-muted, currentColor)' }}>
              <FavoriteBorderRoundedIcon sx={{ fontSize: 11 }} />
              <Typography sx={{ fontSize: 10 }}>{c.likes}</Typography>
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function RelatedTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['home', 'side', 'related'],
    queryFn: () => homeClient.get<{ list: any[] }>('/side/related').then((r) => r.data),
  });
  const list = data?.list || [];

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {[0, 1, 2].map((i) => (
          <Box key={i} sx={{ height: 70, borderRadius: 1.5, bgcolor: 'var(--bg-hover, transparent)' }} />
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {list.map((item) => (
        <Box
          key={item.id}
          sx={{
            display: 'flex',
            gap: 1.25,
            cursor: 'pointer',
            p: 0.5,
            borderRadius: 1.5,
            transition: 'background 0.15s',
            '&:hover': { bgcolor: 'var(--bg-hover, transparent)' },
          }}
        >
          <Box
            sx={{
              position: 'relative',
              width: 72,
              height: 96,
              flexShrink: 0,
              borderRadius: 1.25,
              overflow: 'hidden',
              bgcolor: 'var(--border-color, transparent)',
            }}
          >
            <Box
              component="img"
              src={item.cover || undefined}
              alt={item.title}
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                px: 0.5,
                py: 0.05,
                borderRadius: 0.5,
                bgcolor: 'rgba(0, 0, 0, 0.6)',
                color: 'var(--text-primary, currentColor)',
                fontSize: 9,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {Math.floor(item.durationSec / 60)}:{(item.durationSec % 60).toString().padStart(2, '0')}
            </Box>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-primary, currentColor)',
                lineHeight: 1.3,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {item.title}
            </Typography>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                <Avatar src={item.authorAvatar} sx={{ width: 14, height: 14, fontSize: 8 }}>
                  {item.author?.[0]}
                </Avatar>
                <Typography sx={{ fontSize: 10, color: 'var(--text-secondary, currentColor)' }}>{item.author}</Typography>
              </Box>
              <Typography sx={{ fontSize: 9, color: 'var(--text-muted, currentColor)' }}>
                {formatViews(item.views)} 播放 · {formatLikes(item.likes)} 赞
              </Typography>
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function formatViews(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  return n.toString();
}
function formatLikes(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

