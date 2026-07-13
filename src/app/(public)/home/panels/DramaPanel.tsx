'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import { homeClient } from '@/lib/api/client';
import { AsyncState } from '@/components/common/AsyncState';
import { CoverImage } from '@/components/common/CoverImage';
import { useContentNavigate } from '@/lib/contentRoute';
import { IMAGE_OVERLAY, MEDAL, SECTION_TINT, gradient2 } from '@/constants/gradients';

type DramaSeries = {
  id: number;
  title: string;
  cover: string;
  genre: '言情' | '悬疑' | '都市' | '爱情' | '校园' | '逆袭';
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

const GENRES: { key: DramaSeries['genre'] | 'all'; label: string; color: string }[] = [
  { key: 'all', label: '全部', color: 'primary.main' },
  { key: '言情', label: '言情', color: 'primary.main' },
  { key: '悬疑', label: '悬疑', color: '#8B5CF6' },
  { key: '都市', label: '都市', color: 'secondary.main' },
  { key: '爱情', label: '爱情', color: '#FF8A3D' },
  { key: '校园', label: '校园', color: 'success.main' },
  { key: '逆袭', label: '逆袭', color: 'warning.main' },
];

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

const GENRE_COLOR: Record<DramaSeries['genre'], string> = {
  言情: 'primary.main',
  悬疑: '#8B5CF6',
  都市: 'secondary.main',
  爱情: '#FF8A3D',
  校园: 'success.main',
  逆袭: 'warning.main',
};

function buildQs(filters: { genre: string; status: string; sort: string }) {
  const p = new URLSearchParams();
  if (filters.genre && filters.genre !== 'all') p.set('genre', filters.genre);
  if (filters.status && filters.status !== 'ALL') p.set('status', filters.status);
  if (filters.sort && filters.sort !== 'hot') p.set('sort', filters.sort);
  return p.toString();
}

export function DramaPanel() {
  const [genre, setGenre] = useState<DramaSeries['genre'] | 'all'>('all');
  const [status, setStatus] = useState<DramaSeries['status'] | 'ALL'>('ALL');
  const [sort, setSort] = useState('hot');

  const qs = buildQs({ genre, status, sort });
  const seriesUrl = `/drama/series${qs ? '?' + qs : ''}`;
  const topUrl = `/drama/top${qs ? '?' + qs : ''}`;

  const seriesQuery = useQuery({
    queryKey: ['home', 'drama', 'series', genre, status, sort],
    queryFn: () => homeClient.get<{ list: DramaSeries[]; total: number }>(seriesUrl).then((r) => r.data),
  });

  const topQuery = useQuery({
    queryKey: ['home', 'drama', 'top', genre, status, sort],
    queryFn: () => homeClient.get<{ list: DramaSeries[]; total: number }>(topUrl).then((r) => r.data),
  });

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
            <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.5))', mt: 0.25 }}>一分钟一集 · 看到爽 · 海量高分独家短剧</Typography>
          </Box>
        </Box>
      </Box>

      {/* Top 10 */}
      <AsyncState query={topQuery} skeletonCount={0} isEmpty={() => false}>
        {(data) => <Top10Podium list={data.list} genre={genre} status={status} sort={sort} />}
      </AsyncState>

      {/* Filters panel: genre + status + sort */}
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted, rgba(255,255,255,0.4))', width: 48, flexShrink: 0 }}>题材</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {GENRES.map((g) => (
              <Chip key={g.key} active={genre === g.key} label={g.label} onClick={() => setGenre(g.key)} />
            ))}
          </Box>
        </Box>
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
          {genre === 'all' ? '全部' : genre}短剧
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
          {sort === 'rating' ? '按评分排序' : sort === 'new' ? '按发布时间排序' : '按播放量排序'}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
          共 {seriesQuery.data?.list?.length ?? 0} 部
        </Typography>
      </Box>

      <AsyncState
        query={seriesQuery}
        skeletonCount={10}
        skeletonHeight={260}
        isEmpty={(d) => d.list.length === 0}
        emptyText="该筛选下暂无短剧。可清空筛选或切换题材"
      >
        {(data) => (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5 }}>
            {data.list.map((s) => (
              <DramaCard key={s.id} item={s} />
            ))}
          </Box>
        )}
      </AsyncState>
    </Box>
  );
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

