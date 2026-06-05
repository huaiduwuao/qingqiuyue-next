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
import { homeClient } from '@/lib/api/client';
import { AsyncState } from '@/components/common/AsyncState';
import { useContentNavigate } from '@/lib/contentRoute';
import { IMAGE_OVERLAY, MEDAL, SECTION_TINT } from '@/constants/gradients';

type DramaSeries = {
  id: number;
  title: string;
  cover: string;
  genre: '古风' | '悬疑' | '都市' | '言情' | '校园' | '逆袭';
  status: 'HOT' | 'DONE' | 'EXCLUSIVE';
  rating: number;
  views: number;
  likes: number;
  episodes: number;
  freeEpisodes: number;
  author: string;
  description: string;
  hotRank: number;
};

const GENRES: { key: DramaSeries['genre'] | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: '古风', label: '古风' },
  { key: '悬疑', label: '悬疑' },
  { key: '都市', label: '都市' },
  { key: '言情', label: '言情' },
  { key: '校园', label: '校园' },
  { key: '逆袭', label: '逆袭' },
];

const STATUSES: { key: DramaSeries['status'] | 'ALL'; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'HOT', label: '热门连载' },
  { key: 'DONE', label: '已完结' },
  { key: 'EXCLUSIVE', label: '独家' },
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
  古风: 'primary.main',
  悬疑: '#8B5CF6',
  都市: 'secondary.main',
  言情: '#FF8A3D',
  校园: 'success.main',
  逆袭: 'warning.main',
};

export function DramaPanel() {
  const [genre, setGenre] = useState<DramaSeries['genre'] | 'all'>('all');
  const [status, setStatus] = useState<DramaSeries['status'] | 'ALL'>('ALL');

  const seriesQuery = useQuery({
    queryKey: ['home', 'drama', 'series', genre, status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (genre !== 'all') params.set('genre', genre);
      if (status !== 'ALL') params.set('status', status);
      return homeClient.get<{ list: DramaSeries[] }>(`/drama/series?${params.toString()}`).then((r) => r.data);
    },
  });

  const topQuery = useQuery({
    queryKey: ['home', 'drama', 'top', genre, status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (genre !== 'all') params.set('genre', genre);
      if (status !== 'ALL') params.set('status', status);
      return homeClient.get<{ list: DramaSeries[] }>(`/drama/top?${params.toString()}`).then((r) => r.data);
    },
  });

  return (
    <Box sx={{ p: 2 }}>
      {/* 标题 + 简介 */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 2.5 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #ffffff)' }}>短剧</Typography>
        <Typography sx={{ fontSize: 12, color: 'var(--text-muted, rgba(255,255,255,0.5))' }}>一分钟一集 · 看到爽</Typography>
      </Box>

      {/* Top 10 热门榜(领奖台式) */}
      <AsyncState query={topQuery} skeletonCount={0} isEmpty={() => false}>
        {(data) => <Top10Podium list={data.list} genre={genre} status={status} />}
      </AsyncState>

      {/* 题材 + 状态 双层 chips */}
      <Box sx={{ mt: 4, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted, rgba(255,255,255,0.4))', width: 36, flexShrink: 0 }}>题材</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {GENRES.map((g) => (
              <Chip key={g.key} active={genre === g.key} label={g.label} onClick={() => setGenre(g.key)} />
            ))}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted, rgba(255,255,255,0.4))', width: 36, flexShrink: 0 }}>状态</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {STATUSES.map((s) => (
              <Chip key={s.key} active={status === s.key} label={s.label} onClick={() => setStatus(s.key)} />
            ))}
          </Box>
        </Box>
      </Box>

      {/* 短剧网格 */}
      <AsyncState
        query={seriesQuery}
        skeletonCount={10}
        skeletonHeight={260}
        isEmpty={(d) => d.list.length === 0}
        emptyText="该筛选下暂无短剧"
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

