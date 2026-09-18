'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import { homeClient } from '@/lib/api/client';
import { CoverImage } from '@/components/common/CoverImage';
import { useContentNavigate } from '@/lib/contentRoute';
import { IMAGE_OVERLAY, MEDAL, SECTION_TINT, gradient2 } from '@/constants/gradients';
import { ListLayout, ListLayoutSwitch, LIST_ROW } from '@/components/common/ListLayout';
import { getFacets, FacetOption } from '@/apis/facets';

/**
 * 短剧频道 —— 只有竖屏短剧。
 *
 * 这个频道此前查的是 TELEPLAY,也就是说"短剧"整页展示的是 692 条长剧集
 * (《水浒传》出现在短剧热门榜上)。后端已经改为只取 SHORT_DRAMA。
 *
 * 题材也不再写死。写死的那六个("言情/悬疑/都市/爱情/校园/逆袭")是拿
 * 中文名当筛选值直接发给后端的,而后端存的是归一化题材码 —— 两边对不上,
 * 六个按钮点下去都是空列表。现在选项由 /home/facets?scope=drama 下发,
 * 每项带条数,库里没有的题材根本不出现。
 */
type DramaSeries = {
  id: number;
  title: string;
  cover: string;
  /** 后端规范类型码,详情页路由据此取(短剧复用 teleplay 详情页)。 */
  contentType?: string;
  /** 题材展示名,形如 "甜宠 · 逆袭"。筛选用的是 genres 里的码。 */
  genre?: string;
  genres?: string[];
  status: 'HOT' | 'DONE' | 'EXCLUSIVE';
  rating?: number;
  views?: number;
  likes?: number;
  episodes?: number;
  freeEpisodes?: number;
  author?: string;
  description?: string;
  hotRank?: number;
};

const STATUSES: { key: DramaSeries['status'] | 'ALL'; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'HOT', label: '热门连载' },
  { key: 'DONE', label: '已完结' },
  { key: 'EXCLUSIVE', label: '独家' },
];

const SORTS = [
  { key: 'hot', label: '人气榜', icon: <WhatshotIcon sx={{ fontSize: 14 }} /> },
  { key: 'rating', label: '高评分', icon: <StarRoundedIcon sx={{ fontSize: 14 }} /> },
  { key: 'new', label: '最新', icon: <AccessTimeRoundedIcon sx={{ fontSize: 14 }} /> },
];

const STATUS_LABEL: Record<DramaSeries['status'], string> = {
  HOT: '热门连载',
  DONE: '已完结',
  EXCLUSIVE: '独家',
};

const STATUS_COLOR: Record<DramaSeries['status'], { bg: string; fg: string }> = {
  HOT: { bg: 'rgba(254, 44, 85, 0.18)', fg: 'primary.main' },
  DONE: { bg: 'rgba(93, 219, 150, 0.18)', fg: 'success.main' },
  EXCLUSIVE: { bg: 'rgba(255, 180, 0, 0.18)', fg: 'warning.main' },
};

// Safe lookups: backend module_content.status / genre are free-form VARCHAR,
// so unknown values (e.g. "ONLINE", "", lowercase "hot") would crash on
// Record[key].bg. Normalize + fall back to a default palette.
function statusKey(s: string | undefined | null): DramaSeries['status'] | null {
	const v = String(s ?? '').trim().toUpperCase();
	if (v === 'HOT' || v === 'DONE' || v === 'EXCLUSIVE') return v;
	return null;
}
const DEFAULT_STATUS_COLOR = { bg: 'rgba(255,255,255,0.06)', fg: 'text.secondary' } as const;
const DEFAULT_GENRE_COLOR = 'var(--text-muted, rgba(255,255,255,0.4))';

// 题材标签的配色。按归一化题材码索引;词表新增题材时退回中性色,不会崩。
// 这里刻意只给几个主力题材上色 —— 每个题材一个颜色会让卡片变成调色板。
const GENRE_COLOR: Record<string, string> = {
  romance: 'primary.main',
  suspense: '#8B5CF6',
  urban: 'secondary.main',
  sweet: '#FF8A3D',
  youth: 'success.main',
  reveng: 'warning.main',
};

