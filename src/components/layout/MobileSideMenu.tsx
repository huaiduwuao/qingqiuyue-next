'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import TheatersRoundedIcon from '@mui/icons-material/TheatersRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import WallpaperRoundedIcon from '@mui/icons-material/WallpaperRounded';
import HistoryEduRoundedIcon from '@mui/icons-material/HistoryEduRounded';
import VideoLibraryRoundedIcon from '@mui/icons-material/VideoLibraryRounded';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import CloudDownloadRoundedIcon from '@mui/icons-material/CloudDownloadRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import WatchLaterRoundedIcon from '@mui/icons-material/WatchLaterRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import RecommendRoundedIcon from '@mui/icons-material/RecommendRounded';
import StarsRoundedIcon from '@mui/icons-material/StarsRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ShoppingBagRoundedIcon from '@mui/icons-material/ShoppingBagRounded';
import { useApp } from '@/contexts/AppContext';
import { useAIPrefs } from '@/lib/aiPrefs';
import { loginHref } from '@/lib/auth/redirect';
import { ACCENT } from '@/constants/accents';
import { gradient2 } from '@/constants/gradients';
import { SiteLegalFooter } from '@/components/layout/SiteLegalFooter';

type MenuItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  /** 首页内的页签(?tab=),点了切页签;否则是整页路由 */
  tab?: string;
  href?: string;
  action?: 'settings';
};

