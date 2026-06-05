'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ShareIcon from '@mui/icons-material/Share';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import { useSearchParams, useRouter } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-music';
import { AsyncState } from '@/components/common/AsyncState';
import { useContentNavigate } from '@/lib/contentRoute';

interface LyricLine {
  time: number;
  text: string;
}

const MOCK_LYRICS: LyricLine[] = [
  { time: 0, text: '清秋月 - 主题音乐' },
  { time: 4, text: '词: 测试' },
  { time: 7, text: '曲: 测试' },
  { time: 12, text: '月光洒在窗台' },
  { time: 16, text: '清风吹过书斋' },
  { time: 20, text: '我在这秋夜里' },
  { time: 24, text: '独自等待' },
  { time: 28, text: '...' },
  { time: 36, text: '愿与你共此时' },
  { time: 40, text: '愿与你共白头' },
  { time: 44, text: '...' },
  { time: 60, text: '(间奏)' },
  { time: 80, text: '...' },
];

const MOCK_RECOMMEND = [
  { id: 101, title: '夏日微风', artist: '海潮乐队', cover: 'https://picsum.photos/seed/m1/200/200' },
  { id: 102, title: '深夜独白', artist: '陈墨', cover: 'https://picsum.photos/seed/m2/200/200' },
  { id: 103, title: '远方来信', artist: '苏明远', cover: 'https://picsum.photos/seed/m3/200/200' },
  { id: 104, title: '秋日私语', artist: '轻音乐团', cover: 'https://picsum.photos/seed/m4/200/200' },
];

