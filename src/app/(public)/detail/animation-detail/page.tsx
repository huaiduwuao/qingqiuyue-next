'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ShareIcon from '@mui/icons-material/Share';
import StarIcon from '@mui/icons-material/Star';
import LockIcon from '@mui/icons-material/Lock';
import { useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-animation';
import { withDefaults } from '@/utils/withDefaults';
import { page as itemPage } from '@/apis/content-animation-item';
import VideoPlayer from '@/components/detail/VideoPlayer';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { useContentNavigate } from '@/lib/contentRoute';

interface AnimeItem {
  id: number;
  title: string;
  num: string;
  url?: string;
  collected?: boolean;
}

interface Animation {
  id: number;
  title: string;
  cover: string;
  director: string;
  actors: string[];
  genre: string[];
  area: string;
  year: number;
  rating: number;
  description: string;
  totalEpisodes: number;
  status: string;
}

const MOCK_ANIMATION: Animation = {
  id: 1,
  title: '清秋月物语',
  cover: 'https://picsum.photos/seed/anim0/800/450',
  director: '新海诚',
  actors: ['役所广司', '宫崎葵', '松田龙平', '莉莉'],
  genre: ['动画', '治愈', '校园'],
  area: '日本',
  year: 2024,
  rating: 9.1,
  description:
    '一部以江南秋景为灵感的治愈系动画电影。故事讲述少女清秋在城市与乡间穿梭,寻找失落已久的传统手工艺,沿途遇见形形色色的人,最终在深秋的月色下,找到了自己真正的方向。',
  totalEpisodes: 12,
  status: '已完结',
};

const MOCK_ITEMS: AnimeItem[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  title: `第${i + 1}话`,
  num: String(i + 1),
  collected: i < 3,
}));

const MOCK_RECOMMEND = [
  { id: 31, title: '你的名字', cover: 'https://picsum.photos/seed/a1/300/400', rating: 9.4 },
  { id: 32, title: '铃芽之旅', cover: 'https://picsum.photos/seed/a2/300/400', rating: 8.7 },
  { id: 33, title: '天气之子', cover: 'https://picsum.photos/seed/a3/300/400', rating: 8.5 },
  { id: 34, title: '千与千寻', cover: 'https://picsum.photos/seed/a4/300/400', rating: 9.5 },
];

