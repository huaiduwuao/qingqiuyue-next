'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import { HomeSettingsDrawer } from '@/components/home/HomeSettingsDrawer';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import TheatersRoundedIcon from '@mui/icons-material/TheatersRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import WallpaperRoundedIcon from '@mui/icons-material/WallpaperRounded';
import HistoryEduRoundedIcon from '@mui/icons-material/HistoryEduRounded';
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
import Dialog from '@mui/material/Dialog';
import SwitchAccountRoundedIcon from '@mui/icons-material/SwitchAccountRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import RemoveCircleRoundedIcon from '@mui/icons-material/RemoveCircleRounded';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
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
      // 意境放「发现」第一格:人生感悟、文明图谱是其中的旗舰意境,都从这里进
      { key: 'topic', label: '意境', icon: <CollectionsRoundedIcon />, color: '#FF8A3D', tab: 'topic' },
      { key: 'live', label: '直播', icon: <LiveTvRoundedIcon />, color: ACCENT.red.main, tab: 'live' },
      { key: 'theater', label: '放映厅', icon: <MovieRoundedIcon />, color: ACCENT.purple.main, tab: 'theater' },
      { key: 'drama', label: '短剧', icon: <TheatersRoundedIcon />, color: ACCENT.orange.main, tab: 'drama' },
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
    // 原来「我的」页头像下那排 钱包/积分/订单/购买/会员 快捷入口。创作者中心/奖励中心就是底部的「创作」「悬赏」,不在这里重复
    title: '钱包与会员',
    items: [
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

/**
 * 侧边栏栏目可以自己隐藏/显示:点「编辑」进编辑态,每个栏目右上角 −/+ 切换,隐藏的变淡;
 * 「完成」退出。只存在本机(localStorage),换设备不跟着走。整组都藏了,那一组标题也不显示。
 */
const HIDDEN_KEY = 'qq-side-menu-hidden';

function readHidden(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function useHiddenItems() {
  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set());
  React.useEffect(() => {
    setHidden(readHidden());
  }, []);
  const save = (next: Set<string>) => {
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
    } catch { /* 隐私模式 */ }
  };
  const toggle = (key: string) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    save(next);
  };
  return { hidden, toggle, reset: () => save(new Set()) };
}

/**
 * 侧边栏进的单独子页(直播/短剧…、观看历史…)左上角的返回:只有从侧边栏点进来的才后退,
 * 否则(分享链接、手输地址)上一页不可预期,由首页 layout 直接回一级页。这里记下最后一次从侧边栏去的地址。
 */
const SIDE_MENU_HOP_KEY = 'qq-side-menu-hop';

function rememberHop(url: string) {
  try { sessionStorage.setItem(SIDE_MENU_HOP_KEY, url); } catch { /* 隐私模式 */ }
}

// 客户端是静态导出 + trailingSlash,地址是 /home/recommend/?tab=…,比较前去掉路径末尾的 /
const normUrl = (u: string) => u.replace(/\/+(?=\?|$)/, '');

