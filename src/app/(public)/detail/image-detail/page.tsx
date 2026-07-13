'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-video';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { CoverImage } from '@/components/common/CoverImage';
import { track, recordHistory } from '@/lib/track';

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

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader title={query.data?.title || '图文详情'} />
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
          </Container>
        )}
      </AsyncState>
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
