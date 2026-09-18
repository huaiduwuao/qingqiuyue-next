'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import { homeClient } from '@/lib/api/client';
import { CoverImage } from '@/components/common/CoverImage';
import { useContentNavigate, TYPE_LABEL } from '@/lib/contentRoute';
import { getFacets, FacetOption } from '@/apis/facets';
import { IMAGE_OVERLAY, MEDAL, SECTION_TINT, gradient2 } from '@/constants/gradients';
import { ListLayout, ListLayoutSwitch, LIST_ROW } from '@/components/common/ListLayout';

/**
 * 放映厅 —— 电影 / 电视剧 / 动漫 / 综艺。
 *
 * 这个面板此前有三处坏掉的地方,都源于同一件事:前端自己又写了一份分类表。
 *
 *  1. **整页卡片点不动**。后端返回的 `category` 是 Doris 里的规范类型码
 *     ("FILM"/"TELEPLAY"),而这里拿它去查一张 movie|drama|anime|variety
 *     的表,查出 undefined,`useContentNavigate` 找不到路由就静默返回 ——
 *     点击没有任何反应,也没有报错。现在直接用后端给的 `contentType`。
 *  2. **两个分类按钮是空的**。前端传 category=drama / variety,后端把它们
 *     大写成 DRAMA / VARIETY 去查 content_type,库里没有这两个值。
 *  3. **"短剧"在放映厅里**。CAT_TO_TYPE 把"短剧"映射到 TELEPLAY,于是
 *     放映厅的"短剧"按钮筛出来的是电视剧。短剧有自己的频道,这里不放。
 *
 * 直播也从这里移除了:直播间不是"一部作品",它跟电影混在一张网格里,用户
 * 点进去才发现是另一回事。直播有独立的 /home/recommend?tab=live。
 *
 * 分类、题材、地区、年份、评分现在全部由 /home/facets 现算下发(带条数),
 * 前端不再持有任何分类常量。
 */

type TheaterItem = {
  id: number;
  title: string;
  cover: string;
  /** 后端规范类型码,详情页路由据此取。 */
  contentType: string;
  /** 原始 content_type,仅兼容旧字段,展示与路由都不要用它。 */
  category?: string;
  durationMin?: number;
  rating?: number;
  region?: string;
  regionCode?: string;
  genre?: string;
  genres?: string[];
  year?: number;
  views?: number;
  hotRank?: number;
};

type Resp = { list: TheaterItem[]; total: number };

const SORTS = [
  { key: 'hot', label: '人气榜', icon: <WhatshotIcon sx={{ fontSize: 14 }} /> },
  { key: 'rating', label: '高评分', icon: <StarRoundedIcon sx={{ fontSize: 14 }} /> },
  { key: 'new', label: '最新', icon: <AccessTimeRoundedIcon sx={{ fontSize: 14 }} /> },
];

/** 分类按钮的配色。按类型码索引;后端新增类型时退回中性色,不会崩。 */
const CAT_GRADIENT: Record<string, string> = {
  all: gradient2('#FE2C55', '#FFB400'),
  FILM: gradient2('#FE2C55', '#FF6B8A'),
  TELEPLAY: gradient2('#8B5CF6', '#C4B5FD'),
  ANIMATION: gradient2('#06B6D4', '#5DF7F2'),
  VSHOW: gradient2('#FFB400', '#FFD566'),
};
const NEUTRAL_GRADIENT = gradient2('#6B7280', '#9CA3AF');

const CAT_COLOR: Record<string, string> = {
  FILM: 'primary.main',
  TELEPLAY: '#8B5CF6',
  ANIMATION: 'secondary.main',
  VSHOW: 'warning.main',
};
const DEFAULT_CAT_COLOR = 'var(--text-muted, rgba(255,255,255,0.4))';

/** 类型码 → 展示名。唯一来源是 contentType.gen.ts(后端契约生成物)。 */
function typeLabel(t: string | undefined | null): string {
  const code = String(t ?? '').trim().toUpperCase();
  return TYPE_LABEL[code] || code || '其他';
}
function typeColor(t: string | undefined | null): string {
  return CAT_COLOR[String(t ?? '').trim().toUpperCase()] ?? DEFAULT_CAT_COLOR;
}

