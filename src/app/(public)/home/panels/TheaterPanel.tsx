'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import { homeClient } from '@/lib/api/client';
import { AsyncState } from '@/components/common/AsyncState';
import { CoverImage } from '@/components/common/CoverImage';
import { useContentNavigate } from '@/lib/contentRoute';
import { IMAGE_OVERLAY, MEDAL, SECTION_TINT, gradient2 } from '@/constants/gradients';

const CAT_TO_TYPE: Record<TheaterItem['category'], string> = {
  movie: 'FILM',
  drama: 'TELEPLAY',
  anime: 'ANIMATION',
  variety: 'VSHOW',
};

type TheaterItem = {
  id: number;
  title: string;
  cover: string;
  durationMin?: number;
  rating?: number;
  category: 'movie' | 'drama' | 'anime' | 'variety';
  region?: string;
  year?: number;
  views?: number;
  hotRank?: number;
};

type Resp = { list: TheaterItem[]; total: number };

const CATEGORIES: { key: TheaterItem['category'] | 'all'; label: string; gradient: string }[] = [
  { key: 'all', label: '全部分类', gradient: gradient2('#FE2C55', '#FFB400') },
  { key: 'movie', label: '电影', gradient: gradient2('#FE2C55', '#FF6B8A') },
  { key: 'drama', label: '短剧', gradient: gradient2('#8B5CF6', '#C4B5FD') },
  { key: 'anime', label: '动漫', gradient: gradient2('#06B6D4', '#5DF7F2') },
  { key: 'variety', label: '综艺', gradient: gradient2('#FFB400', '#FFD566') },
];

const CAT_LABEL: Record<TheaterItem['category'], string> = {
  movie: '电影',
  drama: '短剧',
  anime: '动漫',
  variety: '综艺',
};

// Defensive lookups: backend module_content.content_type is free-form and
// the hard-coded 'movie' | 'drama' | 'anime' | 'variety' union can be
// violated (e.g. 'film', 'tvshow', ''). Fall back to a neutral palette
// instead of throwing on .bg / undefined.
function catKey(c: string | undefined | null): TheaterItem['category'] | null {
	const v = String(c ?? '').trim().toLowerCase();
	if (v === 'movie' || v === 'drama' || v === 'anime' || v === 'variety') return v;
	return null;
}
const DEFAULT_CAT_COLOR = 'var(--text-muted, rgba(255,255,255,0.4))';
function safeCatLabel(c: string | undefined | null): string {
	return catKey(c) ? CAT_LABEL[c as TheaterItem['category']] : (c || '其他');
}
function safeCatColor(c: string | undefined | null): string {
	return catKey(c) ? CAT_COLOR[c as TheaterItem['category']] : DEFAULT_CAT_COLOR;
}

const CAT_COLOR: Record<TheaterItem['category'], string> = {
  movie: 'primary.main',
  drama: '#8B5CF6',
  anime: 'secondary.main',
  variety: 'warning.main',
};

const REGIONS = [
  { key: '', label: '全部地区' },
  { key: '中国大陆', label: '中国大陆' },
  { key: '美国', label: '美国' },
  { key: '日本', label: '日本' },
  { key: '韩国', label: '韩国' },
  { key: '欧洲', label: '欧洲' },
];

const YEARS = [
  { key: 0, label: '全部年份' },
  { key: 2026, label: '2026' },
  { key: 2025, label: '2025' },
  { key: 2024, label: '2024' },
  { key: 2023, label: '2023' },
  { key: 2022, label: '2022' },
  { key: 2020, label: '2020 及以前' },
];

const RATINGS = [
  { key: 0, label: '全部评分' },
  { key: 9, label: '9.0+' },
  { key: 8, label: '8.0+' },
  { key: 7, label: '7.0+' },
];

const SORTS = [
  { key: 'hot', label: '人气榜', icon: <WhatshotIcon sx={{ fontSize: 14 }} /> },
  { key: 'rating', label: '高评分', icon: <StarRoundedIcon sx={{ fontSize: 14 }} /> },
  { key: 'new', label: '最新', icon: <AccessTimeRoundedIcon sx={{ fontSize: 14 }} /> },
];

function buildQs(filters: { category: string; region: string; year: number; minRating: number; sort: string }) {
  const p = new URLSearchParams();
  if (filters.category && filters.category !== 'all') p.set('category', filters.category);
  if (filters.region) p.set('region', filters.region);
  if (filters.year > 0) p.set('year', String(filters.year));
  if (filters.minRating > 0) p.set('minRating', String(filters.minRating));
  if (filters.sort && filters.sort !== 'hot') p.set('sort', filters.sort);
  return p.toString();
}

