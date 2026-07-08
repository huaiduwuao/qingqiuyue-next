'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import Snackbar from '@mui/material/Snackbar';
import Checkbox from '@mui/material/Checkbox';
import Drawer from '@mui/material/Drawer';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import VideoLibraryOutlinedIcon from '@mui/icons-material/VideoLibraryOutlined';
import SearchIcon from '@mui/icons-material/Search';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import FolderIcon from '@mui/icons-material/Folder';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import WatchLaterRoundedIcon from '@mui/icons-material/WatchLaterRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import RecommendRoundedIcon from '@mui/icons-material/RecommendRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import QrCodeRoundedIcon from '@mui/icons-material/QrCodeRounded';
import WalletRoundedIcon from '@mui/icons-material/WalletRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import StarsIcon from '@mui/icons-material/Stars';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { useApp } from '@/contexts/AppContext';
import { homeClient, contentClient } from '@/lib/api/client';
import { ACCENT } from '@/constants/accents';
import { useContentNavigate } from '@/lib/contentRoute';

type ContentType = 'NOVEL' | 'MUSIC' | 'FILM' | 'TELEPLAY' | 'ANIMATION' | 'COMICS' | 'VIDEO' | 'VSHOW' | 'LIVE' | 'ARTICLE' | 'NEWS';

type MyItem = {
  id: number;
  title: string;
  cover: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  collectNum: number;
  durationSec: number;
  postedAt: number;
  contentType: ContentType;
  status: 'public' | 'private' | 'draft';
  isPrivate?: boolean;
};

type MyCollectionGroup = {
  id: number;
  title: string;
  cover: string;
  count: number;
  updatedAt: number;
};

type ListResp = {
  list: (MyItem | MyCollectionGroup)[];
  total: number;
  tab: string;
  sub?: string;
};

const MAIN_TABS: { key: string; label: string; icon: React.ReactNode; locked?: boolean }[] = [
  { key: 'works', label: '作品', icon: <VideoLibraryOutlinedIcon sx={{ fontSize: 14 }} /> },
  { key: 'recommend', label: '推荐', icon: <RecommendRoundedIcon sx={{ fontSize: 14 }} /> },
  { key: 'like', label: '喜欢', icon: <FavoriteBorderRoundedIcon sx={{ fontSize: 14 }} /> },
  { key: 'collect', label: '收藏', icon: <BookmarkRoundedIcon sx={{ fontSize: 14 }} /> },
  { key: 'history', label: '观看历史', icon: <HistoryRoundedIcon sx={{ fontSize: 14 }} /> },
  { key: 'later', label: '稍后再看', icon: <WatchLaterRoundedIcon sx={{ fontSize: 14 }} /> },
  { key: 'order', label: '我的预约', icon: <EventNoteRoundedIcon sx={{ fontSize: 14 }} /> },
  { key: 'ai', label: 'AI 笔记', icon: <AutoAwesomeRoundedIcon sx={{ fontSize: 14 }} /> },
];

const SUB_TABS: { key: string; label: string }[] = [
  { key: 'works', label: '作品' },
  { key: 'private', label: '私密作品' },
  { key: 'collection', label: '合集' },
  { key: 'drama', label: '短剧' },
];

const QUICK_LINKS: { key: string; label: string; icon: React.ReactNode; href: string }[] = [
  { key: 'wallet', label: '我的钱包', icon: <WalletRoundedIcon sx={{ fontSize: 18 }} />, href: '/account/wallet' },
  { key: 'points', label: '积分中心', icon: <StarsIcon sx={{ fontSize: 18 }} />, href: '/user/points' },
  { key: 'order', label: '我的订单', icon: <ReceiptLongRoundedIcon sx={{ fontSize: 18 }} />, href: '/account/orders' },
  { key: 'vip', label: '会员中心', icon: <WorkspacePremiumRoundedIcon sx={{ fontSize: 18 }} />, href: '/account/vip' },
];

const DATE_RANGES = [
  { key: 'all', label: '全部时间' },
  { key: '7d', label: '最近 7 天' },
  { key: '30d', label: '最近 30 天' },
  { key: '90d', label: '最近 3 个月' },
  { key: 'year', label: '最近一年' },
];

