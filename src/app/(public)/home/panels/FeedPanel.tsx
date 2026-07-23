'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CheckIcon from '@mui/icons-material/Check';
import AddIcon from '@mui/icons-material/Add';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import ModeCommentOutlinedIcon from '@mui/icons-material/ModeCommentOutlined';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { homeClient, contentClient, formatApiError } from '@/lib/api/client';
import { AsyncState } from '@/components/common/AsyncState';
import { CoverImage } from '@/components/common/CoverImage';
import { FriendPanel } from './FriendPanel';
import SendToSpider from '@/components/SendToSpider';
import { useContentNavigate } from '@/lib/contentRoute';
import { fetchSubcategories, type SubcategoryItem } from '@/apis/home-discover';
import { moduleContentPage } from '@/apis/home';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import Masonry from 'react-masonry-css';

type FeedItem = {
  id: number;
  authorId: number;
  authorName: string;
  authorAvatar: string;
  title: string;
  cover: string;
  durationSec: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  isLive?: boolean;
  liveViewers?: number;
  postedAgoMin: number;
  isFollowing?: boolean;
  isFriend?: boolean;
  category: 'video' | 'live' | 'image' | 'short';
  section: 'recommend' | 'live' | 'music' | 'anime' | 'news' | 'entertainment' | 'tech' | 'food' | 'game' | 'knowledge' | 'sports' | 'finance' | 'novel' | 'comics' | 'film' | 'teleplay';
};

type FeedResp = { list: FeedItem[]; total: number; page: number; size: number };

type SuggestUser = {
  id: number;
  name: string;
  avatar: string;
  douyinId: string;
  bio?: string;
  followers: number;
  verified?: boolean;
  region?: string;
};

const SECTIONS: { key: FeedItem['section']; label: string }[] = [
  { key: 'recommend', label: '推荐' },
  { key: 'novel', label: '小说' },
  { key: 'comics', label: '漫画' },
  { key: 'film', label: '影视' },
  { key: 'teleplay', label: '小剧场' },
  { key: 'entertainment', label: '综艺' },
  { key: 'music', label: '音乐' },
  { key: 'anime', label: '二次元' },
  { key: 'news', label: '资讯' },
  { key: 'tech', label: '科技' },
  { key: 'food', label: '美食' },
  { key: 'game', label: '游戏' },
  { key: 'knowledge', label: '知识' },
  { key: 'sports', label: '体育' },
  { key: 'finance', label: '财经' },
];

// 顶部 Tabs 的「类型」(section)→ 后端子分类字典 parentType 枚举。
// 选中某类型后,用它拉该类型下的子分类(题材),做二级筛选。
// 'recommend'(精选)是聚合流,无单一父类,故不在表中 → 不展示子分类行。
const SECTION_TO_PARENT_TYPE: Partial<Record<FeedItem['section'], string>> = {
  novel: 'NOVEL',
  comics: 'COMICS',
  film: 'FILM',
  teleplay: 'TELEPLAY',
  entertainment: 'VSHOW',
  music: 'MUSIC',
  anime: 'ANIMATION',
  news: 'NEWS',
  game: 'VIDEO',
};

