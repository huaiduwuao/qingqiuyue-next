'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import Skeleton from '@mui/material/Skeleton';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import DownloadIcon from '@mui/icons-material/Download';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import TabletIcon from '@mui/icons-material/Tablet';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import HomeIcon from '@mui/icons-material/Home';
import PersonIcon from '@mui/icons-material/Person';
import StarIcon from '@mui/icons-material/Star';
import { ThemeProvider } from '@mui/material/styles';
import { darkTheme } from '@/styles/theme';
import { useApp } from '@/contexts/AppContext';
import { updateUser } from '@/apis/account';
import { adminClient, isAuthError, formatApiError } from '@/lib/api/client';
import { ACCENT } from '@/constants/accents';
import { CTA_GRADIENT, gradient2 } from '@/constants/gradients';
import { ListLayout, ListLayoutSwitch, LIST_ROW } from '@/components/common/ListLayout';

// 壁纸域占位:后端 `/api/core/wallpaper/*` 就绪后,以下数据/类型替换为 API 调用
type WallpaperCategory = 'all' | 'abstract' | 'anime' | 'scenery' | 'stars' | 'minimal' | 'cyber' | 'other';
type WallpaperSize = 'desktop' | 'tablet' | 'mobile' | 'all';
interface Wallpaper {
  id: string;
  title: string;
  category: WallpaperCategory;
  tags: string[];
  source: 'gradient' | 'image';
  bg: string;
  accent: string;
  author: string;
  usage: number;
  /** 文件体积:库里没存,后端回 0,为 0 时不显示 */
  sizeMb: number;
  /** 原图宽高(后端从 content 里的 "4000x2670" 解析),未知为 0 */
  width?: number;
  height?: number;
  desc: string;
  sizes: WallpaperSize[];
  official: boolean;
  releaseTime: string;
}
interface MyWallpaper {
  id: string;
  appliedTo: 'home' | 'account' | 'none';
  setAt: string;
}
// 主题的展示元数据(配色/英文名)。哪些主题真的有图由后端返回的 categories 决定 ——
// 以前这里写死 6 个主题,而后端把每一张图都归到了不在这份名单里的 abstract,
// 结果除「全部」外 5 个主题永远是 0。
const WALLPAPER_CATEGORIES: Array<{
  key: WallpaperCategory;
  label: string;
  sub: string;
  accent: string;
}> = [
  { key: 'all', label: '全部', sub: 'All', accent: '#8B5CF6' },
  { key: 'anime', label: '动漫', sub: 'Anime', accent: '#EC4899' },
  { key: 'scenery', label: '风景', sub: 'Scenery', accent: '#10B981' },
  { key: 'stars', label: '星空', sub: 'Stars', accent: '#3B82F6' },
  { key: 'minimal', label: '简约', sub: 'Minimal', accent: '#F59E0B' },
  { key: 'cyber', label: '赛博', sub: 'Cyber', accent: '#EF4444' },
  { key: 'abstract', label: '抽象', sub: 'Abstract', accent: '#A78BFA' },
  { key: 'other', label: '其它', sub: 'Other', accent: '#94A3B8' },
];

const CATEGORY_META = new Map(WALLPAPER_CATEGORIES.map((c) => [c.key, c]));

/** 分辨率(4000×2670)—— 文件体积库里没有,用分辨率代替那句写死的「2.5 MB」。 */
function formatResolution(wp: Pick<Wallpaper, 'width' | 'height'>): string {
  if (!wp.width || !wp.height) return '';
  return `${wp.width}×${wp.height}`;
}
const WALLPAPERS: Wallpaper[] = [];

/** 每次向后端要多少张,以及最多翻几页(兜底,避免 total 异常时死循环)。 */
const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const MY_WALLPAPERS: MyWallpaper[] = [];

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// bgCss 把 wp.bg 转成合法的 CSS background 值。
// source === 'image' 时 bg 是图片 URL(MinIO),必须包成 url(...) 才能显示;
// source === 'gradient' 时 bg 本身就是渐变字符串,直接当 CSS 值用。
// 此前一律 `background: wp.bg`,图片 URL 是裸字符串、不是合法 CSS,导致图片壁纸显示不出来。
function bgCss(wp: Pick<Wallpaper, 'bg' | 'source'>): string {
  if (wp.source === 'image' && wp.bg) {
    return `url("${wp.bg}") center/cover no-repeat`;
  }
  return wp.bg;
}

