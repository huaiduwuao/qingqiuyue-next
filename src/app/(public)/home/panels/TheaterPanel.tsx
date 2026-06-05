'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { homeClient } from '@/lib/api/client';
import { AsyncState } from '@/components/common/AsyncState';
import { useContentNavigate } from '@/lib/contentRoute';
import { IMAGE_OVERLAY, MEDAL, SECTION_TINT } from '@/constants/gradients';

const CAT_TO_TYPE: Record<TheaterItem['category'], string> = {
  movie: 'FILM', drama: 'TELEPLAY', anime: 'ANIMATION', variety: 'VSHOW',
};

type TheaterItem = {
  id: number;
  title: string;
  cover: string;
  durationMin: number;
  rating: number;
  category: 'movie' | 'drama' | 'anime' | 'variety';
  region: string;
  year: number;
  views: number;
  hotRank?: number;
};

type Resp = { list: TheaterItem[]; total: number };

const CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: 'movie', label: '电影' },
  { key: 'drama', label: '剧集' },
  { key: 'anime', label: '动漫' },
  { key: 'variety', label: '综艺' },
];

const CAT_LABEL: Record<TheaterItem['category'], string> = {
  movie: '电影',
  drama: '剧集',
  anime: '动漫',
  variety: '综艺',
};

const CAT_COLOR: Record<TheaterItem['category'], string> = {
  movie: 'primary.main',
  drama: '#8B5CF6',
  anime: 'secondary.main',
  variety: 'warning.main',
};

export function TheaterPanel() {
  const [category, setCategory] = useState('all');

  const query = useQuery({
    queryKey: ['home', 'theater', category],
    queryFn: () =>
      homeClient
        .get<Resp>(`/theater/items${category !== 'all' ? `?category=${category}` : ''}`)
        .then((r) => r.data),
  });

  const topQuery = useQuery({
    queryKey: ['home', 'theater', 'top', category],
    queryFn: () =>
      homeClient
        .get<Resp>(`/theater/top${category !== 'all' ? `?category=${category}` : ''}`)
        .then((r) => r.data),
  });

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #ffffff)' }}>放映厅</Typography>
        <Typography sx={{ fontSize: 12, color: 'var(--text-muted, rgba(255,255,255,0.5))' }}>电影 · 剧集 · 动漫 · 综艺</Typography>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {CATEGORIES.map((c) => (
            <Box
              key={c.key}
              onClick={() => setCategory(c.key)}
              sx={{
                px: 1.25,
                py: 0.5,
                borderRadius: 1.5,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: category === c.key ? 600 : 400,
                color: category === c.key ? 'var(--text-primary, #ffffff)' : 'var(--text-secondary, rgba(255,255,255,0.6))',
                bgcolor: category === c.key ? 'var(--brand-color, #FE2C55)' : 'var(--bg-input, rgba(255,255,255,0.04))',
                border: category === c.key ? 'none' : '1px solid var(--border-color, rgba(255,255,255,0.06))',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: category === c.key ? 'var(--brand-color, #FE2C55)' : 'var(--bg-active, rgba(255,255,255,0.08))' },
              }}
            >
              {c.label}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Top 10 热门榜 */}
      <AsyncState query={topQuery} skeletonCount={0} isEmpty={() => false}>
        {(data) => <TheaterTop10 list={data.list} category={category} />}
      </AsyncState>

      <Box sx={{ mt: 4, mb: 2, display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>全部{category === 'all' ? '' : CAT_LABEL[category as TheaterItem['category']]}</Typography>
        <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>按评分排序</Typography>
      </Box>

      <AsyncState
        query={query}
        skeletonCount={8}
        skeletonHeight={260}
        isEmpty={(d) => d.list.length === 0}
        emptyText="该分类暂无内容"
      >
        {(data) => {
          // 网格内按 rating 倒序排
          const sorted = [...data.list].sort((a, b) => b.rating - a.rating);
          return (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
              {sorted.map((item) => (
                <TheaterCard key={item.id} item={item} />
              ))}
            </Box>
          );
        }}
      </AsyncState>
    </Box>
  );
}

// ─── Top 10 领奖台(同 Drama 风格,水平布局)───
function TheaterTop10({ list, category }: { list: TheaterItem[]; category: string }) {
  if (list.length === 0) return null;
  const top3 = list.filter((d) => (d.hotRank || 0) >= 1 && (d.hotRank || 0) <= 3);
  const rest = list.filter((d) => (d.hotRank || 0) >= 4 && (d.hotRank || 0) <= 10);

  return (
    <Box
      sx={{
        position: 'relative',
        mb: 1,
        p: 2.5,
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
        <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
          {category === 'all' ? '本周热门' : `${CAT_LABEL[category as TheaterItem['category']]}热门`}
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.4))', ml: 1 }}>按播放量排序</Typography>
      </Box>

      {/* 前三名 */}
      {top3.length === 3 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 1.5, mb: 2, mt: 1 }}>
          {top3
            .sort((a, b) => (a.hotRank || 0) - (b.hotRank || 0))
            .map((d) => (
              <TheaterPodiumCard key={d.id} item={d} />
            ))}
        </Box>
      )}

      {rest.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1, pt: 1.5, borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
          {rest.map((d) => (
            <TheaterRankRow key={d.id} item={d} />
          ))}
        </Box>
      )}
    </Box>
  );
}