export function FeedPanel({ tab }: { tab: 'home' | 'follow' | 'friend' | 'recommend' }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlSection = (searchParams.get('section') as FeedItem['section']) || 'recommend';
  const [section, setSectionState] = useState<FeedItem['section']>(urlSection);
  const setSection = (next: FeedItem['section']) => {
    setSectionState(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('section', next);
    // 切换类型时清空子分类(题材),避免把小说的题材带到影视上
    params.delete('genre');
    setGenreState('');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  useEffect(() => { setSectionState(urlSection); }, [urlSection]);
  // 二级子分类(题材):选中某类型后按题材筛选;'' = 全部
  const urlGenre = searchParams.get('genre') || '';
  const [genre, setGenreState] = useState<string>(urlGenre);
  const setGenre = (next: string) => {
    setGenreState(next);
    const params = new URLSearchParams(searchParams.toString());
    if (!next) params.delete('genre');
    else params.set('genre', next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  useEffect(() => { setGenreState(urlGenre); }, [urlGenre]);
  const parentType = SECTION_TO_PARENT_TYPE[section];
  const subcatQuery = useQuery({
    queryKey: ['home', 'feed', 'subcategory', parentType],
    queryFn: () =>
      fetchSubcategories(parentType as string).then((r: any) => {
        // 后端返回 { list: [...] } 或 { groups: { NOVEL: [...] } }
        if (Array.isArray(r?.data?.list)) return r.data.list as SubcategoryItem[];
        if (parentType && r?.data?.groups?.[parentType]) return r.data.groups[parentType] as SubcategoryItem[];
        return [] as SubcategoryItem[];
      }),
    enabled: tab === 'home' && !!parentType,
    staleTime: 10 * 60 * 1000,
  });
  // sort + time for home tab; default = hot
  const urlSort = (searchParams.get('sort') as 'views' | 'new' | 'hot') || 'views';
  const [sort, setSortState] = useState<'views' | 'new' | 'hot'>(urlSort);
  const setSort = (next: 'views' | 'new' | 'hot') => {
    setSortState(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'views') params.delete('sort');
    else params.set('sort', next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  useEffect(() => { setSortState(urlSort); }, [urlSort]);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });
  const [manageOpen, setManageOpen] = useState(false);
  const [followSub, setFollowSub] = useState<'feed' | 'list'>('feed');
  const isFollow = tab === 'follow';

  const isPersonal = tab === 'follow' || tab === 'friend';
  const isFriend = tab === 'friend';

  // 分页状态
  const PAGE_SIZE = 12;

  // section 到 contentType 的映射
  const SECTION_TO_TYPE: Record<string, string> = {
    novel: 'NOVEL',
    comics: 'COMICS',
    film: 'FILM',
    teleplay: 'TELEPLAY',
    entertainment: 'VSHOW',
    music: 'MUSIC',
    anime: 'ANIMATION',
    news: 'NEWS',
    tech: 'ARTICLE',
    food: 'VIDEO',
    game: 'VIDEO',
    knowledge: 'ARTICLE',
    sports: 'VIDEO',
    finance: 'ARTICLE',
    // recommend 是聚合流，不传 contentType 获取所有类型
    recommend: '',
  };

  // 使用 useInfiniteQuery 实现真正的无限滚动分页
  // 个人内容(follow/friend)用 /home/feed，分类内容用 /module/content/list
  const {
    data: feedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['home', 'feed', tab, isPersonal ? 'all' : section, sort, isPersonal ? '' : genre],
    queryFn: async ({ pageParam = 1 }) => {
      // 个人内容使用 /home/feed
      if (isPersonal) {
        const params = new URLSearchParams({ tab, page: String(pageParam), size: String(PAGE_SIZE) });
        const resp = await homeClient.get<any>(`/feed?${params.toString()}`).then((r) => r.data);
        // homeClient 拦截器返回 { code, data: { list, total, pageSize }, msg }
        const rawRecords = resp?.data?.list || [];
        const records = rawRecords.map((item: any) => ({
          ...item,
          id: Number(item.id) || item.id,
          cover: item.cover || item.coverUrl || '',
          authorName: item.authorName || item.author || '',
          authorAvatar: item.authorAvatar || item.avatar || '',
          views: item.views || item.readNum || 0,
          likes: item.likes || item.agreeNum || 0,
          comments: item.comments || item.commentNum || 0,
          shares: item.shares || item.shareNum || 0,
          postedAgoMin: item.postedAgoMin || 0,
        }));
        const total = resp?.data?.total || 0;
        return { records, total, page: pageParam };
      }
      // recommend 聚合流使用 /recommend/feed
      if (section === 'recommend') {
        const resp = await contentClient.get(`/recommend/feed?size=${PAGE_SIZE}&page=${pageParam}`).then((r: any) => r.data);
        // contentClient 拦截器返回原始 { code, data: { list, total, hasMore }, msg }
        const rawRecords = resp?.data?.list || [];
        const records = rawRecords.map((item: any) => ({
          ...item,
          id: Number(item.id) || item.id,
          cover: item.cover || item.coverUrl || '',
          authorName: item.authorName || item.author || '',
          authorAvatar: item.authorAvatar || item.avatar || '',
          views: item.views || item.readNum || 0,
          likes: item.likes || item.agreeNum || 0,
          comments: item.comments || item.commentNum || 0,
          shares: item.shares || item.shareNum || 0,
          durationSec: item.durationSec || item.duration || 0,
          postedAgoMin: item.postedAgoMin || 0,
          category: item.category || item.contentType?.toLowerCase() || 'video',
        }));
        const total = resp?.data?.total || 0;
        return { records, total, page: pageParam };
      }
      // 分类内容使用 /module/content/list
      const contentType = SECTION_TO_TYPE[section];
      const resp = await moduleContentPage({
        page: pageParam,
        pageSize: PAGE_SIZE,
        ...(contentType ? { contentType } : {}),
        order: sort === 'new' ? 'CREATE_TIME' : 'COLLECT',
      }) as any;
      // moduleContentPage 内部用 contentClient 包装, resp 同上是 { code, data: { list, total }, msg }
      const rawRecords = resp?.data?.list || resp?.data?.records || [];
      // 字段适配:后端 entity 用 coverUrl/author/readNum/agreeNum → FeedCard 期望 cover/authorName/views/likes
      const records = rawRecords.map((item: any) => ({
        ...item,
        id: Number(item.id) || item.id,
        cover: item.cover || item.coverUrl || '',
        authorName: item.authorName || item.author || '',
        authorAvatar: item.authorAvatar || item.avatar || '',
        views: item.views || item.readNum || 0,
        likes: item.likes || item.agreeNum || 0,
        comments: item.comments || item.commentNum || 0,
        shares: item.shares || item.shareNum || 0,
        postedAgoMin: item.postedAgoMin || 0,
      }));
      const total = resp?.data?.total || resp?.data?.totalRow || 0;
      return { records, total, page: pageParam };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { records, total, page } = lastPage;
      if (records.length === PAGE_SIZE && page * PAGE_SIZE < total) {
        return page + 1;
      }
      return undefined;
    },
    enabled: tab !== 'recommend',
  });

  // 合并所有页面的数据
  const feedList = feedData?.pages.flatMap(page => page.records) || [];

  // 简化分页：使用单一 sentinel ref
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 监听滚动到底部
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage && !isLoading) {
          fetchNextPage();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  // 所有 Hook 调用完毕后再做条件分支(遵守 Rules of Hooks:Hook 顺序在每次渲染必须一致)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {isFriend && (
        <FriendHeader onOpenManage={() => setManageOpen(true)} />
      )}
      {isFollow && (
        <FollowSubHeader value={followSub} onChange={setFollowSub} />
      )}
      {tab === 'home' && !isPersonal && (
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 11,
            bgcolor: 'var(--bg-topbar, rgba(10, 10, 15, 0.85))',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
            flexShrink: 0,
            px: 2,
            pt: 1.5,
            pb: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Box sx={{ width: 32, height: 32, borderRadius: 1.5, background: 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(254,44,85,0.32)', flexShrink: 0 }}>
            <LocalFireDepartmentIcon sx={{ fontSize: 18, color: '#fff' }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary, #ffffff)', letterSpacing: 0.3 }}>精选</Typography>
            <Typography sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>多分类聚合 · 实时热度排序</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'warning.main' }}>
            <TrendingUpIcon sx={{ fontSize: 14 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700 }}>实时榜</Typography>
          </Box>
        </Box>
      )}
      {!isPersonal && (
        <Box
          sx={{
            position: 'sticky',
            top: tab === 'home' ? 'calc(56px + var(--sat, 0px))' : 0,
            zIndex: 10,
            bgcolor: 'var(--bg-topbar, rgba(10, 10, 15, 0.85))',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
            flexShrink: 0,
          }}
        >
          {tab === 'home' && (
            <Tabs
              value={section}
              onChange={(_, v) => setSection(v)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                minHeight: 44,
                px: 1,
                '& .MuiTab-root': {
                  minHeight: 44,
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text-secondary, rgba(255,255,255,0.6))',
                  textTransform: 'none',
                  px: 1.75,
                  py: 0,
                  transition: 'color 0.15s',
                  '&:hover': { color: 'var(--text-primary, #ffffff)' },
                },
                '& .Mui-selected': { color: 'var(--brand-color, #FE2C55) !important', fontWeight: 700 },
                '& .MuiTabs-indicator': { backgroundColor: 'var(--brand-color, #FE2C55)', height: 2.5, borderRadius: 1.25 },
                '& .MuiTabs-scrollButtons': { color: 'var(--text-secondary, rgba(255,255,255,0.55))' },
              }}
            >
              {SECTIONS.map((s) => (
                <Tab key={s.key} value={s.key} label={s.label} />
              ))}
            </Tabs>
          )}
          {/* 二级子分类(题材):选中某类型(如小说)后,展示该类型下的分类来筛选 */}
          {tab === 'home' && parentType && (
            <Box sx={{ position: 'relative', px: 1.5, pt: 0.5, pb: 0.25 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' }, pr: 3 }}>
                <Typography sx={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted, rgba(255,255,255,0.4))', mr: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>分类</Typography>
                {subcatQuery.isLoading ? (
                  <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.4))', fontStyle: 'italic' }}>加载中…</Typography>
                ) : (
                  [{ code: '', name: '全部' }, ...(subcatQuery.data ?? [])].map((s) => {
                    const active = genre === s.code;
                    return (
                      <Box
                        key={s.code || 'all'}
                        onClick={() => setGenre(s.code)}
                      sx={{
                        flexShrink: 0,
                        px: 1.25,
                        py: 0.35,
                        borderRadius: 999,
                        cursor: 'pointer',
                        fontSize: 11.5,
                        fontWeight: active ? 700 : 500,
                        color: active ? '#000' : 'var(--text-secondary, rgba(255,255,255,0.85))',
                        bgcolor: active ? 'rgba(255,255,255,0.95)' : 'transparent',
                        border: '1px solid',
                        borderColor: active ? 'transparent' : 'var(--border-color, rgba(255,255,255,0.12))',
                        transition: 'all 0.15s',
                      }}
                    >
                      {s.name}
                    </Box>
                  );
                })
              )}
            </Box>
            {/* 右侧渐变遮罩提示可滚动 */}
            <Box sx={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 24, background: 'linear-gradient(to right, transparent, var(--bg-body, #F5F5F7))', pointerEvents: 'none' }} />
          </Box>
          )}
          {tab === 'home' && (
            <Box sx={{ position: 'relative', px: 1.5, pt: 0.5, pb: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' }, pr: 3 }}>
                <Typography sx={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted, rgba(255,255,255,0.4))', mr: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>排序</Typography>
                {[
                { key: 'views', label: '人气榜' },
                { key: 'hot', label: '热度' },
                { key: 'new', label: '最新' },
              ].map((s) => {
                const active = sort === s.key;
                return (
                  <Box
                    key={s.key}
                    onClick={() => setSort(s.key as any)}
                    sx={{
                      flexShrink: 0,
                      px: 1.25,
                      py: 0.35,
                      borderRadius: 999,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      fontWeight: active ? 700 : 500,
                      color: active ? '#fff' : 'var(--text-secondary, rgba(255,255,255,0.65))',
                      bgcolor: active ? 'var(--brand-color, #FE2C55)' : 'transparent',
                      border: '1px solid',
                      borderColor: active ? 'transparent' : 'var(--border-color, rgba(255,255,255,0.08))',
                      transition: 'all 0.15s',
                    }}
                  >
                    {s.label}
                  </Box>
                );
              })}
            </Box>
            {/* 右侧渐变遮罩提示可滚动 */}
            <Box sx={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 24, background: 'linear-gradient(to right, transparent, var(--bg-body, #F5F5F7))', pointerEvents: 'none' }} />
          </Box>
          )}
        </Box>
      )}

      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {isFollow && followSub === 'list' ? (
          <FollowList onSnack={(m, severity) => setSnack({ open: true, message: m, severity: severity || 'success' })} />
        ) : (
        <>
          {/* 加载状态 */}
          {isLoading ? (
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" sx={{ height: 200, bgcolor: 'action.hover' }} />
                ))}
              </Box>
            </Box>
          ) : (
            <Box sx={{ p: 2 }}>
              {/* 仅 home 顶部抓取工具条 (follow 是个人页,不放) */}
              {tab === 'home' && !isPersonal && section === 'recommend' && (
                <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, border: '1px dashed', borderColor: 'divider', bgcolor: 'action.hover' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: 12, color: 'var(--text-secondary, rgba(255,255,255,0.6))' }}>
                      没找到想看的?抓一个 URL 进来:
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    <SendToSpider
                      label="抓取 URL"
                      defaultUrl="粘贴任意文章/视频 URL,自动入抓取队列"
                      variant="inline"
                      onSuccess={(m) => setSnack({ open: true, message: m, severity: 'success' })}
                      onError={(m) => setSnack({ open: true, message: m, severity: 'error' })}
                    />
                  </Box>
                </Box>
              )}

              {isPersonal ? (
                // 关注/朋友:中间是 feed(倒序),右侧是推荐用户(sticky,lg+ 才显示)
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {feedList.length > 0 ? (
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
                        {feedList.map((item) => (
                          <FeedCard key={item.id} item={item} tab={tab} onSnack={(m, s) => setSnack({ open: true, message: m, severity: s })} />
                        ))}
                      </Box>
                    ) : (
                      <EmptyHint tab={tab} section={section} />
                    )}
                  </Box>
                  <Box
                    sx={{
                      width: 320,
                      flexShrink: 0,
                      position: { xs: 'static', lg: 'sticky' },
                      top: 0,
                      display: { xs: 'none', lg: 'block' },
                    }}
                  >
                    <RecommendSection tab={tab} onSnack={(m, s) => setSnack({ open: true, message: m, severity: s })} />
                  </Box>
                </Box>
              ) : feedList.length > 0 ? (
                <Masonry
                  breakpointCols={{ default: 4, 1400: 3, 1100: 2, 768: 2, 600: 1, 480: 1 }}
                  className="my-masonry-grid"
                  columnClassName="my-masonry-grid_column"
                >
                  {feedList.map((item) => (
                    <FeedCard key={item.id} item={item} tab={tab} onSnack={(m, s) => setSnack({ open: true, message: m, severity: s })} />
                  ))}
                </Masonry>
              ) : (
                <EmptyHint tab={tab} section={section} />
              )}

              {/* Loading more */}
              {isFetchingNextPage && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>加载中...</Typography>
                </Box>
              )}

              {/* Infinite scroll sentinel */}
              <Box ref={sentinelRef} sx={{ height: 1, minHeight: 1 }} />

              {/* No more data */}
              {!isFetchingNextPage && feedList.length > 0 && !hasNextPage && (
                <Typography sx={{ textAlign: 'center', py: 3, color: 'text.disabled', fontSize: 12 }}>
                  - 没有更多了 -
                </Typography>
              )}
            </Box>
          )}
        </>
        )}
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled" sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        fullWidth
        maxWidth="md"
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'var(--bg-body, #F5F5F7)',
              backgroundImage: 'none',
              borderRadius: 3,
              height: 'min(820px, 90dvh)',
              overflow: 'hidden',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))', flexShrink: 0 }}>
          <GroupsRoundedIcon sx={{ fontSize: 18, color: '#5B8DEF', mr: 1 }} />
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #ffffff)', flex: 1 }}>
            好友管理
          </Typography>
          <IconButton size="small" onClick={() => setManageOpen(false)} aria-label="关闭">
            <CloseRoundedIcon sx={{ fontSize: 18, color: 'var(--text-muted, rgba(255,255,255,0.5))' }} />
          </IconButton>
        </Box>
        <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
          <FriendPanel />
        </DialogContent>
      </Dialog>
    </Box>
  );
}