const PAGE_SIZE = 12;

export function TheaterPanel() {
  const [category, setCategory] = useState('all');
  const [region, setRegion] = useState('');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('');
  const [minRating, setMinRating] = useState('');
  const [sort, setSort] = useState('hot');

  // 筛选器目录随分类变:电影的题材和综艺的题材不是一套词。
  const facetsQuery = useQuery({
    queryKey: ['home', 'theater', 'facets', category],
    queryFn: () => getFacets('theater', category),
    staleTime: 5 * 60 * 1000,
  });
  const facets = facetsQuery.data;

  // 切换分类后,原来选中的题材/地区可能在新分类下根本不存在(选了"综艺"
  // 之后还挂着"武侠仙侠")。目录一到就把失效的选项清掉,否则用户会看到
  // 一个选中的按钮 + 一个空列表,而且找不到是哪个条件筛空的。
  useEffect(() => {
    if (!facets) return;
    const has = (opts: FacetOption[] | undefined, v: string) =>
      !v || (opts ?? []).some((o) => o.value === v);
    if (!has(facets.genres, genre)) setGenre('');
    if (!has(facets.regions, region)) setRegion('');
    if (!has(facets.years, year)) setYear('');
    if (!has(facets.ratings, minRating)) setMinRating('');
  }, [facets]); // eslint-disable-line react-hooks/exhaustive-deps

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (category !== 'all') p.set('category', category);
    if (region) p.set('region', region);
    if (genre) p.set('genre', genre);
    if (year) p.set('year', year);
    if (minRating) p.set('minRating', minRating);
    if (sort && sort !== 'hot') p.set('sort', sort);
    return p;
  }, [category, region, genre, year, minRating, sort]);

  const {
    data: theaterData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['home', 'theater', params.toString()],
    queryFn: async ({ pageParam = 1 }) => {
      const p = new URLSearchParams(params);
      p.set('page', String(pageParam));
      p.set('size', String(PAGE_SIZE));
      const resp = await homeClient.get<Resp>(`/theater/items?${p.toString()}`).then((r) => r);
      return { records: resp?.list || [], total: resp?.total || 0, page: pageParam };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { records, total, page } = lastPage;
      if (records.length === PAGE_SIZE && page * PAGE_SIZE < total) return page + 1;
      return undefined;
    },
  });

  const theaterList = theaterData?.pages.flatMap((page) => page.records) || [];
  // 总数取后端筛选后的 total,而不是"已加载条数"。以前这里显示的是
  // theaterList.length,于是滚动加载时"共 N 部"会一直往上跳。
  const total = theaterData?.pages[0]?.total ?? 0;

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage && !isLoading) {
          fetchNextPage();
        }
      },
      { threshold: 0.1, rootMargin: '100px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  const activeLabel = category === 'all' ? '全部' : typeLabel(category);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      <Box
        sx={{
          position: 'relative',
          mb: 3,
          p: { xs: 2, md: 3 },
          borderRadius: 3,
          background: SECTION_TINT.RED_PURPLE,
          border: '1px solid rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'absolute', right: -20, top: -20, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(254,44,85,0.18), transparent 70%)' }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5, position: 'relative' }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, background: gradient2('#FE2C55', '#FFB400'), display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(254,44,85,0.32)' }}>
            <LocalFireDepartmentIcon sx={{ fontSize: 20, color: '#fff' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: { xs: 18, md: 22 }, fontWeight: 800, color: 'var(--text-primary, #ffffff)', letterSpacing: 0.5 }}>放映厅</Typography>
            <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.5))', mt: 0.25 }}>电影 · 电视剧 · 动漫 · 综艺</Typography>
          </Box>
        </Box>
      </Box>

      <Top10Section params={params} />

      {/* 分类 */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted, rgba(255,255,255,0.4))', width: 48, flexShrink: 0 }}>分类</Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {(facets?.categories ?? []).map((c) => {
              const active = category === c.value;
              return (
                <Box
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  sx={{
                    position: 'relative',
                    px: 1.5,
                    py: 0.625,
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontWeight: active ? 700 : 500,
                    color: active ? '#fff' : 'var(--text-secondary, rgba(255,255,255,0.7))',
                    background: active ? (CAT_GRADIENT[c.value] ?? NEUTRAL_GRADIENT) : 'var(--bg-input, rgba(255,255,255,0.04))',
                    border: '1px solid',
                    borderColor: active ? 'transparent' : 'var(--border-color, rgba(255,255,255,0.08))',
                    boxShadow: active ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
                    transition: 'all 0.15s',
                    '&:hover': { transform: 'translateY(-1px)' },
                  }}
                >
                  {c.label}
                  <Box component="span" sx={{ ml: 0.5, fontSize: 10, opacity: 0.65 }}>{c.count}</Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* 题材 / 地区 / 年份 / 评分 / 排序 —— 选项全部来自后端目录 */}
      <Box
        sx={{
          mb: 3,
          p: 1.5,
          borderRadius: 2,
          bgcolor: 'var(--bg-input, rgba(255,255,255,0.03))',
          border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr 1fr 1fr' },
          gap: 1.5,
        }}
      >
        <FilterRow label="题材" allLabel="全部题材" options={facets?.genres} value={genre} onChange={setGenre} />
        <FilterRow label="地区" allLabel="全部地区" options={facets?.regions} value={region} onChange={setRegion} />
        <FilterRow label="年份" allLabel="全部年份" options={facets?.years} value={year} onChange={setYear} />
        <FilterRow label="评分" allLabel="全部评分" options={facets?.ratings} value={minRating} onChange={setMinRating} />
        <Box>
          <Typography sx={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted, rgba(255,255,255,0.4))', mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>排序</Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {SORTS.map((s) => {
              const active = sort === s.key;
              return (
                <Box
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    cursor: 'pointer',
                    fontSize: 11.5,
                    fontWeight: active ? 700 : 500,
                    color: active ? 'primary.main' : 'var(--text-secondary, rgba(255,255,255,0.6))',
                    bgcolor: active ? 'rgba(254,44,85,0.12)' : 'transparent',
                    border: '1px solid',
                    borderColor: active ? 'rgba(254,44,85,0.4)' : 'transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  {s.icon}
                  {s.label}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      <Box sx={{ mt: 4, mb: 2, display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{activeLabel}</Typography>
        <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
          {sort === 'rating' ? '按评分排序' : sort === 'new' ? '按上映年份排序' : '按播放量排序'}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>共 {total} 部</Typography>
        <ListLayoutSwitch sx={{ alignSelf: 'center' }} />
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)', lg: 'repeat(5, 1fr)' }, gap: 2 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Box key={i} sx={{ aspectRatio: '16/9', borderRadius: 2, bgcolor: 'action.hover' }} />
          ))}
        </Box>
      ) : (
        <Box>
          {theaterList.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography sx={{ color: 'text.secondary' }}>没有符合条件的内容</Typography>
              <Typography sx={{ color: 'text.disabled', fontSize: 12, mt: 0.5 }}>试着放宽题材或年份</Typography>
            </Box>
          ) : (
            <ListLayout minColumnWidth={240} listMaxWidth="var(--page-max-narrow)">
              {theaterList.map((item) => (
                <TheaterCard key={item.id} item={item} />
              ))}
            </ListLayout>
          )}

          {isFetchingNextPage && (
            <Typography sx={{ textAlign: 'center', py: 2, color: 'text.secondary', fontSize: 12 }}>加载中...</Typography>
          )}
          {!isFetchingNextPage && theaterList.length > 0 && !hasNextPage && (
            <Typography sx={{ textAlign: 'center', py: 3, color: 'text.disabled', fontSize: 12 }}>- 没有更多了 -</Typography>
          )}
          <Box ref={sentinelRef} sx={{ height: 1 }} />
        </Box>
      )}
    </Box>
  );
}

