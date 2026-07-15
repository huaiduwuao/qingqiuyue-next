'use client';

import React, { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import Avatar from '@mui/material/Avatar';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { moduleContentPage } from '@/apis/home';
import { getHomeRecommendFollow, getHomeRecommendFriend, type RecommendWork } from '@/apis/dashboard';
import { CoverImage } from '@/components/common/CoverImage';
import { getDetailRoute } from '@/lib/contentRoute';
import { track } from '@/lib/track';
import { TYPE_GRADIENT, RANK_BG, IMAGE_OVERLAY } from '@/constants/gradients';
import { RecommendVideoFeed } from './components/RecommendVideoFeed';
import { MeTabView } from './components/MeTabView';
import { useScrollToBottom } from '@/hooks/useInfiniteScroll';
import Masonry from 'react-masonry-css';
import { useContentNavigate } from '@/lib/contentRoute';
import { homeClient } from '@/lib/api/client';
import HotRankingBar from '@/components/home/HotRankingBar';

// 右侧边栏渐变色映射
const GRADIENT_BY_TYPE: Record<string, string> = {
  film: 'linear-gradient(135deg, #FE2C55 0%, #8B5CF6 100%)',
  teleplay: 'linear-gradient(135deg, #8B5CF6 0%, #2D1B4E 100%)',
  music: 'linear-gradient(135deg, #FFB400 0%, #8B0000 100%)',
};

function gradientByType(contentType: string): string {
  return GRADIENT_BY_TYPE[contentType] ?? 'linear-gradient(135deg, #2D1B4E 0%, transparent 100%)';
}

interface ContentItem {
  id: number;
  title: string;
  subtitle?: string;
  contentType: string;
  cover?: string;
  coverUrl?: string;
  status: string;
  agreeCount?: number;
  collectCount?: number;
  commentCount?: number;
  viewCount?: number;
  author?: { id: number; nickname: string; avatar?: string };
  [key: string]: any;
}

const CATEGORY_NAV = [
  '全部', '小说', '漫画', '影视', '综艺', '音乐', '小剧场', '二次元', '游戏', '资讯', '公开课', '科技',
];

const CATEGORY_TO_TYPE: Record<string, string> = {
  小说: 'NOVEL', 漫画: 'COMICS', 影视: 'FILM', 综艺: 'VSHOW', 音乐: 'MUSIC',
  小剧场: 'TELEPLAY', 二次元: 'ANIMATION', 游戏: 'VIDEO', 资讯: 'NEWS',
  公开课: 'ARTICLE', 科技: 'ARTICLE',
};

const TYPE_TO_CHIP: Record<string, string> = {
  NOVEL: '小说', COMICS: '漫画', FILM: '影视', VSHOW: '综艺', MUSIC: '音乐',
  TELEPLAY: '短剧', ANIMATION: '二次元', VIDEO: '游戏', NEWS: '资讯',
  ARTICLE: '文章', LIVE: '直播',
};

const CATEGORY_TO_TAB: Record<string, string> = {
  全部: 'all', 小说: 'novel', 漫画: 'comics', 影视: 'film', 综艺: 'vshow', 音乐: 'music',
  小剧场: 'theater', 二次元: 'anime', 游戏: 'video', 资讯: 'news',
  公开课: 'article', 科技: 'tech',
};
const TAB_TO_CATEGORY: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_TO_TAB).map(([cat, tab]) => [tab, cat]),
);

const SPECIAL_TABS = new Set(['follow', 'friend', 'ai']);
const SPECIAL_TAB_LABEL: Record<string, { label: string; icon: React.ReactNode }> = {
  follow: { label: '关注', icon: <PersonIcon sx={{ fontSize: 14 }} /> },
  friend: { label: '朋友', icon: <GroupIcon sx={{ fontSize: 14 }} /> },
  ai:     { label: 'AI 推荐', icon: <SmartToyIcon sx={{ fontSize: 14 }} /> },
};

function formatCount(n: number = 0): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

const PAGE_SIZE = 12;

