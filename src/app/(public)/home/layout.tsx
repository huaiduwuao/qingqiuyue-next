'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { loginHref } from '@/lib/auth/redirect';
import { useAIPrefs } from '@/lib/aiPrefs';
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
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import TheatersRoundedIcon from '@mui/icons-material/TheatersRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import DynamicFeedRoundedIcon from '@mui/icons-material/DynamicFeedRounded';
import SettingsIcon from '@mui/icons-material/Settings';
import { useApp } from '@/contexts/AppContext';
import { AvatarHoverPopup } from '@/components/account/AvatarHoverPopup';
import NoticeIconView, { DmIconView } from '@/components/NoticeIcon';
import { FeedPanel } from './panels/FeedPanel';
import { AIRecommendPanel } from './panels/AIRecommendPanel';
import TrendingBoard from '@/components/home/TrendingBoard';
import { LeaderboardPanel } from '@/components/leaderboard/LeaderboardPanel';
import LeaderboardMini from '@/components/leaderboard/LeaderboardMini';
import { parseSectionId } from '@/lib/homeSections';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
// 客户端下载入口:跳到独立 /download 介绍页
import { LivePanel } from './panels/LivePanel';
import { TheaterPanel } from './panels/TheaterPanel';
import { DramaPanel } from './panels/DramaPanel';
import { CommunityPanel } from '@/components/community/CommunityPanel';
import { TopicHub } from '@/components/community/TopicHub';
import { ACCENT } from '@/constants/accents';
import { gradient2 } from '@/constants/gradients';
import HomeRecommendPage from './recommend/page';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { SiteLegalFooter } from '@/components/layout/SiteLegalFooter';
import { useResponsive } from '@/hooks/useResponsive';
import { useTopbarHeight } from '@/hooks/useTopbarHeight';
import { BrandSeal, BrandWordmark } from '@/components/brand/BrandLogo';

