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
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ShareIcon from '@mui/icons-material/Share';
import StarIcon from '@mui/icons-material/Star';
import LockIcon from '@mui/icons-material/Lock';
import { useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-teleplay';
import { page as episodePage } from '@/apis/content-teleplay-item';
import { collectContent } from '@/apis/global';
import { formatApiError } from '@/lib/api/client';
import VideoPlayer from '@/components/detail/VideoPlayer';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { track, recordHistory } from '@/lib/track';

interface Episode {
  id: string | number;
  title: string;
  num: string;
  url?: string;
  collected?: boolean;
}

interface Teleplay {
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

function TeleplayDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const episodeId = searchParams.get('episodeId');

  const query = useQuery({
    queryKey: ['detail', 'teleplay', id],
    queryFn: () => contentDetail({ id: id! }).then((r) => r.data as Partial<Teleplay>),
    enabled: !!id,
  });

  const episodesQuery = useQuery({
    queryKey: ['detail', 'teleplay', id, 'episodes'],
    queryFn: () =>
      episodePage({ moduleContentId: String(id), page: 1, pageSize: 100 }).then((r) => {
        const list = r?.data?.records || r?.data?.list || [];
        return list as Episode[];
      }),
    enabled: !!id,
  });

  // 进入详情:行为埋点(供榜单/推荐)+ 写观看历史。itemType 大写以匹配 Doris content_type。
  React.useEffect(() => {
    if (id) {
      track(id, 'view', 'TELEPLAY');
      recordHistory(id);
    }
  }, [id]);

  const [activeEp, setActiveEp] = useState<string | number>(episodeId ? Number(episodeId) : 1);
  const [favorited, setFavorited] = useState(false);
  const [collectBusy, setCollectBusy] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

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
      await collectContent({ contentId: id, action: next ? 'collect' : 'cancel_collect' });
    } catch (err) {
      setFavorited(!next);
      notify(formatApiError(err), 'error');
    } finally {
      setCollectBusy(false);
    }
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = query.data?.title || '电视剧详情';
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

  const activeEpisode = useMemo(() => {
    const episodes = episodesQuery.data || [];
    return episodes.find((episode) => String(episode.id) === String(activeEp)) || episodes[0];
  }, [episodesQuery.data, activeEp]);

  const grouped = useMemo(() => {
    const eps = episodesQuery.data || [];
    const groups: { range: string; list: Episode[] }[] = [];
    const size = 10;
    for (let i = 0; i < eps.length; i += size) {
      const list = eps.slice(i, i + size);
      const start = Number(list[0]?.num || i + 1);
      const end = Number(list[list.length - 1]?.num || i + size);
      groups.push({ range: `${start}-${end}集`, list });
    }
    return groups;
  }, [episodesQuery.data]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={query.data?.title || '电视剧详情'}
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
                <VideoPlayer src={activeEpisode?.url || ''} poster={data.cover} initialDuration={45 * 60} autoPlay={false} />
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
                    {data.status && (
                      <Chip label={data.status} size="small" sx={{ bgcolor: 'rgba(93,219,150,0.15)', color: 'success.main', fontWeight: 600 }} />
                    )}
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                      {data.area} · {data.year} · 共{data.totalEpisodes}集
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

              <Divider sx={{ borderColor: 'divider', my: 3 }} />

              <Typography variant="h6" sx={{ color: 'text.primary', mb: 2, fontWeight: 700 }}>
                选集播放 ({(episodesQuery.data || []).length})
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {grouped.map((g) => (
                  <Box key={g.range}>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>{g.range}</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1 }}>
                      {g.list.map((ep) => (
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
                  </Box>
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

export default function TeleplayDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <TeleplayDetailContent />
    </React.Suspense>
  );
}
