'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ShareIcon from '@mui/icons-material/Share';
import { useSearchParams, useRouter } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-music';
import { collectContent } from '@/apis/global';
import { formatApiError } from '@/lib/api/client';
import { AsyncState } from '@/components/common/AsyncState';
import HotRankingBar from '@/components/home/HotRankingBar';

interface LyricLine {
  time: number;
  text: string;
}

function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function MusicDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const playlistId = searchParams.get('playlistId');

  const query = useQuery({
    queryKey: ['detail', 'music', id],
    queryFn: () => contentDetail('music', { id: Number(id) }).then((r) => r.data as any),
    enabled: !!id,
  });

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(70);
  const [favorited, setFavorited] = useState(false);
  const [collectBusy, setCollectBusy] = useState(false);
  const [activeLyric, setActiveLyric] = useState(0);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const lyricRef = useRef<HTMLDivElement>(null);
  const duration = query.data?.duration ?? 180;
  const lyrics: LyricLine[] = (query.data?.lyrics as LyricLine[] | undefined) || [];

  const notify = useCallback((message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  const handleCollect = async () => {
    if (!id) {
      notify('内容 ID 缺失', 'error');
      return;
    }
    if (collectBusy) return;
    setCollectBusy(true);
    const next = !favorited;
    setFavorited(next);
    try {
      await collectContent({ contentId: Number(id), action: next ? 'collect' : 'cancel_collect' });
    } catch (err) {
      setFavorited(!next);
      notify(formatApiError(err), 'error');
    } finally {
      setCollectBusy(false);
    }
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = query.data?.title || '音乐详情';
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        notify('链接已复制到剪贴板');
      } else {
        notify('当前环境不支持分享', 'info');
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        notify('分享失败', 'error');
      }
    }
  };

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
    if (!lyrics.length) return;
    const idx = lyrics.findIndex((l, i) => {
      const next = lyrics[i + 1];
      return currentTime >= l.time && (!next || currentTime < next.time);
    });
    if (idx >= 0) setActiveLyric(idx);
  }, [currentTime, lyrics]);

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
                {lyrics.length === 0 ? (
                  <Typography sx={{ p: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>
                    暂无歌词
                  </Typography>
                ) : (
                  lyrics.map((l, idx) => (
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
                  ))
                )}
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
              <IconButton disabled={collectBusy} onClick={handleCollect} sx={{ color: favorited ? 'primary.main' : 'text.secondary' }}>
                {favorited ? <FavoriteIcon /> : <FavoriteBorderIcon />}
              </IconButton>
              <IconButton onClick={handleShare} sx={{ color: 'text.secondary' }}>
                <ShareIcon />
              </IconButton>
            </Box>

            <Divider sx={{ borderColor: 'divider', my: 3 }} />

            <Typography variant="h6" sx={{ color: 'text.primary', mb: 1.5 }}>
              歌曲简介
            </Typography>
            <Typography sx={{ color: 'text.tertiary', fontSize: 14, lineHeight: 1.8, mb: 3 }}>
              {data.info}
            </Typography>
          </Container>
        )}
      </AsyncState>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled" sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default function MusicDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <MusicDetailContent />
      <Container maxWidth="md" sx={{ pb: 6 }}>
        <HotRankingBar contentType="MUSIC" title="全网音乐热门" maxItems={10} expandable />
      </Container>
    </React.Suspense>
  );
}
