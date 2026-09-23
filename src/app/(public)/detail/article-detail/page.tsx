'use client';

import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { CollectButton } from '@/components/detail/CollectButton';
import ShareButtons from '@/components/share/ShareButtons';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SettingsIcon from '@mui/icons-material/Settings';
import { useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-article';
import { useContentInteraction } from '@/hooks/useContentInteraction';
import { formatApiError } from '@/lib/api/client';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { CoverImage } from '@/components/common/CoverImage';
import { track, recordHistory } from '@/lib/track';
import { ReadingSettings, DEFAULT_PAGE_STYLE, type PageStyle } from '@/components/detail/ReadingSettings';
import { ReadingContainer } from '@/components/detail/ReadingContainer';
import { DetailComments } from '@/components/detail/DetailComments';
import { DetailFooter } from '@/components/detail/DetailFooter';

interface Article {
  id: number;
  title: string;
  subtitle?: string;
  cover?: string;
  author: string;
  authorAvatar: string;
  authorBio?: string;
  publishTime: string;
  viewCount: number;
  likeCount: number;
  collectCount: number;
  commentCount: number;
  category: string;
  tags: string[];
  content: string;
}

function ArticleDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const query = useQuery({
    queryKey: ['detail', 'article', id],
    queryFn: () => contentDetail({ id: id! }).then((r) => r as Partial<Article>),
    enabled: !!id,
  });

  // 进入详情:行为埋点(供榜单/推荐)+ 写观看历史。itemType 大写以匹配 Doris content_type。
  React.useEffect(() => {
    if (id) {
      track(id, 'view', 'ARTICLE');
      recordHistory(id);
    }
  }, [id]);

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

  // 赞:真实状态从 /interaction 读,操作后以服务端为准并给出提示(见 hooks/useContentInteraction)
  const { liked, likeDelta, likeBusy, toggleLike: handleLike } = useContentInteraction(id, { notify });

  const updateStyle = (updates: Partial<PageStyle>) =>
    setPageStyle((prev) => ({ ...prev, ...updates }));

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={query.data?.title || '文章详情'}
        rightActions={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton onClick={() => setSettingsOpen(true)} sx={{ color: 'text.tertiary' }}>
              <SettingsIcon />
            </IconButton>
            <IconButton disabled={likeBusy} onClick={handleLike} sx={{ color: liked ? 'primary.main' : 'text.tertiary' }}>
              {liked ? <ThumbUpIcon /> : <ThumbUpOutlinedIcon />}
            </IconButton>
            <CollectButton contentId={id!} contentType="article" />
            <ShareButtons variant="icon" contentType="article" contentId={id ?? ''} title={query.data?.title ?? 'article-detail 详情'} url={typeof window !== 'undefined' ? window.location.href : ''} />
          </Box>
        }
      />

      <AsyncState query={query} isEmpty={(d) => !d}>
        {(data) => (
          <Container maxWidth="md" sx={{ py: 4 }}>
            <Chip
              label={data.category}
              size="small"
              sx={{ bgcolor: 'rgba(254, 44, 85, 0.12)', color: 'primary.main', fontWeight: 600, mb: 2 }}
            />

            <Typography
              variant="h3"
              sx={{ fontWeight: 800, color: 'text.primary', mb: 1.5, lineHeight: 1.3, fontSize: { xs: 24, sm: 32 } }}
            >
              {data.title}
            </Typography>
            {data.subtitle && (
              <Typography sx={{ color: 'text.tertiary', fontSize: 15, mb: 3, lineHeight: 1.6 }}>
                {data.subtitle}
              </Typography>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Avatar src={data.authorAvatar} sx={{ width: 48, height: 48 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>{data.author}</Typography>
                {data.authorBio && (
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.3 }}>{data.authorBio}</Typography>
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTimeIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{data.publishTime}</Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <VisibilityIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{((data.viewCount || 0) / 10000).toFixed(1)}万 阅读</Typography>
              </Box>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>·</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{Math.max(0, (data.likeCount || 0) + likeDelta)} 点赞</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>·</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{data.collectCount || 0} 收藏</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>·</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{data.commentCount || 0} 评论</Typography>
            </Box>

            {data.cover && (
              <CoverImage
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

            <DetailFooter contentId={id!} detail={data} kind="read" />
            <DetailComments contentId={id!} initialCount={data.commentCount || 0} />
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
    </Box>
  );
}

export default function ArticleDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <ArticleDetailContent />
    </React.Suspense>
  );
}
