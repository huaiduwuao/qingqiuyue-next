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
import Badge from '@mui/material/Badge';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import Divider from '@mui/material/Divider';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import ArticleIcon from '@mui/icons-material/Article';
import FolderIcon from '@mui/icons-material/Folder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import HistoryIcon from '@mui/icons-material/History';
import WatchLaterIcon from '@mui/icons-material/WatchLater';
import EventNoteIcon from '@mui/icons-material/EventNote';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import VideoLibraryOutlinedIcon from '@mui/icons-material/VideoLibraryOutlined';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import DiamondIcon from '@mui/icons-material/Diamond';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import ModeCommentOutlinedIcon from '@mui/icons-material/ModeCommentOutlined';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import Switch from '@mui/material/Switch';
import { useThemeMode } from '@/contexts/ThemeContext';
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
// 客户端下载入口:跳到独立 /download 介绍页
import { LivePanel } from './panels/LivePanel';
import { TheaterPanel } from './panels/TheaterPanel';
import { DramaPanel } from './panels/DramaPanel';
import { useContentNavigate } from '@/lib/contentRoute';
import { ACCENT } from '@/constants/accents';
import { gradient2, IMAGE_OVERLAY } from '@/constants/gradients';

const SIDE_NAV: { key: string; label: string; path?: string; icon: React.ReactNode; accent: string; external?: '_blank'; dividerBefore?: boolean }[] = [
  { key: 'home', label: '精选', path: '/home/recommend?tab=home', icon: <HomeRoundedIcon sx={{ fontSize: 18 }} />, accent: 'primary.main' },
  { key: 'recommend', label: '推荐', path: '/home/recommend?tab=recommend', icon: <RecommendRoundedIcon sx={{ fontSize: 18 }} />, accent: 'secondary.main' },
  { key: 'ai', label: 'AI 搜索', path: '/home/recommend?tab=ai', icon: <TravelExploreRoundedIcon sx={{ fontSize: 18 }} />, accent: ACCENT.blue.main },
  { key: 'follow', label: '关注', path: '/home/recommend?tab=follow', icon: <FavoriteRoundedIcon sx={{ fontSize: 18 }} />, accent: 'primary.main' },
  { key: 'friend', label: '朋友', path: '/home/recommend?tab=friend', icon: <GroupsRoundedIcon sx={{ fontSize: 18 }} />, accent: 'warning.main' },
  { key: 'me', label: '我的', path: '/home/recommend?tab=me', icon: <PersonRoundedIcon sx={{ fontSize: 18 }} />, accent: ACCENT.purple.main },
  { key: 'live', label: '直播', path: '/home/recommend?tab=live', icon: <LiveTvRoundedIcon sx={{ fontSize: 18 }} />, accent: 'primary.main' },
  { key: 'content', label: '内容管理', path: '/account/content', icon: <VideoLibraryIcon sx={{ fontSize: 18 }} />, accent: 'secondary.main', external: '_blank' },
  { key: 'reward', label: '悬赏中心', path: '/account/reward', icon: <CardGiftcardIcon sx={{ fontSize: 18 }} />, accent: 'warning.main', external: '_blank' },
  { key: 'theater', label: '放映厅', path: '/home/recommend?tab=theater', icon: <MovieRoundedIcon sx={{ fontSize: 18 }} />, accent: ACCENT.purple.main, dividerBefore: true },
  { key: 'drama', label: '短剧', path: '/home/recommend?tab=drama', icon: <TheatersRoundedIcon sx={{ fontSize: 18 }} />, accent: 'secondary.main' },
];

const ME_SUBMENU = [
  { key: 'default-page', label: '默认首页设置', path: '/account/settings' },
  { key: 'mode', label: '定场模式' },
  { key: 'general', label: '通用设置' },
  { key: 'ai', label: 'AI 设置' },
  { key: 'shortcut', label: '键盘快捷键' },
  { key: 'faq', label: '常见问题' },
  { key: 'support', label: '我的客服' },
];