const SIZE_ICON: Record<Wallpaper['sizes'][number], { Icon: React.ComponentType<{ sx?: any }>; label: string }> = {
  desktop: { Icon: DesktopWindowsIcon, label: '桌面' },
  tablet: { Icon: TabletIcon, label: '平板' },
  mobile: { Icon: PhoneIphoneIcon, label: '手机' },
  all: { Icon: DesktopWindowsIcon, label: '通用' },
};

function WallpaperPageContent() {
  const router = useRouter();
  const { currentUser } = useApp();
  const [activeCat, setActiveCat] = useState<WallpaperCategory | 'all'>('all');
  const [sort, setSort] = useState<'new' | 'hot' | 'size'>('hot');
  // 之前这里预置了 w006 / w009 两个并不存在的 id,页面一打开就有两颗心是亮的。
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [myWallpapers, setMyWallpapers] = useState<MyWallpaper[]>(MY_WALLPAPERS);
  const [detail, setDetail] = useState<Wallpaper | null>(null);
  const [toast, setToast] = useState<{ open: boolean; msg: string }>({ open: false, msg: '' });

  // 真实 API:加载壁纸分类 + 列表
  const [categories, setCategories] = useState<Array<{ key: WallpaperCategory; label: string; sub: string; accent: string }>>(WALLPAPER_CATEGORIES);
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>(WALLPAPERS);
  const [loading, setLoading] = useState(true);
  // 每个主题真实有多少张(后端按标签算好给的,不是只数当前这一页)
  const [catCounts, setCatCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // axios interceptor 返回 { code, data }，apiRes.data 包含 { code, data }
        // 后端返回 { code: 0, data: { list, total, page, pageSize, categories } }
        type WallpaperPayload = { list?: any[]; items?: any[]; categories?: any[]; total?: number };
        const fetchPage = async (page: number): Promise<WallpaperPayload> => {
          const apiRes = await adminClient.get<{ code?: number; data?: WallpaperPayload } & WallpaperPayload>(
            `/wallpaper/list?page=${page}&page_size=${PAGE_SIZE}`,
          );
          const raw = apiRes.data;
          // 实际数据在 raw.data 里（interceptor 把后端 body 包了一层）
          return {
            list: raw?.data?.list ?? raw?.list ?? [],
            items: raw?.data?.items ?? raw?.items ?? [],
            categories: raw?.data?.categories ?? raw?.categories ?? undefined,
            total: raw?.data?.total ?? raw?.total ?? 0,
          };
        };

        const first = await fetchPage(1);
        if (cancelled) return;
        const items = [...((first.list?.length ? first.list : first.items) ?? [])] as Wallpaper[];
        const total = first.total ?? 0;
        // 以前只取默认的第一页(30 条),多出来的壁纸在页面上根本不存在。
        // 壁纸总量是百量级,按页取完即可;MAX_PAGES 兜住异常的 total。
        for (let page = 2; items.length < total && page <= MAX_PAGES; page++) {
          const more = await fetchPage(page);
          if (cancelled) return;
          const rows = ((more.list?.length ? more.list : more.items) ?? []) as Wallpaper[];
          if (rows.length === 0) break;
          items.push(...rows);
        }

        // 主题栏:后端给的是「这个主题有几张」,只把真的有图的列出来。
        // 全站只剩一个「其它」时不摆主题栏 —— 一个永远全选中的筛选没有意义。
        const counts: Record<string, number> = {};
        for (const c of first.categories ?? []) {
          const key = String(c?.key ?? '');
          if (key) counts[key] = Number(c?.count ?? 0);
        }
        counts.all = total;
        const themed = (first.categories ?? [])
          .map((c: any) => CATEGORY_META.get(String(c?.key ?? '') as WallpaperCategory))
          .filter((c): c is NonNullable<typeof c> => !!c && c.key !== 'all');
        const onlyOther = themed.length <= 1 && themed[0]?.key === 'other';
        setCatCounts(counts);
        setCategories([WALLPAPER_CATEGORIES[0], ...(onlyOther ? [] : themed)]);
        setWallpapers(items);
      } catch (err) {
        if (!cancelled) {
          if (isAuthError(err)) {
            setToast({ open: true, msg: '登录已过期,请重新登录' });
          } else {
            setToast({ open: true, msg: formatApiError(err) || '加载壁纸失败' });
          }
          // 保留默认分类
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentApplied = myWallpapers.find((m) => m.appliedTo === 'home');
  const currentWallpaper = useMemo(
    () => wallpapers.find((w) => w.id === currentApplied?.id) ?? wallpapers[0] ?? null,
    [currentApplied, wallpapers],
  );

  // 头图那行副标题:文件体积后端没有(回 0),这时用分辨率代替,两者都没有就整段不显示,
  // 不再对每张图都写死一句「2.5 MB」。
  const heroMeta = useMemo(() => {
    const wp = currentWallpaper;
    if (!wp) return '';
    if (wp.sizeMb > 0) return `${wp.sizeMb.toFixed(1)} MB`;
    return formatResolution(wp);
  }, [currentWallpaper]);

  // 无数据时的默认展示
  const defaultWallpaper: Wallpaper = useMemo(() => ({
    id: 'default',
    title: '青丘阅官方壁纸',
    category: 'abstract' as WallpaperCategory,
    tags: ['官方', '默认'],
    source: 'gradient' as const,
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    accent: '#8B5CF6',
    author: '清秋月官方',
    usage: 0,
    sizeMb: 0,
    desc: '暂无壁纸数据，请稍后再试',
    sizes: ['all'] as WallpaperSize[],
    official: true,
    releaseTime: new Date().toISOString(),
  }), []);

  const filtered = useMemo(() => {
    let list = activeCat === 'all' ? wallpapers : wallpapers.filter((w) => w.category === activeCat);
    if (sort === 'new') list = [...list].sort((a, b) => +new Date(b.releaseTime) - +new Date(a.releaseTime));
    if (sort === 'hot') list = [...list].sort((a, b) => b.usage - a.usage);
    // 「体积」按分辨率排:文件体积后端没有(以前每张都是写死的 2.5MB,这一档等于没排)。
    if (sort === 'size') {
      const px = (w: Wallpaper) => (w.width || 0) * (w.height || 0);
      list = [...list].sort((a, b) => px(b) - px(a));
    }
    return list;
  }, [activeCat, sort, wallpapers]);

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/home/recommend');
    }
  };

  const toggleFavorite = async (id: string) => {
    const next = new Set(favorites);
    const adding = !next.has(id);
    if (adding) next.add(id);
    else next.delete(id);
    setFavorites(next);
    if (!currentUser?.id) {
      setToast({ open: true, msg: '请先登录后收藏壁纸' });
      return;
    }
    try {
      await updateUser({ favoriteWallpapers: Array.from(next) });
      setToast({ open: true, msg: adding ? '已收藏' : '已取消收藏' });
    } catch (err) {
      setToast({ open: true, msg: formatApiError(err) });
    }
  };

  const handleApply = async (wp: Wallpaper, target: 'home' | 'account') => {
    const cleared = myWallpapers.filter((m) => m.appliedTo !== target);
    const existing = myWallpapers.find((m) => m.id === wp.id);
    const updated: MyWallpaper = existing
      ? { ...existing, appliedTo: target, setAt: new Date().toISOString() }
      : { id: wp.id, appliedTo: target, setAt: new Date().toISOString() };
    setMyWallpapers([updated, ...cleared]);
    if (!currentUser?.id) {
      setToast({ open: true, msg: '请先登录后应用壁纸' });
      return;
    }
    try {
      await updateUser({ [target === 'home' ? 'homeWallpaper' : 'profileWallpaper']: wp.id });
      setToast({ open: true, msg: `已设为${target === 'home' ? '主页' : '个人中心'}背景` });
    } catch (err) {
      setToast({ open: true, msg: formatApiError(err) });
    }
  };

  const handleSave = async (wp: Wallpaper) => {
    if (myWallpapers.find((m) => m.id === wp.id)) {
      setToast({ open: true, msg: '该壁纸已在「我的壁纸」中' });
      return;
    }
    const next: MyWallpaper[] = [{ id: wp.id, appliedTo: 'none', setAt: new Date().toISOString() }, ...myWallpapers];
    setMyWallpapers(next);
    if (!currentUser?.id) {
      setToast({ open: true, msg: '请先登录后保存壁纸' });
      return;
    }
    try {
      await updateUser({ savedWallpapers: next.map((m) => m.id) });
      setToast({ open: true, msg: `已收藏《${wp.title}》` });
    } catch (err) {
      setToast({ open: true, msg: formatApiError(err) });
    }
  };

  // 下载壁纸:后端没有 /wallpaper/download(只有 /wallpaper/list),图片地址就在列表数据里。
  const handleDownload = (wp: Wallpaper) => {
    if (!wp.bg) {
      setToast({ open: true, msg: '这张壁纸暂无可下载的图片' });
      return;
    }
    const a = document.createElement('a');
    a.href = wp.bg;
    a.download = `${wp.title}.png`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setToast({ open: true, msg: `已下载《${wp.title}》` });
  };


  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: '#0a0a0f',
        color: 'rgba(255,255,255,0.92)',
        overflowX: 'hidden',
        position: 'relative',
      }}
    >
      {/* 顶部固定栏 */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          minHeight: 60,
          pt: 'var(--sat, 0px)',
          px: { xs: 2, md: 4 },
          bgcolor: 'rgba(10, 10, 15, 0.7)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <IconButton onClick={handleBack} size="small" aria-label="返回" sx={{ color: 'rgba(255,255,255,0.75)' }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
          壁纸库
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          component={Link}
          href="/home/recommend"
          size="small"
          sx={{
            textTransform: 'none',
            fontSize: 12,
            color: 'rgba(255,255,255,0.6)',
            '&:hover': { color: 'rgba(255,255,255,0.95)', bgcolor: 'rgba(255,255,255,0.06)' },
          }}
        >
          回到首页
        </Button>
      </Box>

      {/* Hero:当前壁纸预览 */}
      <Box
        sx={{
          position: 'relative',
          pt: { xs: 4, md: 6 },
          pb: { xs: 4, md: 6 },
          px: { xs: 2, md: 4 },
          overflow: 'hidden',
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 60% 50% at 20% 10%, rgba(139, 92, 246, 0.18) 0%, transparent 60%), ' +
              'radial-gradient(ellipse 50% 40% at 80% 20%, rgba(254, 44, 85, 0.15) 0%, transparent 60%)',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'relative',
            maxWidth: 'var(--page-max)',
            mx: 'auto',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1.1fr' },
            gap: { xs: 4, md: 5 },
            alignItems: 'center',
          }}
        >
          <Box>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: '#FFB400',
                  boxShadow: '0 0 12px #FFB400',
                  animation: 'dot-pulse 1.6s ease-in-out infinite',
                  '@keyframes dot-pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.4 },
                  },
                }}
              />
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', letterSpacing: 2, textTransform: 'uppercase' }}>
                Wallpaper Library · 官方 + 创作者投稿
              </Typography>
            </Box>

            <Typography
              sx={{
                fontSize: { xs: 32, md: 48 },
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: -1,
                background: 'linear-gradient(135deg, #fff 0%, #C4B5FD 60%, #25F4EE 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                mb: 2,
              }}
            >
              选一张壁纸<br />
              换一种心情
            </Typography>

            <Typography
              sx={{
                fontSize: { xs: 14, md: 15 },
                color: 'rgba(255,255,255,0.6)',
                lineHeight: 1.7,
                mb: 3,
                maxWidth: 480,
              }}
            >
              {categories.length > 1 ? `${categories.length - 1} 大主题、` : ''}{wallpapers.length} 款精选壁纸,一键应用到主页或个人中心。
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label="4K 高清"
                sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600, height: 24, '& .MuiChip-label': { px: 1.25 } }}
              />
              <Chip
                size="small"
                label="每周更新"
                sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: 500, height: 24, '& .MuiChip-label': { px: 1.25 } }}
              />
              <Chip
                size="small"
                icon={<CheckCircleIcon sx={{ fontSize: 12, color: '#5DDB96 !important' }} />}
                label="官方 + UGC 双重审核"
                sx={{ bgcolor: 'rgba(93, 219, 150, 0.12)', color: '#5DDB96', fontSize: 11, fontWeight: 600, height: 24, border: '1px solid rgba(93, 219, 150, 0.3)', '& .MuiChip-label': { px: 0.5 } }}
              />
            </Box>
          </Box>

          {/* 当前壁纸预览卡 */}
          <Box
            sx={{
              position: 'relative',
              p: { xs: 2, md: 2.5 },
              borderRadius: 3.5,
              bgcolor: 'rgba(20, 22, 32, 0.5)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Box
                sx={{
                  width: 4,
                  height: 18,
                  borderRadius: 2,
                  background: gradient2('#FFB400', '#FE2C55'),
                  boxShadow: '0 0 8px rgba(255, 180, 0, 0.4)',
                }}
              />
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                Current · 主页背景
              </Typography>
            </Box>
            <Box
              sx={{
                position: 'relative',
                aspectRatio: '16/10',
                borderRadius: 2.5,
                overflow: 'hidden',
                background: bgCss(currentWallpaper ?? defaultWallpaper),
                boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                mb: 2,
              }}
            >
              <Box
                aria-hidden
                sx={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 50%)',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  px: 1,
                  py: 0.25,
                  borderRadius: 1,
                  bgcolor: 'rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(8px)',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                LIVE PREVIEW
              </Box>
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 12,
                  left: 12,
                  right: 12,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  gap: 1,
                }}
              >
                <Box>
                  <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                    {(currentWallpaper ?? defaultWallpaper).title}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                    {(currentWallpaper ?? defaultWallpaper).author}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {(currentWallpaper ?? defaultWallpaper).sizes.map((s) => {
                    const { Icon } = SIZE_ICON[s];
                    return (
                      <Box
                        key={s}
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: 1,
                          bgcolor: 'rgba(0,0,0,0.4)',
                          backdropFilter: 'blur(8px)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                        }}
                      >
                        <Icon sx={{ fontSize: 13 }} />
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', flex: 1 }}>
                {formatCount((currentWallpaper ?? defaultWallpaper).usage)} 人正在使用{heroMeta ? ` · ${heroMeta}` : ''}
              </Typography>
              {currentApplied && (
                <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                  {formatDate(currentApplied.setAt)} 应用
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* 分类 + 排序 */}
      <Box sx={{ px: { xs: 2, md: 4 }, pb: 2, position: 'sticky', top: 60, zIndex: 5, bgcolor: 'rgba(10, 10, 15, 0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Box sx={{ maxWidth: 'var(--page-max)', mx: 'auto', display: 'flex', alignItems: 'center', gap: 1, py: 1.5, flexWrap: 'wrap' }}>
          {/* 分类统一由 categories state 驱动(含 all 项,支持后端动态返回),
              不再硬编码单独的「全部」按钮 —— 此前与 categories[0] 重复渲染出两个「全部」。 */}
          {categories.filter((c) => c.key === 'all').map((c) => (
            <Box
              key={c.key}
              onClick={() => setActiveCat('all')}
              sx={{
                px: 1.5,
                py: 0.6,
                borderRadius: 1.5,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeCat === 'all' ? 700 : 400,
                color: activeCat === 'all' ? '#fff' : 'rgba(255,255,255,0.55)',
                bgcolor: activeCat === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent',
                transition: 'all 0.15s',
                '&:hover': { color: '#fff' },
              }}
            >
              {c.label}
              <Box component="span" sx={{ ml: 0.5, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                {wallpapers.length}
              </Box>
            </Box>
          ))}
          {categories.filter((c) => c.key !== 'all').map((c) => (
            <Box
              key={c.key}
              onClick={() => setActiveCat(c.key)}
              sx={{
                px: 1.5,
                py: 0.6,
                borderRadius: 1.5,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeCat === c.key ? 700 : 400,
                color: activeCat === c.key ? '#fff' : 'rgba(255,255,255,0.55)',
                bgcolor: activeCat === c.key ? `${c.accent}26` : 'transparent',
                border: '1px solid',
                borderColor: activeCat === c.key ? `${c.accent}66` : 'transparent',
                transition: 'all 0.15s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                '&:hover': { color: '#fff', borderColor: `${c.accent}66` },
              }}
            >
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: c.accent, boxShadow: `0 0 6px ${c.accent}99` }} />
              {c.label}
              <Box component="span" sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                {catCounts[c.key] ?? 0}
              </Box>
            </Box>
          ))}
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {[
              { key: 'hot', label: '热门' },
              { key: 'new', label: '最新' },
              { key: 'size', label: '分辨率' },
            ].map((s) => {
              const isActive = sort === s.key;
              return (
                <Box
                  key={s.key}
                  onClick={() => setSort(s.key as any)}
                  sx={{
                    px: 1,
                    py: 0.4,
                    borderRadius: 1,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'primary.main' : 'rgba(255,255,255,0.45)',
                    '&:hover': { color: isActive ? 'primary.main' : 'rgba(255,255,255,0.7)' },
                  }}
                >
                  {s.label}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* 我的壁纸 */}
      {myWallpapers.length > 0 && (
        <Box sx={{ px: { xs: 2, md: 4 }, py: 3 }}>
          <Box sx={{ maxWidth: 'var(--page-max)', mx: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Box
                sx={{
                  width: 4,
                  height: 18,
                  borderRadius: 2,
                  background: gradient2('#FE2C55', '#FFB400'),
                }}
              />
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                我的壁纸
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                {myWallpapers.length} 张
              </Typography>
            </Box>
            <ListLayout minColumnWidth={260} minColumns={2} gap={12}>
              {myWallpapers.map((m) => {
                const wp = wallpapers.find((w) => w.id === m.id);
                if (!wp) return null;
                return (
                  <MyWallpaperCard
                    key={m.id}
                    wp={wp}
                    meta={m}
                    onClick={() => setDetail(wp)}
                    onApplyHome={() => handleApply(wp, 'home')}
                    onApplyAccount={() => handleApply(wp, 'account')}
                  />
                );
              })}
            </ListLayout>
          </Box>
        </Box>
      )}

      {/* 壁纸库网格 */}
      <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 4, md: 6 } }}>
        <Box sx={{ maxWidth: 'var(--page-max)', mx: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <Box
              sx={{
                width: 4,
                height: 18,
                borderRadius: 2,
                background: gradient2('#8B5CF6', '#25F4EE'),
              }}
            />
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
              精选壁纸
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              共 {filtered.length} 张
            </Typography>
            <ListLayoutSwitch />
          </Box>
          <ListLayout minColumnWidth={220} minColumns={2} gap={12}>
            {filtered.map((wp) => (
              <WallpaperCard
                key={wp.id}
                wp={wp}
                favorited={favorites.has(wp.id)}
                isApplied={myWallpapers.find((m) => m.id === wp.id)?.appliedTo === 'home'}
                onClick={() => setDetail(wp)}
                onToggleFavorite={(e) => {
                  e.stopPropagation();
                  toggleFavorite(wp.id);
                }}
              />
            ))}
          </ListLayout>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      <Box sx={{ py: 4, px: { xs: 2, md: 4 }, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          © 2026 清秋月 · 壁纸由官方与创作者共同贡献 · 创作者投稿请联系运营
        </Typography>
      </Box>

      {/* 详情弹窗 */}
      <Dialog
        open={!!detail}
        onClose={() => setDetail(null)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'rgba(20, 22, 32, 0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 3,
              overflow: 'hidden',
              backgroundImage: 'none',
            },
          },
        }}
      >
        {detail && (
          <DetailContent
            wp={detail}
            favorited={favorites.has(detail.id)}
            onToggleFavorite={() => toggleFavorite(detail.id)}
            onApply={(target) => handleApply(detail, target)}
            onSave={() => handleSave(detail)}
            onClose={() => setDetail(null)}
            currentApplied={myWallpapers.find((m) => m.id === detail.id)?.appliedTo ?? 'none'}
          />
        )}
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={2000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          icon={<CheckCircleIcon sx={{ fontSize: 18 }} />}
          sx={{ bgcolor: 'rgba(20, 22, 32, 0.95)', color: '#fff', border: '1px solid rgba(93, 219, 150, 0.4)' }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>

      {/* Loading 遮罩 */}
      {loading && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            bgcolor: 'rgba(10, 10, 15, 0.9)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <CircularProgress size={40} sx={{ color: '#8B5CF6' }} />
          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
            加载壁纸库...
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function WallpaperCard({
  wp,
  favorited,
  isApplied,
  onClick,
  onToggleFavorite,
}: {
  wp: Wallpaper;
  favorited: boolean;
  isApplied: boolean;
  onClick: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': {
          transform: 'translateY(-3px)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
        },
        '&:hover .wp-actions': { opacity: 1 },
        [LIST_ROW]: {
          display: 'flex',
          alignItems: 'stretch',
          bgcolor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '16/10',
          background: bgCss(wp),
          [LIST_ROW]: { width: { xs: 120, sm: 200 }, flexShrink: 0 },
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15), transparent 50%)',
          }}
        />
        {/* 顶部 chips */}
        <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          {wp.official ? (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.25,
                px: 0.75,
                py: 0.25,
                borderRadius: 0.75,
                bgcolor: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              <StarIcon sx={{ fontSize: 10, color: '#FFD566' }} />
              官方
            </Box>
          ) : (
            <Box />
          )}
          <IconButton
            className="wp-actions"
            size="small"
            onClick={onToggleFavorite}
            sx={{
              width: 28,
              height: 28,
              bgcolor: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
              color: favorited ? '#FE2C55' : '#fff',
              opacity: 0,
              transition: 'opacity 0.2s',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
            }}
          >
            {favorited ? <FavoriteIcon sx={{ fontSize: 14 }} /> : <FavoriteBorderIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Box>

        {/* 底部信息 */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            p: 1.25,
            background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.75) 100%)',
            [LIST_ROW]: { display: 'none' },
          }}
        >
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              lineHeight: 1.2,
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {wp.title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
            <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
              {formatCount(wp.usage)} 使用
            </Typography>
            {isApplied && <AppliedBadge />}
          </Box>
        </Box>
      </Box>
      {/* 列表样式:标题移到右侧 */}
      <Box
        sx={{
          display: 'none',
          [LIST_ROW]: { flex: 1, minWidth: 0, p: 1.5, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.5 },
        }}
      >
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#fff', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {wp.title}
        </Typography>
        {wp.desc && (
          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {wp.desc}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            {formatCount(wp.usage)} 使用
          </Typography>
          {isApplied && <AppliedBadge />}
        </Box>
      </Box>
    </Box>
  );
}

function AppliedBadge() {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        px: 0.5,
        py: 0.1,
        borderRadius: 0.5,
        bgcolor: '#5DDB96',
        color: '#0a0a0f',
        fontSize: 9,
        fontWeight: 700,
      }}
    >
      <CheckCircleIcon sx={{ fontSize: 9 }} />
      应用中
    </Box>
  );
}

function MyWallpaperCard({
  wp,
  meta,
  onClick,
  onApplyHome,
  onApplyAccount,
}: {
  wp: Wallpaper;
  meta: MyWallpaper;
  onClick: () => void;
  onApplyHome: () => void;
  onApplyAccount: () => void;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': { transform: 'translateY(-2px)' },
        '&:hover .my-actions': { opacity: 1 },
        [LIST_ROW]: {
          display: 'flex',
          alignItems: 'stretch',
          bgcolor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '16/10',
          background: bgCss(wp),
          [LIST_ROW]: { width: { xs: 120, sm: 200 }, flexShrink: 0 },
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15), transparent 50%)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 6,
            left: 6,
            right: 6,
            display: 'flex',
            gap: 0.5,
            flexWrap: 'wrap',
          }}
        >
          {meta.appliedTo === 'home' && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.25,
                px: 0.5,
                py: 0.15,
                borderRadius: 0.5,
                bgcolor: '#5DDB96',
                color: '#0a0a0f',
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              <HomeIcon sx={{ fontSize: 9 }} />
              主页
            </Box>
          )}
          {meta.appliedTo === 'account' && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.25,
                px: 0.5,
                py: 0.15,
                borderRadius: 0.5,
                bgcolor: ACCENT.purple.main,
                color: '#fff',
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              <PersonIcon sx={{ fontSize: 9 }} />
              个人
            </Box>
          )}
        </Box>
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            p: 1.25,
            background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.75) 100%)',
            [LIST_ROW]: { display: 'none' },
          }}
        >
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>
            {wp.title}
          </Typography>
          <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', mt: 0.25 }}>
            {formatDate(meta.setAt)} 收藏
          </Typography>
        </Box>
        {/* 快捷操作 hover 显示 */}
        <Box
          className="my-actions"
          sx={{
            position: 'absolute',
            right: 6,
            bottom: 6,
            display: 'flex',
            gap: 0.5,
            opacity: 0,
            transition: 'opacity 0.2s',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <IconButton
            size="small"
            onClick={onApplyHome}
            sx={{
              width: 26,
              height: 26,
              bgcolor: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(8px)',
              color: meta.appliedTo === 'home' ? '#5DDB96' : '#fff',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
            }}
          >
            <HomeIcon sx={{ fontSize: 13 }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={onApplyAccount}
            sx={{
              width: 26,
              height: 26,
              bgcolor: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(8px)',
              color: meta.appliedTo === 'account' ? ACCENT.purple.main : '#fff',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
            }}
          >
            <PersonIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Box>
      </Box>
      {/* 列表样式:标题移到右侧 */}
      <Box
        sx={{
          display: 'none',
          [LIST_ROW]: { flex: 1, minWidth: 0, p: 1.5, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.5 },
        }}
      >
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#fff', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {wp.title}
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
          {formatDate(meta.setAt)} 收藏
        </Typography>
      </Box>
    </Box>
  );
}

function DetailContent({
  wp,
  favorited,
  currentApplied,
  onToggleFavorite,
  onApply,
  onSave,
  onClose,
}: {
  wp: Wallpaper;
  favorited: boolean;
  currentApplied: 'home' | 'account' | 'none';
  onToggleFavorite: () => void;
  onApply: (target: 'home' | 'account') => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: 480 }}>
      <Box
        sx={{
          flex: 1.2,
          position: 'relative',
          background: bgCss(wp),
          minHeight: { xs: 220, md: 480 },
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 50%)',
          }}
        />
        <Box sx={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 0.5 }}>
          {wp.official && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.25,
                px: 0.75,
                py: 0.25,
                borderRadius: 0.75,
                bgcolor: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              <StarIcon sx={{ fontSize: 11, color: '#FFD566' }} />
              官方发布
            </Box>
          )}
        </Box>
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            right: 16,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
              {wp.title}
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
              by {wp.author}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {wp.sizes.map((s) => {
              const { Icon, label } = SIZE_ICON[s];
              return (
                <Box
                  key={s}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1.5,
                    bgcolor: 'rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                  }}
                >
                  <Icon sx={{ fontSize: 16 }} />
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
      <Box sx={{ flex: 1, p: { xs: 2.5, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, mb: 0.75 }}>
            Description
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
            {wp.desc}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <DetailRow k="作者" v={wp.author} />
          <DetailRow k="分类" v={CATEGORY_META.get(wp.category)?.label ?? '-'} />
          <DetailRow k="使用人数" v={`${formatCount(wp.usage)} 人`} />
          {wp.sizeMb > 0 ? (
            <DetailRow k="文件大小" v={`${wp.sizeMb.toFixed(1)} MB`} />
          ) : formatResolution(wp) ? (
            <DetailRow k="分辨率" v={formatResolution(wp)} />
          ) : null}
          <DetailRow k="发布时间" v={formatDate(wp.releaseTime)} />
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {wp.tags.map((t) => (
            <Chip
              key={t}
              size="small"
              label={t}
              sx={{
                bgcolor: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 10,
                fontWeight: 500,
                height: 22,
                '& .MuiChip-label': { px: 1 },
              }}
            />
          ))}
        </Box>

        <Box sx={{ flex: 1 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            应用到
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <Button
              variant={currentApplied === 'home' ? 'contained' : 'outlined'}
              onClick={() => onApply('home')}
              startIcon={currentApplied === 'home' ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <HomeIcon sx={{ fontSize: 16 }} />}
              sx={{
                textTransform: 'none',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 1.5,
                py: 1,
                ...(currentApplied === 'home'
                  ? {
                      background: CTA_GRADIENT.RED_YELLOW,
                      color: '#fff',
                      boxShadow: '0 4px 12px rgba(254, 44, 85, 0.3)',
                      '&:hover': { background: CTA_GRADIENT.RED_YELLOW, filter: 'brightness(1.1)' },
                    }
                  : {
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: 'rgba(255,255,255,0.9)',
                      '&:hover': { borderColor: 'rgba(255,255,255,0.4)', bgcolor: 'rgba(255,255,255,0.04)' },
                    }),
              }}
            >
              主页背景
            </Button>
            <Button
              variant={currentApplied === 'account' ? 'contained' : 'outlined'}
              onClick={() => onApply('account')}
              startIcon={currentApplied === 'account' ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <PersonIcon sx={{ fontSize: 16 }} />}
              sx={{
                textTransform: 'none',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 1.5,
                py: 1,
                ...(currentApplied === 'account'
                  ? {
                      background: gradient2(ACCENT.purple.main, '#FE2C55'),
                      color: '#fff',
                      boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                      '&:hover': { filter: 'brightness(1.1)' },
                    }
                  : {
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: 'rgba(255,255,255,0.9)',
                      '&:hover': { borderColor: 'rgba(255,255,255,0.4)', bgcolor: 'rgba(255,255,255,0.04)' },
                    }),
              }}
            >
              个人中心
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              fullWidth
              onClick={onSave}
              startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
              sx={{
                textTransform: 'none',
                fontSize: 13,
                color: 'rgba(255,255,255,0.8)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 1.5,
                py: 1,
                '&:hover': { borderColor: 'rgba(255,255,255,0.25)', bgcolor: 'rgba(255,255,255,0.04)' },
              }}
            >
              收藏到我的
            </Button>
            <IconButton
              onClick={onToggleFavorite}
              sx={{
                border: '1px solid rgba(255,255,255,0.1)',
                color: favorited ? '#FE2C55' : 'rgba(255,255,255,0.7)',
                borderRadius: 1.5,
                '&:hover': { borderColor: 'rgba(255,255,255,0.25)', bgcolor: 'rgba(255,255,255,0.04)' },
              }}
            >
              {favorited ? <FavoriteIcon sx={{ fontSize: 16 }} /> : <FavoriteBorderIcon sx={{ fontSize: 16 }} />}
            </IconButton>
            <Button
              onClick={onClose}
              sx={{
                textTransform: 'none',
                fontSize: 13,
                color: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 1.5,
                px: 2,
                '&:hover': { borderColor: 'rgba(255,255,255,0.25)', bgcolor: 'rgba(255,255,255,0.04)' },
              }}
            >
              关闭
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default function WallpaperPage() {
  return (
    <ThemeProvider theme={darkTheme}>
      <WallpaperPageContent />
    </ThemeProvider>
  );
}

function DetailRow({ k, v }: { k: string; v: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{k}</Typography>
      <Typography sx={{ fontSize: 12, color: '#fff', fontWeight: 500, textAlign: 'right' }}>
        {v}
      </Typography>
    </Box>
  );
}
