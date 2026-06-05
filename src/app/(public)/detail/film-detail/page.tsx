'use client';

import React from 'react';
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
import { useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-film';
import { withDefaults } from '@/utils/withDefaults';
import VideoPlayer from '@/components/detail/VideoPlayer';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { useContentNavigate } from '@/lib/contentRoute';

interface Film {
  id: number;
  title: string;
  cover: string;
  videoUrl?: string;
  director: string;
  actors: string[];
  genre: string[];
  area: string;
  year: number;
  duration: number;
  rating: number;
  description: string;
  stills: string[];
}

const MOCK_FILM: Film = {
  id: 1,
  title: '清秋月',
  cover: 'https://picsum.photos/seed/film0/800/450',
  director: '张艺谋',
  actors: ['章子', '吴磊', '陈道明', '巩俐'],
  genre: ['剧情', '历史', '文艺'],
  area: '中国大陆',
  year: 2024,
  duration: 128,
  rating: 8.7,
  description:
    '清秋月讲述了一段发生在江南古镇的爱情故事。女主角是一位绣娘,男主角是一位归乡的建筑师。二人因一座百年老宅的修复而相识,在共同寻找传统工艺之美的过程中,渐生情愫。影片以江南四季为时间线索,从春日烟雨、盛夏蝉鸣、秋日桂香到冬日雪景,呈现了一幅幅如诗如画的水乡画卷。',
  stills: [
    'https://picsum.photos/seed/film_still1/800/450',
    'https://picsum.photos/seed/film_still2/800/450',
    'https://picsum.photos/seed/film_still3/800/450',
    'https://picsum.photos/seed/film_still4/800/450',
  ],
};

const MOCK_RECOMMEND = [
  { id: 11, title: '山河故人', cover: 'https://picsum.photos/seed/f1/300/400', rating: 8.2 },
  { id: 12, title: '归来', cover: 'https://picsum.photos/seed/f2/300/400', rating: 7.9 },
  { id: 13, title: '影', cover: 'https://picsum.photos/seed/f3/300/400', rating: 7.5 },
  { id: 14, title: '一秒钟', cover: 'https://picsum.photos/seed/f4/300/400', rating: 7.8 },
  { id: 15, title: '悬崖之上', cover: 'https://picsum.photos/seed/f5/300/400', rating: 7.4 },
  { id: 16, title: '满江红', cover: 'https://picsum.photos/seed/f6/300/400', rating: 6.9 },
];

function FilmDetailContent() {
  const searchParams = useSearchParams();
  const navigate = useContentNavigate();
  const id = searchParams.get('id');

  const query = useQuery({
    queryKey: ['detail', 'film', id],
    queryFn: () => contentDetail('film', { id: Number(id) }).then((r) => r.data as Partial<Film>),
    enabled: !!id,
    placeholderData: MOCK_FILM,
    select: (data) => withDefaults(MOCK_FILM, data),
  });

  const [favorited, setFavorited] = React.useState(false);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={query.data?.title || '电影详情'}
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
                <VideoPlayer src="" poster={data.cover} initialDuration={data.duration * 60} autoPlay={false} />
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
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{data.area} · {data.year} · {data.duration}分钟</Typography>
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
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>主演</Typography>
                  <Typography sx={{ fontSize: 14, color: 'text.primary', mt: 0.5 }}>{data.actors.join(' / ')}</Typography>
                </Box>
              </Box>

              <Typography variant="h6" sx={{ color: 'text.primary', mb: 1.5, fontWeight: 700 }}>
                剧情简介
              </Typography>
              <Typography sx={{ color: 'text.tertiary', fontSize: 14, lineHeight: 1.8, mb: 3, textIndent: '2em' }}>
                {data.description}
              </Typography>

              <Typography variant="h6" sx={{ color: 'text.primary', mb: 2, fontWeight: 700 }}>
                影片剧照
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 1.5,
                  mb: 3,
                }}
              >
                {data.stills.map((s, i) => (
                  <Box
                    key={i}
                    component="img"
                    src={s}
                    alt={`stills ${i + 1}`}
                    sx={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 1.5 }}
                  />
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
                    onClick={() => navigate('FILM', r.id)}
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

export default function FilmDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <FilmDetailContent />
    </React.Suspense>
  );
}