const RIGHT_COVERS = [
  { title: 'AI 狼人杀第 52 局', sub: '12 人动物梦境 · 游戏规则', gradient: 'linear-gradient(135deg, #FE2C55 0%, #8B5CF6 100%)' },
  { title: '深海深水 - 埃及艳后', sub: '为了等几白目的娜察干干的，他们要潜入水母宫殿', gradient: 'linear-gradient(135deg, #8B5CF6 0%, #2D1B4E 100%)' },
  { title: '狼村异事', sub: '红事已完，轮到白事', gradient: 'linear-gradient(135deg, #FFB400 0%, #8B0000 100%)' },
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
    body.style.backgroundColor = 'var(--bg-body, #0a0a0f)';
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
      body.style.backgroundColor = prev.bodyBg;
    };
  }, []);

  return (
    <Box sx={{ height: '100dvh', bgcolor: 'var(--bg-body, #0a0a0f)', color: 'var(--text-primary, #ffffff)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TopBar />
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <LeftSidebar activeNav={activeNav} onNavChange={handleNavChange} meOpen={meOpen} onMeOpenChange={setMeOpen} />
        <Box component="main" ref={mainRef} sx={{ flex: 1, minWidth: 0, overflow: 'auto', overscrollBehavior: 'contain' }}>
          {activeNav === 'me' ? <MyHomePage />
           : activeNav === 'ai' ? <AIRecommendPanel />
           : activeNav === 'home' ? <FeedPanel tab="home" />
           : activeNav === 'recommend' ? <FeedPanel tab="recommend" />
           : activeNav === 'follow' ? <FeedPanel tab="follow" />
           : activeNav === 'friend' ? <FeedPanel tab="friend" />
           : activeNav === 'live' ? <LivePanel />
           : activeNav === 'theater' ? <TheaterPanel />
           : activeNav === 'drama' ? <DramaPanel />
           : children}
        </Box>
        {activeNav !== 'me' && activeNav !== 'recommend' && activeNav !== 'follow' && activeNav !== 'friend' && <RightSidebar />}
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
        bgcolor: 'var(--bg-topbar, rgba(10, 10, 15, 0.85))',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
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
                  <SearchIcon sx={{ fontSize: 16, color: 'var(--text-muted, rgba(255,255,255,0.5))' }} />
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
                      color: 'var(--text-primary, #ffffff)',
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'none',
                      lineHeight: 1.4,
                      boxShadow: 'none',
                      // 让涟漪在 primary.main 上更明显
                      '& .MuiTouchRipple-child': { bgcolor: 'rgba(255,255,255,0.45)' },
                      '&:hover': { bgcolor: 'primary.main', filter: 'brightness(1.1)' },
                    }}
                  >
                    搜索
                  </Button>
                </InputAdornment>
              ),
              sx: {
                bgcolor: 'var(--border-color, rgba(255,255,255,0.06))',
                color: 'var(--text-primary, #ffffff)',
                fontSize: 13,
                borderRadius: 2,
                '& input::placeholder': { color: 'var(--text-muted, rgba(255,255,255,0.4))', opacity: 1 },
                '& fieldset': { borderColor: 'var(--border-strong, rgba(255,255,255,0.1))' },
                '&:hover fieldset': { borderColor: 'var(--text-disabled, rgba(255,255,255,0.2))' },
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
              color: 'var(--text-secondary, rgba(255,255,255,0.75))',
              '&:hover': { bgcolor: 'var(--border-color, rgba(255,255,255,0.06))' },
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
              color: 'var(--text-secondary, rgba(255,255,255,0.75))',
              '&:hover': { bgcolor: 'var(--border-color, rgba(255,255,255,0.06))' },
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
              color: 'var(--text-secondary, rgba(255,255,255,0.75))',
              '&:hover': { bgcolor: 'var(--border-color, rgba(255,255,255,0.06))' },
            }}
          >
            <AutoAwesomeIcon sx={{ fontSize: 16, color: 'warning.main' }} />
            <Typography sx={{ fontSize: 12 }}>壁纸</Typography>
          </Box>
        </Tooltip>
        <NoticeIconView />
        <DmIconView />
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
              borderColor: 'rgba(212, 175, 55, 0.4)',
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
            color: 'var(--text-primary, #ffffff)',
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
            color: 'rgba(212, 175, 55, 0.7)',
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

