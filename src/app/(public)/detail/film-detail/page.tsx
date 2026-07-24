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
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ShareIcon from '@mui/icons-material/Share';
import StarIcon from '@mui/icons-material/Star';
import { useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-film';
import { moduleContentAction } from '@/apis/home';
import { contentClient, formatApiError, isNetworkError } from '@/lib/api/client';
import VideoPlayer from '@/components/detail/VideoPlayer';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { CoverImage } from '@/components/common/CoverImage';
import { track, recordHistory } from '@/lib/track';
import { DetailComments } from '@/components/detail/DetailComments';
import { CollectButton } from '@/components/detail/CollectButton';

interface Film {
  id: number;
  title: string;
  cover: string;
  videoUrl?: string;
  source?: string;
  director: string;
  actors: string[];
  genre: string[];
  area: string;
  year: number;
  duration: number;
  rating: number;
  description: string;
  stills: string[];
  likeCount?: number;
  collectCount?: number;
  commentCount?: number;
}

function FilmDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const query = useQuery({
    queryKey: ['detail', 'film', id],
    queryFn: () => contentDetail('film', { id: id! }).then((r) => r.data as Partial<Film>),
    enabled: !!id,
  });

  React.useEffect(() => {
    if (id) {
      track(id, 'view', 'FILM');
      recordHistory(id);
    }
  }, [id]);

  const [liked, setLiked] = React.useState(false);
  const [likeBusy, setLikeBusy] = React.useState(false);
  const [optimisticLikes, setOptimisticLikes] = React.useState(0);
  const [videoSrc, setVideoSrc] = React.useState<string>('');
  const [snack, setSnack] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const notify = React.useCallback((message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  const handleLike = async () => {
    if (!id) {
      notify('内容 ID 缺失', 'error');
      return;
    }
    if (likeBusy) return;
    setLikeBusy(true);
    const next = !liked;
    setLiked(next);
    setOptimisticLikes((prev) => Math.max(0, prev + (next ? 1 : -1)));
    try {
      await moduleContentAction({ contentId: id, action: next ? 'agree' : 'cancel_agree' });
    } catch (err) {
      setLiked(!next);
      setOptimisticLikes((prev) => Math.max(0, prev + (next ? -1 : 1)));
      notify(formatApiError(err), 'error');
    } finally {
      setLikeBusy(false);
    }
  };

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
            <IconButton
              onClick={handleLike}
              disabled={likeBusy}
              sx={{ color: liked ? 'primary.main' : 'text.tertiary' }}
            >
              {liked ? <ThumbUpIcon /> : <ThumbUpOutlinedIcon />}
            </IconButton>
            <CollectButton contentId={id!} contentType="film" />
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
                <VideoPlayer src={videoSrc || data.videoUrl || ''} sourceUrl={data.source || ''} poster={data.cover} initialDuration={(data.duration || 0) * 60} autoPlay={false} />
              </Container>
            </Box>

            <Container maxWidth="lg" sx={{ py: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: { xs: 20, sm: 24, md: 32 }, color: 'text.primary', mb: 1, lineHeight: 1.3 }}>
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
                  <Box sx={{ display: 'flex', gap: 1, mt: 1, justifyContent: 'center' }}>
                    <Box
                      onClick={handleLike}
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.25, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
                    >
                      {liked ? <ThumbUpIcon sx={{ fontSize: 14, color: 'primary.main' }} /> : <ThumbUpOutlinedIcon sx={{ fontSize: 14 }} />}
                      <Typography sx={{ fontSize: 12, color: liked ? 'primary.main' : 'text.secondary' }}>
                        {Math.max(0, (data.likeCount || 0) + optimisticLikes).toLocaleString()}
                      </Typography>
                    </Box>
                    <CollectButton contentId={id!} contentType="film" variant="button" compact />
                  </Box>
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

              <DetailComments contentId={id!} initialCount={data.commentCount || 0} />
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
