'use client';

import React, { useState } from 'react';
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
import CollectionsIcon from '@mui/icons-material/Collections';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { moduleContentPage } from '@/apis/home';
import { getHotTopics, Topic } from '@/apis/topic';
import TopicCover from '@/components/topic/TopicCover';
import { CoverImage } from '@/components/common/CoverImage';
import { getDetailRoute } from '@/lib/contentRoute';
import { track } from '@/lib/track';
import { TYPE_GRADIENT, RANK_BG, IMAGE_OVERLAY } from '@/constants/gradients';
import { RecommendVideoFeed } from './components/RecommendVideoFeed';
import { MeTabView } from './components/MeTabView';
import TeleplayCard from './components/TeleplayCard';
import { useScrollToBottom } from '@/hooks/useInfiniteScroll';
import { useContentNavigate } from '@/lib/contentRoute';
import { homeClient } from '@/lib/api/client';
import LeaderboardMini from '@/components/leaderboard/LeaderboardMini';
import SpotlightCard from '@/components/reactbits/SpotlightCard';
import FadeContent from '@/components/reactbits/FadeContent';

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
  TELEPLAY: '电视剧', SHORT_DRAMA: '短剧', ANIMATION: '二次元', VIDEO: '游戏', NEWS: '资讯',
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

// 快捷入口:关注/朋友已并入「动态」页签(按 scope 切换),AI 推荐由 HomeLayout 渲染 AIRecommendPanel
const QUICK_LINKS: { key: string; href: string; label: string; icon: React.ReactNode }[] = [
  { key: 'follow', href: '/home/recommend?tab=feed&scope=follow', label: '关注', icon: <PersonIcon sx={{ fontSize: 14 }} /> },
  { key: 'friend', href: '/home/recommend?tab=feed&scope=friend', label: '朋友', icon: <GroupIcon sx={{ fontSize: 14 }} /> },
  { key: 'ai', href: '/home/recommend?tab=ai', label: 'AI 推荐', icon: <SmartToyIcon sx={{ fontSize: 14 }} /> },
];

function formatCount(n: number = 0): string {
  if (n == null || isNaN(n) || n < 0) return '0';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

const PAGE_SIZE = 12;

export default function HomeRecommendPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // 兼容 tab 和 section 两种 URL 参数名（后端用 section，前端导航用 tab）
  const tabParam = searchParams.get('tab');
  const sectionParam = searchParams.get('section');
  const tabFromUrl = tabParam || sectionParam || 'all';
  const activeCategory = TAB_TO_CATEGORY[tabFromUrl] || '全部';

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

  // 使用 useInfiniteQuery 实现真正的无限滚动分页
  const {
    data: contentData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['home-recommend', 'content', activeCategory],
    queryFn: async ({ pageParam = 1 }) => {
      const contentType = activeCategory === '全部' || activeCategory === '' ? undefined : (CATEGORY_TO_TYPE[activeCategory] || activeCategory);
      try {
        const resp = await moduleContentPage({
          page: pageParam,
          pageSize: PAGE_SIZE,
          ...(contentType ? { contentType } : {}),
          orderBy: 'COLLECT',
        }) as any;
        const records: ContentItem[] = resp?.data?.data?.list || resp?.data?.data?.records || [];
        const total = resp?.data?.data?.total || resp?.data?.data?.totalRow || 0;
        return { records, total, page: pageParam };
      } catch (err) {
        console.error('[HomeRecommend] contentQuery error:', err);
        throw err;
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { records, total, page } = lastPage;
      if (records.length === PAGE_SIZE && page * PAGE_SIZE < total) {
        return page + 1;
      }
      return undefined;
    },
    enabled: tabFromUrl !== 'recommend',
  });

  // 合并所有页面的数据
  const contentList = contentData?.pages.flatMap(page => page.records) || [];

  // 调试：监控数据变化
  console.log('[HomeRecommend] data changed:', {
    pagesCount: contentData?.pages.length,
    totalItems: contentList.length,
    hasNextPage,
    isFetchingNextPage,
    activeCategory,
    tabFromUrl,
  });

  // 填充到 PAGE_SIZE 个以便瀑布流显示
  const displayList = React.useMemo(() => {
    if (contentList.length >= PAGE_SIZE) return contentList;
    const placeholders: ContentItem[] = Array.from({ length: PAGE_SIZE - contentList.length }).map((_, i) => ({
      id: -(contentList.length + i + 1),
      title: '',
      contentType: 'NOVEL',
      status: 'placeholder',
    } as ContentItem));
    return [...contentList, ...placeholders];
  }, [contentList]);

  const loading = tabFromUrl === 'recommend' ? false : isLoading;

  // 初始加载完成后，加载更多时不显示骨架屏
  const loadingMore = isFetchingNextPage && contentList.length > 0;

  // 判断是否已加载完所有数据
  const isNoMore = !hasNextPage;

  const handleCardClick = (item: ContentItem) => {
    track(item.id, 'click', item.contentType || 'novel');
    const route = getDetailRoute(item.contentType, item.id);
    if (route) router.push(route);
  };

  // 使用 hook 监听滚动到底部（必须在 early return 之前调用）
  const scroll = useScrollToBottom({
    enabled: !loading && !loadingMore && hasNextPage,
  });

  if (tabFromUrl === 'me') {
    return <MeTabView />;
  }

  if (tabFromUrl === 'recommend') {
    return <RecommendVideoFeed />;
  }

  // 默认分类内容
  return (
    <Box sx={{ display: 'flex', gap: 2, px: { xs: 1.5, md: 3 }, py: { xs: 1.5, md: 2 }, minHeight: 0 }}>
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

        {/* 快捷入口 (关注/朋友 → 动态页签,AI 推荐) */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 2,
            flexWrap: 'wrap',
          }}
        >
          {QUICK_LINKS.map((l) => (
            <Box
              key={l.key}
              onClick={() => router.push(l.href, { scroll: false })}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.5,
                py: 0.75,
                borderRadius: 1.5,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                bgcolor: 'action.hover',
                color: 'text.secondary',
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.15s',
                '&:hover': { borderColor: 'rgba(254, 44, 85, 0.4)' },
              }}
            >
              {l.icon}
              {l.label}
            </Box>
          ))}
        </Box>

        {/* 内容瀑布流 - 使用 CSS Grid 避免 Masonry 数据丢失问题 */}
        {loading ? (
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: { xs: 1.25, md: 2 }
          }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" sx={{ aspectRatio: '4/5', bgcolor: 'action.hover' }} />
            ))}
          </Box>
        ) : (
          <Box>
            {/* 瀑布流使用 CSS Grid + masonry 布局 */}
            <Box sx={{
              // 手机也走两列:一列 4:5 的大卡在 375px 上一屏只放一张,像没内容
              columns: { xs: 2, md: 3 },
              columnGap: { xs: 10, md: 16 },
              '& > *': { mb: { xs: 1.25, md: 2 }, breakInside: 'avoid' }
            }}>
              {displayList.map((item, idx) => {
                const rank = idx + 1;
                const hasContent = item.id > 0;
                const gradient = TYPE_GRADIENT[item.contentType] || TYPE_GRADIENT.NOVEL;
                const isTeleplay = item.contentType === 'TELEPLAY'; // 短剧:支持内嵌播第一集

                if (!hasContent) {
                  return <Box key={`placeholder-${idx}`} sx={{ aspectRatio: '4/5' }} />;
                }

                // 短剧卡片:默认与普通卡片一致,但支持「▶ 第一集」就地内嵌播放
                if (isTeleplay) {
                  return (
                    <TeleplayCard
                      key={`content-${item.id}`}
                      item={item}
                      rank={rank}
                      gradient={gradient}
                      typeChip={TYPE_TO_CHIP[item.contentType] ?? '短剧'}
                      onOpen={() => handleCardClick(item)}
                    />
                  );
                }

                return (
                  <FadeContent key={`content-${item.id}`} distance={14} duration={480} delay={Math.min(idx % 9, 6) * 35}>
                  <SpotlightCard
                    spotlightColor="rgba(255,255,255,0.22)"
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
                  </SpotlightCard>
                  </FadeContent>
                );
              })}
            </Box>

            {/* Loading more skeleton */}
            {loadingMore && (
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                gap: 2,
                mt: 2
              }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" sx={{ aspectRatio: '4/5' }} />
                ))}
              </Box>
            )}

            {/* 空状态和底部提示 */}
            {contentList.length === 0 && !loading && (
              <Typography sx={{ textAlign: 'center', py: 4, color: 'text.secondary', fontSize: 13 }}>
                暂无内容
              </Typography>
            )}

            {/* No more data */}
            {!loadingMore && contentList.length > 0 && isNoMore && (
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

      {/* 热门专题 */}
      <HotTopicsSection />
    </Box>
  );
}