function SettingsPopoverContent({ onClose }: { onClose: () => void }) {
  const { mode, setTheme, primaryColor, setPrimaryColor, presetColors } = useThemeMode();
  const isDark = mode === 'dark';

  return (
    <>
      <Box sx={{ px: 1.5, pt: 1, pb: 0.5 }}>
        <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted, rgba(255,255,255,0.4))', letterSpacing: 1, textTransform: 'uppercase' }}>
          外观
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 0.75, borderRadius: 1.5, mx: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: 1, color: 'var(--text-primary, rgba(255,255,255,0.85))' }}>
          {isDark ? <DarkModeRoundedIcon sx={{ fontSize: 15, color: 'var(--text-secondary, rgba(255,255,255,0.6))' }} /> : <LightModeRoundedIcon sx={{ fontSize: 15, color: 'var(--text-secondary, rgba(255,255,255,0.6))' }} />}
          <Typography sx={{ fontSize: 12 }}>{isDark ? '深色模式' : '浅色模式'}</Typography>
        </Box>
        <Switch
          size="small"
          checked={isDark}
          onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
          sx={{
            '& .MuiSwitch-switchBase.Mui-checked': { color: 'var(--brand-color, #FE2C55)' },
            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: 'var(--brand-color, #FE2C55)' },
          }}
        />
      </Box>

      <Box sx={{ px: 1.5, pt: 0.5, pb: 1, mx: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
          <PaletteRoundedIcon sx={{ fontSize: 15, color: 'var(--text-secondary, rgba(255,255,255,0.6))' }} />
          <Typography sx={{ fontSize: 12, color: 'var(--text-primary, rgba(255,255,255,0.85))' }}>主题色</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {presetColors.map((c) => {
            const isActive = primaryColor.toLowerCase() === c.value.toLowerCase();
            return (
              <Tooltip key={c.key} title={c.label} placement="top" arrow>
                <Box
                  onClick={() => setPrimaryColor(c.value)}
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    bgcolor: c.value,
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: isActive ? 'text.primary' : 'transparent',
                    boxShadow: isActive ? `0 0 0 2px ${c.value}, 0 2px 6px rgba(0,0,0,0.4)` : '0 1px 3px rgba(0,0,0,0.3)',
                    transition: 'transform 0.15s',
                    '&:hover': { transform: 'scale(1.12)' },
                  }}
                />
              </Tooltip>
            );
          })}
        </Box>
      </Box>

      <Divider sx={{ my: 0.5, borderColor: 'var(--border-color, rgba(255,255,255,0.06))' }} />

      <Box sx={{ px: 1.5, pt: 0.75, pb: 0.5 }}>
        <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted, rgba(255,255,255,0.4))', letterSpacing: 1, textTransform: 'uppercase' }}>
          设置
        </Typography>
      </Box>

      {ME_SUBMENU.map((s) => (
        <Box
          key={s.key}
          component={s.path ? Link : 'div'}
          href={s.path}
          onClick={onClose}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            px: 1.5,
            py: 0.9,
            mx: 0.5,
            borderRadius: 1.5,
            cursor: 'pointer',
            fontSize: 12,
            color: 'var(--text-secondary, rgba(255,255,255,0.75))',
            textDecoration: 'none',
            transition: 'all 0.15s',
            '&:hover': { bgcolor: 'var(--bg-hover, rgba(255,255,255,0.05))', color: 'var(--text-primary, #ffffff)' },
          }}
        >
          <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: s.path ? 'var(--brand-color, #8B5CF6)' : 'var(--text-disabled, rgba(255,255,255,0.25))' }} />
          {s.label}
        </Box>
      ))}
    </>
  );
}

