'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import Brightness6Icon from '@mui/icons-material/Brightness6';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LockIcon from '@mui/icons-material/Lock';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CollectButton } from '@/components/detail/CollectButton';
import { detail as contentDetail } from '@/apis/content-video';
import { page as chapterPage, get as getChapterDetail, addShelf } from '@/apis/content-novel-chapter';
import { ReadingSettings, DEFAULT_PAGE_STYLE } from '@/components/detail/ReadingSettings';
import type { PageStyle } from '@/components/detail/ReadingSettings';
import { ReadingContainer } from '@/components/detail/ReadingContainer';
import { useScrollProgress } from '@/hooks/useScrollProgress';
import { useContentItems, type ContentItem } from '@/hooks/useContentItems';
import { track, recordHistory } from '@/lib/track';
import { LoginGate } from '@/components/auth/LoginGate';
import { formatApiError } from '@/lib/api/client';
import { DetailComments } from '@/components/detail/DetailComments';
import { DetailFooter } from '@/components/detail/DetailFooter';
import { PlatformLinks, platformsOf, playNoticeOf } from '@/components/detail/ExternalPlatforms';
import { useContentInteraction } from '@/hooks/useContentInteraction';

interface NovelDetail {
  title?: string;
  cover?: string;
  author?: string;
  rating?: number;
  chapterCount?: number;
  totalChapters?: number | string;
  content?: string;
  description?: string;
  source?: string;
  sourceUrl?: string;
  commentCount?: number;
  playNotice?: string;
  platforms?: unknown;
}

interface ChapterBody {
  content?: string;
  body?: string;
  locked?: boolean;
}

/** 发布表单创建的旧作品没有章节子行,章节以 {chapters:[{title, body}]} 存在 content 里。 */
function legacyChapters(id: string, detail: NovelDetail | undefined): ContentItem[] {
  if (typeof detail?.content !== 'string' || !detail.content.trim().startsWith('{')) return [];
  try {
    const parsed = JSON.parse(detail.content);
    if (!Array.isArray(parsed?.chapters)) return [];
    return parsed.chapters.map((c: { title?: string; body?: string }, i: number) => ({
      id: `${id}:${i + 1}`,
      title: c.title || `第 ${i + 1} 章`,
      content: c.body || '',
    }));
  } catch {
    return [];
  }
}

function NovelDetailContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const novelId = searchParams.get('novelId');
  const chapterParam = searchParams.get('chapter');
  const contentId = novelId || id;

  const [index, setIndex] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pageStyle, setPageStyle] = useState<PageStyle>(DEFAULT_PAGE_STYLE);
  const [collected, setCollected] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const readProgress = useScrollProgress(scrollRef);
  const qc = useQueryClient();

  // 行为埋点:进入详情即上报一次浏览(推荐/大数据源头)+ 写观看历史。itemType 大写以匹配 Doris content_type。
  useEffect(() => {
    if (contentId) {
      track(contentId, 'view', 'NOVEL');
      recordHistory(contentId);
    }
  }, [contentId]);

  const detailQuery = useQuery({
    queryKey: ['detail', 'novel', id],
    queryFn: () => contentDetail('novel', { id: id! }).then((r) => (r.data ?? null) as NovelDetail | null),
    enabled: !!id,
  });
  const detail = detailQuery.data ?? undefined;

  // 目录只要标题:lite 模式下后端不逐章从 MinIO 拉正文,几千章的目录也是一次轻请求。
  const tocQuery = useContentItems('novel', id, chapterPage, { lite: true });
  const legacy = useMemo(() => legacyChapters(id ?? '', detail), [id, detail]);
  const chapters = useMemo(() => {
    const rows = tocQuery.data?.items ?? [];
    return rows.length ? rows : legacy;
  }, [tocQuery.data, legacy]);

  // 地址栏带 chapter 时定位到那一章(刷新/分享后停在原处)。
  useEffect(() => {
    if (!chapterParam || chapters.length === 0) return;
    const i = chapters.findIndex((c) => c.id === chapterParam);
    if (i >= 0) setIndex(i);
  }, [chapterParam, chapters]);

  const chapter = chapters[Math.min(index, Math.max(0, chapters.length - 1))];

  // 正文按章取:只拉当前这一章(并预取下一章),不再一次性把整本书的每一章都请求一遍。
  const fetchBody = useCallback(
    (chapterId: string) => getChapterDetail({ id: chapterId } as never).then((r) => ((r as { data?: ChapterBody })?.data ?? {}) as ChapterBody),
    [],
  );
  const bodyQuery = useQuery({
    queryKey: ['novel-chapter', chapter?.id],
    queryFn: () => fetchBody(chapter!.id),
    enabled: !!chapter && !chapter.content && !chapter.locked,
    staleTime: 10 * 60 * 1000,
  });
  const next = chapters[index + 1];
  useEffect(() => {
    if (next && !next.content && !next.locked && bodyQuery.isSuccess) {
      void qc.prefetchQuery({ queryKey: ['novel-chapter', next.id], queryFn: () => fetchBody(next.id), staleTime: 10 * 60 * 1000 });
    }
  }, [next, bodyQuery.isSuccess, qc, fetchBody]);

  const body = chapter?.content || bodyQuery.data?.content || bodyQuery.data?.body || '';
  const locked = !!chapter?.locked || !!bodyQuery.data?.locked;

  const goTo = useCallback(
    (i: number) => {
      const target = chapters[i];
      if (!target) return;
      setIndex(i);
      setTocOpen(false);
      if (id) {
        router.replace(`${pathname}?id=${encodeURIComponent(id)}&chapter=${encodeURIComponent(target.id)}`, { scroll: false });
      }
      if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
    },
    [chapters, id, pathname, router],
  );

  // 赞:真实状态从 /interaction 读,操作后以服务端为准并给出提示(见 hooks/useContentInteraction)
  const { liked, likeBusy, toggleLike: handleLike } = useContentInteraction(contentId, {
    notify: (message, severity) => (severity === 'error' ? setErrMsg(message) : setOkMsg(message)),
  });

  const shelfMutation = useMutation({
    mutationFn: (params: { novelId: string; chapterId: string }) => addShelf({ id: params.novelId, chapterId: params.chapterId }),
    onSuccess: () => {
      setCollected(true);
      setOkMsg('已加入书架,可在「我的书架」查看');
    },
    onError: (err) => setErrMsg(formatApiError(err) || '加入书架失败,请稍后重试'),
  });

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

  const sourceLink = [detail?.sourceUrl, detail?.source].find((u) => !!u && /^https?:\/\//.test(u));
  const intro = (detail?.description || (legacy.length ? '' : detail?.content) || '').trim();
  const chapterTotal = Number(detail?.totalChapters) || detail?.chapterCount || chapters.length;
  const tocLoading = tocQuery.isLoading || detailQuery.isLoading;

  const navButtons = chapters.length > 0 && (
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <Button fullWidth variant="outlined" onClick={() => goTo(index - 1)} disabled={index <= 0} sx={{ borderRadius: 4 }}>
        上一章
      </Button>
      <Button fullWidth variant="outlined" onClick={() => setTocOpen(true)} sx={{ borderRadius: 4, maxWidth: 96 }}>
        目录
      </Button>
      <Button fullWidth variant="contained" onClick={() => goTo(index + 1)} disabled={!next} sx={{ borderRadius: 4 }}>
        下一章
      </Button>
    </Box>
  );

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
      <Snackbar
        open={!!okMsg && !errMsg}
        autoHideDuration={2000}
        onClose={() => setOkMsg(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setOkMsg(null)}>
          {okMsg}
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
            {chapter?.title || detail?.title || '章节阅读'}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
            {tocLoading
              ? '加载中...'
              : chapters.length
                ? `第 ${index + 1} / ${chapters.length} 章 · 已读 ${Math.round(readProgress)}%`
                : detail?.title || ''}
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
        <IconButton onClick={() => setTocOpen(true)} size="small" aria-label="目录" disabled={chapters.length === 0}>
          <FormatListBulletedIcon fontSize="small" />
        </IconButton>
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
          <CollectButton contentId={contentId!} contentType="novel" />
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
              onClick={() => contentId && chapter && shelfMutation.mutate({ novelId: contentId, chapterId: chapter.id })}
              disabled={collected || !chapter}
              sx={{ borderRadius: 4 }}
            >
              {collected ? '已在书架' : '加入书架'}
            </Button>
          </LoginGate>
        }
      />

      <Drawer anchor="right" open={tocOpen} onClose={() => setTocOpen(false)} slotProps={{ paper: { sx: { width: { xs: '85vw', sm: 360 } } } }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontWeight: 700 }}>目录</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>共 {chapters.length} 章</Typography>
        </Box>
        <List dense sx={{ overflowY: 'auto', flex: 1 }}>
          {chapters.map((c, i) => (
            <ListItemButton
              key={c.id}
              selected={i === index}
              onClick={() => goTo(i)}
              ref={i === index && tocOpen ? (el: HTMLDivElement | null) => el?.scrollIntoView({ block: 'center' }) : undefined}
            >
              <ListItemText
                primary={c.title || `第 ${i + 1} 章`}
                slotProps={{ primary: { noWrap: true, sx: { fontSize: 14, color: i === index ? 'primary.main' : 'text.primary' } } }}
              />
              {c.locked && <LockIcon sx={{ fontSize: 14, color: 'text.secondary', ml: 1 }} />}
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box ref={scrollRef} sx={{ pb: pageStyle.loadStyle === 'click' && chapters.length ? 10 : 4 }}>
        {detailQuery.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <Container maxWidth="md" sx={{ pt: 2 }}>
            {/* 小说信息卡:封面/标题/作者/评分/简介 */}
            {detail && (
              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  p: 2,
                  mb: 3,
                  borderRadius: 3,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {detail.cover ? (
                  <Box
                    component="img"
                    src={detail.cover}
                    alt={detail.title || ''}
                    sx={{ width: 96, height: 128, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 96,
                      height: 128,
                      borderRadius: 2,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'action.hover',
                      color: 'text.secondary',
                      fontSize: 40,
                    }}
                  >
                    📖
                  </Box>
                )}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {detail.title || '未命名小说'}
                  </Typography>
                  {detail.author && (
                    <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 0.5 }}>作者:{detail.author}</Typography>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    {typeof detail.rating === 'number' && detail.rating > 0 && (
                      <Typography sx={{ fontSize: 13, color: 'warning.main', fontWeight: 600 }}>★ {detail.rating.toFixed(1)}</Typography>
                    )}
                    {chapterTotal > 0 && (
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{chapterTotal} 章</Typography>
                    )}
                  </Box>
                  {intro && (
                    <Typography
                      sx={{
                        fontSize: 13,
                        color: 'text.secondary',
                        lineHeight: 1.6,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {intro}
                    </Typography>
                  )}
                  {chapters.length > 0 && (
                    <Button size="small" startIcon={<FormatListBulletedIcon />} onClick={() => setTocOpen(true)} sx={{ mt: 1, px: 0 }}>
                      查看目录
                    </Button>
                  )}
                </Box>
              </Box>
            )}

            {tocLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : chapters.length === 0 ? (
              <Box sx={{ py: 5, px: 2, textAlign: 'center', color: 'text.secondary', borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
                <MenuBookIcon sx={{ fontSize: 36, mb: 1, opacity: 0.6 }} />
                <Typography sx={{ fontSize: 14, mb: 1.5 }}>
                  {tocQuery.data?.backfilling
                    ? '正在获取章节目录…'
                    : playNoticeOf(detail) || '这本书暂时没有可在线阅读的章节'}
                </Typography>
                {platformsOf(detail).length > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <PlatformLinks platforms={platformsOf(detail)} title="" dense />
                  </Box>
                )}
                {sourceLink && platformsOf(detail).length === 0 && (
                  <Button variant="outlined" size="small" href={sourceLink} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}>
                    去原站阅读
                  </Button>
                )}
              </Box>
            ) : (
              <>
                <Box key={chapter?.id} id={chapter?.id} sx={{ mb: 3 }}>
                  <ReadingContainer style={pageStyle} chapterTitle={chapter?.title || `第 ${index + 1} 章`} chapterIndex={index + 1}>
                    {locked ? (
                      <Box sx={{ py: 4, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <LockIcon sx={{ opacity: 0.6 }} />
                        本章为付费内容,解锁后阅读
                      </Box>
                    ) : bodyQuery.isLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : body ? (
                      body
                    ) : (
                      <Box sx={{ py: 4, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                        {/* 起点等正版站只收目录,正文在原站读 */}
                        {chapter?.url && /^https?:\/\//.test(chapter.url) ? '本章正文请在原站阅读' : '本章正文尚未收录'}
                        {chapter?.url && /^https?:\/\//.test(chapter.url) && (
                          <Button size="small" variant="outlined" href={chapter.url} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}>
                            去原站阅读本章
                          </Button>
                        )}
                      </Box>
                    )}
                  </ReadingContainer>
                </Box>

                {pageStyle.loadStyle !== 'click' && <Box sx={{ mb: 3 }}>{navButtons}</Box>}

                {!next && (
                  <Box sx={{ textAlign: 'center', pb: 3 }}>
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
              </>
            )}

            <DetailFooter contentId={contentId!} detail={detail} kind="read" />
            <Divider sx={{ borderColor: 'divider', my: 3 }} />
            <DetailComments contentId={contentId!} initialCount={detail?.commentCount || 0} />
          </Container>
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
            boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
          }}
        >
          {navButtons}
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