/**
 * 热门榜跟着筛选条件走。以前它只吃 category,用户筛了"日本 · 动漫"而榜单
 * 纹丝不动 —— 看上去像是筛选没生效。
 */
function Top10Section({ params }: { params: URLSearchParams }) {
  const qs = params.toString();
  const topQuery = useQuery({
    queryKey: ['home', 'theater', 'top', qs],
    queryFn: () => homeClient.get<Resp>(`/theater/top?${qs}`).then((r) => r),
  });

  const list = topQuery.data?.list;
  if (topQuery.isLoading || !list?.length) return null;

  const category = params.get('category') || 'all';
  const title = category === 'all' ? '本周热门' : `${typeLabel(category)}热门`;
  const ordered = [...list].sort((a, b) => (a.hotRank || 99) - (b.hotRank || 99)).slice(0, 10);

  return (
    <Box
      sx={{
        position: 'relative',
        mb: 1,
        p: { xs: 2, md: 2.5 },
        borderRadius: 2.5,
        background: SECTION_TINT.PRIMARY_PURPLE,
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ position: 'absolute', top: 12, right: 16, display: 'flex', alignItems: 'center', gap: 0.75, color: 'warning.main' }}>
        <LocalFireDepartmentIcon sx={{ fontSize: 18 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>TOP 10 热门榜</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <WhatshotIcon sx={{ fontSize: 20, color: 'primary.main' }} />
        <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{title}</Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
          gap: 1.25,
        }}
      >
        {ordered.map((d) => (
          <TheaterRankCard key={d.id} item={d} />
        ))}
      </Box>
    </Box>
  );
}