function AnimationDetailContent() {
  const searchParams = useSearchParams();
  const navigate = useContentNavigate();
  const id = searchParams.get('id');

  const query = useQuery({
    queryKey: ['detail', 'animation', id],
    queryFn: () => contentDetail('animation', { id: Number(id) }).then((r) => r.data as Partial<Animation>),
    enabled: !!id,
    placeholderData: MOCK_ANIMATION,
    select: (data) => withDefaults(MOCK_ANIMATION, data),
  });

  const itemsQuery = useQuery({
    queryKey: ['detail', 'animation', id, 'items'],
    queryFn: () =>
      itemPage({ moduleContentId: String(id), page: 1, pageSize: 100 }).then((r) => {
        const list = r?.data?.records || r?.data?.list || [];
        return list as AnimeItem[];
      }),
    enabled: !!id,
    placeholderData: MOCK_ITEMS,
  });

  const [activeEp, setActiveEp] = useState<number>(1);
  const [favorited, setFavorited] = useState(false);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={query.data?.title || '动漫详情'}
        rightActions={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton onClick={() => setFavorited((f) => !f)} sx={{ color: favorited ? 'primary.main' : 'text.tertiary' }}>
              {favorited ? <FavoriteIcon /> : <FavoriteBorderIcon />}
            </IconButton>
            <IconButton sx={{ color: 'text.tertiary' }}>
              <ShareIcon />
            </IconButton>
          </Box>
        }
      />

      <AsyncState query={query} isEmpty={(d) => !d}>
        {(data) => (
          <>
            <Box sx={{ bgcolor: '#000' }}>
              <Container maxWidth="lg" sx={{ py: 0 }}>
                <VideoPlayer src="" poster={data.cover} initialDuration={24 * 60} autoPlay={false} />
              </Container>
            </Box>

            <Container maxWidth="lg" sx={{ py: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 1 }}>
                    {data.title}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    {data.genre.map((g) => (
                      <Chip key={g} label={g} size="small" sx={{ bgcolor: 'rgba(254, 44, 85, 0.12)', color: 'primary.main', fontWeight: 600 }} />
                    ))}
                    <Chip label={data.status} size="small" sx={{ bgcolor: 'rgba(93,219,150,0.15)', color: 'success.main', fontWeight: 600 }} />
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                      {data.area} · {data.year} · 全{data.totalEpisodes}话
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'warning.main' }}>
                    <StarIcon sx={{ fontSize: 20 }} />
                    <Typography sx={{ fontSize: 28, fontWeight: 800, color: 'warning.main' }}>{data.rating}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>豆瓣评分</Typography>
                </Box>
              </Box>

              <Divider sx={{ borderColor: 'divider', my: 2 }} />

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5, mb: 3 }}>
                <Box>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>导演</Typography>
                  <Typography sx={{ fontSize: 14, color: 'text.primary', mt: 0.5 }}>{data.director}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>声优</Typography>
                  <Typography sx={{ fontSize: 14, color: 'text.primary', mt: 0.5 }}>{data.actors.join(' / ')}</Typography>
                </Box>
              </Box>

              <Typography variant="h6" sx={{ color: 'text.primary', mb: 1.5, fontWeight: 700 }}>
                剧情简介
              </Typography>
              <Typography sx={{ color: 'text.tertiary', fontSize: 14, lineHeight: 1.8, mb: 3, textIndent: '2em' }}>
                {data.description}
              </Typography>

              <Divider sx={{ borderColor: 'divider', my: 3 }} />

              <Typography variant="h6" sx={{ color: 'text.primary', mb: 2, fontWeight: 700 }}>
                选集播放 ({(itemsQuery.data || []).length})
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                {(itemsQuery.data || []).map((ep) => (
                  <Box
                    key={ep.id}
                    onClick={() => setActiveEp(ep.id)}
                    sx={{
                      py: 1.2,
                      px: 1,
                      textAlign: 'center',
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 500,
                      border: '1px solid',
                      borderColor: activeEp === ep.id ? 'primary.main' : 'divider',
                      bgcolor: activeEp === ep.id ? 'rgba(254, 44, 85, 0.12)' : 'background.paper',
                      color: activeEp === ep.id ? 'primary.main' : 'text.tertiary',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 0.3,
                      transition: 'all 0.15s',
                    }}
                  >
                    {!ep.collected && <LockIcon sx={{ fontSize: 12, color: 'text.secondary' }} />}
                    {ep.title}
                  </Box>
                ))}
              </Box>

              <Divider sx={{ borderColor: 'divider', my: 3 }} />
              <Typography variant="h6" sx={{ color: 'text.primary', mb: 2, fontWeight: 700 }}>
                相似推荐
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1.5 }}>
                {MOCK_RECOMMEND.map((r) => (
                  <Box
                    key={r.id}
                    onClick={() => navigate('ANIMATION', r.id)}
                    sx={{ cursor: 'pointer', '&:hover': { transform: 'translateY(-2px)' }, transition: 'all 0.15s' }}
                  >
                    <Box
                      component="img"
                      src={r.cover}
                      alt={r.title}
                      sx={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 1.5 }}
                    />
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', mt: 1 }} noWrap>
                      {r.title}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, mt: 0.3 }}>
                      <StarIcon sx={{ fontSize: 12, color: 'warning.main' }} />
                      <Typography sx={{ fontSize: 11, color: 'warning.main', fontWeight: 600 }}>{r.rating}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Container>
          </>
        )}
      </AsyncState>
    </Box>
  );
}

export default function AnimationDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <AnimationDetailContent />
    </React.Suspense>
  );
}