function Top10Podium({ list, genre, status, sort }: { list: DramaSeries[]; genre: DramaSeries['genre'] | 'all'; status: DramaSeries['status'] | 'ALL'; sort: string }) {
  const subtitle = sort === 'rating' ? '按评分排序' : sort === 'new' ? '最新上线' : '按播放量排序';
  const titleParts: string[] = [];
  if (genre !== 'all') titleParts.push(genre);
  if (status !== 'ALL') titleParts.push(STATUS_LABEL[status]);
  const title = titleParts.length === 0 ? '本周热门' : titleParts.join('·');

  const top3 = list.filter((d) => (d.hotRank || 0) >= 1 && (d.hotRank || 0) <= 3);
  const rest = list.filter((d) => (d.hotRank || 0) >= 4 && (d.hotRank || 0) <= 10);

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

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 1.5, mb: 2, mt: 1 }}>
        {top3
          .sort((a, b) => (a.hotRank ?? 0) - (b.hotRank ?? 0))
          .map((d) => (
            <PodiumCard key={d.id} item={d} />
          ))}
      </Box>

      {rest.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1, pt: 1.5, borderTop: '1px dashed', borderTopColor: 'divider' }}>
          {rest.map((d) => (
            <RankRow key={d.id} item={d} />
          ))}
        </Box>
      )}
    </Box>
  );
}

function PodiumCard({ item }: { item: DramaSeries }) {
  const navigate = useContentNavigate();
  const rank = item.hotRank;
  const rankStyle = rank === 1 ? MEDAL[1] : rank === 2 ? MEDAL[2] : MEDAL[3];

  return (
    <Box
      onClick={() => navigate('TELEPLAY', item.id)}
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        background: rankStyle.bg,
        border: '1px solid',
        borderColor: rankStyle.border,
        transition: 'transform 0.2s',
        '&:hover': { transform: 'translateY(-3px)' },
      }}
    >
      <Box sx={{ position: 'absolute', top: 8, left: 8, width: 28, height: 28, borderRadius: '50%', background: rankStyle.badge, color: rankStyle.txt, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.4)', zIndex: 1 }}>
        {rank}
      </Box>
      <Box sx={{ position: 'relative', aspectRatio: '3/4' }}>
        <CoverImage src={item.cover} alt={item.title} sx={{ width: '100%', height: '100%' }} />
        <Box sx={{ position: 'absolute', inset: 0, background: IMAGE_OVERLAY.HEAVY }} />
        <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-end' }}>
          <Box sx={{ px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: STATUS_COLOR[item.status].bg, color: STATUS_COLOR[item.status].fg, fontSize: 9, fontWeight: 700 }}>
            {STATUS_LABEL[item.status]}
          </Box>
          {item.rating !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.6)', color: 'warning.main', fontSize: 9, fontWeight: 700 }}>
              <StarRoundedIcon sx={{ fontSize: 9 }} />{(item.rating ?? 0).toFixed(1)}
            </Box>
          )}
        </Box>
        <Box sx={{ position: 'absolute', bottom: 8, left: 8, right: 8 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff', mb: 0.25, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.title}
          </Typography>
          <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>
            {formatViews(item.views)} 播放 · {item.episodes ?? '-'} 集
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function RankRow({ item }: { item: DramaSeries }) {
  const navigate = useContentNavigate();
  return (
    <Box onClick={() => navigate('TELEPLAY', item.id)} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75, borderRadius: 1, cursor: 'pointer', transition: 'background 0.15s', '&:hover': { bgcolor: 'action.hover' } }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted, rgba(255,255,255,0.4))', width: 22, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {item.hotRank}
      </Typography>
      <Box sx={{ width: 32, height: 18, borderRadius: 0.5, overflow: 'hidden', flexShrink: 0 }}>
        <CoverImage src={item.cover} alt="" sx={{ width: '100%', height: '100%' }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary, #fff)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.title}
        </Typography>
        <Typography sx={{ fontSize: 9, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
          {item.genre} · {formatViews(item.views)}
        </Typography>
      </Box>
    </Box>
  );
}

function DramaCard({ item }: { item: DramaSeries }) {
  const navigate = useContentNavigate();
  return (
    <Box
      onClick={() => navigate('TELEPLAY', item.id)}
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
      <Box sx={{ position: 'relative', aspectRatio: '3/4', overflow: 'hidden' }}>
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
          <Box sx={{ px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: STATUS_COLOR[item.status].bg, color: STATUS_COLOR[item.status].fg, fontSize: 9, fontWeight: 700 }}>
            {STATUS_LABEL[item.status]}
          </Box>
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
        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 1, background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 100%)' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.title}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ p: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
          <Box sx={{ px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(255,255,255,0.04)', color: GENRE_COLOR[item.genre], fontSize: 9, fontWeight: 600 }}>
            {item.genre}
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