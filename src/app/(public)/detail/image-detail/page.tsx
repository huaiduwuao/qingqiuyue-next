'use client';

import React, { useMemo, useState, useCallback } from 'react';
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
import { useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-video';
import { moduleContentAction } from '@/apis/home';
import { formatApiError } from '@/lib/api/client';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { CoverImage } from '@/components/common/CoverImage';
import { track, recordHistory } from '@/lib/track';
import { DetailComments } from '@/components/detail/DetailComments';
import { CollectButton } from '@/components/detail/CollectButton';

type PictureDetail = {
  id: string | number;
  title: string;
  subtitle?: string;
  content?: string;
  cover?: string;
  status?: string;
  tags?: string[];
  structuredContent?: unknown;
  audioUrl?: string;
  likeCount?: number;
  collectCount?: number;
  commentCount?: number;
};

function parseStructured(data: PictureDetail) {
  if (data.structuredContent) return data.structuredContent as any;
  if (!data.content) return {};
  try {
    return JSON.parse(data.content);
  } catch {
    return { text: data.content };
  }
}

function ImageDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const query = useQuery({
    queryKey: ['detail', 'picture', id],
    queryFn: () => contentDetail('picture-album', { id: id! }).then((r) => r.data as PictureDetail),
    enabled: !!id,
  });

  React.useEffect(() => {
    if (id) {
      track(id, 'view', 'PICTURE');
      recordHistory(id);
    }
  }, [id]);

  const view = useMemo(() => {
    const data = query.data;
    if (!data) return { images: [] as string[], audioUrl: '', text: '', isMv: false };
    const structured = parseStructured(data);
    const rawImages = Array.isArray(structured)
      ? structured
      : Array.isArray(structured?.images)
        ? structured.images
        : [];
    const images: string[] = rawImages
      .map((item: any) => typeof item === 'string' ? item : item?.url || item?.imageUrl)
      .filter(Boolean);
    if (!images.length && data.cover) images.push(data.cover);
    return {
      images,
      audioUrl: data.audioUrl || structured?.audioUrl || structured?.audio?.url || '',
      text: structured?.text || data.subtitle || '',
      isMv: structured?.kind === 'image-mv' || structured?.mode === 'picture-mv' || !!structured?.audio,
    };
  }, [query.data]);

  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [optimisticLikes, setOptimisticLikes] = useState(0);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const notify = useCallback((message: string, severity: 'success' | 'error' | 'info' = 'success') => {
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

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = query.data?.title || '图文详情';
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
        title={query.data?.title || '图文详情'}
        rightActions={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              onClick={handleLike}
              disabled={likeBusy}
              sx={{ color: liked ? 'primary.main' : 'text.tertiary' }}
            >
              {liked ? <ThumbUpIcon /> : <ThumbUpOutlinedIcon />}
            </IconButton>
            <CollectButton contentId={id!} contentType="picture" />
            <IconButton onClick={handleShare} sx={{ color: 'text.tertiary' }}>
              <ShareIcon />
            </IconButton>
          </Box>
        }
      />
      <AsyncState query={query} isEmpty={(data) => !data}>
        {(data) => (
          <Container maxWidth="md" sx={{ py: 3 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', flex: 1 }}>
                {data.title}
              </Typography>
              <Chip label={view.isMv ? '图片 MV' : '图文'} size="small" color="primary" />
              {data.status && <Chip label={data.status} size="small" variant="outlined" />}
            </Box>
            {view.text && (
              <Typography sx={{ color: 'text.secondary', fontSize: 14, lineHeight: 1.8, mb: 2 }}>
                {view.text}
              </Typography>
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5 }}>
              {view.images.map((src, index) => (
                <CoverImage
                  key={`${src}-${index}`}
                  src={src}
                  alt={`${data.title}-${index + 1}`}
                  sx={{ width: '100%', maxHeight: 520, borderRadius: 2, objectFit: 'contain', bgcolor: '#000' }}
                />
              ))}
            </Box>
            {view.audioUrl && (
              <Box component="audio" controls src={view.audioUrl} sx={{ width: '100%', mt: 2 }}>
                当前浏览器不支持音频播放。
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2, my: 2, justifyContent: 'center' }}>
              <Box
                onClick={handleLike}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
              >
                {liked ? <ThumbUpIcon sx={{ fontSize: 18, color: 'primary.main' }} /> : <ThumbUpOutlinedIcon sx={{ fontSize: 18 }} />}
                <Typography sx={{ fontSize: 13, color: liked ? 'primary.main' : 'text.secondary' }}>
                  {Math.max(0, (data.likeCount || 0) + optimisticLikes).toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CollectButton contentId={id!} contentType="picture" variant="button" compact />
              </Box>
            </Box>

            <DetailComments contentId={id!} initialCount={data.commentCount || 0} />
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

export default function ImageDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <ImageDetailContent />
    </React.Suspense>
  );
}