const SIDE_NAV: { key: string; label: string; path?: string; icon: React.ReactNode; accent: string; dividerBefore?: boolean }[] = [
  { key: 'home', label: '精选', path: '/home/recommend?tab=home', icon: <HomeRoundedIcon sx={{ fontSize: 18 }} />, accent: 'primary.main' },
  { key: 'recommend', label: '推荐', path: '/home/recommend?tab=recommend', icon: <RecommendRoundedIcon sx={{ fontSize: 18 }} />, accent: 'secondary.main' },
  { key: 'rank', label: '排行榜', path: '/home/recommend?tab=rank', icon: <EmojiEventsRoundedIcon sx={{ fontSize: 18 }} />, accent: 'warning.main' },
  { key: 'ai', label: 'AI 助手', path: '/home/recommend?tab=ai', icon: <AutoAwesomeRoundedIcon sx={{ fontSize: 18 }} />, accent: ACCENT.blue.main },
  { key: 'me', label: '我的', path: '/home/recommend?tab=me', icon: <PersonRoundedIcon sx={{ fontSize: 18 }} />, accent: ACCENT.purple.main },
  { key: 'live', label: '直播', path: '/home/recommend?tab=live', icon: <LiveTvRoundedIcon sx={{ fontSize: 18 }} />, accent: 'primary.main' },
  { key: 'feed', label: '动态', path: '/home/recommend?tab=feed', icon: <DynamicFeedRoundedIcon sx={{ fontSize: 18 }} />, accent: '#25F4EE' },
  { key: 'topic', label: '专题', path: '/home/recommend?tab=topic', icon: <CollectionsRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FF8A3D' },
  // 内容管理/悬赏中心:router.push 同页跳转(不开新标签),保留历史栈可返回
  { key: 'content', label: '内容管理', path: '/account/content', icon: <VideoLibraryIcon sx={{ fontSize: 18 }} />, accent: 'secondary.main', dividerBefore: true },
  { key: 'reward', label: '悬赏中心', path: '/account/reward', icon: <CardGiftcardIcon sx={{ fontSize: 18 }} />, accent: 'warning.main' },
  { key: 'theater', label: '放映厅', path: '/home/recommend?tab=theater', icon: <MovieRoundedIcon sx={{ fontSize: 18 }} />, accent: ACCENT.purple.main, dividerBefore: true },
  { key: 'drama', label: '短剧', path: '/home/recommend?tab=drama', icon: <TheatersRoundedIcon sx={{ fontSize: 18 }} />, accent: 'secondary.main' },
];

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab');
  // 关注/朋友已并入「动态」页签(?tab=feed&scope=follow|friend),旧链接照样打开动态
  const legacyCircle = rawTab === 'follow' || rawTab === 'friend' ? rawTab : null;
  const urlTab = legacyCircle ? 'feed' : rawTab;
  const urlSection = searchParams.get('section');
  // 兼容 section 参数：优先用 tab，如果只有 section=recommend 则导航到 recommend
  const effectiveTab = urlTab || (urlSection === 'recommend' ? 'recommend' : 'home');
  const [activeNav, setActiveNav] = useState(effectiveTab);
  const [meOpen, setMeOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement | null>(null);
  // 搜索框状态提升到 Layout，便于导航时清空
  const [searchDraft, setSearchDraft] = useState('');
  const searchDraftRef = useRef('');

  // 响应式 Hook(< md 用底部导航,>= md 用侧栏;同一条线,见 useResponsive)
  const { isMobile } = useResponsive();

  // 同步 URL ?tab= → activeNav,这样从详情页返回时保留 tab
  useEffect(() => {
    setActiveNav(urlTab || effectiveTab);
  }, [urlTab]);

  // 把旧的 ?tab=follow / ?tab=friend 改写成 ?tab=feed&scope=…,地址栏和页签对得上
  useEffect(() => {
    if (!legacyCircle) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'feed');
    params.set('scope', legacyCircle);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [legacyCircle]);

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
    // --app-height:支持 dvh 的浏览器是 100dvh,老 WebView 由 ViewportFix 写 innerHeight
    body.style.height = 'var(--app-height, 100vh)';
    body.style.backgroundColor = 'var(--bg-body, transparent)';
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
      body.style.backgroundColor = prev.bodyBg;
    };
  }, []);

  return (
    <Box sx={{ height: 'var(--app-height, 100vh)', bgcolor: 'var(--bg-body, transparent)', color: 'var(--text-primary, currentColor)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TopBar
        searchDraft={searchDraft}
        setSearchDraft={setSearchDraft}
        searchDraftRef={searchDraftRef}
        isMobile={isMobile}
      />
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <LeftSidebar
          activeNav={activeNav}
          onNavChange={handleNavChange}
          meOpen={meOpen}
          onMeOpenChange={setMeOpen}
        />
        <Box component="main" ref={mainRef} sx={{
          flex: 1,
          minWidth: 0,
          overflow: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          // 底部导航挂载时会把自身高度写进 --bottom-nav-inset(含安全区),这里照抄,
          // 不再各自猜 56px;桌面端该变量是 0。
          // 音乐底栏出现时再加上它的高度(--player-inset,由 GlobalMusicBar 写入)。
          pb: 'calc(var(--bottom-nav-inset, 0px) + var(--player-inset, 0px))',
          // 推荐视频流要铺满剩余高度:main 自己是列向 flex,视频流 flex:1
          display: 'flex',
          flexDirection: 'column',
          '& > *': { flexShrink: 0 },
          '& > [data-fill-main]': { flex: 1, minHeight: 0 },
        }}>
          {activeNav === 'me' ? <MyHomePage />
           : activeNav === 'ai' ? <AIRecommendPanel />
           : activeNav === 'home' ? <FeedPanel tab="home" />
           : activeNav === 'recommend' ? <HomeRecommendPage />
           : activeNav === 'rank' ? <LeaderboardPanel />
           : activeNav === 'live' ? <LivePanel />
           : activeNav === 'theater' ? <TheaterPanel />
           : activeNav === 'drama' ? <DramaPanel />
           : activeNav === 'feed' ? <CommunityPanel />
           : activeNav === 'topic' ? <TopicHub />
           : <Box sx={{ p: 3 }}>{children}</Box>}
        </Box>
        {/* recommend 页面自己处理右侧栏，home 使用外部侧边栏 */}
        {/* 移动端隐藏右侧栏 */}
        {activeNav === 'home' && !isMobile && <RightSidebar section={urlSection || 'recommend'} />}
      </Box>
      {/* 底部导航栏（移动端） */}
      <MobileBottomNav activeNav={activeNav} onNavChange={handleNavChange} />
    </Box>
  );
}

function TopBar({
  searchDraft,
  setSearchDraft,
  searchDraftRef,
  isMobile,
}: {
  searchDraft: string;
  setSearchDraft: (v: string) => void;
  searchDraftRef: React.MutableRefObject<string>;
  isMobile: boolean;
}) {
  const { currentUser } = useApp();
  const router = useRouter();
  const headerRef = useRef<HTMLDivElement | null>(null);
  // 实际高度(含刘海安全区)写进 --topbar-h,面板内的 sticky 子栏按它对齐
  useTopbarHeight(headerRef);

  const submit = () => {
    const q = searchDraftRef.current.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  // 移动端隐藏次要按钮
  const showExtraButtons = !isMobile;

  return (
    <Box
      ref={headerRef}
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1, md: 1.5 },
        // 刘海屏:高度 = 内容高 + 顶部安全区。之前是 height:56 + paddingTop:sat,
        // border-box 下安全区把 56px 吃掉一大半,顶栏内容被压扁/重叠。
        minHeight: { xs: 'calc(56px + var(--sat, 0px))', md: 'calc(60px + var(--sat, 0px))' },
        pl: { xs: 'max(var(--sal, 0px), 12px)', sm: 2, md: 3 },
        pr: { xs: 'max(var(--sar, 0px), 12px)', sm: 2, md: 3 },
        bgcolor: 'var(--bg-topbar, transparent)',
        backdropFilter: 'blur(14px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.4)',
        borderBottom: '1px solid var(--border-color, transparent)',
        flexShrink: 0,
        // Safe Area 顶部适配
        paddingTop: 'var(--sat, 0px)',
      }}
    >
      <Logo isCompact={isMobile} />
      <Box sx={{ flex: 1, maxWidth: { xs: 'none', md: 480, xl: 640 }, mx: { xs: 0.5, md: 2 }, minWidth: 0 }}>
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
                      display: { xs: 'none', sm: 'inline-flex' },
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
                bgcolor: 'var(--bg-input, transparent)',
                color: 'var(--text-primary, currentColor)',
                fontSize: { xs: 13, md: 13 },
                height: { xs: 38, md: 40 },
                borderRadius: 999,
                pr: { xs: 1, sm: 0.5 },
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
        ) : isMobile ? null : (
          /* 移动端不再重复这个按钮:底部「我的」标签本身就是登录入口(未登录时它给登录引导)。
             桌面端没有底部导航,这里是唯一的入口,保留。 */
          <Button
            size="small"
            variant="contained"
            color="primary"
            onClick={() => router.push(loginHref())}
            sx={{
              ml: { xs: 0.5, md: 1.5 },
              textTransform: 'none',
              fontSize: 13,
              fontWeight: 600,
              px: { xs: 1.5, md: 2.25 },
              minWidth: 0,
              whiteSpace: 'nowrap',
              borderRadius: 999,
              background: 'linear-gradient(90deg, #FE2C55 0%, #FF6B3D 100%)',
              boxShadow: '0 6px 16px rgba(254,44,85,0.28)',
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
      aria-label="清秋月 首页"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        minWidth: isCompact ? 'auto' : 180,
        cursor: 'pointer',
        textDecoration: 'none',
        flexShrink: 0,
        '&:hover .brand-seal': { transform: 'rotate(-6deg)' },
      }}
    >
      <BrandSeal
        className="brand-seal"
        size={isCompact ? 30 : 34}
        sx={{ transition: 'transform 0.3s ease', filter: 'drop-shadow(0 2px 4px rgba(184,38,46,0.25))' }}
      />
      {/* 移动端只留印章 */}
      {!isCompact && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.25 }}>
          <BrandWordmark height={30} sx={{ color: 'var(--text-primary, currentColor)' }} />
          <Box
            component="span"
            sx={{
              fontFamily: '"ZCOOL XiaoWei", "Songti SC", "STSong", "SimSun", serif',
              fontSize: 9,
              lineHeight: 1,
              letterSpacing: 2.5,
              color: 'var(--text-muted, currentColor)',
              whiteSpace: 'nowrap',
            }}
          >
            十年清秋 · 问心明月
          </Box>
        </Box>
      )}
    </Box>
  );
}