// 热门专题组件
function HotTopicsSection() {
  const router = useRouter();
  const { data: topics, isLoading } = useQuery({
    queryKey: ['home', 'hot-topics'],
    queryFn: async () => {
      const res = await getHotTopics(4);
      return res.data || [];
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Box
        sx={{
          borderRadius: 2,
          bgcolor: 'var(--bg-surface, transparent)',
          border: '1px solid var(--border-color, transparent)',
          overflow: 'hidden',
          p: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
          <CollectionsIcon sx={{ fontSize: 16, color: 'primary.main', mr: 0.75 }} />
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>热门专题</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
          ))}
        </Box>
      </Box>
    );
  }

  if (!topics || topics.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        borderRadius: 2,
        bgcolor: 'var(--bg-surface, transparent)',
        border: '1px solid var(--border-color, transparent)',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.5, pb: 1 }}>
        <CollectionsIcon sx={{ fontSize: 16, color: 'primary.main', mr: 0.75 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, currentColor)', flex: 1 }}>
          热门专题
        </Typography>
        <Typography
          sx={{ fontSize: 10, color: 'var(--text-muted, currentColor)', cursor: 'pointer' }}
          onClick={() => router.push('/topic')}
        >
          更多
        </Typography>
      </Box>
      <Box sx={{ px: 1.5, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {topics.map((topic: Topic) => (
          <Box
            key={topic.id}
            onClick={() => router.push(`/detail/topic-detail?id=${topic.id}`)}
            sx={{
              display: 'flex',
              gap: 1.5,
              p: 1,
              borderRadius: 1.5,
              cursor: 'pointer',
              transition: 'background-color 0.15s',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Box
              sx={{
                width: 60,
                height: 45,
                borderRadius: 1,
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <TopicCover
                id={topic.id}
                cover={topic.cover}
                title={topic.title}
                contentType={topic.contentType}
                aspectRatio="4/3"
                iconSize={18}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--text-primary, currentColor)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {topic.title}
              </Typography>
              <Typography
                sx={{
                  fontSize: 10,
                  color: 'var(--text-muted, currentColor)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {topic.contentCount} 内容 · {topic.viewCount} 浏览
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
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

// 榜单 Tab:站内热度日榜(可切类型),与左侧导航「排行榜」同源。
// (这里原来渲染的是 /side/comments —— 一串用户评论,并不是榜单。)
function RankingTabContent() {
  return <LeaderboardMini embedded limit={10} />;
}
