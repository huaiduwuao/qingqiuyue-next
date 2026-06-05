'use client';

import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ShareIcon from '@mui/icons-material/Share';
import StarIcon from '@mui/icons-material/Star';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import LockIcon from '@mui/icons-material/Lock';
import { useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-comics';
import { withDefaults } from '@/utils/withDefaults';
import { page as itemPage } from '@/apis/content-comics-item';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { useContentNavigate } from '@/lib/contentRoute';

interface Chapter {
  id: number;
  title: string;
  num: string;
  pages: number;
  collected?: boolean;
}

interface Comics {
  id: number;
  title: string;
  cover: string;
  author: string;
  painter: string;
  genre: string[];
  area: string;
  status: string;
  rating: number;
  description: string;
  totalChapters: number;
}

const MOCK_COMICS: Comics = {
  id: 1,
  title: '清秋月物语',
  cover: 'https://picsum.photos/seed/cm0/400/550',
  author: '林清秋',
  painter: '白月光',
  genre: ['少女', '治愈', '古风'],
  area: '中国大陆',
  status: '连载中',
  rating: 9.3,
  description:
    '清秋月物语讲述一位现代少女意外穿越回明清时期江南小镇的故事。她在古镇中学习传统手工艺,与当地的青年才俊相识相知,展开了一段跨越时空的奇幻旅程。',
  totalChapters: 80,
};

const MOCK_CHAPTERS: Chapter[] = Array.from({ length: 24 }, (_, i) => ({
  id: i + 1,
  title: `第${i + 1}话`,
  num: String(i + 1),
  pages: 20 + (i % 6) * 4,
  collected: i < 6,
}));

const MOCK_PAGES = Array.from({ length: 24 }, (_, i) => `https://picsum.photos/seed/cmpg${i}/800/1200`);

const MOCK_RECOMMEND = [
  { id: 61, title: '步天歌', cover: 'https://picsum.photos/seed/cm1/300/400', rating: 9.1 },
  { id: 62, title: '一人之下', cover: 'https://picsum.photos/seed/cm2/300/400', rating: 9.0 },
  { id: 63, title: '狐妖小红娘', cover: 'https://picsum.photos/seed/cm3/300/400', rating: 9.2 },
  { id: 64, title: '罗小黑战记', cover: 'https://picsum.photos/seed/cm4/300/400', rating: 9.4 },
];

function ComicsDetailContent() {
  const searchParams = useSearchParams();
  const navigate = useContentNavigate();
  const id = searchParams.get('id');

  const query = useQuery({
    queryKey: ['detail', 'comics', id],
    queryFn: () => contentDetail('comics', { id: Number(id) }).then((r) => r.data as Partial<Comics>),
    enabled: !!id,
    placeholderData: MOCK_COMICS,
    select: (data) => withDefaults(MOCK_COMICS, data),
  });

  const chaptersQuery = useQuery({
    queryKey: ['detail', 'comics', id, 'chapters'],
    queryFn: () =>
      itemPage({ moduleContentId: String(id), page: 1, pageSize: 100 }).then((r) => {
        const list = r?.data?.records || r?.data?.list || [];
        return (list.length ? list : MOCK_CHAPTERS) as Chapter[];
      }),
    enabled: !!id,
    placeholderData: MOCK_CHAPTERS,
  });

  const [activeChapter, setActiveChapter] = useState<number>(1);
  const [activePage, setActivePage] = useState<number>(1);
  const [favorited, setFavorited] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const readerRef = useRef<HTMLDivElement>(null);

  const openReader = (chapterId: number) => {
    setActiveChapter(chapterId);
    setActivePage(1);
    setReaderOpen(true);
    setTimeout(() => {
      readerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    }, 0);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={query.data?.title || '漫画详情'}
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
        {(data) => {
          const chapters = chaptersQuery.data || [];
          return (
            <Container maxWidth="md" sx={{ py: 3 }}>
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <Box
                  component="img"
                  src={data.cover}
                  alt={data.title}
                  sx={{ width: 140, aspectRatio: '3/4', objectFit: 'cover', borderRadius: 2, flexShrink: 0 }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', mb: 1 }}>
                    {data.title}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
                    {data.genre.map((g) => (
                      <Chip key={g} label={g} size="small" sx={{ bgcolor: 'rgba(254, 44, 85, 0.12)', color: 'primary.main', fontWeight: 600 }} />
                    ))}
                    <Chip label={data.status} size="small" sx={{ bgcolor: 'rgba(93,219,150,0.15)', color: 'success.main', fontWeight: 600 }} />
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1.5 }}>
                    <Box>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>作者</Typography>
                      <Typography sx={{ fontSize: 13, color: 'text.primary' }}>{data.author}</Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>作画</Typography>
                      <Typography sx={{ fontSize: 13, color: 'text.primary' }}>{data.painter}</Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>地区</Typography>
                      <Typography sx={{ fontSize: 13, color: 'text.primary' }}>{data.area}</Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>话数</Typography>
                      <Typography sx={{ fontSize: 13, color: 'text.primary' }}>共{data.totalChapters}话</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'warning.main' }}>
                    <StarIcon sx={{ fontSize: 16 }} />
                    <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'warning.main' }}>{data.rating}</Typography>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary', ml: 0.5 }}>读者评分</Typography>
                  </Box>
                </Box>
              </Box>

              <Typography variant="h6" sx={{ color: 'text.primary', mb: 1.5, fontWeight: 700 }}>
                作品简介
              </Typography>
              <Typography sx={{ color: 'text.tertiary', fontSize: 14, lineHeight: 1.8, mb: 3, textIndent: '2em' }}>
                {data.description}
              </Typography>

              <Divider sx={{ borderColor: 'divider', my: 3 }} />

              <Typography variant="h6" sx={{ color: 'text.primary', mb: 2, fontWeight: 700 }}>
                章节列表 ({chapters.length})
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                {chapters.map((ch) => (
                  <Box
                    key={ch.id}
                    onClick={() => openReader(ch.id)}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      border: '1px solid #252836',
                      bgcolor: 'background.paper',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: 'primary.main' },
                    }}
                  >
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {!ch.collected && <LockIcon sx={{ fontSize: 12, color: 'text.secondary' }} />}
                        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>{ch.title}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.3 }}>{ch.pages} 页</Typography>
                    </Box>
                    <Chip label="阅读" size="small" sx={{ bgcolor: 'rgba(254, 44, 85, 0.12)', color: 'primary.main', fontSize: 10 }} />
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
                    onClick={() => navigate('COMICS', r.id)}
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

              {/* 阅读器弹层 */}
              {readerOpen && (
                <Box
                  sx={{
                    position: 'fixed',
                    inset: 0,
                    bgcolor: 'rgba(0,0,0,0.95)',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', p: 1.5, borderBottom: '1px solid #252836' }}>
                    <IconButton onClick={() => setReaderOpen(false)} sx={{ color: 'text.primary' }}>
                      <NavigateBeforeIcon />
                    </IconButton>
                    <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', ml: 1, flex: 1 }} noWrap>
                      {data.title} · {chapters.find((c) => c.id === activeChapter)?.title}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                      {activePage} / {MOCK_PAGES.length}
                    </Typography>
                  </Box>

                  <Box
                    ref={readerRef}
                    sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                  >
                    {MOCK_PAGES.map((src, i) => (
                      <Box
                        key={i}
                        component="img"
                        src={src}
                        alt={`page ${i + 1}`}
                        onClick={() => setActivePage(i + 1)}
                        sx={{ width: '100%', maxWidth: 600, display: 'block', mb: 1 }}
                      />
                    ))}
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderTop: '1px solid #252836' }}>
                    <IconButton onClick={() => setActivePage(Math.max(1, activePage - 1))} sx={{ color: 'text.primary' }}>
                      <NavigateBeforeIcon />
                    </IconButton>
                    <Slider
                      size="small"
                      value={activePage}
                      min={1}
                      max={MOCK_PAGES.length}
                      onChange={(_, v) => setActivePage(v as number)}
                      sx={{ color: 'primary.main', mx: 1 }}
                    />
                    <IconButton
                      onClick={() => setActivePage(Math.min(MOCK_PAGES.length, activePage + 1))}
                      sx={{ color: 'text.primary' }}
                    >
                      <NavigateNextIcon />
                    </IconButton>
                  </Box>
                </Box>
              )}
            </Container>
          );
        }}
      </AsyncState>
    </Box>
  );
}

export default function ComicsDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <ComicsDetailContent />
    </React.Suspense>
  );
}