function LeftSidebar({ activeNav, onNavChange, meOpen, onMeOpenChange }: { activeNav: string; onNavChange: (k: string) => void; meOpen: boolean; onMeOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const settingsBtnRef = React.useRef<HTMLDivElement | null>(null);
  // 用户关掉了 AI 入口:侧栏不再列「AI 助手」(正停在这个页签时照常显示,免得高亮项凭空消失)
  const [aiPrefs] = useAIPrefs();
  const navItems = SIDE_NAV.filter((n) => n.key !== 'ai' || aiPrefs.aiEntry || activeNav === 'ai');
  return (
    <Box
      component="nav"
      sx={{
        width: { md: 200, lg: 220 },
        flexShrink: 0,
        minHeight: 0,
        // < md 由底部导航接管(MobileBottomNav 同一条线)
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        borderRight: '1px solid var(--border-color, transparent)',
        bgcolor: 'var(--bg-sidebar, transparent)',
      }}
    >
      <Box sx={{ flex: 1, py: 1.5, overflow: 'auto' }}>
        {navItems.map((n) => {
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
        {/* 免责声明 / 数据采集说明 / 备案号:整屏布局没有页脚,合规信息放侧栏底部 */}
        <SiteLegalFooter sx={{ px: 0.5, mb: 1 }} />
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
        minHeight: 0,
        overflowY: 'auto',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      {/* 站内排行榜(internal/leaderboard):按类型出的热度日榜,跟随首页 section
          切到对应类型,一键进完整榜单页(左侧导航「排行榜」)。 */}
      {/* 频道可能是用户自建的(标签/专题/关键词),那种没有单一内容类型 → 总榜 */}
      <LeaderboardMini defaultType={parseSectionId(section)?.contentType || 'ALL'} limit={10} />

      {/* 全网热榜:跨平台热度索引(后端 internal/trending),每条带来源平台,
          可按平台筛选。筛选项来自索引本身,爬虫接入新平台后自动多一项。 */}
      <TrendingBoard title="全网热榜" defaultPeriod="day" maxItems={12} />
    </Box>
  );
}
