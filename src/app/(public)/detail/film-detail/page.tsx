'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ShareIcon from '@mui/icons-material/Share';
import StarIcon from '@mui/icons-material/Star';
import { useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-film';
import { collectContent } from '@/apis/global';
import { contentClient, formatApiError, isNetworkError } from '@/lib/api/client';
import VideoPlayer from '@/components/detail/VideoPlayer';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { CoverImage } from '@/components/common/CoverImage';
import { track, recordHistory } from '@/lib/track';

// 之前这里硬编码了 Google 公开样片作为缺省视频。已移除:无 URL 时由 VideoPlayer 显示空状态。

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

function FilmDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const query = useQuery({
    queryKey: ['detail', 'film', id],
    queryFn: () => contentDetail('film', { id: Number(id) }).then((r) => r.data as Partial<Film>),
    enabled: !!id,
  });

  // 进入详情:行为埋点(供榜单/推荐)+ 写观看历史。itemType 大写以匹配 Doris content_type。
  React.useEffect(() => {
    if (id) {
      track(id, 'view', 'FILM');
      recordHistory(id);
    }
  }, [id]);

  const [favorited, setFavorited] = React.useState(false);
  const [collectBusy, setCollectBusy] = React.useState(false);
  const [videoSrc, setVideoSrc] = React.useState<string>('');
  const [snack, setSnack] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const notify = React.useCallback((message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await contentClient.get<{ url: string; cover?: string; title?: string }>('/detail/film/play', {
          params: { id },
        });
        if (cancelled) return;
        setVideoSrc(res?.data?.url || '');
      } catch (err) {
        if (cancelled) return;
        if (isNetworkError(err)) {
          setVideoSrc('');
        } else {
          notify(formatApiError(err), 'error');
          setVideoSrc('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, notify]);

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
    const title = query.data?.title || '电影详情';
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

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={query.data?.title || '电影详情'}
        rightActions={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton disabled={collectBusy} onClick={handleCollect} sx={{ color: favorited ? 'primary.main' : 'text.tertiary' }}>
              {favorited ? <FavoriteIcon /> : <FavoriteBorderIcon />}
            </IconButton>
            <IconButton onClick={handleShare} sx={{ color: 'text.tertiary' }}>
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
                <VideoPlayer src={videoSrc} poster={data.cover} initialDuration={(data.duration || 0) * 60} autoPlay={false} />
              </Container>
            </Box>

            <Container maxWidth="lg" sx={{ py: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 1 }}>
                    {data.title}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    {(data.genre || []).map((g) => (
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
                  <Typography sx={{ fontSize: 14, color: 'text.primary', mt: 0.5 }}>{(data.actors || []).join(' / ')}</Typography>
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
                {(data.stills || []).map((s, i) => (
                  <CoverImage
                    key={i}
                    src={s}
                    alt={`stills ${i + 1}`}
                    sx={{ width: '100%', aspectRatio: '16/9', borderRadius: 1.5 }}
                  />
                ))}
              </Box>

              <Divider sx={{ borderColor: 'divider', my: 3 }} />
            </Container>
          </>
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

export default function FilmDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <FilmDetailContent />
    </React.Suspense>
  );
}