function FilterRow({
  label,
  allLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  allLabel: string;
  options: FacetOption[] | undefined;
  value: string;
  onChange: (v: string) => void;
}) {
  // 后端返回空数组 = 这批内容里这个维度一条数据都没有(比如直播没有年份)。
  // 那就不渲染这一列,而不是渲染一个只有"全部"的假筛选器。
  if (!options || options.length === 0) return null;
  const all: FacetOption = { value: '', label: allLabel, count: 0 };
  return (
    <Box>
      <Typography sx={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted, rgba(255,255,255,0.4))', mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Typography>
      <Box
        sx={{
          display: 'flex',
          gap: 0.5,
          overflowX: 'auto',
          pb: 0.5,
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {[all, ...options].map((o) => {
          const active = value === o.value;
          return (
            <Box
              key={o.value || '__all__'}
              onClick={() => onChange(o.value)}
              title={o.count ? `${o.count} 部` : undefined}
              sx={{
                flexShrink: 0,
                px: 1,
                py: 0.4,
                borderRadius: 1,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                color: active ? 'primary.main' : 'var(--text-secondary, rgba(255,255,255,0.65))',
                bgcolor: active ? 'rgba(254,44,85,0.12)' : 'transparent',
                border: '1px solid',
                borderColor: active ? 'rgba(254,44,85,0.4)' : 'rgba(255,255,255,0.06)',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {o.label}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function TheaterRankCard({ item }: { item: TheaterItem }) {
  const navigate = useContentNavigate();
  const rank = item.hotRank || 0;
  const isTop3 = rank >= 1 && rank <= 3;
  const medal = isTop3 ? MEDAL[rank] : null;
  const badgeBg = isTop3
    ? medal!.badge
    : 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)';
  const badgeColor = isTop3 ? medal!.txt : 'var(--text-primary, #fff)';
  const cardBg = isTop3 ? medal!.bg : 'var(--bg-surface, rgba(20, 22, 32, 0.6))';
  const cardBorder = isTop3 ? medal!.border : '1px solid var(--border-color, rgba(255,255,255,0.06))';

  return (
    <Box
      onClick={() => navigate(item.contentType, item.id)}
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        background: cardBg,
        border: cardBorder,
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 24px rgba(0,0,0,0.3)' },
      }}
    >
      <Box sx={{ position: 'relative', aspectRatio: '3/4' }}>
        <CoverImage src={item.cover} alt={item.title} sx={{ width: '100%', height: '100%' }} />
        <Box sx={{ position: 'absolute', inset: 0, background: IMAGE_OVERLAY.HEAVY }} />
        <Box sx={{ position: 'absolute', top: 6, left: 6, minWidth: 24, height: 24, borderRadius: '50%', background: badgeBg, color: badgeColor, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', backdropFilter: isTop3 ? 'none' : 'blur(4px)', border: isTop3 ? 'none' : '1px solid rgba(255,255,255,0.2)', boxShadow: isTop3 ? '0 2px 6px rgba(0,0,0,0.4)' : 'none', zIndex: 1, fontVariantNumeric: 'tabular-nums' }}>
          {rank}
        </Box>
        <Box sx={{ position: 'absolute', top: 6, right: 6, display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-end' }}>
          {!!item.rating && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.6)', color: 'warning.main', fontSize: 9, fontWeight: 700 }}>
              <StarRoundedIcon sx={{ fontSize: 9 }} />{item.rating.toFixed(1)}
            </Box>
          )}
          <Box sx={{ px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.6)', color: typeColor(item.contentType), fontSize: 9, fontWeight: 600 }}>
            {typeLabel(item.contentType)}
          </Box>
        </Box>
        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 1, background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 100%)' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1.2, mb: 0.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.title}
          </Typography>
          <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>{subline(item)}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

function TheaterCard({ item }: { item: TheaterItem }) {
  const navigate = useContentNavigate();
  return (
    <Box
      onClick={() => navigate(item.contentType, item.id)}
      sx={{
        [LIST_ROW]: { display: 'flex' },
        borderRadius: 2,
        bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
        border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
        '&:hover': { transform: 'translateY(-3px)', borderColor: 'var(--border-strong, rgba(255,255,255,0.16))', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' },
      }}
    >
      <Box sx={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden', [LIST_ROW]: { width: { xs: 140, sm: 220 }, flexShrink: 0 } }}>
        <CoverImage src={item.cover} alt={item.title} sx={{ width: '100%', height: '100%' }} />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.2)',
            opacity: 0,
            transition: 'opacity 0.2s',
            '.MuiBox-root:hover > &': { opacity: 1 },
          }}
        >
          <PlayArrowRoundedIcon sx={{ fontSize: 48, color: 'var(--text-primary, #ffffff)' }} />
        </Box>
        {/* 评分缺失时不画一个 "0.0" 的角标 —— 线上 708 部电影里 372 部没有评分,
            画成 0.0 会让它们看起来是"被打了零分"。 */}
        {!!item.rating && (
          <Box sx={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 0.25, px: 0.75, py: 0.25, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.7)', color: 'warning.main', fontSize: 11, fontWeight: 700 }}>
            <StarRoundedIcon sx={{ fontSize: 12 }} />
            {item.rating.toFixed(1)}
          </Box>
        )}
        <Box sx={{ position: 'absolute', top: 8, right: 8, px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.7)', color: typeColor(item.contentType), fontSize: 10, fontWeight: 600 }}>
          {typeLabel(item.contentType)}
        </Box>
        {!!item.durationMin && (
          <Box sx={{ position: 'absolute', bottom: 8, right: 8, px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.7)', color: 'var(--text-primary, #ffffff)', fontSize: 10 }}>
            {item.durationMin} 分钟
          </Box>
        )}
      </Box>
      <Box sx={{ p: 1.5, [LIST_ROW]: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #ffffff)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: 0.5 }}>
          {item.title}
        </Typography>
        {!!item.genre && (
          <Typography sx={{ fontSize: 10, color: 'var(--text-secondary, rgba(255,255,255,0.55))', mb: 0.25, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.genre}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
            {[item.region, item.year || null].filter(Boolean).join(' · ') || ' '}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
            {formatViews(item.views)} 播放
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

/** 榜单卡片的副行。评分/年份缺失时跳过,不拼出"0.0 分"这种假数据。 */
function subline(item: TheaterItem): string {
  const parts = [`${formatViews(item.views)} 播放`];
  if (item.rating) parts.push(`评分 ${item.rating.toFixed(1)}`);
  else if (item.year) parts.push(String(item.year));
  return parts.join(' · ');
}

function formatViews(n?: number | null): string {
  const num = Number(n) || 0;
  if (num >= 100000000) return `${(num / 100000000).toFixed(1)}亿`;
  if (num >= 10000) return `${(num / 10000).toFixed(1)}w`;
  return num.toString();
}