export function cameFromSideMenu(url: string): boolean {
  try {
    const hop = sessionStorage.getItem(SIDE_MENU_HOP_KEY);
    return hop != null && normUrl(hop) === normUrl(url);
  } catch {
    return false;
  }
}

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
  const { logout } = useAuth();
  // 切换账号 = 退出当前账号再到登录页登另一个;两者共用一个确认框
  const [confirm, setConfirm] = React.useState<null | 'switch' | 'logout'>(null);
  const { hidden, toggle, reset } = useHiddenItems();
  const [editing, setEditing] = React.useState(false);
  // 每次打开都从普通态开始
  React.useEffect(() => {
    if (!open) setEditing(false);
  }, [open]);

  const doLogout = () => {
    setConfirm(null);
    onClose();
    void logout(); // logout 内部会跳登录页
  };

  const pick = (item: MenuItem) => {
    if (editing) {
      toggle(item.key);
      return;
    }
    onClose();
    if (item.action === 'settings') onOpenSettings();
    else if (item.tab) {
      rememberHop(`/home/recommend?tab=${item.tab}`);
      onNavChange(item.tab);
    } else if (item.href) {
      rememberHop(item.href);
      router.push(item.href);
    }
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, px: 0.5, mb: 0.5, minHeight: 30 }}>
          {editing && (
            <Typography sx={{ flex: 1, fontSize: 11.5, color: 'var(--text-muted, currentColor)', px: 0.5 }}>
              点栏目隐藏或显示
            </Typography>
          )}
          {editing && hidden.size > 0 && (
            <Button size="small" variant="text" onClick={reset} sx={{ minWidth: 0, fontSize: 12, color: 'var(--text-muted, currentColor)' }}>
              全部显示
            </Button>
          )}
          <Button
            size="small"
            variant="text"
            onClick={() => setEditing((v) => !v)}
            sx={{ minWidth: 0, fontSize: 12, fontWeight: 600, color: editing ? 'var(--brand-color, #FE2C55)' : 'var(--text-secondary, currentColor)' }}
          >
            {editing ? '完成' : '编辑'}
          </Button>
        </Box>
        {GROUPS.map((g) => {
          // 用户关掉了 AI 入口就不列「AI 助手」;自己隐藏的栏目只在编辑态里出现(变淡)
          const items = g.items
            .filter((it) => it.key !== 'ai' || aiPrefs.aiEntry || activeNav === 'ai')
            .filter((it) => editing || !hidden.has(it.key));
          if (items.length === 0) return null;
          return (
            <Box key={g.title} sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted, currentColor)', px: 1, mb: 0.75, letterSpacing: 0.5 }}>
                {g.title}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', rowGap: 1.25, bgcolor: 'var(--bg-card, rgba(127,127,127,0.06))', borderRadius: 3, py: 1.5 }}>
                {items.map((it) => {
                  const current = !editing && !!it.tab && activeNav === it.tab;
                  const isHidden = hidden.has(it.key);
                  return (
                    <Box
                      key={it.key}
                      component="button"
                      type="button"
                      onClick={() => pick(it)}
                      aria-current={current ? 'page' : undefined}
                      aria-pressed={editing ? !isHidden : undefined}
                      aria-label={editing ? `${isHidden ? '显示' : '隐藏'}「${it.label}」` : undefined}
                      sx={{
                        position: 'relative',
                        opacity: editing && isHidden ? 0.4 : 1,
                        transition: 'opacity 0.15s',
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
                      <Box sx={{ position: 'relative', width: 38, height: 38, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: it.color, bgcolor: `${it.color}1F`, '& > svg': { fontSize: 21 } }}>
                        {it.icon}
                        {editing && (
                          <Box
                            component="span"
                            aria-hidden
                            sx={{
                              position: 'absolute',
                              top: -7,
                              right: -7,
                              display: 'flex',
                              borderRadius: '50%',
                              bgcolor: 'var(--bg-body, #fff)',
                              color: isHidden ? ACCENT.blue.main : 'var(--text-muted, #999)',
                              '& svg': { fontSize: 17 },
                            }}
                          >
                            {isHidden ? <AddCircleRoundedIcon /> : <RemoveCircleRoundedIcon />}
                          </Box>
                        )}
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

      {/* 账号操作:手机上没有右上角头像菜单,切换账号 / 退出登录只能在这里 */}
      {currentUser && (
        <Box sx={{ px: 1.5, pb: 1, display: 'flex', gap: 1 }}>
          {([
            { key: 'switch', label: '切换账号', icon: <SwitchAccountRoundedIcon /> },
            { key: 'logout', label: '退出登录', icon: <LogoutRoundedIcon /> },
          ] as const).map((b) => (
            <Button
              key={b.key}
              fullWidth
              variant="text"
              startIcon={b.icon}
              onClick={() => setConfirm(b.key)}
              sx={{
                borderRadius: 2,
                fontWeight: 600,
                fontSize: 13,
                bgcolor: 'var(--bg-card, rgba(127,127,127,0.06))',
                color: b.key === 'logout' ? 'var(--brand-color, #FE2C55)' : 'var(--text-secondary, currentColor)',
              }}
            >
              {b.label}
            </Button>
          ))}
        </Box>
      )}

      {/* 免责声明 / 数据采集说明 / 备案号:手机上侧栏不显示,合规信息挪到这里 */}
      <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid var(--border-color, transparent)' }}>
        <SiteLegalFooter />
      </Box>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1 }}>
            {confirm === 'switch' ? '切换账号?' : '确认退出登录?'}
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 3, lineHeight: 1.6 }}>
            {confirm === 'switch'
              ? `将退出「${currentUser?.name || '当前账号'}」并前往登录页,用另一个账号登录`
              : '退出后需要重新登录才能使用书架、消息、创作等功能'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button fullWidth variant="outlined" onClick={() => setConfirm(null)} sx={{ borderRadius: 2 }}>
              取消
            </Button>
            <Button fullWidth variant="contained" onClick={doLogout} sx={{ borderRadius: 2, background: 'linear-gradient(90deg, #FE2C55 0%, #FF6B8A 100%)' }}>
              {confirm === 'switch' ? '去登录' : '确认退出'}
            </Button>
          </Box>
        </Box>
      </Dialog>
    </Drawer>
  );
}

export default MobileSideMenu;

/**
 * 手机端全局唯一的侧边栏入口:≡ 按钮 + MobileSideMenu。首页顶栏和创作/悬赏/消息页顶栏都用它,
 * 别的页面不要再自己做一套抽屉导航(以前 account 下有「个人中心/内容管理/奖励中心/设置」一套,
 * 工作台里还有一套,创作页左上角一度并排两个 ≡)。
 *
 * 不在首页时点侧边栏里的首页页签 = 跳回首页对应页签;「首页设置」自己挂一个设置抽屉。
 */
export function MobileMenuButton({
  activeNav = '',
  onNavChange,
  onOpenSettings,
}: {
  activeNav?: string;
  onNavChange?: (key: string) => void;
  onOpenSettings?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  return (
    <>
      <IconButton aria-label="打开侧边栏" onClick={() => setOpen(true)} sx={{ color: 'var(--text-primary, currentColor)' }}>
        <MenuRoundedIcon />
      </IconButton>
      <MobileSideMenu
        open={open}
        onClose={() => setOpen(false)}
        activeNav={activeNav}
        onNavChange={onNavChange ?? ((key) => router.push(`/home/recommend?tab=${key}`))}
        onOpenSettings={onOpenSettings ?? (() => setSettingsOpen(true))}
      />
      {!onOpenSettings && <HomeSettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
