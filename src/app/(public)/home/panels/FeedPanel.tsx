'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Tooltip from '@mui/material/Tooltip';
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import ModeCommentOutlinedIcon from '@mui/icons-material/ModeCommentOutlined';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { CoverImage } from '@/components/common/CoverImage';
import { UserAvatarLink } from '@/components/common/UserAvatarLink';
import { useContentNavigate } from '@/lib/contentRoute';
import { fetchSubcategories, type SubcategoryItem } from '@/apis/home-discover';
import { moduleContentPage } from '@/apis/home';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { ListLayout, ListLayoutSwitch, LIST_ROW } from '@/components/common/ListLayout';
import FadeContent from '@/components/reactbits/FadeContent';
import SpotlightCard from '@/components/reactbits/SpotlightCard';
import MusicPlayButton from '@/components/player/MusicPlayButton';
import SplitText from '@/components/reactbits/SplitText';
import BlurText from '@/components/reactbits/BlurText';

// 后端 pkg/jsonfix 已将 BIGINT > Number.MAX_SAFE_INTEGER (2^53) 转为字符串。
// 前端不可再 Number() 转换，否则精度再次丢失导致详情页 404。
// 此函数在 id 超出安全范围时保留原始形式（数字或字符串）。
const safeId = (id: any): string | number => {
  if (id === null || id === undefined) return id as any;
  const n = Number(id);
  if (Number.isSafeInteger(n)) return n;
  // 超出安全范围:保留原始值（后端已转 string）
  return String(id);
};

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

// 精选流参与交错的类型。NEWS 不在内:它基本是热搜词条,没有封面。
const RECOMMEND_TYPES = ['VIDEO', 'FILM', 'TELEPLAY', 'ANIMATION', 'VSHOW', 'COMICS', 'MUSIC', 'NOVEL', 'SHORT_DRAMA', 'ARTICLE', 'LIVE'];
const RECOMMEND_PER_TYPE = 2;

// 字段适配:后端 entity 用 coverUrl/author/readNum/agreeNum → FeedCard 期望字段
function toFeedRecord(item: any) {
  // postedAgoMin:从 createTime 计算分钟数
  let postedAgoMin = item.postedAgoMin || 0;
  if (!postedAgoMin && item.createTime) {
    postedAgoMin = Math.floor((Date.now() - new Date(item.createTime).getTime()) / 60000);
  }
  // durationSec:从 content 字段提取(如 "01:23:45" → 5025秒)
  let durationSec = item.durationSec || item.duration || 0;
  if (!durationSec && typeof item.content === 'string') {
    const match = item.content.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      const [, h, m, s] = match;
      durationSec = (parseInt(h) * 3600) + (parseInt(m) * 60) + (parseInt(s || '0'));
    }
  }
  return {
    ...item,
    id: safeId(item.id),
    cover: item.cover || item.coverUrl || '',
    authorName: item.authorName || item.author || '',
    authorAvatar: item.authorAvatar || item.avatar || '',
    views: item.views || item.readNum || 0,
    likes: item.likes || item.agreeNum || 0,
    comments: item.comments || item.commentNum || 0,
    shares: item.shares || item.shareNum || 0,
    postedAgoMin,
    durationSec,
    category: item.category || item.contentType?.toLowerCase() || 'video',
  };
}

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

// 关注/朋友已并入「动态」页签(CommunityPanel),这里只剩精选作品流
type PanelTab = 'home' | 'recommend';

