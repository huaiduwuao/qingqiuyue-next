'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { moduleContentPage } from '@/apis/home';
import { getHomeRecommendFollow, getHomeRecommendFriend, type RecommendWork } from '@/apis/dashboard';
import { CoverImage } from '@/components/common/CoverImage';
import { getDetailRoute } from '@/lib/contentRoute';
import { track } from '@/lib/track';
import { TYPE_GRADIENT, RANK_BG } from '@/constants/gradients';
import { RecommendVideoFeed } from './components/RecommendVideoFeed';
import { MeTabView } from './components/MeTabView';

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

export default function HomeRecommendPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || 'all';
  const isSpecialTab = SPECIAL_TABS.has(tabFromUrl);
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
  const setActiveSpecial = (tab: string) => setTab(tab);

  const contentQuery = useQuery({
    queryKey: ['home-recommend', 'content', activeCategory],
    queryFn: () => moduleContentPage({
      pageNum: 1,
      pageSize: 12,
      contentType: activeCategory === '全部' ? '' : CATEGORY_TO_TYPE[activeCategory] || activeCategory,
      order: 'COLLECT',
    }).then((r: any) => r.data?.list || []),
    placeholderData: (prev) => prev || [],
    enabled: !isSpecialTab && tabFromUrl !== 'recommend',
  });

  const followQuery = useQuery({
    queryKey: ['home-recommend', 'follow'],
    queryFn: () => getHomeRecommendFollow({ page: 1, size: 12 }),
    enabled: tabFromUrl === 'follow',
    refetchOnMount: 'always',
  });

  const friendQuery = useQuery({
    queryKey: ['home-recommend', 'friend'],
    queryFn: () => getHomeRecommendFriend({ page: 1, size: 12 }),
    enabled: tabFromUrl === 'friend',
    refetchOnMount: 'always',
  });

  React.useEffect(() => {
    if (tabFromUrl === 'ai') {
      router.replace('/search?q=' + encodeURIComponent('推荐'));
    }
  }, [tabFromUrl, router]);

  let contentList: ContentItem[] = contentQuery.data || [];
  if (tabFromUrl === 'follow') {
    const raw = (followQuery.data?.records ?? followQuery.data?.list ?? []) as RecommendWork[];
    contentList = raw.map((w) => ({
      id: Number(w.id.replace(/^\D+/, '')) || 0,
      title: w.title,
      contentType: 'VIDEO',
      status: w.status,
      cover: w.cover,
      viewCount: w.views,
    } as ContentItem));
  } else if (tabFromUrl === 'friend') {
    const raw = (friendQuery.data?.records ?? friendQuery.data?.list ?? []) as RecommendWork[];
    contentList = raw.map((w) => ({
      id: Number(w.id.replace(/^\D+/, '')) || 0,
      title: w.title,
      contentType: 'VIDEO',
      status: w.status,
      cover: w.cover,
      viewCount: w.views,
    } as ContentItem));
  }

  const loading = isSpecialTab
    ? (tabFromUrl === 'follow' ? followQuery.isFetching : tabFromUrl === 'friend' ? friendQuery.isFetching : false)
    : tabFromUrl === 'recommend'
      ? false
      : contentQuery.isFetching;

  const handleCardClick = (item: ContentItem) => {
    track(item.id, 'click', item.contentType || 'novel');
    const route = getDetailRoute(item.contentType, item.id);
    if (route) router.push(route);
  };

  const displayList = React.useMemo(() => {
    if (contentList.length >= 12) return contentList;
    const placeholders: ContentItem[] = Array.from({ length: 12 - contentList.length }).map((_, i) => ({
      id: -(contentList.length + i + 1),
      title: '',
      contentType: 'NOVEL',
      status: 'placeholder',
    } as ContentItem));
    return [...contentList, ...placeholders];
  }, [contentList]);

  if (tabFromUrl === 'me') {
    return <MeTabView />;
  }

  if (tabFromUrl === 'recommend') {
    return <RecommendVideoFeed />;
  }

  return (
    <Box sx={{ px: 3, py: 2 }}>
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
            {contentList.length === 0 ? (loading ? '加载中…' : '关注的人还没发作品') : `共 ${contentList.length} 部`}
          </Typography>
        )}
        {tabFromUrl === 'friend' && (
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {contentList.length === 0 ? (loading ? '加载中…' : '还没有互相关注的朋友') : `共 ${contentList.length} 部`}
          </Typography>
        )}
      </Box>

      {loading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" sx={{ aspectRatio: '4/5', bgcolor: 'action.hover' }} />
          ))}
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1.5,
          }}
        >
          {displayList.map((item, idx) => {
            const rank = idx + 1;
            const hasContent = item.id > 0;
            const gradient = TYPE_GRADIENT[item.contentType] || TYPE_GRADIENT.NOVEL;

            if (!hasContent) {
              return <Box key={item.id} sx={{ aspectRatio: '4/5' }} />;
            }

            return (
              <Box
                key={item.id}
                onClick={() => handleCardClick(item)}
                sx={{
                  position: 'relative',
                  borderRadius: 2,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  aspectRatio: '4/5',
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
        </Box>
      )}
    </Box>
  );
}