export default function HomeRecommendPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || 'all';
  const isSpecialTab = SPECIAL_TABS.has(tabFromUrl);
  const activeCategory = TAB_TO_CATEGORY[tabFromUrl] || '全部';

  // 分页状态
  const [contentPage, setContentPage] = useState(1);
  const [contentList, setContentList] = useState<ContentItem[]>([]);
  const [contentHasMore, setContentHasMore] = useState(true);

  const [followPage, setFollowPage] = useState(1);
  const [followList, setFollowList] = useState<RecommendWork[]>([]);
  const [followHasMore, setFollowHasMore] = useState(true);

  const [friendPage, setFriendPage] = useState(1);
  const [friendList, setFriendList] = useState<RecommendWork[]>([]);
  const [friendHasMore, setFriendHasMore] = useState(true);

  // 切换 tab 时重置分页状态
  useEffect(() => {
    setContentPage(1);
    setContentList([]);
    setContentHasMore(true);
    setFollowPage(1);
    setFollowList([]);
    setFollowHasMore(true);
    setFriendPage(1);
    setFriendList([]);
    setFriendHasMore(true);
  }, [tabFromUrl]);

  const setTab = (newTab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newTab === 'all') {
      params.delete('tab');
    } else {
      params.set('tab', newTab);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };
  const setActiveCategory = (category: string) => setTab(CATEGORY_TO_TAB[category] || 'all');
  const setActiveSpecial = (tab: string) => setTab(tab);

  // 内容查询（支持分页）
  const contentQuery = useQuery({
    queryKey: ['home-recommend', 'content', activeCategory, contentPage],
    queryFn: async () => {
      const contentType = activeCategory === '全部' || activeCategory === '' ? undefined : (CATEGORY_TO_TYPE[activeCategory] || activeCategory);
      try {
        const resp = await moduleContentPage({
          pageNum: contentPage,
          pageSize: PAGE_SIZE,
          ...(contentType ? { contentType } : {}),
          order: 'COLLECT',
        }) as any;
        const records: ContentItem[] = resp?.data?.records || resp?.data?.list || [];
        const total = resp?.data?.totalRow || resp?.data?.total || 0;

        setContentList(prev => contentPage === 1 ? records : [...prev, ...records]);
        setContentHasMore(records.length === PAGE_SIZE && (contentPage * PAGE_SIZE) < total);

        return records;
      } catch (err) {
        console.error('[HomeRecommend] contentQuery error:', err);
        setContentList([]);
        setContentHasMore(false);
        throw err;
      }
    },
    retry: 1,
    enabled: !isSpecialTab && tabFromUrl !== 'recommend',
  });

  // 关注查询（支持分页）
  const followQuery = useQuery({
    queryKey: ['home-recommend', 'follow', followPage],
    queryFn: async () => {
      const resp = await getHomeRecommendFollow({ page: followPage, pageSize: PAGE_SIZE }) as any;
      const records: RecommendWork[] = resp?.list || [];
      const total = resp?.total || 0;

      setFollowList(prev => followPage === 1 ? records : [...prev, ...records]);
      setFollowHasMore(records.length === PAGE_SIZE && (followPage * PAGE_SIZE) < total);

      return records;
    },
    placeholderData: (prev) => prev,
    enabled: tabFromUrl === 'follow',
  });

  // 朋友查询（支持分页）
  const friendQuery = useQuery({
    queryKey: ['home-recommend', 'friend', friendPage],
    queryFn: async () => {
      const resp = await getHomeRecommendFriend({ page: friendPage, pageSize: PAGE_SIZE }) as any;
      const records: RecommendWork[] = resp?.list || [];
      const total = resp?.total || 0;

      setFriendList(prev => friendPage === 1 ? records : [...prev, ...records]);
      setFriendHasMore(records.length === PAGE_SIZE && (friendPage * PAGE_SIZE) < total);

      return records;
    },
    placeholderData: (prev) => prev,
    enabled: tabFromUrl === 'friend',
  });

  // 简化：使用单一 sentinel ref
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 监听滚动到底部
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        console.log('[HomeRecommend] IntersectionObserver:', {
          tab: tabFromUrl,
          isIntersecting: entry.isIntersecting,
          contentHasMore,
          isLoading: contentQuery.isLoading,
          contentPage,
        });

        if (entry.isIntersecting) {
          if (!isSpecialTab && tabFromUrl !== 'recommend' && contentHasMore && !contentQuery.isLoading) {
            console.log('[HomeRecommend] Loading next page');
            setContentPage(p => p + 1);
          } else if (tabFromUrl === 'follow' && followHasMore && !followQuery.isLoading) {
            console.log('[HomeRecommend] Loading follow page');
            setFollowPage(p => p + 1);
          } else if (tabFromUrl === 'friend' && friendHasMore && !friendQuery.isLoading) {
            console.log('[HomeRecommend] Loading friend page');
            setFriendPage(p => p + 1);
          }
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [tabFromUrl, isSpecialTab, contentHasMore, contentQuery.isLoading, followHasMore, followQuery.isLoading, friendHasMore, friendQuery.isLoading]);

  // 转换数据格式
  let displayContentList: ContentItem[] = contentList;
  if (tabFromUrl === 'follow') {
    displayContentList = followList.map((w) => ({
      id: Number(String(w.id).replace(/^\D+/, '')) || 0,
      title: w.title,
      contentType: 'VIDEO',
      status: w.status,
      cover: w.cover,
      viewCount: w.views,
    } as ContentItem));
  } else if (tabFromUrl === 'friend') {
    displayContentList = friendList.map((w) => ({
      id: Number(String(w.id).replace(/^\D+/, '')) || 0,
      title: w.title,
      contentType: 'VIDEO',
      status: w.status,
      cover: w.cover,
      viewCount: w.views,
    } as ContentItem));
  }

  const loading = isSpecialTab
    ? (tabFromUrl === 'follow' ? followQuery.isLoading : tabFromUrl === 'friend' ? friendQuery.isLoading : false)
    : tabFromUrl === 'recommend'
      ? false
      : contentQuery.isLoading;

  const loadingMore = isSpecialTab
    ? (tabFromUrl === 'follow' ? followQuery.isFetching && !followQuery.isLoading : tabFromUrl === 'friend' ? friendQuery.isFetching && !friendQuery.isLoading : false)
    : contentQuery.isFetching && !contentQuery.isLoading;

  // 判断是否已加载完所有数据
  const isNoMore = isSpecialTab
    ? (tabFromUrl === 'follow' ? !followHasMore : tabFromUrl === 'friend' ? !friendHasMore : false)
    : !contentHasMore;

  const handleCardClick = (item: ContentItem) => {
    track(item.id, 'click', item.contentType || 'novel');
    const route = getDetailRoute(item.contentType, item.id);
    if (route) router.push(route);
  };

  const displayList = React.useMemo(() => {
    if (displayContentList.length >= PAGE_SIZE) return displayContentList;
    const placeholders: ContentItem[] = Array.from({ length: PAGE_SIZE - displayContentList.length }).map((_, i) => ({
      id: -(displayContentList.length + i + 1),
      title: '',
      contentType: 'NOVEL',
      status: 'placeholder',
    } as ContentItem));
    return [...displayContentList, ...placeholders];
  }, [displayContentList]);

  if (tabFromUrl === 'me') {
    return <MeTabView />;
  }

  if (tabFromUrl === 'recommend') {
    return <RecommendVideoFeed />;
  }

  // Masonry breakpoint 配置
  const masonryBreakpoints = { default: 3, 1200: 2, 800: 1 };

  return (
    <Box sx={{ display: 'flex', gap: 2, px: 3, py: 2, minHeight: 0 }}>
      {/* 左侧内容区 */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* 分类导航 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            mb: 2,
            pb: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            overflowX: 'auto',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {CATEGORY_NAV.map((c) => {
            const isActive = activeCategory === c;
            return (
              <Box
                key={c}
                onClick={() => setActiveCategory(c)}
                sx={{
                  position: 'relative',
                  px: 1.5,
                  py: 0.75,
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'text.primary' : 'text.secondary',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.15s',
                  '&:hover': { color: 'text.primary' },
                  '&::after': isActive
                    ? {
                        content: '""',
                        position: 'absolute',
                        left: 12,
                        right: 12,
                        bottom: -1.5,
                        height: 2,
                        borderRadius: 1,
                        bgcolor: 'primary.main',
                      }
                    : {},
                }}
              >
                {c}
              </Box>
            );
          })}
        </Box>

        {/* 特殊 Tab (关注/朋友/AI) */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 2,
          }}
        >
          {(['follow', 'friend', 'ai'] as const).map((k) => {
            const meta = SPECIAL_TAB_LABEL[k];
            const isActive = tabFromUrl === k;
            return (
              <Box
                key={k}
                onClick={() => setActiveSpecial(k)}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1.5,
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  bgcolor: isActive ? 'rgba(254, 44, 85, 0.15)' : 'action.hover',
                  color: isActive ? 'primary.main' : 'text.secondary',
                  border: '1px solid',
                  borderColor: isActive ? 'rgba(254, 44, 85, 0.4)' : 'divider',
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: 'rgba(254, 44, 85, 0.4)' },
                }}
              >
                {meta.icon}
                {meta.label}
              </Box>
            );
          })}
          <Box sx={{ flex: 1 }} />
          {tabFromUrl === 'follow' && (
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              {contentList.length === 0 ? (loading ? '加载中...' : '关注的人还没发作品') : `共 ${contentList.length} 部`}
            </Typography>
          )}
          {tabFromUrl === 'friend' && (
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              {contentList.length === 0 ? (loading ? '加载中...' : '还没有互相关注的朋友') : `共 ${contentList.length} 部`}
            </Typography>
          )}
        </Box>

        {/* 内容瀑布流 */}
        {loading ? (
          <Masonry
            breakpointCols={masonryBreakpoints}
            className="my-masonry-grid"
            columnClassName="my-masonry-grid_column"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" sx={{ aspectRatio: '4/5', bgcolor: 'action.hover' }} />
            ))}
          </Masonry>
        ) : (
          <Box>
            <Masonry
              breakpointCols={masonryBreakpoints}
              className="my-masonry-grid"
              columnClassName="my-masonry-grid_column"
            >
              {displayList.map((item, idx) => {
                const rank = idx + 1;
                const hasContent = item.id > 0;
                const gradient = TYPE_GRADIENT[item.contentType] || TYPE_GRADIENT.NOVEL;

                if (!hasContent) {
                  return <Box key={`placeholder-${idx}`} sx={{ aspectRatio: '4/5' }} />;
                }

                return (
                  <Box
                    key={`content-${item.id}-${contentPage}`}
                    onClick={() => handleCardClick(item)}
                    sx={{
                      position: 'relative',
                      borderRadius: 2,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      background: gradient,
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-3px)',
                        boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15), transparent 60%)',
                      }}
                    />
                    {(item.cover || item.coverUrl) && (
                      <CoverImage
                        src={item.cover || item.coverUrl}
                        alt={item.title}
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                        }}
                      />
                    )}

                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: 36,
                        height: 36,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        fontWeight: 800,
                        color: 'text.primary',
                        fontFamily: 'monospace',
                        background: rank <= 3
                          ? RANK_BG[rank]
                          : 'rgba(0,0,0,0.5)',
                        backdropFilter: rank > 3 ? 'blur(4px)' : 'none',
                        borderBottomRightRadius: 8,
                        boxShadow: rank <= 3 ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
                      }}
                    >
                      {rank}
                    </Box>

                    {item.viewCount !== undefined && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.25,
                          px: 0.75,
                          py: 0.25,
                          borderRadius: 1,
                          bgcolor: 'rgba(0,0,0,0.5)',
                          backdropFilter: 'blur(4px)',
                          color: 'text.primary',
                          fontSize: 10,
                          fontFamily: 'monospace',
                        }}
                      >
                        <PlayArrowRoundedIcon sx={{ fontSize: 11 }} />
                        {formatCount(item.viewCount)}
                      </Box>
                    )}

                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        p: 1.25,
                        background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%)',
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: 'text.primary',
                          lineHeight: 1.3,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          minHeight: 32,
                        }}
                      >
                        {item.title}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <Box
                          sx={{
                            px: 0.5,
                            py: 0.125,
                            borderRadius: 0.5,
                            bgcolor: 'rgba(255, 88, 88, 0.4)',
                            color: 'text.primary',
                            fontSize: 9,
                            fontWeight: 600,
                          }}
                        >
                          {TYPE_TO_CHIP[item.contentType] ?? '推荐'}
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Masonry>

            {/* Loading more skeleton */}
            {loadingMore && (
              <Box sx={{ mt: 1.5 }}>
                <Masonry
                  breakpointCols={masonryBreakpoints}
                  className="my-masonry-grid"
                  columnClassName="my-masonry-grid_column"
                >
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} variant="rounded" sx={{ aspectRatio: '4/5' }} />
                  ))}
                </Masonry>
              </Box>
            )}

            {/* Infinite scroll sentinel */}
            <Box ref={sentinelRef} sx={{ height: 20, mt: 2, bgcolor: 'red', opacity: 0.5, borderRadius: 1 }} />

            {/* Empty state */}
            {displayContentList.length === 0 && !loading && (
              <Typography sx={{ textAlign: 'center', py: 4, color: 'text.secondary', fontSize: 13 }}>
                暂无内容
              </Typography>
            )}

            {/* No more data */}
            {!loadingMore && displayContentList.length > 0 && isNoMore && (
              <Typography sx={{ textAlign: 'center', py: 3, color: 'text.disabled', fontSize: 12 }}>
                - 没有更多了 -
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* 右侧边栏 */}
      <RecommendRightSidebar />
    </Box>
  );
}