export function FeedPanel({ tab }: { tab: PanelTab }) {
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
  const urlSort = (searchParams.get('sort') as 'views' | 'new' | 'hot' | 'rating') || 'views';
  const [sort, setSortState] = useState<'views' | 'new' | 'hot' | 'rating'>(urlSort);
  const setSort = (next: 'views' | 'new' | 'hot' | 'rating') => {
    setSortState(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'views') params.delete('sort');
    else params.set('sort', next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  useEffect(() => { setSortState(urlSort); }, [urlSort]);
  // 评分/年份筛选(分类内容页):rating=最低分, year=上映年份
  const urlRatingMin = searchParams.get('rating') || '';
  const [ratingMin, setRatingMin] = useState<string>(urlRatingMin);
  const setRating = (next: string) => {
    setRatingMin(next);
    const params = new URLSearchParams(searchParams.toString());
    if (!next) params.delete('rating');
    else params.set('rating', next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  useEffect(() => { setRatingMin(urlRatingMin); }, [urlRatingMin]);
  const urlYear = searchParams.get('year') || '';
  const [year, setYearState] = useState<string>(urlYear);
  const setYear = (next: string) => {
    setYearState(next);
    const params = new URLSearchParams(searchParams.toString());
    if (!next) params.delete('year');
    else params.set('year', next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  useEffect(() => { setYearState(urlYear); }, [urlYear]);
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

  // 使用 useInfiniteQuery 实现真正的无限滚动分页(分类内容用 /module/content/list)
  const {
    data: feedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['home', 'feed', tab, section, sort, genre, ratingMin, year],
    queryFn: async ({ pageParam = 1 }) => {
      // recommend 精选流:多类型交错,真正按页翻。
      //
      // 原先每类型固定取第 1 页 2 条、返回值里 page 恒为 1:首屏最多 12 条,
      // 往下滚 getNextPageParam 永远算出 page=2 却又拿回同一批(重复 key),
      // 某类型没数据(FILM/NOVEL 曾为 0)就更少 —— 这就是精选页"没几条"的原因。
      // 现在每页从每个类型各取第 pageParam 页,按轮转交错,任一类型还有剩就继续翻。
      if (section === 'recommend') {
        const results = await Promise.all(
          RECOMMEND_TYPES.map((type) =>
            moduleContentPage({
              page: pageParam,
              pageSize: RECOMMEND_PER_TYPE,
              contentType: type,
              // 定时刷新会刷新仍在各平台热榜上的条目,update_time 越近越"正在热"。
              orderBy: 'update_time',
              // 只要有封面的条目:资讯热搜这类纯文字条目在瀑布流里是一片空白卡片。
              hasCover: true,
            }).catch(() => null),
          ),
        );
        const lists: any[][] = results.map((r: any) => r?.data?.list || r?.data?.records || []);
        const totals = results.map((r: any) => Number(r?.data?.total || r?.data?.totalRow || 0));
        const merged: any[] = [];
        for (let i = 0; i < RECOMMEND_PER_TYPE; i++) {
          for (const list of lists) {
            if (list[i]) merged.push(list[i]);
          }
        }
        const hasMore = lists.some(
          (list, i) => list.length === RECOMMEND_PER_TYPE && pageParam * RECOMMEND_PER_TYPE < totals[i],
        );
        const total = totals.reduce((a, b) => a + b, 0);
        return { records: merged.map(toFeedRecord), total, page: pageParam, hasMore };
      }
      // 分类内容使用 /module/content/list
      const contentType = SECTION_TO_TYPE[section];
      const resp = await moduleContentPage({
        page: pageParam,
        pageSize: PAGE_SIZE,
        ...(contentType ? { contentType } : {}),
        // 后端认的参数名是 orderBy;之前传 order 被静默丢弃,"最新/高评分"排序从未生效。
        orderBy: sort === 'new' ? 'CREATE_TIME' : sort === 'rating' ? 'rating' : 'COLLECT',
        ...(ratingMin ? { ratingMin } : {}),
        ...(year ? { releaseYear: year } : {}),
      }) as any;
      // moduleContentPage 内部用 contentClient 包装, resp 同上是 { code, data: { list, total }, msg }
      const rawRecords = resp?.data?.list || resp?.data?.records || [];
      const records = rawRecords.map(toFeedRecord);
      const total = resp?.data?.total || resp?.data?.totalRow || 0;
      return { records, total, page: pageParam };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { records, total, page } = lastPage;
      if ('hasMore' in lastPage) return lastPage.hasMore ? page + 1 : undefined;
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
      {tab === 'home' && (
        <Box
          sx={{
            // 不再 sticky:之前它 sticky top:0,下面的 Tabs 再 sticky top:calc(56px + sat)。
            // 顶栏已经吃掉了安全区,这里再加一次就在刘海机上留出一条空缝,内容从缝里
            // 穿过去("顶栏重叠")。现在标题随内容滚走,只有 Tabs 吸顶,手机上也省一截高度。
            flexShrink: 0,
            px: { xs: 1.5, md: 2 },
            pt: { xs: 1.25, md: 1.5 },
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
            <Typography component="div" sx={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary, #ffffff)', letterSpacing: 0.3 }}>
              <SplitText text="精选" delay={70} onView={false} />
            </Typography>
            <Typography component="div" sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
              <BlurText text="多分类聚合 · 实时热度排序" delay={22} />
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'warning.main' }}>
            <TrendingUpIcon sx={{ fontSize: 14 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700 }}>实时榜</Typography>
          </Box>
        </Box>
      )}
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            bgcolor: 'var(--bg-topbar, rgba(10, 10, 15, 0.85))',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
            flexShrink: 0,
          }}
        >
          {tab === 'home' && (
            <Box sx={{ display: 'flex', alignItems: 'center', pr: 1.5 }}>
            <Tabs
              value={section}
              onChange={(_, v) => setSection(v)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                flex: 1,
                minWidth: 0,
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
            <ListLayoutSwitch />
            </Box>
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
                { key: 'rating', label: '高评分' },
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
          {/* 评分/年份筛选(分类内容页;仅影视类生效,推荐/关注不展示) */}
          {tab === 'home' && section !== 'recommend' && (
            <Box sx={{ position: 'relative', px: 1.5, pb: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' }, pr: 3 }}>
                <Typography sx={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted, rgba(255,255,255,0.4))', mr: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>筛选</Typography>
                {['8', '9'].map((r) => {
                  const active = ratingMin === r;
                  return (
                    <Box
                      key={`r${r}`}
                      onClick={() => setRating(active ? '' : r)}
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
                      {r}分+
                    </Box>
                  );
                })}
                <Typography sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.3))', flexShrink: 0, mx: 0.25 }}>|</Typography>
                {[String(new Date().getFullYear()), String(new Date().getFullYear() - 1)].map((y) => {
                  const active = year === y;
                  return (
                    <Box
                      key={`y${y}`}
                      onClick={() => setYear(active ? '' : y)}
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
                      {y}
                    </Box>
                  );
                })}
              </Box>
              {/* 右侧渐变遮罩提示可滚动 */}
              <Box sx={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 24, background: 'linear-gradient(to right, transparent, var(--bg-body, #F5F5F7))', pointerEvents: 'none' }} />
            </Box>
          )}
        </Box>

      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
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
              {feedList.length > 0 ? (
                <ListLayout minColumnWidth={260} listMaxWidth="var(--page-max-narrow)">
                  {feedList.map((item, i) => (
                    <FadeContent key={item.id} distance={14} duration={480} delay={Math.min(i % 8, 6) * 35}>
                      <FeedCard item={item} />
                    </FadeContent>
                  ))}
                </ListLayout>
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
      </Box>
    </Box>
  );
}

// ─── 卡片 ───
function FeedCard({ item }: { item: FeedItem }) {
  const navigate = useContentNavigate();

  // 后端 /feed 返回的 item.category 实际是 module_content.content_type(已是规范大写
  // NOVEL/FILM/.../VIDEO/LIVE),直接用作详情路由 type,不再做枚举猜测。
  // 兼容旧 mock(可能返 'video'/'live' 等小写)的兜底映射。
  const legacyCategoryToType: Record<string, string> = {
    video: 'VIDEO', short: 'VIDEO', image: 'VIDEO', live: 'LIVE',
  };
  const rawType = (item as any).contentType || item.category;
  const targetType = rawType ? (legacyCategoryToType[rawType] || String(rawType).toUpperCase()) : null;


  return (
    <SpotlightCard
      spotlightColor="rgba(254, 44, 85, 0.14)"
      onClick={() => {
        if (targetType) navigate(targetType, item.id);
      }}
      sx={{
        borderRadius: 2,
        bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))',
        border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        overflow: 'hidden',
        cursor: targetType ? 'pointer' : 'default',
        transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
        [LIST_ROW]: { display: 'flex' },
        '&:hover': targetType
          ? { transform: 'translateY(-3px)', borderColor: 'var(--border-strong, rgba(255,255,255,0.12))', boxShadow: '0 14px 32px rgba(0,0,0,0.18)' }
          : {},
      }}
    >
      <Box sx={{ position: 'relative', aspectRatio: '16/9', bgcolor: 'var(--bg-input, rgba(255,255,255,0.04))', overflow: 'hidden', [LIST_ROW]: { width: { xs: 140, sm: 240 }, flexShrink: 0, alignSelf: 'center' } }}>
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
        {/* 音乐卡片:不进详情页也能直接听,交给全局底栏 */}
        {targetType === 'MUSIC' && (
          <MusicPlayButton
            id={item.id}
            title={item.title}
            sx={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', '&:hover': { transform: 'translate(-50%, -50%) scale(1.06)' } }}
          />
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

      <Box sx={{ p: 1.5, [LIST_ROW]: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}>
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
          <UserAvatarLink userId={item.authorId} name={item.authorName} src={item.authorAvatar} size={22} />
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
    </SpotlightCard>
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
function EmptyHint({ tab, section }: { tab: PanelTab; section: FeedItem['section'] }) {
  const isRec = section === 'recommend';
  let title = '该分类暂无内容';
  let hint = '试试切换到其他分类';
  if (isRec) {
    if (tab === 'home') { title = '精选内容为空'; hint = '稍后再来看看'; }
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
