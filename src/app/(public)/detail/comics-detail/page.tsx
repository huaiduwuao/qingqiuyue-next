'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { CollectButton } from '@/components/detail/CollectButton';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ShareIcon from '@mui/icons-material/Share';
import StarIcon from '@mui/icons-material/Star';
import FavoriteIcon from '@mui/icons-material/Favorite';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-comics';
import { page as itemPage } from '@/apis/content-comics-item';
import { useContentInteraction } from '@/hooks/useContentInteraction';
import { formatApiError } from '@/lib/api/client';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { CoverImage } from '@/components/common/CoverImage';
import { track, recordHistory } from '@/lib/track';
import { DetailComments } from '@/components/detail/DetailComments';
import { DetailFooter } from '@/components/detail/DetailFooter';
import { EpisodeList } from '@/components/detail/EpisodeList';
import { useContentItems, type ContentItem } from '@/hooks/useContentItems';

interface Comics {
  id: number;
  title: string;
  cover: string;
  author: string;
  painter: string;
  genre: string[] | string;
  area: string;
  status: string;
  rating: number | string;
  description: string;
  content?: string;
  source?: string;
  sourceUrl?: string;
  totalChapters: number | string;
  likeCount?: number;
  collectCount?: number;
  commentCount?: number;
}

const INTERNAL_STATUS = new Set(['active', 'PUBLISH', 'UN_PUBLISH', 'REVIEWING', 'REJECTED', 'DRAFT']);

/**
 * 一话的分页图片:content 是 JSON 图片数组(爬虫 crawl-pages 与发布表单都写这个格式)或单图 URL;
 * 解析不出图片时退回章节封面(旧的发布表单一页一话,图只放在 cover 里),还没抓图时为空。
 */
function chapterImages(ch: ContentItem | undefined): string[] {
  if (!ch) return [];
  const fallback = ch.cover ? [ch.cover] : [];
  if (!ch.content) return fallback;
  try {
    const parsed = JSON.parse(ch.content);
    let urls: string[] = [];
    if (Array.isArray(parsed)) urls = parsed.filter((s: unknown): s is string => typeof s === 'string' && !!s);
    else if (typeof parsed === 'string') urls = parsed ? [parsed] : [];
    else if (parsed && Array.isArray(parsed.urls)) urls = parsed.urls.filter((s: unknown): s is string => typeof s === 'string' && !!s);
    return urls.length ? urls : fallback;
  } catch {
    return /^https?:\/\//.test(ch.content) ? [ch.content] : fallback;
  }
}

function ComicsDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const query = useQuery({
    queryKey: ['detail', 'comics', id],
    queryFn: () => contentDetail('comics', { id: id! }).then((r) => r.data as Partial<Comics>),
    enabled: !!id,
  });
  const chaptersQuery = useContentItems('comics', id, itemPage);
  const chapters = chaptersQuery.data?.items ?? [];

  // 进入详情:行为埋点(供榜单/推荐)+ 写观看历史。itemType 大写以匹配 Doris content_type。
  useEffect(() => {
    if (id) {
      track(id, 'view', 'COMICS');
      recordHistory(id);
    }
  }, [id]);

  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<number>(1);
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

  const chapterIndex = chapters.findIndex((c) => c.id === activeChapterId);
  const chapter = chapterIndex >= 0 ? chapters[chapterIndex] : undefined;
  const images = useMemo(() => chapterImages(chapter), [chapter]);

  // 赞:真实状态从 /interaction 读,操作后以服务端为准并给出提示(见 hooks/useContentInteraction)
  const { liked, likeDelta: optimisticLikes, likeBusy, toggleLike: handleLike } = useContentInteraction(id, { notify });

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

  const openChapter = useCallback(
    (ch: ContentItem) => {
      if (ch.locked) {
        notify('该话需解锁后阅读', 'info');
        return;
      }
      setActiveChapterId(ch.id);
      setActivePage(1);
      setReaderOpen(true);
      setTimeout(() => readerRef.current?.scrollTo({ top: 0, behavior: 'auto' }), 0);
    },
    [notify],
  );

  const goChapter = useCallback(
    (delta: number) => {
      const next = chapters[chapterIndex + delta];
      if (next) openChapter(next);
      else notify(delta > 0 ? '已经是最后一话' : '已经是第一话', 'info');
    },
    [chapters, chapterIndex, openChapter, notify],
  );

  // 翻到本话最后一页再往后,直接进入下一话。
  const nextPage = useCallback(() => {
    if (activePage < images.length) setActivePage((p) => p + 1);
    else goChapter(1);
  }, [activePage, images.length, goChapter]);
  const prevPage = useCallback(() => {
    if (activePage > 1) setActivePage((p) => p - 1);
    else goChapter(-1);
  }, [activePage, goChapter]);

  useEffect(() => {
    if (!readerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextPage();
      else if (e.key === 'ArrowLeft') prevPage();
      else if (e.key === 'Escape') setReaderOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readerOpen, nextPage, prevPage]);

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
            <CollectButton contentId={id!} contentType="comics" />
            <IconButton onClick={handleShare} sx={{ color: 'text.tertiary' }}>
              <ShareIcon />
            </IconButton>
          </Box>
        }
      />

      <AsyncState query={query} isEmpty={(d) => !d}>
        {(data) => {
          const genres = Array.isArray(data.genre) ? data.genre : data.genre ? [data.genre] : [];
          const rating = Number(data.rating);
          const total = Number(data.totalChapters) || chapters.length;
          const infos = [
            { label: '作者', value: data.author },
            { label: '作画', value: data.painter },
            { label: '地区', value: data.area },
            { label: '话数', value: total > 0 ? `共${total}话` : '' },
          ].filter((f) => f.value);
          const intro = (data.description || data.content || '').trim();
          const sourceLink = [data.sourceUrl, data.source].find((u) => !!u && /^https?:\/\//.test(u));
          return (
            <Container maxWidth="lg" sx={{ py: 3 }}>
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                    {genres.map((g) => (
                      <Chip key={g} label={g} size="small" sx={{ bgcolor: 'rgba(254, 44, 85, 0.12)', color: 'primary.main', fontWeight: 600 }} />
                    ))}
                    {data.status && !INTERNAL_STATUS.has(data.status) && (
                      <Chip label={data.status} size="small" sx={{ bgcolor: 'rgba(93,219,150,0.15)', color: 'success.main', fontWeight: 600 }} />
                    )}
                  </Box>
                  {infos.length > 0 && (
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1.5 }}>
                      {infos.map((f) => (
                        <Box key={f.label}>
                          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{f.label}</Typography>
                          <Typography sx={{ fontSize: 13, color: 'text.primary' }}>{f.value}</Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                  {rating > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'warning.main' }}>
                      <StarIcon sx={{ fontSize: 16 }} />
                      <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'warning.main' }}>{rating.toFixed(1)}</Typography>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary', ml: 0.5 }}>读者评分</Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', gap: 2, mt: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
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
                      <FavoriteIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                        {data.collectCount || 0}
                      </Typography>
                    </Box>
                    {chapters.length > 0 && (
                      <Button size="small" variant="contained" onClick={() => openChapter(chapters[0])} sx={{ borderRadius: 4 }}>
                        开始阅读
                      </Button>
                    )}
                  </Box>
                </Box>
              </Box>

              {intro && (
                <>
                  <Typography variant="h6" sx={{ color: 'text.primary', mb: 1.5, fontWeight: 700 }}>
                    作品简介
                  </Typography>
                  <Typography sx={{ color: 'text.tertiary', fontSize: 14, lineHeight: 1.8, mb: 3, textIndent: '2em', whiteSpace: 'pre-line' }}>
                    {intro}
                  </Typography>
                </>
              )}

              <Divider sx={{ borderColor: 'divider', my: 3 }} />

              <EpisodeList
                title="章节列表"
                items={chapters}
                activeId={activeChapterId}
                onSelect={(ch) => openChapter(ch)}
                unit="话"
                variant="list"
                loading={chaptersQuery.isLoading}
                backfilling={chaptersQuery.data?.backfilling}
                empty={
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    暂无章节
                    {sourceLink && (
                      <Button size="small" href={sourceLink} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}>
                        去原站阅读
                      </Button>
                    )}
                  </Box>
                }
              />

              <DetailFooter contentId={id!} detail={data} kind="read" />
              <DetailComments contentId={id!} initialCount={data.commentCount || 0} />

              <Divider sx={{ borderColor: 'divider', my: 3 }} />

              {/* 阅读器弹层 */}
              {readerOpen && chapter && (
                <Box
                  role="dialog"
                  aria-label={`${data.title} ${chapter.title}`}
                  sx={{
                    position: 'fixed',
                    inset: 0,
                    bgcolor: 'rgba(0,0,0,0.95)',
                    zIndex: 1300,
                    display: 'flex',
                    flexDirection: 'column',
                    color: '#fff',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', p: 1.5, gap: 1, borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                    <IconButton onClick={() => setReaderOpen(false)} sx={{ color: '#fff' }} aria-label="关闭阅读器">
                      <CloseRoundedIcon />
                    </IconButton>
                    <Typography sx={{ fontSize: 14, fontWeight: 600, flex: 1 }} noWrap>
                      {data.title} · 第{chapterIndex + 1}话 {chapter.title}
                    </Typography>
                    {images.length > 0 && (
                      <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                        {activePage} / {images.length}
                      </Typography>
                    )}
                  </Box>

                  <Box
                    ref={readerRef}
                    sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: images.length ? 'flex-start' : 'center' }}
                  >
                    {images.length === 0 ? (
                      <Box sx={{ p: 4, textAlign: 'center', fontSize: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                        本话图片尚未收录
                        {chapter.url && /^https?:\/\//.test(chapter.url) && (
                          <Button
                            size="small"
                            variant="outlined"
                            href={chapter.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                            sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)' }}
                          >
                            去原站阅读本话
                          </Button>
                        )}
                      </Box>
                    ) : (
                      <Box
                        onClick={nextPage}
                        sx={{ width: '100%', maxWidth: 560, display: 'flex', justifyContent: 'center', p: 1, cursor: 'pointer' }}
                      >
                        <img
                          src={images[Math.min(activePage, images.length) - 1]}
                          alt={`${chapter.title || ''} 第 ${activePage} 页`}
                          style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: 4 }}
                        />
                      </Box>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                    <Button size="small" onClick={() => goChapter(-1)} disabled={chapterIndex <= 0} sx={{ color: '#fff', minWidth: 0 }}>
                      上一话
                    </Button>
                    <IconButton onClick={prevPage} sx={{ color: '#fff' }} aria-label="上一页">
                      <NavigateBeforeIcon />
                    </IconButton>
                    <Slider
                      size="small"
                      value={Math.min(activePage, Math.max(1, images.length))}
                      min={1}
                      max={Math.max(1, images.length)}
                      disabled={images.length <= 1}
                      onChange={(_, v) => setActivePage(v as number)}
                      sx={{ color: 'primary.main', mx: 1 }}
                    />
                    <IconButton onClick={nextPage} sx={{ color: '#fff' }} aria-label="下一页">
                      <NavigateNextIcon />
                    </IconButton>
                    <Button size="small" onClick={() => goChapter(1)} disabled={chapterIndex >= chapters.length - 1} sx={{ color: '#fff', minWidth: 0 }}>
                      下一话
                    </Button>
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