export function TheaterPanel() {
  const [category, setCategory] = useState<'all' | TheaterItem['category']>('all');
  const [region, setRegion] = useState('');
  const [year, setYear] = useState(0);
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState('hot');

  const qs = buildQs({ category, region, year, minRating, sort });
  const listUrl = `/theater/items${qs ? '?' + qs : ''}`;
  const topUrl = `/theater/top?${qs ? qs + '&' : ''}category=${category}`;

  const query = useQuery({
    queryKey: ['home', 'theater', category, region, year, minRating, sort],
    queryFn: () => homeClient.get<Resp>(listUrl).then((r) => r.data),
  });

  const topQuery = useQuery({
    queryKey: ['home', 'theater', 'top', category, region, year, minRating, sort],
    queryFn: () => homeClient.get<Resp>(topUrl).then((r) => r.data),
  });

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
            <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.5))', mt: 0.25 }}>电影 · 短剧 · 动漫 · 综艺 · 高分好片</Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted, rgba(255,255,255,0.4))', width: 48, flexShrink: 0 }}>分类</Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {CATEGORIES.map((c) => {
              const active = category === c.key;
              return (
                <Box
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  sx={{
                    position: 'relative',
                    px: 1.5,
                    py: 0.625,
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontWeight: active ? 700 : 500,
                    color: active ? '#fff' : 'var(--text-secondary, rgba(255,255,255,0.7))',
                    background: active ? c.gradient : 'var(--bg-input, rgba(255,255,255,0.04))',
                    border: '1px solid',
                    borderColor: active ? 'transparent' : 'var(--border-color, rgba(255,255,255,0.08))',
                    boxShadow: active ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
                    transition: 'all 0.15s',
                    '&:hover': { transform: 'translateY(-1px)' },
                  }}
                >
                  {c.label}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          mb: 3,
          p: 1.5,
          borderRadius: 2,
          bgcolor: 'var(--bg-input, rgba(255,255,255,0.03))',
          border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr 1fr' },
          gap: 1.5,
        }}
      >
        <FilterRow
          label="地区"
          options={REGIONS.map((r) => ({ key: String(r.key), label: r.label }))}
          value={region}
          onChange={(v) => setRegion(v)}
        />
        <FilterRow
          label="年份"
          options={YEARS.map((y) => ({ key: String(y.key), label: y.label }))}
          value={String(year)}
          onChange={(v) => setYear(Number(v) || 0)}
        />
        <FilterRow
          label="评分"
          options={RATINGS.map((r) => ({ key: String(r.key), label: r.label }))}
          value={String(minRating)}
          onChange={(v) => setMinRating(Number(v) || 0)}
        />
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

      <AsyncState query={topQuery} skeletonCount={0} isEmpty={() => false}>
        {(data) => <TheaterTop10 list={data.list} category={category} sort={sort} />}
      </AsyncState>

      <Box sx={{ mt: 4, mb: 2, display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
          {category === 'all' ? '全部' : CAT_LABEL[category]}
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
          {sort === 'rating' ? '按评分排序' : sort === 'new' ? '按发布时间排序' : '按播放量排序'}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
          共 {query.data?.total ?? 0} 部
        </Typography>
      </Box>

      <AsyncState
        query={query}
        skeletonCount={8}
        skeletonHeight={260}
        isEmpty={(d) => d.list.length === 0}
        emptyText="该分类暂无内容。可调宽上述属性，或切换到其他分类"
      >
        {(data) => {
          return (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2 }}>
              {data.list.map((item) => (
                <TheaterCard key={item.id} item={item} />
              ))}
            </Box>
          );
        }}
      </AsyncState>
    </Box>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
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
        {options.map((o) => {
          const active = value === o.key;
          return (
            <Box
              key={o.key}
              onClick={() => onChange(o.key)}
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

function TheaterTop10({ list, category, sort }: { list: TheaterItem[]; category: 'all' | TheaterItem['category']; sort: string }) {
  if (list.length === 0) return null;
  const subtitle = sort === 'rating' ? '按评分排序' : sort === 'new' ? '最新上线' : '按播放量排序';
  const title = category === 'all' ? '本周热门' : `${CAT_LABEL[category]}热门`;
  // Sort by hotRank (1..10); missing ranks get pushed to the end
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
          <TheaterRankCard key={d.id} item={d} />
        ))}
      </Box>
    </Box>
  );
}

function TheaterRankCard({ item }: { item: TheaterItem }) {
  const navigate = useContentNavigate();
  const rank = item.hotRank || 0;
  // Top 3 use medal background; 4-10 use a neutral surface.
  // All 10 share the same card size and inner layout so the grid is uniform.
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
      onClick={() => navigate(CAT_TO_TYPE[item.category], item.id)}
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
          {item.rating !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.6)', color: 'warning.main', fontSize: 9, fontWeight: 700 }}>
              <StarRoundedIcon sx={{ fontSize: 9 }} />{(item.rating ?? 0).toFixed(1)}
            </Box>
          )}
          <Box sx={{ px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.6)', color: safeCatColor(item.category), fontSize: 9, fontWeight: 600 }}>
            {safeCatLabel(item.category)}
          </Box>
        </Box>
        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 1, background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 100%)' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1.2, mb: 0.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.title}
          </Typography>
          <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>
            {formatViews(item.views)} 播放 · 评分 {(item.rating ?? 0).toFixed(1)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}


function TheaterCard({ item }: { item: TheaterItem }) {
  const navigate = useContentNavigate();
  return (
    <Box
      onClick={() => navigate(CAT_TO_TYPE[item.category], item.id)}
      sx={{
        borderRadius: 2,
        bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
        border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
        '&:hover': { transform: 'translateY(-3px)', borderColor: 'var(--border-strong, rgba(255,255,255,0.16))', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' },
      }}
    >
      <Box sx={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden' }}>
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
        <Box sx={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 0.25, px: 0.75, py: 0.25, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.7)', color: 'warning.main', fontSize: 11, fontWeight: 700 }}>
          <StarRoundedIcon sx={{ fontSize: 12 }} />
          {(item.rating ?? 0).toFixed(1)}
        </Box>
        <Box sx={{ position: 'absolute', top: 8, right: 8, px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.7)', color: safeCatColor(item.category), fontSize: 10, fontWeight: 600 }}>
          {safeCatLabel(item.category)}
        </Box>
        <Box sx={{ position: 'absolute', bottom: 8, right: 8, px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.7)', color: 'var(--text-primary, #ffffff)', fontSize: 10 }}>
          {item.durationMin ?? '-'} 分钟
        </Box>
      </Box>
      <Box sx={{ p: 1.5 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #ffffff)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: 0.5 }}>
          {item.title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
            {[item.region, item.year].filter(Boolean).join(' · ') || '未知'}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
            {formatViews(item.views)} 播放
          </Typography>
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