/** 取第一个题材码的配色 —— 卡片上只有一行标签的位置。 */
function genreColorOf(codes: string[] | undefined): string {
  const first = codes?.[0];
  return (first && GENRE_COLOR[first]) || DEFAULT_GENRE_COLOR;
}

export function DramaPanel() {
  const [genre, setGenre] = useState('');
  const [status, setStatus] = useState<DramaSeries['status'] | 'ALL'>('ALL');
  const [sort, setSort] = useState('hot');

  // 题材选项按当前库存现算,每项带条数。
  const facetsQuery = useQuery({
    queryKey: ['home', 'drama', 'facets'],
    queryFn: () => getFacets('drama'),
    staleTime: 5 * 60 * 1000,
  });
  const genreOptions = facetsQuery.data?.genres ?? [];

  // 分页状态
  const PAGE_SIZE = 12;

  // 使用 useInfiniteQuery 实现无限滚动分页
  const {
    data: dramaData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['home', 'drama', genre, status, sort],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({ page: String(pageParam), pageSize: String(PAGE_SIZE) });
      if (genre) params.set('genre', genre);
      if (status && status !== 'ALL') params.set('status', status);
      if (sort && sort !== 'hot') params.set('sort', sort);
      const resp = await homeClient.get<{ list: DramaSeries[]; total: number }>(`/drama/series?${params.toString()}`).then((r) => r);
      const records = resp?.list || [];
      const total = resp?.total || 0;
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
  });

  // 合并所有页面的数据
  const dramaList = dramaData?.pages.flatMap(page => page.records) || [];

  // 简化：使用单一 sentinel ref
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

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      {/* Hero */}
      <Box
        sx={{
          position: 'relative',
          mb: 3,
          p: { xs: 2, md: 3 },
          borderRadius: 3,
          background: SECTION_TINT.RED_PURPLE_YELLOW,
          border: '1px solid rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'absolute', right: -20, top: -20, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,180,0,0.18), transparent 70%)' }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, position: 'relative' }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, background: gradient2('#FE2C55', '#FFB400'), display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(254,44,85,0.32)' }}>
            <LocalFireDepartmentIcon sx={{ fontSize: 20, color: '#fff' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: { xs: 18, md: 22 }, fontWeight: 800, color: 'var(--text-primary, #ffffff)', letterSpacing: 0.5 }}>短剧</Typography>
            {/* 不写"海量独家" —— 库里有多少就说多少,数字来自后端筛选后的 total */}
            <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.5))', mt: 0.25 }}>竖屏短剧 · 一分钟一集</Typography>
          </Box>
        </Box>
      </Box>

      {/* Top 10 */}
      <Top10Section genre={genre} genreLabel={genreLabelOf(genreOptions, genre)} status={status} sort={sort} />

      {/* Filters panel */}
      <Box
        sx={{
          mt: 4,
          mb: 3,
          p: 1.5,
          borderRadius: 2,
          bgcolor: 'var(--bg-input, rgba(255,255,255,0.03))',
          border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        {/* 题材:库里一条都没有的题材不渲染,免得用户点进一个必然为空的筛选 */}
        {genreOptions.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted, rgba(255,255,255,0.4))', width: 48, flexShrink: 0 }}>题材</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              <Chip active={genre === ''} label="全部" onClick={() => setGenre('')} />
              {genreOptions.map((g) => (
                <Chip key={g.value} active={genre === g.value} label={`${g.label} ${g.count}`} onClick={() => setGenre(g.value)} />
              ))}
            </Box>
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted, rgba(255,255,255,0.4))', width: 48, flexShrink: 0 }}>状态</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {STATUSES.map((s) => (
              <Chip key={s.key} active={status === s.key} label={s.label} onClick={() => setStatus(s.key)} />
            ))}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted, rgba(255,255,255,0.4))', width: 48, flexShrink: 0 }}>排序</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
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

      <Box sx={{ mb: 2, display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
          {genreLabelOf(genreOptions, genre) || '全部'}短剧
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
          {sort === 'rating' ? '按评分排序' : sort === 'new' ? '按发布时间排序' : '按播放量排序'}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
          共 {dramaData?.pages[0]?.total ?? 0} 部
        </Typography>
        <ListLayoutSwitch sx={{ alignSelf: 'center' }} />
      </Box>

      {/* 短剧网格 */}
      {isLoading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)', lg: 'repeat(6, 1fr)' }, gap: 2 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <Box key={i} sx={{ aspectRatio: '3/4', borderRadius: 2, bgcolor: 'action.hover' }} />
          ))}
        </Box>
      ) : (
        <Box>
          {dramaList.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography sx={{ color: 'text.secondary' }}>
                {genre || status !== 'ALL' ? '该筛选下暂无短剧' : '短剧库还在建设中'}
              </Typography>
              <Typography sx={{ color: 'text.disabled', fontSize: 12, mt: 0.5 }}>
                {genre || status !== 'ALL' ? '试着放宽题材或状态' : '这里只收竖屏短剧 —— 长剧集在放映厅'}
              </Typography>
            </Box>
          ) : (
            <ListLayout minColumnWidth={170} minColumns={2} listMaxWidth="var(--page-max-narrow)">
              {dramaList.map((s) => (
                <DramaCard key={s.id} item={s} />
              ))}
            </ListLayout>
          )}

          {/* Loading more */}
          {isFetchingNextPage && (
            <Typography sx={{ textAlign: 'center', py: 2, color: 'text.secondary', fontSize: 12 }}>加载中...</Typography>
          )}

          {/* No more */}
          {!isFetchingNextPage && dramaList.length > 0 && !hasNextPage && (
            <Typography sx={{ textAlign: 'center', py: 3, color: 'text.disabled', fontSize: 12 }}>- 没有更多了 -</Typography>
          )}

          {/* Scroll sentinel */}
          <Box ref={sentinelRef} sx={{ height: 1 }} />
        </Box>
      )}
    </Box>
  );
}