// 右侧边栏组件
type SideTab = 'live' | 'ranking';

function RecommendRightSidebar() {
  const [tab, setTab] = useState<SideTab>('live');
  const navigate = useContentNavigate();

  return (
    <Box
      component="aside"
      sx={{
        width: 300,
        flexShrink: 0,
        display: { xs: 'none', lg: 'flex' },
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {/* 实时动态 Tab */}
      <Box
        sx={{
          borderRadius: 2,
          bgcolor: 'var(--bg-surface, transparent)',
          border: '1px solid var(--border-color, transparent)',
          overflow: 'hidden',
        }}
      >
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
          <Tab value="live" label="热门" />
          <Tab value="ranking" label="榜单" />
        </Tabs>

        <Box sx={{ p: 1.5, pt: 1, maxHeight: 400, overflowY: 'auto' }}>
          {tab === 'live' && <HotTabContent navigate={navigate} />}
          {tab === 'ranking' && <RankingTabContent />}
        </Box>
      </Box>

      {/* 内容榜单 - 单列 */}
      <HotRankingBar
        defaultType="NOVEL"
        title="内容榜单"
        maxItems={8}
        expandable
        showTypeTabs={false}
        columns={1}
      />
    </Box>
  );
}

// 热门内容 Tab
function HotTabContent({ navigate }: { navigate: ReturnType<typeof useContentNavigate> }) {
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
        {[0, 1, 2, 3].map((i) => (
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map((c, i) => (
        <Box
          key={`hot-${c.id ?? i}`}
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
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary, currentColor)', lineHeight: 1.2 }}>
              {c.title}
            </Typography>
            <Typography
              sx={{
                fontSize: 9,
                color: 'var(--text-secondary, currentColor)',
                mt: 0.25,
                lineHeight: 1.2,
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

// 榜单 Tab
type CommentItem = { id?: number; avatar?: string; user?: string; text?: string; time?: string; likes?: number };

function RankingTabContent() {
  const { data, isLoading } = useQuery({
    queryKey: ['home', 'side', 'comments'],
    queryFn: () => homeClient.get<{ list: CommentItem[] }>('/side/comments').then((r) => r.data),
  });
  const list = data?.list || [];

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Box key={i} sx={{ height: 60, borderRadius: 1.5, bgcolor: 'action.hover' }} />
        ))}
      </Box>
    );
  }

  if (list.length === 0) {
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary', p: 1, display: 'block' }}>
        暂无榜单
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {list.map((c: CommentItem, i: number) => (
        <Box key={c.id ?? i} sx={{ display: 'flex', gap: 1 }}>
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