// ─── 卡片 ───
function FeedCard({ item, tab, onSnack }: { item: FeedItem; tab: 'home' | 'follow' | 'friend' | 'recommend'; onSnack?: (m: string, s: 'success' | 'error') => void }) {
  const qc = useQueryClient();
  const navigate = useContentNavigate();
  const [busy, setBusy] = useState(false);

  // 后端 /feed 返回的 item.category 实际是 module_content.content_type(已是规范大写
  // NOVEL/FILM/.../VIDEO/LIVE),直接用作详情路由 type,不再做枚举猜测。
  // 兼容旧 mock(可能返 'video'/'live' 等小写)的兜底映射。
  const legacyCategoryToType: Record<string, string> = {
    video: 'VIDEO', short: 'VIDEO', image: 'VIDEO', live: 'LIVE',
  };
  const rawType = (item as any).contentType || item.category;
  const targetType = rawType ? (legacyCategoryToType[rawType] || String(rawType).toUpperCase()) : null;

  const toggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (item.isFollowing) {
        await homeClient.delete(`/follow/${item.authorId}`);
      } else {
        await homeClient.post(`/follow/${item.authorId}`);
      }
      // 刷新 feed + suggestions
      qc.invalidateQueries({ queryKey: ['home', 'feed'] });
      qc.invalidateQueries({ queryKey: ['home', 'suggestions'] });
    } catch (err) {
      onSnack?.(formatApiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const addAsFriend = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await homeClient.post(`/friend/${item.authorId}`);
      qc.invalidateQueries({ queryKey: ['home', 'feed'] });
      qc.invalidateQueries({ queryKey: ['home', 'friend'] });
    } catch (err) {
      onSnack?.(formatApiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  // 关注/朋友 tab 显示状态徽章 + 按钮;home tab 也显示徽章但不显示按钮(简单)
  const showActions = tab === 'follow' || tab === 'friend';

  return (
    <Box
      onClick={() => {
        if (targetType) navigate(targetType, item.id);
      }}
      sx={{
        borderRadius: 2,
        bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))',
        border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        overflow: 'hidden',
        cursor: targetType ? 'pointer' : 'default',
        transition: 'transform 0.2s, border-color 0.2s',
        '&:hover': targetType ? { transform: 'translateY(-2px)', borderColor: 'var(--border-strong, rgba(255,255,255,0.12))' } : {},
      }}
    >
      <Box sx={{ position: 'relative', aspectRatio: '16/9', bgcolor: 'var(--bg-input, rgba(255,255,255,0.04))', overflow: 'hidden' }}>
        <CoverImage src={item.cover} alt={item.title} sx={{ width: '100%', height: '100%' }} />
        {item.isLive ? (
          <Chip
            icon={<LiveTvRoundedIcon sx={{ fontSize: 12, color: '#ffffff !important' }} />}
            label={`直播中 ${item.liveViewers}`}
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              height: 20,
              bgcolor: 'var(--brand-color, #FE2C55)',
              color: 'var(--text-primary, #ffffff)',
              fontSize: 10,
              fontWeight: 600,
              '& .MuiChip-icon': { color: 'var(--text-primary, #ffffff)' },
            }}
          />
        ) : (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              px: 0.75,
              py: 0.125,
              borderRadius: 0.5,
              bgcolor: 'rgba(0,0,0,0.6)',
              color: 'var(--text-primary, #ffffff)',
              fontSize: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
            }}
          >
            <PlayArrowRoundedIcon sx={{ fontSize: 10 }} />
            {formatDuration(item.durationSec)}
          </Box>
        )}
        {item.category === 'image' && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              px: 0.75,
              py: 0.125,
              borderRadius: 0.5,
              bgcolor: 'rgba(91, 141, 239, 0.85)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            图文
          </Box>
        )}
      </Box>

      <Box sx={{ p: 1.5 }}>
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary, #ffffff)',
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            mb: 1,
            minHeight: 34,
          }}
        >
          {item.title}
        </Typography>

        {/* 作者行:头像 + 名字 + 状态徽章 + 关注/朋友按钮 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
          <Avatar src={item.authorAvatar || undefined} sx={{ width: 22, height: 22, fontSize: 10 }}>
            {item.authorName?.[0] ?? '?'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontSize: 11, color: 'var(--text-secondary, rgba(255,255,255,0.85))', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.authorName}
              </Typography>
              {item.isFriend ? (
                <Tooltip title="互相关注">
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.05, borderRadius: 0.5, bgcolor: 'rgba(93, 219, 150, 0.15)', color: 'success.main', fontSize: 9, fontWeight: 600, flexShrink: 0 }}>
                    <CheckCircleRoundedIcon sx={{ fontSize: 9 }} />
                    朋友
                  </Box>
                </Tooltip>
              ) : item.isFollowing ? (
                <Tooltip title="已关注">
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.05, borderRadius: 0.5, bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: 500, flexShrink: 0 }}>
                    关注
                  </Box>
                </Tooltip>
              ) : null}
            </Box>
          </Box>

          {showActions && (
            tab === 'friend' && item.isFollowing && !item.isFriend ? (
              <Button
                size="small"
                variant="contained"
                onClick={addAsFriend}
                disabled={busy}
                startIcon={<PersonAddAlt1Icon sx={{ fontSize: 12 }} />}
                sx={{
                  minWidth: 0,
                  px: 1,
                  py: 0.25,
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'none',
                  bgcolor: '#5B8DEF',
                  '&:hover': { bgcolor: '#4A7AD9' },
                }}
              >
                加为朋友
              </Button>
            ) : item.isFollowing ? (
              <Button
                size="small"
                variant="outlined"
                onClick={toggleFollow}
                disabled={busy}
                startIcon={<CheckIcon sx={{ fontSize: 12 }} />}
                sx={{
                  minWidth: 0,
                  px: 1,
                  py: 0.25,
                  fontSize: 10,
                  fontWeight: 500,
                  textTransform: 'none',
                  color: 'var(--text-secondary, rgba(255,255,255,0.7))',
                  borderColor: 'var(--border-strong, rgba(255,255,255,0.16))',
                  '&:hover': { borderColor: 'var(--border-strong, rgba(255,255,255,0.24))', bgcolor: 'var(--bg-hover, rgba(255,255,255,0.04))' },
                }}
              >
                已关注
              </Button>
            ) : (
              <Button
                size="small"
                variant="contained"
                onClick={toggleFollow}
                disabled={busy}
                startIcon={<AddIcon sx={{ fontSize: 12 }} />}
                sx={{
                  minWidth: 0,
                  px: 1,
                  py: 0.25,
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'none',
                  bgcolor: 'var(--brand-color, #FE2C55)',
                  '&:hover': { bgcolor: '#E0274A' },
                }}
              >
                关注
              </Button>
            )
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Stat icon={<FavoriteBorderRoundedIcon sx={{ fontSize: 12 }} />} value={item.likes} />
          <Stat icon={<ModeCommentOutlinedIcon sx={{ fontSize: 12 }} />} value={item.comments} />
          <Stat icon={<ShareOutlinedIcon sx={{ fontSize: 12 }} />} value={item.shares} />
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
            {formatViews(item.views)} 播放
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ─── 推荐区(空态 / 顶部插入) ───
function RecommendSection({ tab, onSnack }: { tab: 'follow' | 'friend'; onSnack?: (m: string, s: 'success' | 'error') => void }) {
  const type = tab === 'friend' ? 'friend' : 'follow';
  const title = tab === 'friend' ? '你可能认识的人' : '推荐关注';
  const hint = tab === 'friend' ? '基于共同好友推荐' : '基于你的兴趣推荐';

  const { data, isLoading } = useQuery({
    queryKey: ['home', 'suggestions', type],
    queryFn: () => homeClient.get<{ list: SuggestUser[] }>(`/suggestions?type=${type}&limit=8`).then((r) => r.data),
  });

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1.5 }}>
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>{title}</Typography>
          <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.5))', mt: 0.25 }}>{hint}</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1.5 }}>
        {((isLoading ? Array.from({ length: 4 }, () => undefined as SuggestUser | undefined) : (data?.list as SuggestUser[] | undefined) || [])).map((u, i) => (
          <SuggestUserCard key={u?.id || i} user={u} tab={tab} loading={isLoading} onSnack={onSnack} />
        ))}
      </Box>
    </Box>
  );
}

function SuggestUserCard({ user, tab, loading, onSnack }: { user?: SuggestUser; tab: 'follow' | 'friend'; loading?: boolean; onSnack?: (m: string, s: 'success' | 'error') => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const isFriend = tab === 'friend';

  const act = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || busy) return;
    setBusy(true);
    try {
      if (isFriend) {
        await homeClient.post(`/friend/${user.id}`);
        qc.invalidateQueries({ queryKey: ['home', 'friend'] });
      } else {
        await homeClient.post(`/follow/${user.id}`);
      }
      qc.invalidateQueries({ queryKey: ['home', 'feed'] });
      qc.invalidateQueries({ queryKey: ['home', 'suggestions'] });
    } catch (err) {
      onSnack?.(formatApiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) {
    return (
      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))', border: '1px solid var(--border-color, rgba(255,255,255,0.06))', height: 88 }} />
    );
  }

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))',
        border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        transition: 'border-color 0.2s',
        '&:hover': { borderColor: 'var(--border-strong, rgba(255,255,255,0.12))' },
      }}
    >
      <Avatar src={user.avatar || undefined} sx={{ width: 40, height: 40, fontSize: 14, flexShrink: 0 }}>
        {user.name?.[0] ?? '?'}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #fff)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.name}
          </Typography>
          {user.verified && (
            <Tooltip title="认证创作者">
              <CheckCircleRoundedIcon sx={{ fontSize: 12, color: 'primary.main' }} />
            </Tooltip>
          )}
        </Box>
        <Typography sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.5))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user.followers >= 10000 ? `${(user.followers / 10000).toFixed(1)}w` : user.followers} 粉丝
        </Typography>
      </Box>
      <Button
        size="small"
        variant="contained"
        onClick={act}
        disabled={busy}
        startIcon={isFriend ? <PersonAddAlt1Icon sx={{ fontSize: 12 }} /> : <AddIcon sx={{ fontSize: 12 }} />}
        sx={{
          minWidth: 0,
          px: 1.25,
          py: 0.4,
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'none',
          bgcolor: isFriend ? '#5B8DEF' : 'var(--brand-color, #FE2C55)',
          '&:hover': { bgcolor: isFriend ? '#4A7AD9' : '#E0274A' },
        }}
      >
        {isFriend ? '+加好友' : '+关注'}
      </Button>
    </Box>
  );
}

function Stat({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: 'var(--text-muted, rgba(255,255,255,0.55))' }}>
      {icon}
      <Typography sx={{ fontSize: 11 }}>{value}</Typography>
    </Box>
  );
}

function formatDuration(sec: number): string {
  if (sec == null || isNaN(sec) || sec < 0) return '0:00';
  if (sec < 60) return `${sec}秒`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatViews(n: number): string {
  if (n == null || isNaN(n) || n < 0) return '0';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toString();
}

// ─── 空态文案(轻量) ───
function EmptyHint({ tab, section }: { tab: 'home' | 'follow' | 'friend' | 'recommend'; section: FeedItem['section'] }) {
  const isRec = section === 'recommend';
  let title = '该分类暂无内容';
  let hint = '试试切换到其他分类';
  if (isRec) {
    if (tab === 'home') { title = '精选内容为空'; hint = '稍后再来看看'; }
    else if (tab === 'follow') { title = '还没有关注动态'; hint = '去下方推荐关注更多创作者'; }
    else if (tab === 'friend') { title = '朋友动态为空'; hint = '加几个朋友,看看他们的生活'; }
  }
  return (
    <Box
      sx={{
        py: 6,
        textAlign: 'center',
        borderRadius: 2,
        bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.3))',
        border: '1px dashed var(--border-color, rgba(255,255,255,0.1))',
        mb: 2,
      }}
    >
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{title}</Typography>
      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', mt: 0.5 }}>{hint}</Typography>
    </Box>
  );
}

// ─── 朋友 tab 头部(sticky,带统计 + 管理入口) ───
function FriendHeader({ onOpenManage }: { onOpenManage: () => void }) {
  const { data } = useQuery({
    queryKey: ['home', 'friend', 'stats'],
    queryFn: () => homeClient.get<{ friendCount: number; incoming: number; sent: number }>('/friend/stats').then((r) => r.data),
  });
  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        bgcolor: 'var(--bg-topbar, rgba(10, 10, 15, 0.85))',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        flexShrink: 0,
        px: 2,
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <GroupsRoundedIcon sx={{ fontSize: 18, color: '#5B8DEF' }} />
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>朋友动态</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, ml: 1 }}>
        <FriendStat label="好友" value={data?.friendCount} />
        <FriendStat label="收到的申请" value={data?.incoming} accent="#5B8DEF" />
        <FriendStat label="已发出" value={data?.sent} />
      </Box>
      <Box sx={{ flex: 1 }} />
      <Button
        size="small"
        variant="outlined"
        startIcon={<GroupsRoundedIcon sx={{ fontSize: 14 }} />}
        onClick={onOpenManage}
        sx={{
          minWidth: 0,
          px: 1.5,
          py: 0.5,
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'none',
          color: '#5B8DEF',
          borderColor: 'rgba(91, 141, 239, 0.4)',
          '&:hover': { borderColor: '#5B8DEF', bgcolor: 'rgba(91, 141, 239, 0.08)' },
        }}
      >
        好友管理
      </Button>
    </Box>
  );
}

function FriendStat({ label, value, accent }: { label: string; value: number | undefined; accent?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: accent || 'var(--text-primary, #ffffff)', fontVariantNumeric: 'tabular-nums' }}>
        {value ?? '—'}
      </Typography>
      <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.5))' }}>{label}</Typography>
    </Box>
  );
}

// ─── 关注 tab 子头部:动态 / 我的关注 切换 ───
function FollowSubHeader({ value, onChange }: { value: 'feed' | 'list'; onChange: (v: 'feed' | 'list') => void }) {
  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        bgcolor: 'var(--bg-topbar, rgba(10, 10, 15, 0.85))',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        flexShrink: 0,
        px: 2,
      }}
    >
      <Tabs
        value={value}
        onChange={(_, v) => onChange(v)}
        sx={{
          minHeight: 40,
          '& .MuiTab-root': {
            minHeight: 40,
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-secondary, rgba(255,255,255,0.6))',
            textTransform: 'none',
            px: 2,
            py: 0,
            transition: 'color 0.15s',
            '&:hover': { color: 'var(--text-primary, #ffffff)' },
          },
          '& .Mui-selected': { color: 'var(--brand-color, #FE2C55) !important', fontWeight: 700 },
          '& .MuiTabs-indicator': { backgroundColor: 'var(--brand-color, #FE2C55)', height: 2.5, borderRadius: 1.25 },
        }}
      >
        <Tab value="feed" label="动态" />
        <Tab value="list" label="我的关注" />
      </Tabs>
    </Box>
  );
}

type FollowedUser = {
  id: number;
  name: string;
  avatar: string;
  douyinId: string;
  bio?: string;
  followers: number;
  following: number;
  posts: number;
  isFriend: boolean;
};

// ─── 关注列表(行 + 取关) ───
function FollowList({ onSnack }: { onSnack: (msg: string, severity?: 'success' | 'error') => void }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['home', 'follow', 'list'],
    queryFn: () => homeClient.get<{ list: FollowedUser[]; total: number }>('/follow/list').then((r) => r.data),
  });

  const unfollow = async (user: FollowedUser) => {
    try {
      await homeClient.delete(`/follow/${user.id}`);
      qc.invalidateQueries({ queryKey: ['home', 'follow', 'list'] });
      qc.invalidateQueries({ queryKey: ['home', 'feed'] });
      qc.invalidateQueries({ queryKey: ['home', 'suggestions'] });
      onSnack(`已取消关注 ${user.name}`, 'success');
    } catch {
      onSnack('取关失败,请重试', 'error');
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <AsyncState query={query} skeletonCount={4} skeletonHeight={72} isEmpty={(d) => d.list.length === 0}>
        {(data) => (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography sx={{ fontSize: 12, color: 'var(--text-muted, rgba(255,255,255,0.5))', mb: 0.5 }}>
              共 {data.total} 位关注
            </Typography>
            {data.list.map((u) => (
              <FollowedRow key={u.id} user={u} onUnfollow={unfollow} />
            ))}
          </Box>
        )}
      </AsyncState>
    </Box>
  );
}

function FollowedRow({ user, onUnfollow }: { user: FollowedUser; onUnfollow: (u: FollowedUser) => void }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handle = async () => {
    setBusy(true);
    try {
      await onUnfollow(user);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 1.5,
          borderRadius: 2,
          bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))',
          border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
          transition: 'border-color 0.2s',
          '&:hover': { borderColor: 'var(--border-strong, rgba(255,255,255,0.12))' },
        }}
      >
        <Avatar src={user.avatar || undefined} sx={{ width: 48, height: 48, fontSize: 18 }}>
          {user.name?.[0] ?? '?'}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
              {user.name}
            </Typography>
            {user.isFriend && (
              <Tooltip title="互为朋友">
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.05, borderRadius: 0.5, bgcolor: 'rgba(91, 141, 239, 0.15)', color: '#5B8DEF', fontSize: 9, fontWeight: 600 }}>
                  <CheckCircleRoundedIcon sx={{ fontSize: 9 }} />
                  朋友
                </Box>
              </Tooltip>
            )}
          </Box>
          <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.5))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.bio || `抖音号: ${user.douyinId}`}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'var(--text-disabled, rgba(255,255,255,0.35))', mt: 0.25 }}>
            {user.followers >= 10000 ? `${(user.followers / 10000).toFixed(1)}w` : user.followers} 粉丝 · {user.posts} 作品
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setConfirming(true)}
          disabled={busy}
          sx={{
            minWidth: 0,
            px: 1.5,
            py: 0.5,
            fontSize: 12,
            fontWeight: 500,
            textTransform: 'none',
            color: 'var(--text-secondary, rgba(255,255,255,0.7))',
            borderColor: 'var(--border-strong, rgba(255,255,255,0.16))',
            '&:hover': { borderColor: 'var(--brand-color, #FE2C55)', color: 'var(--brand-color, #FE2C55)', bgcolor: 'rgba(254, 44, 85, 0.06)' },
          }}
        >
          已关注
        </Button>
      </Box>

      <Dialog open={confirming} onClose={() => setConfirming(false)} maxWidth="xs" fullWidth>
        <Box sx={{ p: 3 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary, #fff)', mb: 1 }}>
            确认取消关注?
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'var(--text-secondary, rgba(255,255,255,0.6))' }}>
            取消后将不再看到 <b style={{ color: 'var(--text-primary, #fff)' }}>{user.name}</b> 的动态更新。
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, p: 2, pt: 0, justifyContent: 'flex-end' }}>
          <Button onClick={() => setConfirming(false)} sx={{ color: 'var(--text-secondary, rgba(255,255,255,0.7))', textTransform: 'none' }}>
            再想想
          </Button>
          <Button
            onClick={handle}
            disabled={busy}
            variant="contained"
            sx={{ bgcolor: 'var(--brand-color, #FE2C55)', textTransform: 'none', '&:hover': { bgcolor: '#E0274A' } }}
          >
            确认取关
          </Button>
        </Box>
      </Dialog>
    </>
  );
}