function LeftSidebar({ activeNav, onNavChange, meOpen, onMeOpenChange }: { activeNav: string; onNavChange: (k: string) => void; meOpen: boolean; onMeOpenChange: (v: boolean) => void }) {
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
        borderRight: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        bgcolor: 'var(--bg-sidebar, rgba(10, 10, 15, 0.5))',
      }}
    >
      <Box sx={{ flex: 1, py: 1.5, overflow: 'auto' }}>
        {SIDE_NAV.map((n) => {
          const isActive = activeNav === n.key;
          const isNewTab = n.external === '_blank';
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
            color: isActive ? 'var(--text-primary, #ffffff)' : 'var(--text-secondary, rgba(255,255,255,0.65))',
            bgcolor: isActive ? 'var(--border-color, rgba(255,255,255,0.06))' : 'transparent',
            transition: 'all 0.15s',
            textDecoration: 'none',
            '&:hover': { bgcolor: 'var(--bg-hover, rgba(255,255,255,0.04))', color: 'var(--text-primary, #ffffff)' },
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
              {isNewTab && (
                <Box sx={{ fontSize: 9, color: 'var(--text-disabled, rgba(255,255,255,0.3))', ml: 0.5 }}>↗</Box>
              )}
            </>
          );
          return (
            <React.Fragment key={n.key}>
              {n.dividerBefore && (
                <Divider sx={{ my: 1, mx: 2, borderColor: 'var(--border-color, rgba(255,255,255,0.06))' }} />
              )}
              {isNewTab ? (
                <Box component="a" href={n.path} target="_blank" rel="noopener noreferrer" sx={itemSx}>
                  {inner}
                </Box>
              ) : (
                <Box onClick={() => onNavChange(n.key)} sx={itemSx}>
                  {inner}
                </Box>
              )}
            </React.Fragment>
          );
        })}
      </Box>
      <Box sx={{ p: 1.5, borderTop: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
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
            color: meOpen ? ACCENT.purple.main : 'var(--text-muted, rgba(255,255,255,0.5))',
            bgcolor: meOpen ? ACCENT.purple.soft12 : 'transparent',
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': { bgcolor: ACCENT.purple.soft12, color: ACCENT.purple.main },
          }}
        >
          <SettingsIcon sx={{ fontSize: 16 }} />
        </Box>
        <Popover
          open={meOpen}
          onClose={() => onMeOpenChange(false)}
          anchorEl={settingsBtnRef.current}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          slotProps={{
            paper: {
              sx: {
                ml: 1,
                bgcolor: 'var(--bg-elevated, rgba(20, 22, 32, 0.98))',
                border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                backdropFilter: 'blur(12px)',
                borderRadius: 2,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                minWidth: 240,
                p: 0.5,
              },
            },
          }}
        >
          <SettingsPopoverContent onClose={() => onMeOpenChange(false)} />
        </Popover>
      </Box>
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
        display: { xs: 'none', lg: 'block' },
        p: 2,
        height: 'calc(100dvh - 60px)',
        overflowY: 'auto',
      }}
    >
      <Box
        sx={{
          borderRadius: 2,
          bgcolor: 'var(--bg-surface, rgba(255,255,255,0.03))',
          border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
          overflow: 'hidden',
        }}
      >
        {/* 头部 + tab 切换 */}
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.5, pb: 0.5 }}>
          <WhatshotIcon sx={{ fontSize: 16, color: 'primary.main', mr: 0.75 }} />
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #ffffff)', flex: 1 }}>
            实时动态
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>实时</Typography>
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
              color: 'var(--text-secondary, rgba(255,255,255,0.55))',
              textTransform: 'none',
              py: 0.5,
            },
            '& .Mui-selected': { color: '#FE2C55 !important', fontWeight: 700 },
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
    </Box>
  );
}