function Top10Section({ genre, genreLabel, status, sort }: { genre: string; genreLabel: string; status: string; sort: string }) {
  const topQuery = useQuery({
    queryKey: ['home', 'drama', 'top', genre, status, sort],
    queryFn: () => {
      const params = new URLSearchParams();
      if (genre) params.set('genre', genre);
      if (status && status !== 'ALL') params.set('status', status);
      return homeClient.get<{ list: DramaSeries[] }>(`/drama/top?${params.toString()}`).then((r) => r);
    },
  });

  if (topQuery.isLoading) return null;
  if (!topQuery.data?.list?.length) return null;

  return <Top10Podium list={topQuery.data.list} genreLabel={genreLabel} status={status as any} sort={sort} />;
}

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        px: 1.25,
        py: 0.4,
        borderRadius: 1.5,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        color: active ? '#fff' : 'var(--text-secondary, rgba(255,255,255,0.7))',
        bgcolor: active ? 'var(--brand-color, #FE2C55)' : 'var(--bg-input, rgba(255,255,255,0.04))',
        border: active ? 'none' : '1px solid var(--border-color, rgba(255,255,255,0.06))',
        transition: 'all 0.15s',
        '&:hover': { bgcolor: active ? 'var(--brand-color, #FE2C55)' : 'var(--bg-active, rgba(255,255,255,0.08))' },
      }}
    >
      {label}
    </Box>
  );
}

function Top10Podium({ list, genreLabel, status, sort }: { list: DramaSeries[]; genreLabel: string; status: DramaSeries['status'] | 'ALL'; sort: string }) {
  const subtitle = sort === 'rating' ? '按评分排序' : sort === 'new' ? '最新上线' : '按播放量排序';
  const titleParts: string[] = [];
  if (genreLabel) titleParts.push(genreLabel);
  if (status !== 'ALL') titleParts.push(STATUS_LABEL[status]);
  const title = titleParts.length === 0 ? '本周热门' : titleParts.join('·');
  const ordered = [...list].sort((a, b) => (a.hotRank || 99) - (b.hotRank || 99)).slice(0, 10);

  return (
    <Box
      sx={{
        position: 'relative',
        mb: 1,
        p: 2.5,
        borderRadius: 2.5,
        background: SECTION_TINT.RED_PURPLE_YELLOW,
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
        <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{title}短剧</Typography>
        <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.4))', ml: 1 }}>{subtitle}</Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
          gap: 1.25,
        }}
      >
        {ordered.map((d) => (
          <RankCard key={d.id} item={d} />
        ))}
      </Box>
    </Box>
  );
}