const GROUPS: { title: string; items: MenuItem[] }[] = [
  {
    title: '发现',
    items: [
      { key: 'live', label: '直播', icon: <LiveTvRoundedIcon />, color: ACCENT.red.main, tab: 'live' },
      { key: 'theater', label: '放映厅', icon: <MovieRoundedIcon />, color: ACCENT.purple.main, tab: 'theater' },
      { key: 'drama', label: '短剧', icon: <TheatersRoundedIcon />, color: ACCENT.orange.main, tab: 'drama' },
      { key: 'topic', label: '意境', icon: <CollectionsRoundedIcon />, color: '#FF8A3D', tab: 'topic' },
      { key: 'ai', label: 'AI 助手', icon: <AutoAwesomeRoundedIcon />, color: ACCENT.blue.main, tab: 'ai' },
      { key: 'poetry', label: '诗词', icon: <HistoryEduRoundedIcon />, color: ACCENT.cyan.main, href: '/poetry' },
      { key: 'wallpaper', label: '壁纸', icon: <WallpaperRoundedIcon />, color: ACCENT.gold.main, href: '/wallpaper' },
    ],
  },
  {
    // 「我的」页签栏在手机上只留 作品/书架/歌单/喜欢/收藏/合集,其余几个子页从这里进(见 MyHomePage 的 ME_DRAWER_TABS)
    title: '我的内容',
    items: [
      { key: 'me-history', label: '观看历史', icon: <HistoryRoundedIcon />, color: ACCENT.blue.main, href: '/home/recommend?tab=me&mainTab=history' },
      { key: 'me-later', label: '稍后再看', icon: <WatchLaterRoundedIcon />, color: ACCENT.orange.main, href: '/home/recommend?tab=me&mainTab=later' },
      { key: 'me-order', label: '我的预约', icon: <EventNoteRoundedIcon />, color: ACCENT.red.main, href: '/home/recommend?tab=me&mainTab=order' },
      { key: 'me-recommend', label: '我的推荐', icon: <RecommendRoundedIcon />, color: ACCENT.purple.main, href: '/home/recommend?tab=me&mainTab=recommend' },
      { key: 'me-ai', label: 'AI 笔记', icon: <AutoAwesomeRoundedIcon />, color: ACCENT.cyan.main, href: '/home/recommend?tab=me&mainTab=ai' },
    ],
  },
  {
    // 原来「我的」页头像下那排 钱包/积分/订单/购买/会员 快捷入口
    title: '创作与钱包',
    items: [
      { key: 'content', label: '创作者中心', icon: <VideoLibraryRoundedIcon />, color: ACCENT.purple.main, href: '/account/content' },
      { key: 'reward', label: '奖励中心', icon: <CardGiftcardRoundedIcon />, color: ACCENT.orange.main, href: '/account/reward' },
      { key: 'recharge', label: '充钻石', icon: <DiamondRoundedIcon />, color: ACCENT.blue.main, href: '/recharge' },
      { key: 'wallet', label: '我的钱包', icon: <AccountBalanceWalletRoundedIcon />, color: ACCENT.red.main, href: '/account/wallet' },
      { key: 'points', label: '积分中心', icon: <StarsRoundedIcon />, color: ACCENT.purple.main, href: '/user/points' },
      { key: 'orders', label: '我的订单', icon: <ReceiptLongRoundedIcon />, color: ACCENT.blue.main, href: '/account/orders' },
      { key: 'purchases', label: '我的购买', icon: <ShoppingBagRoundedIcon />, color: ACCENT.orange.main, href: '/account/purchases' },
      { key: 'vip', label: '会员中心', icon: <WorkspacePremiumRoundedIcon />, color: ACCENT.gold.main, href: '/account/vip' },
    ],
  },
  {
    title: '更多',
    items: [
      { key: 'download', label: '下载客户端', icon: <CloudDownloadRoundedIcon />, color: ACCENT.cyan.main, href: '/download' },
      { key: 'home-settings', label: '首页设置', icon: <TuneRoundedIcon />, color: ACCENT.purple.main, action: 'settings' },
      { key: 'settings', label: '账号与隐私', icon: <SettingsRoundedIcon />, color: ACCENT.blue.main, href: '/account/settings' },
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  activeNav: string;
  onNavChange: (key: string) => void;
  onOpenSettings: () => void;
}

/**
 * 手机端首页左上角的侧边栏(抽屉)。底部导航只放五个一级入口,其余功能
 * (直播/放映厅/短剧/意境/AI、创作收益相关、客户端、设置、备案信息)都在这里。
 */
export function MobileSideMenu({ open, onClose, activeNav, onNavChange, onOpenSettings }: Props) {
  const router = useRouter();
  const { currentUser } = useApp();
  const [aiPrefs] = useAIPrefs();

  const pick = (item: MenuItem) => {
    onClose();
    if (item.action === 'settings') onOpenSettings();
    else if (item.tab) onNavChange(item.tab);
    else if (item.href) router.push(item.href);
  };

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: 'min(300px, 82vw)',
            bgcolor: 'var(--bg-body, #fff)',
            color: 'var(--text-primary, currentColor)',
            pt: 'var(--sat, 0px)',
            pb: 'var(--sab, 0px)',
            display: 'flex',
            flexDirection: 'column',
          },
        },
      }}
    >
      {/* 账号:已登录点进「我的」,未登录给登录按钮 */}
      <Box sx={{ px: 2, pt: 2.5, pb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {currentUser ? (
          <Box
            component="button"
            type="button"
            onClick={() => { onClose(); onNavChange('me'); }}
            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0, border: 0, p: 0, background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <Avatar
              src={currentUser.avatar}
              sx={{ width: 44, height: 44, background: gradient2('#FE2C55', ACCENT.purple.main), fontWeight: 700 }}
            >
              {currentUser.name?.[0] || 'U'}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser.name || '我'}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'var(--text-muted, currentColor)' }}>查看个人主页</Typography>
            </Box>
            <ChevronRightRoundedIcon sx={{ color: 'var(--text-muted, currentColor)' }} />
          </Box>
        ) : (
          <Button
            fullWidth
            variant="contained"
            onClick={() => { onClose(); router.push(loginHref()); }}
            sx={{ borderRadius: 999, fontWeight: 600, background: 'linear-gradient(90deg, #FE2C55 0%, #FF6B3D 100%)' }}
          >
            登录 / 注册
          </Button>
        )}
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', px: 1.5, pb: 1 }}>
        {GROUPS.map((g) => {
          // 用户关掉了 AI 入口就不列「AI 助手」
          const items = g.items.filter((it) => it.key !== 'ai' || aiPrefs.aiEntry || activeNav === 'ai');
          return (
            <Box key={g.title} sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted, currentColor)', px: 1, mb: 0.75, letterSpacing: 0.5 }}>
                {g.title}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', rowGap: 1.25, bgcolor: 'var(--bg-card, rgba(127,127,127,0.06))', borderRadius: 3, py: 1.5 }}>
                {items.map((it) => {
                  const current = !!it.tab && activeNav === it.tab;
                  return (
                    <Box
                      key={it.key}
                      component="button"
                      type="button"
                      onClick={() => pick(it)}
                      aria-current={current ? 'page' : undefined}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 0.5,
                        border: 0,
                        background: 'transparent',
                        color: current ? 'var(--brand-color, #FE2C55)' : 'var(--text-secondary, currentColor)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        WebkitTapHighlightColor: 'transparent',
                        minWidth: 0,
                      }}
                    >
                      <Box sx={{ width: 38, height: 38, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: it.color, bgcolor: `${it.color}1F`, '& svg': { fontSize: 21 } }}>
                        {it.icon}
                      </Box>
                      <Typography component="span" sx={{ fontSize: 11.5, fontWeight: current ? 700 : 500, whiteSpace: 'nowrap' }}>
                        {it.label}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* 免责声明 / 数据采集说明 / 备案号:手机上侧栏不显示,合规信息挪到这里 */}
      <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid var(--border-color, transparent)' }}>
        <SiteLegalFooter />
      </Box>
    </Drawer>
  );
}

export default MobileSideMenu;
