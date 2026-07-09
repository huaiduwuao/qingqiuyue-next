'use client';

import React, { useState, useCallback } from 'react';
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
import VisibilityIcon from '@mui/icons-material/Visibility';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SourceIcon from '@mui/icons-material/Source';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SettingsIcon from '@mui/icons-material/Settings';
import { useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-news';
import { collectContent } from '@/apis/global';
import { formatApiError } from '@/lib/api/client';
import DetailHeader from '@/components/detail/DetailHeader';
import HotRankingBar from '@/components/home/HotRankingBar';
import { AsyncState } from '@/components/common/AsyncState';
import { ReadingSettings, DEFAULT_PAGE_STYLE, type PageStyle } from '@/components/detail/ReadingSettings';
import { ReadingContainer } from '@/components/detail/ReadingContainer';

interface News {
  id: number;
  title: string;
  subtitle?: string;
  cover?: string;
  source: string;
  sourceLogo?: string;
  author?: string;
  publishTime: string;
  viewCount: number;
  likeCount: number;
  category: string;
  tags: string[];
  content: string;
  sourceUrl?: string;
}

function NewsDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const query = useQuery({
    queryKey: ['detail', 'news', id],
    queryFn: () => contentDetail({ id: Number(id) }).then((r) => r.data as Partial<News>),
    enabled: !!id,
  });

  const [favorited, setFavorited] = useState(false);
  const [collectBusy, setCollectBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pageStyle, setPageStyle] = useState<PageStyle>(DEFAULT_PAGE_STYLE);
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
    const title = query.data?.title || '新闻详情';
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

  const updateStyle = (updates: Partial<PageStyle>) =>
    setPageStyle((prev) => ({ ...prev, ...updates }));

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={query.data?.title || '新闻详情'}
        rightActions={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton onClick={() => setSettingsOpen(true)} sx={{ color: 'text.tertiary' }}>
              <SettingsIcon />
            </IconButton>
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
          <Container maxWidth="md" sx={{ py: 3 }}>
            <Chip
              label={data.category}
              size="small"
              sx={{ bgcolor: 'rgba(254, 44, 85, 0.12)', color: 'primary.main', fontWeight: 600, mb: 2 }}
            />

            <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 1.5, lineHeight: 1.4 }}>
              {data.title}
            </Typography>
            {data.subtitle && (
              <Typography sx={{ color: 'text.tertiary', fontSize: 15, mb: 2, lineHeight: 1.6 }}>
                {data.subtitle}
              </Typography>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SourceIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>{data.source}</Typography>
              </Box>
              {data.author && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{data.author}</Typography>}
              <Box sx={{ flex: 1 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTimeIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{data.publishTime}</Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <VisibilityIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>阅读 {((data.viewCount || 0) / 10000).toFixed(1)}万</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', ml: 2 }}>
                点赞 {(data.likeCount || 0).toLocaleString()}
              </Typography>
            </Box>

            {data.cover && (
              <Box
                component="img"
                src={data.cover}
                alt={data.title}
                sx={{ width: '100%', borderRadius: 2, mb: 3 }}
              />
            )}

            <ReadingContainer style={pageStyle}>{data.content}</ReadingContainer>

            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 3, mt: 2 }}>
              {(data.tags || []).map((t) => (
                <Chip
                  key={t}
                  label={`#${t}`}
                  size="small"
                  sx={{ bgcolor: 'rgba(254, 44, 85, 0.12)', color: 'primary.main', fontWeight: 500 }}
                />
              ))}
            </Box>

            {data.sourceUrl && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'background.paper',
                  border: '1px solid #252836',
                  borderRadius: 2,
                  mb: 3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <SourceIcon sx={{ color: 'text.secondary' }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>原文链接</Typography>
                  <Typography sx={{ fontSize: 13, color: 'text.primary', wordBreak: 'break-all' }}>
                    {data.sourceUrl}
                  </Typography>
                </Box>
                <IconButton onClick={() => window.open(data.sourceUrl, '_blank')} sx={{ color: 'primary.main' }}>
                  <OpenInNewIcon />
                </IconButton>
              </Box>
            )}

            <Divider sx={{ borderColor: 'divider', my: 3 }} />
          </Container>
        )}
      </AsyncState>

      <ReadingSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        style={pageStyle}
        onChange={updateStyle}
      />

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

      {/* 页底全网热搜(Phase 3 Doris 实时) */}
      <Container maxWidth="md" sx={{ pb: 6 }}>
        <HotRankingBar contentType="NEWS" title="全网热搜" maxItems={10} expandable />
      </Container>
    </Box>
  );
}

export default function NewsDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <NewsDetailContent />
    </React.Suspense>
  );
}