function HotTab() {
  const navigate = useContentNavigate();
  const hotTypes: ('FILM' | 'TELEPLAY' | 'MUSIC')[] = ['FILM', 'TELEPLAY', 'MUSIC'];
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {RIGHT_COVERS.map((c, i) => (
        <Box
          key={i}
          onClick={() => navigate(hotTypes[i] || 'FILM', i + 1)}
          sx={{
            position: 'relative',
            aspectRatio: '16/9',
            borderRadius: 1.5,
            background: c.gradient,
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
              background: 'radial-gradient(circle at 30% 30%, var(--text-disabled, rgba(255,255,255,0.2)), transparent 60%)',
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
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #ffffff)', lineHeight: 1.2 }}>
              {c.title}
            </Typography>
            <Typography
              sx={{
                fontSize: 10,
                color: 'var(--text-secondary, rgba(255,255,255,0.7))',
                mt: 0.25,
                lineHeight: 1.2,
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {c.sub}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
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
            <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'var(--bg-hover, rgba(255,255,255,0.05))' }} />
            <Box sx={{ flex: 1 }}>
              <Box sx={{ width: '60%', height: 10, borderRadius: 0.5, bgcolor: 'var(--bg-hover, rgba(255,255,255,0.05))', mb: 0.5 }} />
              <Box sx={{ width: '90%', height: 10, borderRadius: 0.5, bgcolor: 'var(--bg-hover, rgba(255,255,255,0.05))' }} />
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
          <Avatar src={c.avatar} sx={{ width: 28, height: 28, fontSize: 11, bgcolor: 'var(--border-color, rgba(255,255,255,0.08))' }}>
            {c.user?.[0] || 'U'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary, rgba(255,255,255,0.85))' }}>
                {c.user}
              </Typography>
              <Typography sx={{ fontSize: 9, color: 'var(--text-muted, rgba(255,255,255,0.35))' }}>{c.time}</Typography>
            </Box>
            <Typography sx={{ fontSize: 11, color: 'var(--text-secondary, rgba(255,255,255,0.7))', lineHeight: 1.4, mb: 0.25 }}>
              {c.text}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
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
          <Box key={i} sx={{ height: 70, borderRadius: 1.5, bgcolor: 'var(--bg-hover, rgba(255,255,255,0.04))' }} />
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
            '&:hover': { bgcolor: 'var(--bg-hover, rgba(255,255,255,0.04))' },
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
              bgcolor: 'var(--border-color, rgba(255,255,255,0.06))',
            }}
          >
            <Box
              component="img"
              src={item.cover}
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
                color: 'var(--text-primary, #ffffff)',
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
                color: 'var(--text-primary, #ffffff)',
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
                <Typography sx={{ fontSize: 10, color: 'var(--text-secondary, rgba(255,255,255,0.55))' }}>{item.author}</Typography>
              </Box>
              <Typography sx={{ fontSize: 9, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
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

const MY_MAIN_TABS = [
  { key: 'works', label: '作品', icon: <VideoLibraryOutlinedIcon sx={{ fontSize: 16 }} />, count: 0 },
  { key: 'recommend', label: '推荐', icon: null, count: 0 },
  { key: 'like', label: '喜欢', icon: null, locked: true, count: null },
  { key: 'collect', label: '收藏', icon: null, locked: true, count: null },
  { key: 'history', label: '观看历史', icon: null, locked: true, count: null },
  { key: 'later', label: '稍后再看', icon: null, locked: true, count: null },
  { key: 'order', label: '我的预约', icon: null, locked: true, count: null },
  { key: 'ai', label: 'AI 笔记', icon: null, locked: true, count: null },
];

const MY_SUB_TABS = [
  { key: 'works', label: '作品' },
  { key: 'private', label: '私密作品', locked: true },
  { key: 'collection', label: '合集', locked: true },
  { key: 'drama', label: '短剧', locked: true },
];

function MyHomePage() {
  const { currentUser } = useApp();
  const [mainTab, setMainTab] = useState('works');
  const [subTab, setSubTab] = useState('works');

  const profileQuery = useQuery({
    queryKey: ['home', 'me', 'profile'],
    queryFn: () => homeClient.get<any>('/me/profile').then((r) => r.data),
  });
  const profile = profileQuery.data;

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100%',
        bgcolor: 'var(--bg-body, #0A0B14)',
        overflow: 'hidden',
      }}
    >
      {/* Aurora gradient background */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 60% 50% at 20% 10%, rgba(139, 92, 246, 0.18) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 80% 5%, rgba(91, 141, 239, 0.15) 0%, transparent 60%), radial-gradient(ellipse 80% 30% at 50% 0%, rgba(254, 44, 85, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ position: 'relative', p: { xs: 1.5, md: 3 } }}>
        {/* Profile header */}
        <Box
          sx={{
            display: 'flex',
            gap: 2.5,
            alignItems: 'flex-start',
            p: 2.5,
            borderRadius: 2.5,
            bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
            border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
            backdropFilter: 'blur(8px)',
            mb: 2,
          }}
        >
          {/* Moon avatar */}
          <Box
            sx={{
              position: 'relative',
              width: 80,
              height: 80,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                sx={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '1px solid',
                  borderColor: 'rgba(212, 175, 55, 0.4)',
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
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, #F5E6A8 0%, #D4AF37 60%, #8B6F1F 100%)',
                boxShadow: '0 0 12px rgba(212, 175, 55, 0.5), inset -3px -3px 6px rgba(0,0,0,0.4)',
                position: 'relative',
                zIndex: 1,
              }}
            />
          </Box>

          {/* User info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
              <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #ffffff)' }}>
                {profile?.user?.nickname || currentUser?.nickname || currentUser?.name || '怀独无傲'}
              </Typography>
              <Box sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: 'rgba(255,180,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />
              </Box>
            </Box>

            {/* Stats row */}
            <Box sx={{ display: 'flex', gap: 2.5, mb: 1, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.5))' }}>关注</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>{profile?.stats?.following ?? '—'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', animation: 'pulse 1.6s ease-in-out infinite', '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                  <Typography sx={{ fontSize: 11, color: 'primary.main', fontWeight: 600 }}>{profile?.stats?.lives ?? 0}人正在直播</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.5))' }}>粉丝</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>{profile?.stats?.followers ?? '—'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.5))' }}>获赞</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>{profile?.stats?.likes ?? 0}</Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 12, color: 'var(--text-secondary, rgba(255,255,255,0.55))' }}>抖音号: {profile?.user?.douyinId ?? '—'}</Typography>
              {profile?.user?.age != null && (
                <Box sx={{ px: 0.75, py: 0.125, borderRadius: 0.75, bgcolor: 'rgba(91, 141, 239, 0.15)', border: '1px solid rgba(91, 141, 239, 0.3)' }}>
                  <Typography sx={{ fontSize: 10, color: ACCENT.blue.main, fontWeight: 600 }}>{profile.user.age}岁</Typography>
                </Box>
              )}
              {profile?.user?.region && (
                <Box sx={{ px: 0.75, py: 0.125, borderRadius: 0.75, bgcolor: ACCENT.gold.soft12, border: `1px solid ${ACCENT.gold.border30}` }}>
                  <Typography sx={{ fontSize: 10, color: ACCENT.gold.main, fontWeight: 600 }}>{profile.user.region}</Typography>
                </Box>
              )}
            </Box>

            {profile?.user?.bio && (
              <Typography sx={{ fontSize: 12, color: 'var(--text-secondary, rgba(255,255,255,0.6))', mt: 0.5 }}>
                {profile.user.bio}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Main tabs */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            mb: 2,
            borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
            pb: 0,
          }}
        >
          {MY_MAIN_TABS.map((t) => {
            const isActive = mainTab === t.key;
            return (
              <Box
                key={t.key}
                onClick={() => !t.locked && setMainTab(t.key)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1.5,
                  py: 1.25,
                  cursor: t.locked ? 'not-allowed' : 'pointer',
                  color: isActive ? 'var(--text-primary, #ffffff)' : 'var(--text-secondary, rgba(255,255,255,0.55))',
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  borderBottom: '2px solid',
                  borderColor: isActive ? 'primary.main' : 'transparent',
                  mb: '-1px',
                  transition: 'all 0.15s',
                  '&:hover': { color: t.locked ? 'var(--text-secondary, rgba(255,255,255,0.55))' : 'var(--text-primary, #ffffff)' },
                }}
              >
                {t.count !== null && (
                  <Typography component="span" sx={{ fontSize: 14, fontWeight: isActive ? 600 : 400 }}>{t.label} {t.count}</Typography>
                )}
                {t.count === null && (
                  <Typography component="span" sx={{ fontSize: 14, fontWeight: isActive ? 600 : 400 }}>{t.label}</Typography>
                )}
                {t.locked && <LockOutlinedIcon sx={{ fontSize: 12, color: 'var(--text-disabled, rgba(255,255,255,0.3))' }} />}
              </Box>
            );
          })}

          <Box sx={{ flex: 1 }} />

          <Button
            variant="outlined"
            size="small"
            sx={{
              borderColor: 'var(--border-strong, rgba(255,255,255,0.12))',
              color: 'var(--text-secondary, rgba(255,255,255,0.7))',
              textTransform: 'none',
              fontSize: 12,
              borderRadius: 1.5,
              '&:hover': { borderColor: 'var(--border-strong, rgba(255,255,255,0.24))', bgcolor: 'var(--bg-hover, rgba(255,255,255,0.04))' },
            }}
          >
            批量管理
          </Button>
        </Box>

        {/* Sub tabs + tools */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {MY_SUB_TABS.map((t) => {
              const isActive = subTab === t.key;
              return (
                <Box
                  key={t.key}
                  onClick={() => !t.locked && setSubTab(t.key)}
                  sx={{
                    px: 1.25,
                    py: 0.5,
                    borderRadius: 1.5,
                    cursor: t.locked ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--text-primary, #ffffff)' : t.locked ? 'var(--text-muted, rgba(255,255,255,0.35))' : 'var(--text-secondary, rgba(255,255,255,0.65))',
                    bgcolor: isActive ? 'primary.main' : t.locked ? 'transparent' : 'var(--bg-hover, rgba(255,255,255,0.04))',
                    border: isActive ? 'none' : '1px solid var(--border-color, rgba(255,255,255,0.06))',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    '&:hover': { bgcolor: isActive ? 'primary.main' : t.locked ? 'transparent' : 'var(--border-color, rgba(255,255,255,0.08))' },
                  }}
                >
                  {t.label}
                  {t.locked && <LockOutlinedIcon sx={{ fontSize: 11, color: 'var(--text-disabled, rgba(255,255,255,0.3))' }} />}
                </Box>
              );
            })}
          </Box>

          <Box sx={{ flex: 1 }} />

          <TextField
            size="small"
            placeholder="搜索你发布的作品"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 14, color: 'var(--text-muted, rgba(255,255,255,0.4))' }} />
                  </InputAdornment>
                ),
                sx: {
                  bgcolor: 'var(--bg-hover, rgba(255,255,255,0.04))',
                  color: 'var(--text-primary, #ffffff)',
                  fontSize: 12,
                  borderRadius: 1.5,
                  '& input::placeholder': { color: 'var(--text-muted, rgba(255,255,255,0.4))', opacity: 1 },
                  '& fieldset': { borderColor: 'var(--border-color, rgba(255,255,255,0.08))' },
                },
              },
            }}
            sx={{ width: 200 }}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<CalendarMonthIcon sx={{ fontSize: 14 }} />}
            sx={{
              borderColor: 'var(--border-strong, rgba(255,255,255,0.12))',
              color: 'var(--text-secondary, rgba(255,255,255,0.7))',
              textTransform: 'none',
              fontSize: 12,
              borderRadius: 1.5,
              '&:hover': { borderColor: 'var(--border-strong, rgba(255,255,255,0.24))', bgcolor: 'var(--bg-hover, rgba(255,255,255,0.04))' },
            }}
          >
            日期筛选
          </Button>
        </Box>

        {/* Empty state */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 10,
            gap: 1.5,
          }}
        >
          <Box
            sx={{
              width: 88,
              height: 88,
              borderRadius: 2.5,
              bgcolor: 'var(--bg-hover, rgba(255,255,255,0.04))',
              border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FolderIcon sx={{ fontSize: 44, color: 'var(--text-disabled, rgba(255,255,255,0.25))' }} />
          </Box>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary, rgba(255,255,255,0.7))', mt: 1 }}>
            暂无内容
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
            该账号还未发布过作品哦~
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