// ─── Top 10 领奖台 ───
function Top10Podium({ list, genre, status }: { list: DramaSeries[]; genre: DramaSeries['genre'] | 'all'; status: DramaSeries['status'] | 'ALL' }) {
  const titleSuffix =
    genre === 'all' && status === 'ALL'
      ? '本周热门'
      : `${genre !== 'all' ? genre : ''}${genre !== 'all' && status !== 'ALL' ? '·' : ''}${status !== 'ALL' ? STATUS_LABEL[status] : ''}热门` || '本周热门';
  const top3 = list.filter((d) => d.hotRank >= 1 && d.hotRank <= 3);
  const rest = list.filter((d) => d.hotRank >= 4 && d.hotRank <= 10);

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
      {/* 装饰:角落火焰图标 */}
      <Box sx={{ position: 'absolute', top: 12, right: 16, display: 'flex', alignItems: 'center', gap: 0.75, color: 'warning.main' }}>
        <LocalFireDepartmentIcon sx={{ fontSize: 18 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>TOP 10 热门榜</Typography>
      </Box>

      {/* 标题 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <WhatshotIcon sx={{ fontSize: 20, color: 'primary.main' }} />
        <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{titleSuffix}短剧</Typography>
        <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.4))', ml: 1 }}>按播放量排序</Typography>
      </Box>

      {/* 前三名:领奖台 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 1.5, mb: 2, mt: 1 }}>
        {top3
          .sort((a, b) => a.hotRank - b.hotRank)
          .map((d) => (
            <PodiumCard key={d.id} item={d} />
          ))}
      </Box>

      {/* 4-10 列表 */}
      {rest.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1, pt: 1.5, borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
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
  // 配色:1=金,2=银,3=铜
  const rankStyle =
    rank === 1
      ? MEDAL[1]
      : rank === 2
      ? MEDAL[2]
      : MEDAL[3];

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
      {/* 名次徽章 */}
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: rankStyle.badge,
          color: rank === 1 ? '#3a1a00' : '#1a1a1a',
          fontSize: 14,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          zIndex: 1,
        }}
      >
        {rank}
      </Box>

      {/* 封面 */}
      <Box sx={{ position: 'relative', aspectRatio: '3/4' }}>
        <img src={item.cover} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <Box sx={{ position: 'absolute', inset: 0, background: IMAGE_OVERLAY.MID }} />

        {/* 题材 + 评分 */}
        <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-end' }}>
          <Box sx={{ px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.6)', color: GENRE_COLOR[item.genre], fontSize: 9, fontWeight: 600 }}>
            {item.genre}
          </Box>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.05, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.6)', color: 'warning.main', fontSize: 9, fontWeight: 700 }}>
            <StarRoundedIcon sx={{ fontSize: 10 }} />
            {item.rating.toFixed(1)}
          </Box>
        </Box>

        {/* 底部信息 */}
        <Box sx={{ position: 'absolute', bottom: 8, left: 8, right: 8 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff', mb: 0.25, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.title}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
            {formatViews(item.views)} 播放 · {item.episodes} 集
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function RankRow({ item }: { item: DramaSeries }) {
  const navigate = useContentNavigate();
  return (
    <Box
      onClick={() => navigate('TELEPLAY', item.id)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.75,
        borderRadius: 1,
        cursor: 'pointer',
        transition: 'background 0.15s',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
      }}
    >
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted, rgba(255,255,255,0.4))', width: 22, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {item.hotRank}
      </Typography>
      <Box sx={{ width: 24, height: 32, borderRadius: 0.5, overflow: 'hidden', flexShrink: 0 }}>
        <img src={item.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary, #fff)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.title}
        </Typography>
        <Typography sx={{ fontSize: 9, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
          {STATUS_LABEL[item.status]} · {formatViews(item.views)}
        </Typography>
      </Box>
    </Box>
  );
}

function DramaCard({ item }: { item: DramaSeries }) {
  const navigate = useContentNavigate();
  const sColor = STATUS_COLOR[item.status];
  return (
    <Box
      onClick={() => navigate('TELEPLAY', item.id)}
      sx={{
        position: 'relative',
        borderRadius: 2,
        bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))',
        border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.2s, border-color 0.2s',
        '&:hover': { transform: 'translateY(-2px)', borderColor: 'var(--border-strong, rgba(255,255,255,0.12))' },
      }}
    >
      <Box sx={{ position: 'relative', aspectRatio: '3/4' }}>
        <img src={item.cover} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <Box sx={{ position: 'absolute', inset: 0, background: IMAGE_OVERLAY.MID }} />

        {/* 题材 */}
        <Box sx={{ position: 'absolute', top: 8, left: 8, px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.6)', color: GENRE_COLOR[item.genre], fontSize: 10, fontWeight: 600 }}>
          {item.genre}
        </Box>

        {/* 评分 */}
        <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.05, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.6)', color: 'warning.main', fontSize: 10, fontWeight: 700 }}>
          <StarRoundedIcon sx={{ fontSize: 10 }} />
          {item.rating.toFixed(1)}
        </Box>

        {/* 状态徽章 */}
        <Box sx={{ position: 'absolute', top: 36, left: 8, px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: sColor.bg, color: sColor.fg, fontSize: 9, fontWeight: 600 }}>
          {STATUS_LABEL[item.status]}
        </Box>

        {/* 集数 + 播放量 */}
        <Box sx={{ position: 'absolute', bottom: 8, left: 8, right: 8 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: 0.25 }}>
            {item.title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'rgba(255,255,255,0.7)' }}>
            <PlayArrowRoundedIcon sx={{ fontSize: 10 }} />
            <Typography sx={{ fontSize: 10 }}>{item.episodes} 集 · {formatViews(item.views)} 播放</Typography>
          </Box>
        </Box>

        {/* 锁 */}
        {item.freeEpisodes < item.episodes && (
          <Box sx={{ position: 'absolute', bottom: 8, right: 8, width: 20, height: 20, borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LockRoundedIcon sx={{ fontSize: 11, color: 'warning.main' }} />
          </Box>
        )}
      </Box>
    </Box>
  );
}

function formatViews(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}亿`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  return n.toString();
}