function TheaterPodiumCard({ item }: { item: TheaterItem }) {
  const navigate = useContentNavigate();
  const rank = item.hotRank || 0;
  const rankStyle = MEDAL[rank] ?? MEDAL[3];

  return (
    <Box
      onClick={() => navigate(CAT_TO_TYPE[item.category], item.id)}
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
      <Box sx={{ position: 'relative', aspectRatio: '16/9' }}>
        <img src={item.cover} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <Box sx={{ position: 'absolute', inset: 0, background: IMAGE_OVERLAY.MID }} />
        <Box sx={{ position: 'absolute', top: 8, right: 8, px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.6)', color: CAT_COLOR[item.category], fontSize: 9, fontWeight: 600 }}>
          {CAT_LABEL[item.category]}
        </Box>
        <Box sx={{ position: 'absolute', bottom: 8, left: 8, right: 8 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff', mb: 0.25, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.title}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
            {formatViews(item.views)} 播放 · 评分 {item.rating.toFixed(1)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function TheaterRankRow({ item }: { item: TheaterItem }) {
  const navigate = useContentNavigate();
  return (
    <Box onClick={() => navigate(CAT_TO_TYPE[item.category], item.id)} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75, borderRadius: 1, cursor: 'pointer', transition: 'background 0.15s', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted, rgba(255,255,255,0.4))', width: 22, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {item.hotRank}
      </Typography>
      <Box sx={{ width: 32, height: 18, borderRadius: 0.5, overflow: 'hidden', flexShrink: 0 }}>
        <img src={item.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary, #fff)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.title}
        </Typography>
        <Typography sx={{ fontSize: 9, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
          {CAT_LABEL[item.category]} · {formatViews(item.views)}
        </Typography>
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
        transition: 'transform 0.2s, border-color 0.2s',
        '&:hover': { transform: 'translateY(-2px)', borderColor: 'var(--border-strong, rgba(255,255,255,0.12))' },
      }}
    >
      <Box sx={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden' }}>
        <img src={item.cover} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
          {item.rating.toFixed(1)}
        </Box>
        <Box sx={{ position: 'absolute', top: 8, right: 8, px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.7)', color: CAT_COLOR[item.category], fontSize: 10, fontWeight: 600 }}>
          {CAT_LABEL[item.category]}
        </Box>
        <Box sx={{ position: 'absolute', bottom: 8, right: 8, px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.7)', color: 'var(--text-primary, #ffffff)', fontSize: 10 }}>
          {item.durationMin} 分钟
        </Box>
      </Box>
      <Box sx={{ p: 1.5 }}>
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary, #ffffff)',
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            mb: 0.5,
          }}
        >
          {item.title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
            {item.region} · {item.year}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
            {formatViews(item.views)} 播放
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function formatViews(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}亿`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  return n.toString();
}
