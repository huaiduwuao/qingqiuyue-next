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
import { detail as contentDetail } from '@/apis/content-vshow';
import { withDefaults } from '@/utils/withDefaults';
import { page as itemPage } from '@/apis/content-vshow-item';
import VideoPlayer from '@/components/detail/VideoPlayer';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { useContentNavigate } from '@/lib/contentRoute';

interface ShowItem {
  id: number;
  title: string;
  num: string;
  date?: string;
  collected?: boolean;
}

interface VShow {
  id: number;
  title: string;
  cover: string;
  host: string;
  guests: string[];
  genre: string[];
  area: string;
  year: number;
  rating: number;
  description: string;
  totalEpisodes: number;
  status: string;
}

const MOCK_VSHOW: VShow = {
  id: 1,
  title: '清秋月·文化漫谈',
  cover: 'https://picsum.photos/seed/vs0/800/450',
  host: '汪涵',
  guests: ['易中天', '康震', '蒙曼', '钱文忠'],
  genre: ['综艺', '文化', '访谈'],
  area: '中国大陆',
  year: 2024,
  rating: 8.4,
  description:
    '一档以传统文化为主题的文化访谈综艺节目。每一期邀请不同领域的文化学者与嘉宾,围绕一个主题展开深入探讨,从诗词歌赋到琴棋书画,从历史典故到民间艺术,以轻松幽默的方式,让观众感受中华传统文化的魅力。',
  totalEpisodes: 24,
  status: '更新中',
};

const MOCK_ITEMS: ShowItem[] = Array.from({ length: 24 }, (_, i) => ({
  id: i + 1,
  title: `第${i + 1}期:主题${i + 1}`,
  num: String(i + 1),
  date: `2026-0${(i % 6) + 1}-${10 + (i % 18)}`,
  collected: i < 4,
}));

const MOCK_RECOMMEND = [
  { id: 41, title: '朗读者', cover: 'https://picsum.photos/seed/v1/300/400', rating: 8.6 },
  { id: 42, title: '中国诗词大会', cover: 'https://picsum.photos/seed/v2/300/400', rating: 8.2 },
  { id: 43, title: '国家宝藏', cover: 'https://picsum.photos/seed/v3/300/400', rating: 9.1 },
  { id: 44, title: '典籍里的中国', cover: 'https://picsum.photos/seed/v4/300/400', rating: 8.9 },
];

function VShowDetailContent() {
  const searchParams = useSearchParams();
  const navigate = useContentNavigate();
  const id = searchParams.get('id');

  const query = useQuery({
    queryKey: ['detail', 'vshow', id],
    queryFn: () => contentDetail({ id: Number(id) }).then((r) => r.data as Partial<VShow>),
    enabled: !!id,
    placeholderData: MOCK_VSHOW,
    select: (data) => withDefaults(MOCK_VSHOW, data),
  });

  const itemsQuery = useQuery({
    queryKey: ['detail', 'vshow', id, 'items'],
    queryFn: () =>
      itemPage({ moduleContentId: String(id), page: 1, pageSize: 100 }).then((r) => {
        const list = r?.data?.records || r?.data?.list || [];
        return list as ShowItem[];
      }),
    enabled: !!id,
    placeholderData: MOCK_ITEMS,
  });

  const [activeEp, setActiveEp] = useState<number>(1);
  const [favorited, setFavorited] = useState(false);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={query.data?.title || '综艺详情'}
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
                <VideoPlayer src="" poster={data.cover} initialDuration={90 * 60} autoPlay={false} />
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
                      {data.area} · {data.year} · 共{data.totalEpisodes}期
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
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>主持人</Typography>
                  <Typography sx={{ fontSize: 14, color: 'text.primary', mt: 0.5 }}>{data.host}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>常驻嘉宾</Typography>
                  <Typography sx={{ fontSize: 14, color: 'text.primary', mt: 0.5 }}>{data.guests.join(' / ')}</Typography>
                </Box>
              </Box>

              <Typography variant="h6" sx={{ color: 'text.primary', mb: 1.5, fontWeight: 700 }}>
                节目简介
              </Typography>
              <Typography sx={{ color: 'text.tertiary', fontSize: 14, lineHeight: 1.8, mb: 3, textIndent: '2em' }}>
                {data.description}
              </Typography>

              <Divider sx={{ borderColor: 'divider', my: 3 }} />

              <Typography variant="h6" sx={{ color: 'text.primary', mb: 2, fontWeight: 700 }}>
                选期播放 ({(itemsQuery.data || []).length})
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                {(itemsQuery.data || []).map((ep) => (
                  <Box
                    key={ep.id}
                    onClick={() => setActiveEp(ep.id)}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: activeEp === ep.id ? 'primary.main' : 'divider',
                      bgcolor: activeEp === ep.id ? 'rgba(254, 44, 85, 0.12)' : 'background.paper',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {!ep.collected && <LockIcon sx={{ fontSize: 12, color: 'text.secondary' }} />}
                        <Typography sx={{ fontSize: 13, fontWeight: 600, color: activeEp === ep.id ? 'primary.main' : 'text.primary' }}>
                          {ep.title}
                        </Typography>
                      </Box>
                      {ep.date && (
                        <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.3 }}>{ep.date}</Typography>
                      )}
                    </Box>
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
                    onClick={() => navigate('VSHOW', r.id)}
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

export default function VShowDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <VShowDetailContent />
    </React.Suspense>
  );
}