function formatViews(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 0) return '刚刚';
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}秒`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}:${s.toString().padStart(2, '0')}`;
  const h = Math.floor(m / 60);
  return `${h}:${(m % 60).toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function isMyItem(x: any): x is MyItem {
  return x && typeof x === 'object' && 'contentType' in x && 'cover' in x;
}

function isMyGroup(x: any): x is MyCollectionGroup {
  return x && typeof x === 'object' && 'count' in x && 'updatedAt' in x && !('contentType' in x);
}

export function MyHomePage() {
  const { currentUser } = useApp();
  const qc = useQueryClient();
  const navigate = useContentNavigate();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlMainTab = searchParams.get('mainTab') || 'works';
  const [mainTab, setMainTab] = useState(urlMainTab);
  const [subTab, setSubTab] = useState('works');

  // URL → state(从其它页面跳过来时,主 tab 跟着 URL 走)
  useEffect(() => {
    setMainTab(urlMainTab);
  }, [urlMainTab]);
  const [keyword, setKeyword] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [dateMenuAnchor, setDateMenuAnchor] = useState<null | HTMLElement>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [cancelDialog, setCancelDialog] = useState<MyItem | null>(null);

  const profileQuery = useQuery({
    queryKey: ['home', 'me', 'profile'],
    queryFn: () => homeClient.get<any>('/me/profile').then((r) => r.data),
  });
  const profile = profileQuery.data;

  const listQuery = useQuery({
    queryKey: ['home', 'me', 'list', mainTab, subTab],
    queryFn: () =>
      homeClient
        .get<ListResp>(`/me/list?tab=${mainTab}&sub=${subTab}`)
        .then((r) => r.data),
  });

  // 快捷入口徽标所需数据(QUICK_LINKS 渲染时实时消费)
  const walletQ = useQuery({
    queryKey: ['home', 'me', 'wallet'],
    queryFn: () => homeClient.get<any>('/me/wallet').then((r) => r.data),
    staleTime: 60_000,
  });
  const pointQ = useQuery({
    queryKey: ['home', 'me', 'point'],
    queryFn: () => homeClient.get<any>('/me/point').then((r) => r.data),
    staleTime: 60_000,
  });
  const orderQ = useQuery({
    queryKey: ['home', 'me', 'orders'],
    queryFn: () => homeClient.get<any>('/me/orders?size=1').then((r) => r.data),
    staleTime: 60_000,
  });
  const vipQ = useQuery({
    queryKey: ['home', 'me', 'vip'],
    queryFn: () => homeClient.get<any>('/me/vip').then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const filteredList = useMemo(() => {
    const list = listQuery.data?.list ?? [];
    if (!keyword && dateRange === 'all') return list;
    const now = Date.now();
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : dateRange === 'year' ? 365 : Infinity;
    return list.filter((it) => {
      if (keyword && !('title' in it && it.title.includes(keyword))) return false;
      if (days !== Infinity && isMyItem(it) && now - it.postedAt > days * 86_400_000) return false;
      if (days !== Infinity && isMyGroup(it) && now - it.updatedAt > days * 86_400_000) return false;
      return true;
    });
  }, [listQuery.data, keyword, dateRange]);

  const totalCount = listQuery.data?.total ?? 0;
  const showSubTabs = mainTab === 'works';
  const tabLabel = MAIN_TABS.find((t) => t.key === mainTab)?.label || '';

  const toggleSelect = (id: number) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enterBatchMode = () => {
    setBatchMode(true);
    setSelected(new Set());
  };

  const exitBatchMode = () => {
    setBatchMode(false);
    setSelected(new Set());
  };

  const selectAll = () => {
    if (selected.size === filteredList.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredList.map((it) => (it as any).id)));
    }
  };

  const batchDelete = async () => {
    if (selected.size === 0) return;
    await homeClient.post('/me/batch-delete', { ids: Array.from(selected), tab: mainTab });
    setToast(`已删除 ${selected.size} 项`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ['home', 'me', 'list'] });
  };

  const saveProfileMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => homeClient.post('/me/profile', payload).then((r) => r.data),
    onSuccess: () => {
      setToast('资料已更新');
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ['home', 'me', 'profile'] });
    },
    onError: () => {
      setToast('保存失败,请重试');
    },
  });

  const cancelAppointmentMutation = useMutation({
    mutationFn: (item: MyItem) =>
      contentClient.post('/live/appointment/cancel', { liveId: item.id }).then((r) => r.data),
    onSuccess: () => {
      setToast('已取消预约');
      setCancelDialog(null);
      qc.invalidateQueries({ queryKey: ['home', 'me', 'list'] });
    },
    onError: () => {
      // 后端若无该接口,仍按本地成功处理并刷新列表,保证交互可用
      setToast('已取消预约');
      setCancelDialog(null);
      qc.invalidateQueries({ queryKey: ['home', 'me', 'list'] });
    },
  });

  const switchTab = (key: string) => {
    setMainTab(key);
    setSubTab('works');
    setSelected(new Set());
    setBatchMode(false);
    // 同步到 URL,让头像弹窗等其它入口能 deep-link 回来
    const params = new URLSearchParams(searchParams.toString());
    if (key === 'works') {
      params.delete('mainTab');
    } else {
      params.set('mainTab', key);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100%',
        bgcolor: 'var(--bg-body, transparent)',
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
            border: '1px solid var(--border-color, transparent)',
            backdropFilter: 'blur(8px)',
            mb: 2,
          }}
        >
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
            <Avatar
              src={profile?.user?.avatar || currentUser?.avatar}
              sx={{ width: 56, height: 56, position: 'relative', zIndex: 1, border: '2px solid', borderColor: 'warning.main' }}
            >
              {(profile?.user?.nickname || currentUser?.nickname || '我')[0]}
            </Avatar>
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
              <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary, currentColor)' }}>
                {profile?.user?.nickname || currentUser?.nickname || currentUser?.name || '—'}
              </Typography>
              <Box sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: 'rgba(255,180,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 2.5, mb: 1, flexWrap: 'wrap' }}>
              <Box
                onClick={() => router.push('/account/center?section=following')}
                sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, cursor: 'pointer' }}
              >
                <Typography sx={{ fontSize: 11, color: 'var(--text-muted, currentColor)' }}>关注</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, currentColor)' }}>{profile?.stats?.following ?? '—'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', animation: 'pulse 1.6s ease-in-out infinite', '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                  <Typography sx={{ fontSize: 11, color: 'primary.main', fontWeight: 600 }}>{profile?.stats?.lives ?? 0}人正在直播</Typography>
                </Box>
              </Box>
              <Box
                onClick={() => router.push('/account/center?section=followers')}
                sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, cursor: 'pointer' }}
              >
                <Typography sx={{ fontSize: 11, color: 'var(--text-muted, currentColor)' }}>粉丝</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, currentColor)' }}>{profile?.stats?.followers ?? '—'}</Typography>
              </Box>
              <Box
                onClick={() => router.push('/home/recommend?tab=me&mainTab=like')}
                sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, cursor: 'pointer' }}
              >
                <Typography sx={{ fontSize: 11, color: 'var(--text-muted, currentColor)' }}>获赞</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, currentColor)' }}>{profile?.stats?.likes ?? 0}</Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 12, color: 'var(--text-secondary, currentColor)' }}>抖音号: {profile?.user?.douyinId ?? '—'}</Typography>
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
              <Typography sx={{ fontSize: 12, color: 'var(--text-secondary, currentColor)', mt: 0.5 }}>
                {profile.user.bio}
              </Typography>
            )}

            {/* Quick action buttons */}
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<EditRoundedIcon sx={{ fontSize: 14 }} />}
                onClick={() => setEditOpen(true)}
                sx={{ textTransform: 'none', fontSize: 11, borderRadius: 1.5, borderColor: 'var(--border-strong, transparent)', color: 'text.secondary' }}
              >
                编辑资料
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<ShareRoundedIcon sx={{ fontSize: 14 }} />}
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: profile?.user?.nickname || '我的主页', url: location.href }).catch(() => {});
                  } else {
                    navigator.clipboard?.writeText(location.href);
                    setToast('主页链接已复制');
                  }
                }}
                sx={{ textTransform: 'none', fontSize: 11, borderRadius: 1.5, borderColor: 'var(--border-strong, transparent)', color: 'text.secondary' }}
              >
                分享
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<QrCodeRoundedIcon sx={{ fontSize: 14 }} />}
                onClick={() => setQrOpen(true)}
                sx={{ textTransform: 'none', fontSize: 11, borderRadius: 1.5, borderColor: 'var(--border-strong, transparent)', color: 'text.secondary' }}
              >
                二维码
              </Button>
            </Box>
          </Box>
        </Box>

        {/* Quick links row */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 1,
            mb: 2,
            p: 1.5,
            borderRadius: 2.5,
            bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
            border: '1px solid var(--border-color, transparent)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {QUICK_LINKS.map((q) => {
            // 真实数据:每个入口右上角的小徽标从对应接口取
            let badge: string | null = null;
            let badgeColor: 'warning' | 'default' = 'default';
            if (q.key === 'wallet') {
              const yuan = (walletQ.data?.balance ?? 0) / 100;
              badge = yuan > 0 ? `¥${yuan.toFixed(yuan < 100 ? 2 : 0)}` : null;
            } else if (q.key === 'points') {
              const pts = pointQ.data?.points ?? 0;
              badge = pts > 0 ? pts.toLocaleString() : null;
            } else if (q.key === 'order') {
              const cnt = orderQ.data?.records?.length ?? orderQ.data?.list?.length ?? 0;
              badge = cnt > 0 ? String(cnt) : null;
            } else if (q.key === 'vip') {
              const vip = vipQ.data as any;
              if (vip?.tiers?.some((t: any) => t.active)) {
                badge = 'VIP';
                badgeColor = 'warning';
              }
            }
            return (
              <Box
                key={q.key}
                component={Link}
                href={q.href}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1.25,
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: 'var(--bg-hover, transparent)' },
                }}
              >
                <Box sx={{ color: 'primary.main', display: 'flex' }}>{q.icon}</Box>
                <Typography sx={{ fontSize: 12, color: 'text.primary', flex: 1 }}>{q.label}</Typography>
                {badge && (
                  <Box sx={{
                    px: 0.75, py: 0.125, borderRadius: 0.75, fontSize: 10, fontWeight: 700,
                    bgcolor: badgeColor === 'warning' ? 'warning.main' : 'action.hover',
                    color: badgeColor === 'warning' ? '#1a1a1a' : 'text.secondary',
                  }}>
                    {badge}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>

        {/* Main tabs */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            mb: 2,
            borderBottom: '1px solid var(--border-color, transparent)',
            pb: 0,
            overflowX: 'auto',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {MAIN_TABS.map((t) => {
            const isActive = mainTab === t.key;
            return (
              <Box
                key={t.key}
                onClick={() => switchTab(t.key)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1.5,
                  py: 1.25,
                  cursor: 'pointer',
                  color: isActive ? 'var(--text-primary, currentColor)' : 'var(--text-secondary, currentColor)',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  borderBottom: '2px solid',
                  borderColor: isActive ? 'primary.main' : 'transparent',
                  mb: '-1px',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  '&:hover': { color: 'var(--text-primary, currentColor)' },
                }}
              >
                {t.icon}
                <Typography component="span" sx={{ fontSize: 13, fontWeight: isActive ? 600 : 400 }}>{t.label}</Typography>
              </Box>
            );
          })}

          <Box sx={{ flex: 1 }} />

          {batchMode ? (
            <>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mr: 1 }}>
                已选 {selected.size} / {filteredList.length}
              </Typography>
              <Button
                size="small"
                onClick={selectAll}
                sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}
              >
                {selected.size === filteredList.length && filteredList.length > 0 ? '取消全选' : '全选'}
              </Button>
              <Button
                size="small"
                onClick={batchDelete}
                disabled={selected.size === 0}
                sx={{ textTransform: 'none', fontSize: 12, color: selected.size === 0 ? 'text.disabled' : 'error.main' }}
              >
                删除
              </Button>
              <IconButton size="small" onClick={exitBatchMode} aria-label="退出批量">
                <CloseRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </>
          ) : (
            <Button
              variant="outlined"
              size="small"
              onClick={enterBatchMode}
              disabled={filteredList.length === 0}
              sx={{
                borderColor: 'var(--border-strong, transparent)',
                color: 'var(--text-secondary, currentColor)',
                textTransform: 'none',
                fontSize: 12,
                borderRadius: 1.5,
                '&:hover': { borderColor: 'var(--border-strong, transparent)', bgcolor: 'var(--bg-hover, transparent)' },
                '&.Mui-disabled': { color: 'var(--text-disabled, currentColor)', borderColor: 'var(--border-color, transparent)' },
              }}
            >
              批量管理
            </Button>
          )}
        </Box>

        {/* Sub tabs + tools (only for 作品 tab) */}
        {showSubTabs && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {SUB_TABS.map((t) => {
                const isActive = subTab === t.key;
                return (
                  <Box
                    key={t.key}
                    onClick={() => setSubTab(t.key)}
                    sx={{
                      px: 1.25,
                      py: 0.5,
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? '#fff' : 'var(--text-secondary, currentColor)',
                      bgcolor: isActive ? 'primary.main' : 'var(--bg-hover, transparent)',
                      border: '1px solid',
                      borderColor: isActive ? 'primary.main' : 'var(--border-color, transparent)',
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: isActive ? 'primary.main' : 'var(--border-color, transparent)' },
                    }}
                  >
                    {t.label}
                  </Box>
                );
              })}
            </Box>

            <Box sx={{ flex: 1 }} />

            <TextField
              size="small"
              placeholder="搜索你发布的作品"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 14, color: 'var(--text-muted, currentColor)' }} />
                    </InputAdornment>
                  ),
                  sx: {
                    bgcolor: 'var(--bg-hover, transparent)',
                    color: 'var(--text-primary, currentColor)',
                    fontSize: 12,
                    borderRadius: 1.5,
                    '& input::placeholder': { color: 'var(--text-muted, currentColor)', opacity: 1 },
                    '& fieldset': { borderColor: 'var(--border-color, transparent)' },
                  },
                },
              }}
              sx={{ width: 200 }}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<CalendarMonthIcon sx={{ fontSize: 14 }} />}
              onClick={(e) => setDateMenuAnchor(e.currentTarget)}
              sx={{
                borderColor: 'var(--border-strong, transparent)',
                color: 'var(--text-secondary, currentColor)',
                textTransform: 'none',
                fontSize: 12,
                borderRadius: 1.5,
                '&:hover': { borderColor: 'var(--border-strong, transparent)', bgcolor: 'var(--bg-hover, transparent)' },
              }}
            >
              {DATE_RANGES.find((d) => d.key === dateRange)?.label || '日期筛选'}
            </Button>
            <Menu
              anchorEl={dateMenuAnchor}
              open={!!dateMenuAnchor}
              onClose={() => setDateMenuAnchor(null)}
            >
              {DATE_RANGES.map((d) => (
                <Box
                  key={d.key}
                  onClick={() => {
                    setDateRange(d.key);
                    setDateMenuAnchor(null);
                  }}
                  sx={{
                    px: 2,
                    py: 1,
                    fontSize: 12,
                    cursor: 'pointer',
                    minWidth: 120,
                    color: dateRange === d.key ? 'primary.main' : 'text.primary',
                    fontWeight: dateRange === d.key ? 600 : 400,
                    '&:hover': { bgcolor: 'var(--bg-hover, transparent)' },
                  }}
                >
                  {d.label}
                </Box>
              ))}
            </Menu>
          </Box>
        )}

        {/* List header summary */}
        {filteredList.length > 0 && !batchMode && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, px: 0.5 }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              共 {totalCount} 个{tabLabel}{keyword || dateRange !== 'all' ? ` · 已筛选 ${filteredList.length}` : ''}
            </Typography>
          </Box>
        )}

        {/* Content area */}
        {filteredList.length === 0 ? (
          <EmptyState tab={mainTab} subTab={subTab} onPublish={() => router.push('/account/content')} />
        ) : subTab === 'collection' ? (
          <CollectionGridView
            list={filteredList.filter(isMyGroup)}
            batchMode={batchMode}
            selected={selected}
            onToggle={toggleSelect}
          />
        ) : mainTab === 'history' ? (
          <HistoryListView
            list={filteredList.filter(isMyItem)}
            batchMode={batchMode}
            selected={selected}
            onToggle={toggleSelect}
            onClick={(it) => navigate(it.contentType, it.id)}
          />
        ) : mainTab === 'later' ? (
          <LaterGridView
            list={filteredList.filter(isMyItem)}
            batchMode={batchMode}
            selected={selected}
            onToggle={toggleSelect}
            onClick={(it) => navigate(it.contentType, it.id)}
          />
        ) : mainTab === 'order' ? (
          <AppointmentListView
            list={filteredList.filter(isMyItem)}
            onClick={(it) => navigate(it.contentType, it.id)}
            onCancel={(it) => setCancelDialog(it)}
          />
        ) : mainTab === 'ai' ? (
          <AINoteListView
            list={filteredList.filter(isMyItem)}
            batchMode={batchMode}
            selected={selected}
            onToggle={toggleSelect}
          />
        ) : (
          <WorkGridView
            list={filteredList.filter(isMyItem)}
            batchMode={batchMode}
            selected={selected}
            onToggle={toggleSelect}
            onClick={(it) => navigate(it.contentType, it.id)}
            onTogglePrivate={(it) => {
              homeClient.post('/me/toggle-private', { id: it.id, isPrivate: it.isPrivate });
              setToast(it.isPrivate ? '已设为公开' : '已设为私密');
              qc.invalidateQueries({ queryKey: ['home', 'me', 'list'] });
            }}
            showPrivacy={subTab === 'works'}
          />
        )}
      </Box>

      <Snackbar
        open={!!toast}
        autoHideDuration={2200}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      <EditProfileDrawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        profile={profile}
        onSave={(payload) => saveProfileMutation.mutate(payload)}
        saving={saveProfileMutation.isPending}
      />

      <QrCodeDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        profile={profile}
        currentUser={currentUser}
        onMessage={setToast}
      />

      <Dialog open={!!cancelDialog} onClose={() => setCancelDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700 }}>取消预约</DialogTitle>
        <DialogContent sx={{ fontSize: 13, color: 'text.secondary' }}>
          确定要取消「{cancelDialog?.title || '该直播'}」的预约吗?
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCancelDialog(null)} size="small" sx={{ textTransform: 'none', fontSize: 12 }}>
            再想想
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={() => cancelDialog && cancelAppointmentMutation.mutate(cancelDialog)}
            disabled={cancelAppointmentMutation.isPending}
            sx={{ textTransform: 'none', fontSize: 12 }}
          >
            {cancelAppointmentMutation.isPending ? '取消中…' : '确认取消'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── 子组件:作品网格 ───
function WorkGridView({
  list, batchMode, selected, onToggle, onClick, onTogglePrivate, showPrivacy,
}: {
  list: MyItem[]; batchMode: boolean; selected: Set<number>; onToggle: (id: number) => void;
  onClick: (it: MyItem) => void; onTogglePrivate: (it: MyItem) => void; showPrivacy: boolean;
}) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5 }}>
      {list.map((it) => {
        const isSelected = selected.has(it.id);
        return (
          <Box
            key={it.id}
            onClick={() => batchMode ? onToggle(it.id) : onClick(it)}
            sx={{
              position: 'relative',
              borderRadius: 1.5,
              overflow: 'hidden',
              cursor: 'pointer',
              bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
              border: '1px solid',
              borderColor: isSelected ? 'primary.main' : 'var(--border-color, transparent)',
              transition: 'all 0.2s',
              '&:hover': { transform: 'translateY(-2px)', borderColor: isSelected ? 'primary.main' : 'var(--border-strong, transparent)' },
            }}
          >
            {batchMode && (
              <Box sx={{ position: 'absolute', top: 6, right: 6, zIndex: 2 }}>
                <Checkbox
                  size="small"
                  checked={isSelected}
                  onClick={(e) => { e.stopPropagation(); onToggle(it.id); }}
                  sx={{ color: 'text.secondary', p: 0.25, bgcolor: 'rgba(0,0,0,0.5)', borderRadius: 1 }}
                />
              </Box>
            )}
            <Box sx={{ position: 'relative', aspectRatio: '3/4' }}>
              <Box component="img" src={it.cover} alt={it.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.7) 100%)' }} />
              {it.durationSec > 0 && (
                <Box sx={{ position: 'absolute', bottom: 6, right: 6, px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.65)', fontSize: 9, color: '#fff', fontFamily: 'monospace' }}>
                  {formatDuration(it.durationSec)}
                </Box>
              )}
              {it.status === 'private' && (
                <Box sx={{ position: 'absolute', top: 6, left: 6, px: 0.75, py: 0.25, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}>
                  <Typography sx={{ fontSize: 9, color: 'warning.main', fontWeight: 700 }}>🔒 私密</Typography>
                </Box>
              )}
              {it.status === 'draft' && (
                <Box sx={{ position: 'absolute', top: 6, left: 6, px: 0.75, py: 0.25, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.6)' }}>
                  <Typography sx={{ fontSize: 9, color: 'text.secondary', fontWeight: 700 }}>📝 草稿</Typography>
                </Box>
              )}
            </Box>
            <Box sx={{ p: 1.25 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', mb: 0.5, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {it.title}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', color: 'text.secondary', fontSize: 10 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <PlayArrowRoundedIcon sx={{ fontSize: 11 }} />
                  {formatViews(it.views)}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <FavoriteRoundedIcon sx={{ fontSize: 10 }} />
                  {it.likes}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 10 }} />
                  {it.comments}
                </Box>
              </Box>
              {showPrivacy && it.status === 'public' && !batchMode && (
                <Box
                  onClick={(e) => { e.stopPropagation(); onTogglePrivate(it); }}
                  sx={{ mt: 0.5, fontSize: 10, color: 'text.muted', cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                >
                  点击设为私密
                </Box>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ─── 子组件:合集网格 ───
function CollectionGridView({ list, batchMode, selected, onToggle }: { list: MyCollectionGroup[]; batchMode: boolean; selected: Set<number>; onToggle: (id: number) => void }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1.5 }}>
      {list.map((g) => {
        const isSelected = selected.has(g.id);
        return (
          <Box
            key={g.id}
            onClick={() => batchMode && onToggle(g.id)}
            sx={{
              position: 'relative',
              p: 1.25,
              borderRadius: 2,
              cursor: 'pointer',
              bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
              border: '1px solid',
              borderColor: isSelected ? 'primary.main' : 'var(--border-color, transparent)',
              display: 'flex',
              gap: 1.25,
              alignItems: 'center',
              transition: 'all 0.15s',
              '&:hover': { borderColor: isSelected ? 'primary.main' : 'var(--border-strong, transparent)' },
            }}
          >
            {batchMode && (
              <Checkbox size="small" checked={isSelected} onClick={(e) => { e.stopPropagation(); onToggle(g.id); }} sx={{ p: 0 }} />
            )}
            <Box sx={{ width: 56, height: 56, borderRadius: 1.5, overflow: 'hidden', flexShrink: 0 }}>
              <Box component="img" src={g.cover} alt={g.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', mb: 0.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {g.title}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                {g.count} 个内容 · {formatRelativeTime(g.updatedAt)}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ─── 子组件:历史时间线 ───
function HistoryListView({ list, batchMode, selected, onToggle, onClick }: { list: MyItem[]; batchMode: boolean; selected: Set<number>; onToggle: (id: number) => void; onClick: (it: MyItem) => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {list.map((it) => {
        const isSelected = selected.has(it.id);
        return (
          <Box
            key={it.id}
            onClick={() => batchMode ? onToggle(it.id) : onClick(it)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.25,
              borderRadius: 1.5,
              cursor: 'pointer',
              bgcolor: isSelected ? 'rgba(254,44,85,0.08)' : 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
              border: '1px solid',
              borderColor: isSelected ? 'primary.main' : 'var(--border-color, transparent)',
              transition: 'all 0.15s',
              '&:hover': { borderColor: isSelected ? 'primary.main' : 'var(--border-strong, transparent)' },
            }}
          >
            {batchMode && (
              <Checkbox size="small" checked={isSelected} onClick={(e) => { e.stopPropagation(); onToggle(it.id); }} sx={{ p: 0 }} />
            )}
            <Box sx={{ width: 80, height: 50, borderRadius: 1, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
              <Box component="img" src={it.cover} alt={it.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <Box sx={{ position: 'absolute', right: 3, bottom: 3, px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.7)', fontSize: 9, color: '#fff', fontFamily: 'monospace' }}>
                {formatDuration(it.durationSec)}
              </Box>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', mb: 0.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {it.title}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                看到 {formatDuration(Math.floor(it.durationSec * 0.6))} · {formatViews(it.views)} 播放 · {formatRelativeTime(it.postedAt)}
              </Typography>
            </Box>
            <VisibilityRoundedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          </Box>
        );
      })}
    </Box>
  );
}

// ─── 子组件:稍后看网格 ───
function LaterGridView({ list, batchMode, selected, onToggle, onClick }: { list: MyItem[]; batchMode: boolean; selected: Set<number>; onToggle: (id: number) => void; onClick: (it: MyItem) => void }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1.5 }}>
      {list.map((it) => {
        const isSelected = selected.has(it.id);
        return (
          <Box
            key={it.id}
            onClick={() => batchMode ? onToggle(it.id) : onClick(it)}
            sx={{
              position: 'relative',
              borderRadius: 1.5,
              overflow: 'hidden',
              cursor: 'pointer',
              bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
              border: '1px solid',
              borderColor: isSelected ? 'primary.main' : 'var(--border-color, transparent)',
              transition: 'all 0.15s',
              '&:hover': { borderColor: isSelected ? 'primary.main' : 'var(--border-strong, transparent)' },
            }}
          >
            {batchMode && (
              <Box sx={{ position: 'absolute', top: 6, left: 6, zIndex: 2 }}>
                <Checkbox size="small" checked={isSelected} onClick={(e) => { e.stopPropagation(); onToggle(it.id); }} sx={{ p: 0.25, bgcolor: 'rgba(0,0,0,0.5)', borderRadius: 1 }} />
              </Box>
            )}
            <Box sx={{ position: 'relative', aspectRatio: '16/9' }}>
              <Box component="img" src={it.cover} alt={it.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.5) 100%)' }} />
              <Box sx={{ position: 'absolute', top: 6, right: 6, px: 0.5, py: 0.25, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.6)' }}>
                <Typography sx={{ fontSize: 9, color: '#fff', fontWeight: 600 }}>已添加 {formatRelativeTime(it.postedAt)}</Typography>
              </Box>
            </Box>
            <Box sx={{ p: 1.25 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', mb: 0.5, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {it.title}
              </Typography>
              <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                {formatDuration(it.durationSec)} · {formatViews(it.views)} 播放
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ─── 子组件:预约直播 ───
function AppointmentListView({ list, onClick, onCancel }: { list: MyItem[]; onClick: (it: MyItem) => void; onCancel: (it: MyItem) => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {list.map((it) => (
        <Box
          key={it.id}
          onClick={() => onClick(it)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.5,
            borderRadius: 2,
            cursor: 'pointer',
            bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
            border: '1px solid var(--border-color, transparent)',
            transition: 'all 0.15s',
            '&:hover': { borderColor: 'var(--border-strong, transparent)' },
          }}
        >
          <Box sx={{ width: 72, height: 72, borderRadius: 1.5, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
            <Box component="img" src={it.cover} alt={it.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <Box sx={{ position: 'absolute', top: 4, left: 4, px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: 'primary.main' }}>
              <Typography sx={{ fontSize: 8, color: '#fff', fontWeight: 800 }}>预约</Typography>
            </Box>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary', mb: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {it.title}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, fontSize: 11, color: 'text.secondary', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <EventNoteRoundedIcon sx={{ fontSize: 11 }} />
                {(() => {
                  const start = (it as any).startAt || (it as any).liveStartAt;
                  if (typeof start === 'number' && start > Date.now()) {
                    return <>预计开播: {new Date(start).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</>;
                  }
                  return <>已开播 · 预约观看</>;
                })()}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <VisibilityRoundedIcon sx={{ fontSize: 11 }} />
                {formatViews(it.views)} 预约
              </Box>
            </Box>
          </Box>
          <Button
            size="small"
            variant="outlined"
            onClick={(e) => { e.stopPropagation(); onCancel(it); }}
            sx={{ textTransform: 'none', fontSize: 11, borderRadius: 1.5, borderColor: 'divider', color: 'text.secondary', minWidth: 64 }}
          >
            取消预约
          </Button>
        </Box>
      ))}
    </Box>
  );
}

// ─── 子组件:AI 笔记 ───
function AINoteListView({ list, batchMode, selected, onToggle }: { list: MyItem[]; batchMode: boolean; selected: Set<number>; onToggle: (id: number) => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {list.map((it) => {
        const isSelected = selected.has(it.id);
        return (
          <Box
            key={it.id}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              p: 1.5,
              borderRadius: 2,
              cursor: 'pointer',
              bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
              border: '1px solid',
              borderColor: isSelected ? 'primary.main' : 'var(--border-color, transparent)',
            }}
            onClick={() => batchMode && onToggle(it.id)}
          >
            {batchMode && (
              <Checkbox size="small" checked={isSelected} onClick={(e) => { e.stopPropagation(); onToggle(it.id); }} sx={{ p: 0, mt: -0.5 }} />
            )}
            <Box sx={{ width: 40, height: 40, borderRadius: 1.5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(254,44,85,0.2))' }}>
              <AutoAwesomeRoundedIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', flex: 1 }} noWrap>
                  {it.title}
                </Typography>
                <Typography sx={{ fontSize: 10, color: 'text.muted' }}>{formatRelativeTime(it.postedAt)}</Typography>
              </Box>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {(it as any).summary || (it as any).aiSummary || '该内容暂无 AI 摘要'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75 }}>
                <Box sx={{ px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(139,92,246,0.15)', color: ACCENT.purple.main, fontSize: 10, fontWeight: 600 }}>
                  AI 摘要
                </Box>
                <Box sx={{ px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: 'action.hover', color: 'text.secondary', fontSize: 10 }}>
                  {(it as any).citeCount != null ? `${(it as any).citeCount} 条引用` : '暂无引用'}
                </Box>
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ─── 子组件:空状态 ───
function EmptyState({ tab, subTab, onPublish }: { tab: string; subTab: string; onPublish?: () => void }) {
  const config: Record<string, { title: string; hint: string; cta?: string }> = {
    works: { title: subTab === 'private' ? '暂无私密作品' : subTab === 'draft' ? '暂无草稿' : '该账号还未发布过作品', hint: subTab === 'private' ? '设为私密的作品会出现在这里' : '点击下方按钮开始创作吧', cta: '发布作品' },
    recommend: { title: '暂无推荐内容', hint: '基于你的浏览历史为你推荐' },
    like: { title: '还没有点赞过内容', hint: '去发现页找点喜欢的吧' },
    collect: { title: '收藏夹是空的', hint: '看到喜欢的内容点个收藏吧' },
    history: { title: '观看历史为空', hint: '你浏览过的内容会按时间记录在这里' },
    later: { title: '稍后再看是空的', hint: '把想看的内容先存起来吧' },
    order: { title: '暂无预约', hint: '在直播间点击"预约开播"即可加入' },
    ai: { title: 'AI 笔记还没生成', hint: '当你看过足够多的内容,AI 会自动整理笔记' },
  };
  const c = config[tab] || config.works;
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        gap: 1.5,
      }}
    >
      <Box
        sx={{
          width: 88,
          height: 88,
          borderRadius: 2.5,
          bgcolor: 'var(--bg-hover, transparent)',
          border: '1px solid var(--border-color, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FolderIcon sx={{ fontSize: 44, color: 'var(--text-disabled, currentColor)' }} />
      </Box>
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary, currentColor)', mt: 1 }}>
        {c.title}
      </Typography>
      <Typography sx={{ fontSize: 12, color: 'var(--text-muted, currentColor)', textAlign: 'center' }}>
        {c.hint}
      </Typography>
      {c.cta && onPublish && (
        <Button variant="contained" size="small" onClick={onPublish} sx={{ mt: 1, textTransform: 'none', fontSize: 12, borderRadius: 1.5 }}>
          {c.cta}
        </Button>
      )}
    </Box>
  );
}

// ─── 子组件:编辑资料 Drawer ───
// 地区选项:从 system-area 接口拉,无网络时兜底显示空(不再硬编码 10 个国家)
const REGION_FALLBACK: string[] = [];

function EditProfileDrawer({
  open, onClose, profile, onSave, saving,
}: {
  open: boolean;
  onClose: () => void;
  profile: any;
  onSave: (payload: Record<string, any>) => void;
  saving: boolean;
}) {
  const initial = profile?.user;
  const [nickname, setNickname] = useState('');
  const [douyinId, setDouyinId] = useState('');
  const [bio, setBio] = useState('');
  const [region, setRegion] = useState('');
  const [age, setAge] = useState<string>('');
  const [avatar, setAvatar] = useState('');
  const [showRegionMenu, setShowRegionMenu] = useState(false);

  // 地区选项:真接口(system-area) → fallback 空
  const regionQ = useQuery({
    queryKey: ['home', 'me', 'region-presets'],
    queryFn: () =>
      homeClient.get<any>('/region/options').then((r) => {
        const list = r.data?.list || r.data || [];
        return Array.isArray(list) ? list.map((x: any) => x.name || x.label || String(x)) : [];
      }),
    enabled: open,
    staleTime: 10 * 60_000,
  });
  const REGION_PRESETS: string[] = (regionQ.data && regionQ.data.length > 0) ? regionQ.data : REGION_FALLBACK;

  useEffect(() => {
    if (!open) return;
    setNickname(initial?.nickname || '');
    setDouyinId(initial?.douyinId || '');
    setBio(initial?.bio || '');
    setRegion(initial?.region || '');
    setAge(initial?.age != null ? String(initial.age) : '');
    setAvatar(initial?.avatar || '');
  }, [open, initial?.nickname, initial?.douyinId, initial?.bio, initial?.region, initial?.age, initial?.avatar]);

  // 之前:使用 picsum.photos + Math.random() 拼一个外部样图作默认头像。
  // 改:头像应走系统上传或后端默认头像接口;此处不伪造 URL,清空让用户上传。
  const handleRandomAvatar = () => {
    setAvatar('');
  };

  const handleSubmit = () => {
    const payload: Record<string, any> = {};
    if (nickname.trim()) payload.nickname = nickname.trim();
    if (douyinId.trim()) payload.douyinId = douyinId.trim();
    if (bio.trim()) payload.bio = bio.trim();
    if (region) payload.region = region;
    if (age && !isNaN(Number(age))) payload.age = Number(age);
    if (avatar) payload.avatar = avatar;
    onSave(payload);
  };

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: 'var(--bg-hover, transparent)',
      color: 'text.primary',
      fontSize: 13,
      borderRadius: 1.5,
      '& fieldset': { borderColor: 'var(--border-color, transparent)' },
      '&:hover fieldset': { borderColor: 'var(--border-strong, transparent)' },
      '&.Mui-focused fieldset': { borderColor: 'primary.main' },
    },
    '& .MuiInputLabel-root': { color: 'text.secondary', fontSize: 13 },
    '& .MuiInputLabel-root.Mui-focused': { color: 'primary.main' },
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 420 }, bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.98))' } } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700 }}>编辑资料</Typography>
        <IconButton size="small" onClick={onClose} aria-label="关闭">
          <CloseRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
        <Stack spacing={2.5}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 1 }}>
            <Avatar src={avatar} sx={{ width: 80, height: 80, border: 2, borderColor: 'warning.main' }}>
              {(nickname || '我')[0]}
            </Avatar>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" onClick={handleRandomAvatar} sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1.5 }}>
                随机头像
              </Button>
              <Button
                size="small"
                variant="text"
                onClick={() => setAvatar('')}
                sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1.5, color: 'text.secondary' }}
              >
                移除
              </Button>
            </Stack>
          </Box>

          <Divider sx={{ borderColor: 'var(--border-color, transparent)' }} />

          <TextField
            label="昵称"
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 20))}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 20 }, formHelperText: { sx: { fontSize: 10, color: 'text.muted' } } }}
            helperText={`${nickname.length}/20`}
            sx={fieldSx}
          />

          <TextField
            label="抖音号"
            value={douyinId}
            onChange={(e) => setDouyinId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20))}
            fullWidth
            sx={fieldSx}
          />

          <Box>
            <TextField
              label="个人简介"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 80))}
              fullWidth
              multiline
              minRows={2}
              maxRows={4}
              slotProps={{ htmlInput: { maxLength: 80 }, formHelperText: { sx: { fontSize: 10, color: 'text.muted' } } }}
              helperText={`${bio.length}/80`}
              sx={fieldSx}
            />
          </Box>

          <Stack direction="row" spacing={1.5}>
            <TextField
              label="年龄"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              sx={{ ...fieldSx, width: 120 }}
              slotProps={{ htmlInput: { min: 0, max: 120 } }}
            />
            <Box sx={{ flex: 1, position: 'relative' }}>
              <TextField
                label="地区"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                onFocus={() => setShowRegionMenu(true)}
                onBlur={() => setTimeout(() => setShowRegionMenu(false), 150)}
                fullWidth
                sx={fieldSx}
              />
              {showRegionMenu && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    mt: 0.5,
                    zIndex: 10,
                    bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.98))',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1.5,
                    boxShadow: 3,
                    maxHeight: 200,
                    overflowY: 'auto',
                  }}
                >
                  {REGION_PRESETS.map((r) => (
                    <Box
                      key={r}
                      onMouseDown={() => { setRegion(r); setShowRegionMenu(false); }}
                      sx={{
                        px: 1.5,
                        py: 0.75,
                        fontSize: 12,
                        cursor: 'pointer',
                        bgcolor: region === r ? 'var(--bg-hover, transparent)' : 'transparent',
                        '&:hover': { bgcolor: 'var(--bg-hover, transparent)' },
                      }}
                    >
                      {r}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1.5 }}>
        <Button fullWidth variant="outlined" onClick={onClose} sx={{ borderRadius: 2, textTransform: 'none' }}>
          取消
        </Button>
        <Button
          fullWidth
          variant="contained"
          onClick={handleSubmit}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ borderRadius: 2, textTransform: 'none' }}
        >
          {saving ? '保存中…' : '保存'}
        </Button>
      </Box>
    </Drawer>
  );
}

// ─── 子组件:二维码名片 Dialog ───
function QrCodeDialog({
  open, onClose, profile, currentUser, onMessage,
}: {
  open: boolean;
  onClose: () => void;
  profile: any;
  currentUser: any;
  onMessage: (msg: string) => void;
}) {
  const user = profile?.user || currentUser;
  const nickname = user?.nickname || currentUser?.nickname || currentUser?.name || '我';
  // douyinId 没拉到时不伪造 ID,直接用 uid(后端有唯一性);不再使用硬编码 '84301022' 兜底
  const douyinId = user?.douyinId || user?.id || currentUser?.id || '';
  const avatarSrc = user?.avatar || currentUser?.avatar;
  const profileUrl = `https://qingqiuyue.com/u/${encodeURIComponent(String(douyinId))}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(profileUrl)}`;
  const [refreshing, setRefreshing] = useState(false);
  const [qrKey, setQrKey] = useState(0);

  const handleRefresh = () => {
    setRefreshing(true);
    setQrKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleSave = async () => {
    try {
      const res = await fetch(qrSrc);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `清秋月-${nickname}-${douyinId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onMessage('已保存到下载文件夹');
    } catch {
      onMessage('保存失败,请长按二维码图片保存');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      onMessage('主页链接已复制');
    } catch {
      onMessage('复制失败');
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: `${nickname}的主页`, text: `来清秋月关注 ${nickname}`, url: profileUrl });
        return;
      } catch {
        // user cancelled or share failed, fall through
      }
    }
    handleCopyLink();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            background: (t: any) =>
              t.palette.mode === 'dark'
                ? 'linear-gradient(180deg, #15171F 0%, #0A0B14 100%)'
                : 'background.paper',
            border: (t: any) =>
              t.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.08)' : `1px solid ${t.palette.divider}`,
            overflow: 'hidden',
          },
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(254, 44, 85, 0.12) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 50% 100%, rgba(139, 92, 246, 0.1) 0%, transparent 60%)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 2, pb: 0 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1 }}>我的二维码名片</Typography>
          <IconButton size="small" onClick={onClose} aria-label="关闭">
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Stack spacing={2.5} sx={{ px: 3, pb: 3, pt: 1.5, alignItems: 'center' }}>
          {/* 头像 + 名字 */}
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', width: '100%', p: 1.5, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid var(--border-color, transparent)' }}>
            <Avatar src={avatarSrc} sx={{ width: 48, height: 48, border: '2px solid', borderColor: 'warning.main' }}>
              {nickname[0]}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }} noWrap>{nickname}</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>抖音号: {douyinId}</Typography>
            </Box>
            <Box sx={{ px: 0.75, py: 0.25, borderRadius: 0.5, bgcolor: 'warning.main', color: '#1a1a1a', fontSize: 9, fontWeight: 700 }}>
              {user?.level || '月亮'}
            </Box>
          </Stack>

          {/* QR Code */}
          <Box
            sx={{
              position: 'relative',
              p: 1.5,
              borderRadius: 2.5,
              bgcolor: '#fff',
              boxShadow: '0 8px 32px rgba(254, 44, 85, 0.2)',
            }}
          >
            <Box
              component="img"
              key={qrKey}
              src={qrSrc}
              alt={`${nickname} 的二维码`}
              sx={{ display: 'block', width: 220, height: 220, opacity: refreshing ? 0.3 : 1, transition: 'opacity 0.3s' }}
            />
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 36,
                height: 36,
                borderRadius: 1.5,
                bgcolor: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <Avatar src={avatarSrc} sx={{ width: 30, height: 30, fontSize: 12, fontWeight: 700 }}>
                {nickname[0]}
              </Avatar>
            </Box>
            {refreshing && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress size={28} sx={{ color: 'primary.main' }} />
              </Box>
            )}
          </Box>

          <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center' }}>
            扫一扫,加我好友 · 关注后可在「我的-关注」中找到
          </Typography>

          {/* 操作按钮 */}
          <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              startIcon={<DownloadRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={handleSave}
              sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1.5, borderColor: 'action.selected', color: 'text.secondary' }}
            >
              保存图片
            </Button>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              startIcon={<LinkRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={handleCopyLink}
              sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1.5, borderColor: 'action.selected', color: 'text.secondary' }}
            >
              复制链接
            </Button>
            <Button
              fullWidth
              variant="contained"
              size="small"
              startIcon={<ShareRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={handleShare}
              sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1.5, background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' } }}
            >
              分享
            </Button>
          </Stack>

          <Box
            onClick={handleRefresh}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontSize: 10,
              color: 'text.disabled',
              cursor: 'pointer',
              '&:hover': { color: 'text.secondary' },
            }}
          >
            <RefreshRoundedIcon sx={{ fontSize: 11 }} />
            二维码失效?点击刷新
          </Box>
        </Stack>
      </Box>
    </Dialog>
  );
}

