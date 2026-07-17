'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import Brightness6Icon from '@mui/icons-material/Brightness6';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { useRouter, useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-video';
import { page as chapterPage, getNovel, addShelf } from '@/apis/content-novel-chapter';
import { ReadingSettings, DEFAULT_PAGE_STYLE } from '@/components/detail/ReadingSettings';
import type { PageStyle } from '@/components/detail/ReadingSettings';
import { ReadingContainer } from '@/components/detail/ReadingContainer';
import { useScrollProgress } from '@/hooks/useScrollProgress';
import { track, recordHistory } from '@/lib/track';
import { LoginGate } from '@/components/auth/LoginGate';
import { formatApiError } from '@/lib/api/client';
import { DetailComments } from '@/components/detail/DetailComments';
import { moduleContentAction } from '@/apis/home';

function NovelDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const novelId = searchParams.get('novelId');

  const [chapters, setChapters] = useState<any[]>([]);
  const [chapter, setChapter] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pageStyle, setPageStyle] = useState<PageStyle>(DEFAULT_PAGE_STYLE);
  const [collected, setCollected] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [optimisticLikes, setOptimisticLikes] = useState(0);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const readProgress = useScrollProgress(scrollRef);
  const qc = useQueryClient();

  // 行为埋点:进入详情即上报一次浏览(推荐/大数据源头)+ 写观看历史。itemType 大写以匹配 Doris content_type。
  useEffect(() => {
    const nid = novelId || id;
    if (nid) {
      track(nid, 'view', 'NOVEL');
      recordHistory(nid);
    }
  }, [novelId, id]);

  const initialQuery = useQuery({
    queryKey: ['detail', 'novel', id],
    queryFn: async () => {
      const detailResponse = await contentDetail('novel', { id: id! });
      const detail = detailResponse.data as any;
      const chapterResponse = await chapterPage({ moduleContentId: id!, page: 1, page_size: 100 });
      let items = chapterResponse?.data?.records ?? chapterResponse?.data?.list ?? [];

      // Compatibility for works created before child-row persistence was deployed.
      if (!items.length && typeof detail?.content === 'string') {
        try {
          const parsed = JSON.parse(detail.content);
          items = Array.isArray(parsed?.chapters)
            ? parsed.chapters.map((item: any, index: number) => ({
                id: `${id}:${index + 1}`,
                title: item.title,
                content: item.body,
                sort: item.index ?? index + 1,
              }))
            : [];
        } catch {
          items = [];
        }
      }

      return {
        detail,
        chapters: items.map((item: any, index: number) => ({
          id: item.id ?? `${id}:${index + 1}`,
          name: item.title || `第 ${index + 1} 章`,
          content: { content: item.content || item.body || '' },
        })),
      };
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (initialQuery.data && chapters.length === 0) {
      setChapters(initialQuery.data.chapters);
      setChapter(initialQuery.data.chapters[0] ?? null);
      setHasMore(false);
    }
  }, [initialQuery.data, chapters.length]);

  const nextChapterMutation = useMutation({
    mutationFn: (params: { chapterId: number | string; novelId: string }) =>
      getNovel({ id: params.chapterId, novelId: params.novelId, to: 'next' }),
    onSuccess: (res) => {
      if (!res.data) {
        setHasMore(false);
        return;
      }
      setChapters((prev) => [...prev, res.data]);
      setChapter(res.data);
    },
    onError: (err) => {
      console.error('Failed to load next chapter:', err);
    },
  });

  const loadNextChapter = () => {
    if (!chapter || !novelId) return;
    nextChapterMutation.mutate({ chapterId: chapter.id, novelId });
  };

  const loadPrevChapter = () => {
    if (chapters.length <= 1) return;
    setChapters((prev) => {
      const next = prev.slice(0, -1);
      setChapter(next[next.length - 1]);
      return next;
    });
    setHasMore(true);
  };

  const collectMutation = useMutation({
    mutationFn: (params: { novelId: string; chapterId: number | string }) =>
      addShelf({ id: params.novelId, chapterId: params.chapterId }),
    onSuccess: () => {
      setCollected(true);
      qc.invalidateQueries({ queryKey: ['detail', 'novel', id] });
    },
    onError: (err) => {
      setErrMsg(formatApiError(err) || '收藏失败,请稍后重试');
    },
  });

  const handleCollect = () => {
    if (!novelId || !chapter) return;
    collectMutation.mutate({ novelId, chapterId: chapter.id });
  };

  const handleLike = async () => {
    const nid = novelId || id;
    if (!nid) return;
    if (likeBusy) return;
    setLikeBusy(true);
    const next = !liked;
    setLiked(next);
    setOptimisticLikes((prev) => Math.max(0, prev + (next ? 1 : -1)));
    try {
      await moduleContentAction({ contentId: nid, action: next ? 'agree' : 'cancel_agree' });
    } catch (err) {
      setLiked(!next);
      setOptimisticLikes((prev) => Math.max(0, prev + (next ? -1 : 1)));
      setErrMsg(formatApiError(err) || '操作失败');
    } finally {
      setLikeBusy(false);
    }
  };

  const updatePageStyle = (updates: Partial<PageStyle>) => {
    setPageStyle((prev) => ({ ...prev, ...updates }));
  };

  if (!id) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: { xs: 2, md: 4 }, textAlign: 'center' }}>
          <Typography color="text.secondary">缺少参数</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      <Snackbar
        open={!!errMsg}
        autoHideDuration={2500}
        onClose={() => setErrMsg(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setErrMsg(null)}>
          {errMsg}
        </Alert>
      </Snackbar>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          px: 2,
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}
      >
        <IconButton onClick={() => router.back()} size="small" aria-label="返回">
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {chapter?.name || '章节阅读'}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
            {initialQuery.isLoading ? '加载中...' : `已读 ${Math.round(readProgress)}%`}
          </Typography>
        </Box>
        <Box sx={{ width: 80 }}>
          <LinearProgress
            variant="determinate"
            value={readProgress}
            sx={{
              height: 3,
              borderRadius: 1.5,
              bgcolor: 'action.hover',
              '& .MuiLinearProgress-bar': {
                background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                borderRadius: 1.5,
              },
            }}
          />
        </Box>
        <IconButton
          onClick={() => updatePageStyle({ black: !pageStyle.black })}
          size="small"
          aria-label="切换模式"
          sx={{ color: pageStyle.black ? 'warning.main' : 'inherit' }}
        >
          <Brightness6Icon fontSize="small" />
        </IconButton>
        <IconButton
          onClick={handleLike}
          disabled={likeBusy}
          size="small"
          aria-label="点赞"
          sx={{ color: liked ? 'primary.main' : 'inherit' }}
        >
          {liked ? <ThumbUpIcon fontSize="small" /> : <ThumbUpOutlinedIcon fontSize="small" />}
        </IconButton>
        <LoginGate mode="overlay" message="登录后收藏" overlayOpacity={1}>
          <IconButton
            onClick={handleCollect}
            size="small"
            aria-label="收藏"
            sx={{ color: collected ? 'primary.main' : 'inherit' }}
          >
            {collected ? <BookmarkAddedIcon fontSize="small" /> : <BookmarkAddIcon fontSize="small" />}
          </IconButton>
        </LoginGate>
        <IconButton onClick={() => setSettingsOpen(true)} size="small" aria-label="设置">
          <SettingsIcon fontSize="small" />
        </IconButton>
      </Box>

      <ReadingSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        style={pageStyle}
        onChange={updatePageStyle}
        footerAction={
          <LoginGate mode="overlay" message="登录后加入书架" overlayOpacity={1}>
            <Button
              fullWidth
              variant="contained"
              startIcon={collected ? <BookmarkAddedIcon /> : <BookmarkAddIcon />}
              onClick={handleCollect}
              disabled={collected}
              sx={{ borderRadius: 4 }}
            >
              {collected ? '已在书架' : '加入书架'}
            </Button>
          </LoginGate>
        }
      />

      <Box ref={scrollRef} sx={{ pb: 8 }}>
        {initialQuery.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <Box>
            {chapters.map((item, idx) => (
              <Box key={item.id || idx} sx={{ mb: 4 }} id={item.id?.toString()}>
                <ReadingContainer
                  style={pageStyle}
                  chapterTitle={item.name}
                  chapterIndex={idx + 1}
                >
                  {item.content?.content || ''}
                </ReadingContainer>
              </Box>
            ))}

            {hasMore && pageStyle.loadStyle === 'pull' && (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Button
                  onClick={loadNextChapter}
                  variant="outlined"
                  sx={{
                    borderRadius: 4,
                    px: 4,
                    borderColor: `${pageStyle.color}55`,
                    color: pageStyle.color,
                    '&:hover': {
                      borderColor: pageStyle.color,
                      bgcolor: `${pageStyle.color}11`,
                    },
                  }}
                >
                  加载下一章 →
                </Button>
              </Box>
            )}

            {!hasMore && chapters.length > 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2,
                    py: 1,
                    borderRadius: 4,
                    bgcolor: `${pageStyle.color}11`,
                    color: `${pageStyle.color}AA`,
                    fontSize: 12,
                  }}
                >
                  <MenuBookIcon sx={{ fontSize: 14 }} />
                  已是最后一章
                </Box>
              </Box>
            )}

            <Divider sx={{ borderColor: 'divider', my: 3 }} />
            <DetailComments contentId={novelId || id!} initialCount={initialQuery.data?.detail?.commentCount || 0} />
          </Box>
        )}
      </Box>

      {pageStyle.loadStyle === 'click' && chapters.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
            p: 1.5,
            display: 'flex',
            gap: 1.5,
            boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <Button fullWidth variant="outlined" onClick={loadPrevChapter} disabled={chapters.length <= 1} sx={{ borderRadius: 4 }}>
            上一章
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={loadNextChapter}
            disabled={!hasMore}
            sx={{ borderRadius: 4 }}
          >
            下一章
          </Button>
        </Box>
      )}
    </Box>
  );
}

export default function NovelDetailPage() {
  return (
    <React.Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      }
    >
      <NovelDetailContent />
    </React.Suspense>
  );
}