function RankCard({ item }: { item: DramaSeries }) {
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
  const sk = statusKey(item.status);
  const statusInfo = sk ? STATUS_COLOR[sk] : DEFAULT_STATUS_COLOR;
  const statusLabel = sk ? STATUS_LABEL[sk] : (item.status || '其他');

  return (
    <Box
      onClick={() => navigate(item.contentType || 'SHORT_DRAMA', item.id)}
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
          <Box sx={{ px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: statusInfo.bg, color: statusInfo.fg, fontSize: 9, fontWeight: 700 }}>
            {statusLabel}
          </Box>
          {item.rating !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.6)', color: 'warning.main', fontSize: 9, fontWeight: 700 }}>
              <StarRoundedIcon sx={{ fontSize: 9 }} />{(item.rating ?? 0).toFixed(1)}
            </Box>
          )}
        </Box>
        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 1, background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 100%)' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1.2, mb: 0.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.title}
          </Typography>
          <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>
            {item.genre || '其他'} · {formatViews(item.views)} 播放
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}


function DramaCard({ item }: { item: DramaSeries }) {
  const navigate = useContentNavigate();
  return (
    <Box
      onClick={() => navigate(item.contentType || 'SHORT_DRAMA', item.id)}
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
      <Box sx={{ position: 'relative', aspectRatio: '3/4', overflow: 'hidden', [LIST_ROW]: { width: { xs: 84, sm: 110 }, flexShrink: 0 } }}>
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
        <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-end' }}>
          {(() => {
            const k = statusKey(item.status);
            const c = k ? STATUS_COLOR[k] : DEFAULT_STATUS_COLOR;
            return (
              <Box sx={{ px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: c.bg, color: c.fg, fontSize: 9, fontWeight: 700 }}>
                {k ? STATUS_LABEL[k] : (item.status || '其他')}
              </Box>
            );
          })()}
          {item.rating !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.6)', color: 'warning.main', fontSize: 10, fontWeight: 700 }}>
              <StarRoundedIcon sx={{ fontSize: 10 }} />{(item.rating ?? 0).toFixed(1)}
            </Box>
          )}
        </Box>
        {item.freeEpisodes !== undefined && item.episodes !== undefined && item.freeEpisodes < item.episodes && (
          <Box sx={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.6)', color: 'warning.main', fontSize: 9, fontWeight: 600 }}>
            <LockRoundedIcon sx={{ fontSize: 9 }} />
            {item.freeEpisodes}/{item.episodes}
          </Box>
        )}
        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 1, background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 100%)', [LIST_ROW]: { display: 'none' } }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.title}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ p: 1, [LIST_ROW]: { flex: 1, minWidth: 0, p: 1.5, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.75 } }}>
        <Typography sx={{ display: 'none', [LIST_ROW]: { display: '-webkit-box' }, fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #fff)', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {item.title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
          <Box sx={{ px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(255,255,255,0.04)', color: genreColorOf(item.genres), fontSize: 9, fontWeight: 600 }}>
            {item.genre || '其他'}
          </Box>
          <Typography sx={{ fontSize: 9, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>· {formatViews(item.views)} 播放</Typography>
        </Box>
      </Box>
    </Box>
  );
}

function formatViews(n?: number | null): string {
  const num = Number(n) || 0;
  if (num >= 100000000) return `${(num / 100000000).toFixed(1)}亿`;
  if (num >= 10000) return `${(num / 10000).toFixed(1)}w`;
  return num.toString();
}
/** 题材码 → 展示名。目录里找不到就原样返回,不硬编码任何题材词。 */
function genreLabelOf(options: FacetOption[], code: string): string {
  if (!code) return '';
  return options.find((o) => o.value === code)?.label ?? code;
}
