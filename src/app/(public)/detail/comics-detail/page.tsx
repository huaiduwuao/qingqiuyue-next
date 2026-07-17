'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ShareIcon from '@mui/icons-material/Share';
import StarIcon from '@mui/icons-material/Star';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import LockIcon from '@mui/icons-material/Lock';
import { useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-comics';
import { page as itemPage } from '@/apis/content-comics-item';
import { collectContent } from '@/apis/global';
import { moduleContentAction } from '@/apis/home';
import { formatApiError } from '@/lib/api/client';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { CoverImage } from '@/components/common/CoverImage';
import { track, recordHistory } from '@/lib/track';
import { DetailComments } from '@/components/detail/DetailComments';

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
  likeCount?: number;
  collectCount?: number;
  commentCount?: number;
}

function ComicsDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const query = useQuery({
    queryKey: ['detail', 'comics', id],
    queryFn: () => contentDetail('comics', { id: id! }).then((r) => r.data as Partial<Comics>),
    enabled: !!id,
  });

  const chaptersQuery = useQuery({
    queryKey: ['detail', 'comics', id, 'chapters'],
    queryFn: () =>
      itemPage({ moduleContentId: String(id), page: 1, pageSize: 100 }).then((r) => {
        const list = r?.data?.records || r?.data?.list || [];
        return list as Chapter[];
      }),
    enabled: !!id,
  });

  // 进入详情:行为埋点(供榜单/推荐)+ 写观看历史。itemType 大写以匹配 Doris content_type。
  React.useEffect(() => {
    if (id) {
      track(id, 'view', 'COMICS');
      recordHistory(id);
    }
  }, [id]);

  const [activeChapter, setActiveChapter] = useState<number>(1);
  const [activePage, setActivePage] = useState<number>(1);
  const [favorited, setFavorited] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [optimisticLikes, setOptimisticLikes] = useState(0);
  const [collectBusy, setCollectBusy] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const readerRef = useRef<HTMLDivElement>(null);
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
    const title = query.data?.title || '漫画详情';
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
            <IconButton
              onClick={handleLike}
              disabled={likeBusy}
              sx={{ color: liked ? 'primary.main' : 'text.tertiary' }}
            >
              {liked ? <ThumbUpIcon /> : <ThumbUpOutlinedIcon />}
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
        {(data) => {
          const chapters = chaptersQuery.data || [];
          return (
            <Container maxWidth="md" sx={{ py: 3 }}>
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <CoverImage
                  src={data.cover}
                  alt={data.title}
                  sx={{ width: 140, aspectRatio: '3/4', borderRadius: 2, flexShrink: 0 }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', mb: 1 }}>
                    {data.title}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
                    {(data.genre || []).map((g) => (
                      <Chip key={g} label={g} size="small" sx={{ bgcolor: 'rgba(254, 44, 85, 0.12)', color: 'primary.main', fontWeight: 600 }} />
                    ))}
                    {data.status && (
                      <Chip label={data.status} size="small" sx={{ bgcolor: 'rgba(93,219,150,0.15)', color: 'success.main', fontWeight: 600 }} />
                    )}
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
                  <Box sx={{ display: 'flex', gap: 2, mt: 1.5 }}>
                    <Box
                      onClick={handleLike}
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
                    >
                      {liked ? <ThumbUpIcon sx={{ fontSize: 16, color: 'primary.main' }} /> : <ThumbUpOutlinedIcon sx={{ fontSize: 16 }} />}
                      <Typography sx={{ fontSize: 13, color: liked ? 'primary.main' : 'text.secondary' }}>
                        {Math.max(0, (data.likeCount || 0) + optimisticLikes).toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <FavoriteIcon sx={{ fontSize: 16, color: favorited ? 'primary.main' : 'text.secondary' }} />
                      <Typography sx={{ fontSize: 13, color: favorited ? 'primary.main' : 'text.secondary' }}>
                        {data.collectCount || 0}
                      </Typography>
                    </Box>
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
                      border: '1px solid',
                      borderColor: 'divider',
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

              <DetailComments contentId={id!} initialCount={data.commentCount || 0} />

              <Divider sx={{ borderColor: 'divider', my: 3 }} />

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
                  <Box sx={{ display: 'flex', alignItems: 'center', p: 1.5, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
                    <IconButton onClick={() => setReaderOpen(false)} sx={{ color: 'text.primary' }}>
                      <NavigateBeforeIcon />
                    </IconButton>
                    <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', ml: 1, flex: 1 }} noWrap>
                      {data.title} · {chapters.find((c) => c.id === activeChapter)?.title}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                      {activePage}
                    </Typography>
                  </Box>

                  <Box
                    ref={readerRef}
                    sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                  >
                    <Box sx={{ p: 4, color: '#fff', textAlign: 'center', fontSize: 14 }}>
                      暂无内容
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderTop: '1px solid', borderTopColor: 'divider' }}>
                    <IconButton onClick={() => setActivePage(Math.max(1, activePage - 1))} sx={{ color: 'text.primary' }}>
                      <NavigateBeforeIcon />
                    </IconButton>
                    <Slider
                      size="small"
                      value={activePage}
                      min={1}
                      max={Math.max(1, activePage)}
                      onChange={(_, v) => setActivePage(v as number)}
                      sx={{ color: 'primary.main', mx: 1 }}
                    />
                    <IconButton
                      onClick={() => setActivePage(activePage + 1)}
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

export default function ComicsDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <ComicsDetailContent />
    </React.Suspense>
  );
}