function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function MusicDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const navigate = useContentNavigate();
  const id = searchParams.get('id');
  const playlistId = searchParams.get('playlistId');

  const query = useQuery({
    queryKey: ['detail', 'music', id],
    queryFn: () => contentDetail('music', { id: Number(id) }).then((r) => r.data as any),
    enabled: !!id,
    placeholderData: {
      id: 1,
      title: '清秋月主题音乐',
      artist: '清秋月工作室',
      cover: 'https://picsum.photos/seed/music0/400/400',
      album: '清秋月 · 原创专辑',
      duration: 180,
      release: '2026-05',
      info: '清秋月原创主题音乐,融合古典与现代元素,以古筝与电子音色交织,描绘秋夜书斋独坐的静谧时光。整首曲目以五声音阶为基调,旋律舒缓悠长,适合静心阅读与创作时循环播放。',
    },
  });

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(70);
  const [favorited, setFavorited] = useState(false);
  const [activeLyric, setActiveLyric] = useState(0);
  const lyricRef = useRef<HTMLDivElement>(null);
  const duration = query.data?.duration ?? 180;

  useEffect(() => {
    const t = setInterval(() => {
      if (playing) {
        setCurrentTime((p) => {
          const next = p + 1;
          if (next >= duration) {
            setPlaying(false);
            return 0;
          }
          return next;
        });
      }
    }, 1000);
    return () => clearInterval(t);
  }, [playing, duration]);

  useEffect(() => {
    const idx = MOCK_LYRICS.findIndex((l, i) => {
      const next = MOCK_LYRICS[i + 1];
      return currentTime >= l.time && (!next || currentTime < next.time);
    });
    if (idx >= 0) setActiveLyric(idx);
  }, [currentTime]);

  useEffect(() => {
    if (lyricRef.current) {
      const el = lyricRef.current.querySelector(`[data-idx="${activeLyric}"]`) as HTMLElement;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLyric]);

  const togglePlay = () => setPlaying((p) => !p);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* 顶部条 */}
      <Box sx={{ display: 'flex', alignItems: 'center', p: 1.5, borderBottom: '1px solid #252836' }}>
        <IconButton onClick={() => router.back()} sx={{ color: 'text.tertiary' }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', ml: 1 }}>
          {query.data?.title || '音乐详情'}
        </Typography>
      </Box>

      <AsyncState query={query} isEmpty={(d) => !d}>
        {(data) => (
          <Container maxWidth="md" sx={{ py: 3 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '280px 1fr' }, gap: 3, mb: 3 }}>
              <Box>
                <Box
                  component="img"
                  src={data.cover}
                  alt={data.title}
                  sx={{
                    width: '100%',
                    aspectRatio: '1/1',
                    borderRadius: 2,
                    objectFit: 'cover',
                    boxShadow: '0 8px 32px rgba(254, 44, 85, 0.25)',
                    animation: playing ? 'spin 20s linear infinite' : 'none',
                    '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
                  }}
                />
                <Typography variant="h6" sx={{ color: 'text.primary', mt: 2, fontWeight: 700 }}>
                  {data.title}
                </Typography>
                <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
                  {data.artist} · {data.album}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                  <Chip label={data.release} size="small" variant="outlined" sx={{ borderColor: 'divider', color: 'text.secondary' }} />
                </Box>
              </Box>

              <Box
                ref={lyricRef}
                sx={{
                  height: { xs: 280, sm: 380 },
                  overflow: 'auto',
                  bgcolor: 'background.paper',
                  border: '1px solid #252836',
                  borderRadius: 2,
                  p: 2,
                  '&::-webkit-scrollbar': { width: 4 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
                }}
              >
                {MOCK_LYRICS.map((l, idx) => (
                  <Box
                    key={idx}
                    data-idx={idx}
                    sx={{
                      py: 1,
                      color: idx === activeLyric ? 'primary.main' : 'text.secondary',
                      fontSize: idx === activeLyric ? 18 : 14,
                      fontWeight: idx === activeLyric ? 600 : 400,
                      textAlign: 'center',
                      transition: 'all 0.2s',
                      transform: idx === activeLyric ? 'scale(1.05)' : 'scale(1)',
                    }}
                  >
                    {l.text}
                  </Box>
                ))}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', minWidth: 36, textAlign: 'right' }}>
                {fmtTime(currentTime)}
              </Typography>
              <Slider
                size="small"
                value={currentTime}
                max={duration}
                onChange={(_, v) => setCurrentTime(v as number)}
                sx={{ color: 'primary.main' }}
              />
              <Typography sx={{ fontSize: 11, color: 'text.secondary', minWidth: 36 }}>
                {fmtTime(duration)}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
              <IconButton onClick={() => setCurrentTime(0)} sx={{ color: 'text.tertiary' }}>
                <SkipPreviousIcon fontSize="large" />
              </IconButton>
              <IconButton
                onClick={togglePlay}
                sx={{
                  bgcolor: 'primary.main',
                  color: 'text.primary',
                  '&:hover': { bgcolor: '#E0264B' },
                  width: 56,
                  height: 56,
                }}
              >
                {playing ? <PauseIcon fontSize="large" /> : <PlayArrowIcon fontSize="large" />}
              </IconButton>
              <IconButton onClick={() => setCurrentTime(duration)} sx={{ color: 'text.tertiary' }}>
                <SkipNextIcon fontSize="large" />
              </IconButton>
              <Box sx={{ width: 16 }} />
              <VolumeUpIcon sx={{ color: 'text.secondary' }} />
              <Slider
                size="small"
                value={volume}
                onChange={(_, v) => setVolume(v as number)}
                sx={{ color: 'primary.main', width: 100, ml: 1 }}
              />
              <Box sx={{ flex: 1 }} />
              <IconButton onClick={() => setFavorited((f) => !f)} sx={{ color: favorited ? 'primary.main' : 'text.secondary' }}>
                {favorited ? <FavoriteIcon /> : <FavoriteBorderIcon />}
              </IconButton>
              <IconButton sx={{ color: 'text.secondary' }}>
                <ShareIcon />
              </IconButton>
            </Box>

            <Divider sx={{ borderColor: 'divider', my: 3 }} />

            <Typography variant="h6" sx={{ color: 'text.primary', mb: 1.5 }}>
              歌曲简介
            </Typography>
            <Typography sx={{ color: 'text.tertiary', fontSize: 14, lineHeight: 1.8, mb: 3 }}>
              {data.info || '清秋月原创主题音乐,融合古典与现代元素,以古筝与电子音色交织,描绘秋夜书斋独坐的静谧时光。整首曲目以五声音阶为基调,旋律舒缓悠长,适合静心阅读与创作时循环播放。'}
            </Typography>

            <Typography variant="h6" sx={{ color: 'text.primary', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <LibraryMusicIcon sx={{ color: 'primary.main' }} />
              相似推荐
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}>
              {MOCK_RECOMMEND.map((r) => (
                <Box
                  key={r.id}
                  onClick={() => navigate('MUSIC', r.id)}
                  sx={{
                    bgcolor: 'background.paper',
                    border: '1px solid #252836',
                    borderRadius: 2,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
                  }}
                >
                  <Box component="img" src={r.cover} alt={r.title} sx={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover' }} />
                  <Box sx={{ p: 1.5 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }} noWrap>
                      {r.title}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }} noWrap>
                      {r.artist}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Container>
        )}
      </AsyncState>
    </Box>
  );
}

export default function MusicDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <MusicDetailContent />
    </React.Suspense>
  );
}
