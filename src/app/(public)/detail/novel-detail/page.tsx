'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import useMediaQuery from '@mui/material/useMediaQuery';
import { ThemeProvider, createTheme, useTheme } from '@mui/material/styles';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-video';
import { page as chapterPage, get as getChapterDetail, addShelf } from '@/apis/content-novel-chapter';
import { useContentItems, type ContentItem } from '@/hooks/useContentItems';
import { useContentInteraction } from '@/hooks/useContentInteraction';
import { useAuth } from '@/contexts/AuthContext';
import { loginHref } from '@/lib/auth/redirect';
import { track, recordHistory } from '@/lib/track';
import { formatApiError } from '@/lib/api/client';
import { lightTheme, darkTheme } from '@/styles/theme';
import { DetailComments } from '@/components/detail/DetailComments';
import { DetailFooter } from '@/components/detail/DetailFooter';
import { PlatformLinks, platformsOf, playNoticeOf } from '@/components/detail/ExternalPlatforms';
import { AvailabilityBadge } from '@/components/common/AvailabilityBadge';
import type { PlaybackStatus } from '@/apis/recommend';
import { ChapterBlock, type ChapterBody } from '@/components/novel-reader/ChapterBlock';
import { ReaderChrome, type ReaderPanel } from '@/components/novel-reader/ReaderChrome';
import {
  READER_ACCENT,
  fontOf,
  loadProgress,
  noiseLayer,
  saveProgress,
  themeOf,
  useReaderPrefs,
  type ReaderTheme,
} from '@/components/novel-reader/prefs';

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
  /** 站内到底能不能读(后端 internal/playability 的阅读轴,见 content_availability.go)。
   *  线上绝大多数书是 catalog_only:目录齐全、正文一个字都没有。 */
  availability?: {
    axis?: string;
    status?: PlaybackStatus;
    readable?: boolean;
    notice?: string;
    readyItems?: number;
    totalItems?: number;
    sourceUrl?: string;
  };
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

/** 正文之外的 MUI 组件(评论、推荐、抽屉)也跟着阅读主题换底色和明暗。 */
function ReaderMuiScope({ theme, children }: { theme: ReaderTheme; children: React.ReactNode }) {
  const outer = useTheme();
  const primary = outer.palette.primary.main;
  const scoped = useMemo(
    () =>
      createTheme(theme.dark ? darkTheme : lightTheme, {
        palette: { primary: { main: primary }, background: { default: theme.page, paper: theme.paper }, divider: theme.line },
      }),
    [theme, primary],
  );
  return <ThemeProvider theme={scoped}>{children}</ThemeProvider>;
}

/** 首章之上的书籍扉页:封面、书名、作者、章节数/评分、简介。 */
function BookCover({ detail, theme, chapterTotal, onStart, empty }: { detail?: NovelDetail; theme: ReaderTheme; chapterTotal: number; onStart?: () => void; empty?: React.ReactNode }) {
  // 旧作品的 content 是章节 JSON,不能当简介
  const intro = (detail?.description || (detail?.content?.trim().startsWith('{') ? '' : detail?.content) || '').trim();
  const avail = detail?.availability;
  // 有目录、没正文 —— 线上绝大多数书就是这个状态。此时"开始阅读"是个谎:点下去
  // 翻的是一本空白书。后端没下发 availability 时(未部署 / Doris 抖动)保持原样,
  // 宁可不说也不要说错。
  const textMissing = avail?.status !== undefined && avail.readable === false;
  const stats = [
    chapterTotal > 0 && { value: chapterTotal.toLocaleString(), label: '章节' },
    typeof detail?.rating === 'number' && detail.rating > 0 && { value: detail.rating.toFixed(1), label: '评分' },
  ].filter(Boolean) as { value: string; label: string }[];

  return (
    <Box
      id="book-info"
      sx={{
        m: { xs: '16px', sm: '24px' },
        px: { xs: 2, sm: 4 },
        py: { xs: 4, sm: 6 },
        borderRadius: '24px',
        border: `1px solid ${theme.line}`,
        textAlign: 'center',
        color: theme.text,
      }}
    >
      {detail?.cover ? (
        <Box component="img" src={detail.cover} alt={detail.title || ''} sx={{ width: 94, height: 125, objectFit: 'cover', borderRadius: '6px', boxShadow: '0 4px 16px rgba(0,0,0,.18)' }} />
      ) : (
        <Box sx={{ width: 94, height: 125, mx: 'auto', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: theme.fill, color: theme.sub }}>
          <MenuBookIcon sx={{ fontSize: 40 }} />
        </Box>
      )}
      <Box component="h2" sx={{ m: 0, mt: 2.5, fontSize: { xs: 28, sm: 36 }, lineHeight: 1.25, fontWeight: 500, wordBreak: 'break-word' }}>
        {detail?.title || '未命名小说'}
      </Box>
      {/* 站内能不能读,在扉页上就说清楚 —— 不要等用户翻到第一章才发现是空白。 */}
      {avail?.status && (
        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'center' }}>
          <AvailabilityBadge status={avail.status} readyItems={avail.readyItems} totalItems={avail.totalItems} />
        </Box>
      )}
      {detail?.author && <Box sx={{ mt: 1, fontSize: 14, color: theme.sub }}>{detail.author} 著</Box>}
      {stats.length > 0 && (
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', gap: { xs: 4, sm: 10 } }}>
          {stats.map((s) => (
            <Box key={s.label} sx={{ minWidth: 0 }}>
              <Box sx={{ fontSize: 20, fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</Box>
              <Box sx={{ mt: 0.5, fontSize: 12, color: theme.sub }}>{s.label}</Box>
            </Box>
          ))}
        </Box>
      )}
      {intro && (
        <Box
          sx={{
            mt: 4,
            mx: 'auto',
            maxWidth: 560,
            fontSize: 14,
            lineHeight: 1.8,
            color: theme.sub,
            textAlign: 'left',
            whiteSpace: 'pre-line',
            display: '-webkit-box',
            WebkitLineClamp: 5,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {intro}
        </Box>
      )}
      {onStart && !textMissing && (
        <Button onClick={onStart} variant="contained" disableElevation sx={{ mt: 4, px: 5, borderRadius: '20px', bgcolor: READER_ACCENT, '&:hover': { bgcolor: '#C9262F' } }}>
          开始阅读
        </Button>
      )}
      {/* 正文没入库时,把"为什么"和"去哪读"直接给出来。目录仍然可以翻
          (下面的章节列表照常渲染),但不再假装点进去有东西可读。 */}
      {textMissing && (
        <Box sx={{ mt: 4, fontSize: 14, color: theme.sub }}>
          <Box sx={{ mb: avail?.sourceUrl ? 1.5 : 0 }}>{avail?.notice || '本站未收录该书正文'}</Box>
          {avail?.sourceUrl && (
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              href={avail.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
            >
              去原站阅读
            </Button>
          )}
        </Box>
      )}
      {empty}
    </Box>
  );
}

function NovelDetailContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const novelId = searchParams.get('novelId');
  const chapterParam = searchParams.get('chapter');
  const contentId = novelId || id;
  const { status: authStatus } = useAuth();

  const { prefs, update: updatePrefs, toggleNight } = useReaderPrefs();
  const rt = themeOf(prefs.theme);
  const fontFamily = fontOf(prefs.font);
  const outerTheme = useTheme();
  const isMobile = useMediaQuery(outerTheme.breakpoints.down('md'));

  // 已渲染的章节区间:滚动模式读到章末往后接,翻页模式始终只有一章
  const [range, setRange] = useState<{ start: number; end: number } | null>(null);
  const [current, setCurrent] = useState(0);
  const [panel, setPanel] = useState<ReaderPanel>(null);
  const [mobileChrome, setMobileChrome] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [progress, setProgress] = useState(0);
  const [viewport, setViewport] = useState(1280);
  const [shelved, setShelved] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // 行为埋点:进入详情即上报一次浏览(推荐/大数据源头)+ 写观看历史。itemType 大写以匹配 Doris content_type。
  useEffect(() => {
    if (contentId) {
      track(contentId, 'view', 'NOVEL');
      recordHistory(contentId);
    }
  }, [contentId]);

  const detailQuery = useQuery({
    queryKey: ['detail', 'novel', id],
    queryFn: () => contentDetail('novel', { id: id! }).then((r) => (r ?? null) as NovelDetail | null),
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
  const tocLoading = tocQuery.isLoading || detailQuery.isLoading;

  const fetchBody = useCallback(
    (chapterId: string) => getChapterDetail({ id: chapterId } as never).then((r) => ((r as { data?: ChapterBody })?.data ?? {}) as ChapterBody),
    [],
  );

  const setUrlChapter = useCallback(
    (chapterId: string) => {
      if (!id) return;
      // 只改地址栏,不走路由:滚动时频繁换章不该触发重新渲染整页
      window.history.replaceState(window.history.state, '', `${pathname}?id=${encodeURIComponent(id)}&chapter=${encodeURIComponent(chapterId)}`);
    },
    [id, pathname],
  );

  // 起始章节只定一次:地址栏带 chapter 的定位到那一章,否则续读上次的位置
  useEffect(() => {
    if (range || tocLoading || chapters.length === 0 || !id) return;
    const wanted = chapterParam || loadProgress(id);
    const found = wanted ? chapters.findIndex((c) => c.id === wanted) : -1;
    const start = Math.max(0, found);
    setRange({ start, end: start });
    setCurrent(start);
    if (!chapterParam && found > 0) setOkMsg(`已为你定位到上次读到的「${chapters[found].title || `第 ${found + 1} 章`}」`);
  }, [range, tocLoading, chapters, chapterParam, id]);

  const goTo = useCallback(
    (i: number) => {
      const target = chapters[i];
      if (!target) return;
      setRange({ start: i, end: i });
      setCurrent(i);
      setPanel(null);
      setShowInfo(false);
      setUrlChapter(target.id);
      if (id) saveProgress(id, target.id);
      window.scrollTo({ top: 0 });
    },
    [chapters, id, setUrlChapter],
  );

  // 切到翻页模式时收起已接上的章节,只留当前这一章
  useEffect(() => {
    if (prefs.mode !== 'page') return;
    setRange((r) => (r && r.end > r.start ? { start: current, end: current } : r));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在模式变化时收起
  }, [prefs.mode]);

  const appendAfter = useCallback(
    (i: number) => setRange((r) => (r && r.end === i && i + 1 < chapters.length ? { ...r, end: i + 1 } : r)),
    [chapters.length],
  );

  // 滚动:进度条、当前章节(视口上方 30% 处所在的那章)、移动端滚动时收起菜单
  useEffect(() => {
    let raf = 0;
    let lastY = window.scrollY;
    const compute = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
      const sections = document.querySelectorAll<HTMLElement>('[data-chapter-index]');
      let cur = -1;
      sections.forEach((s) => {
        if (cur < 0 || s.getBoundingClientRect().top <= window.innerHeight * 0.3) cur = Number(s.dataset.chapterIndex);
      });
      if (cur >= 0) setCurrent(cur);
      if (Math.abs(window.scrollY - lastY) > 24) {
        setMobileChrome(false);
        lastY = window.scrollY;
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    const onResize = () => setViewport(window.innerWidth);
    onResize();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const currentChapter = chapters[current];
  useEffect(() => {
    if (!range || !currentChapter || !id) return;
    setUrlChapter(currentChapter.id);
    saveProgress(id, currentChapter.id);
  }, [range, currentChapter, id, setUrlChapter]);

  // 页面底色跟主题走,避免回弹/超出内容时露出站点底色
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = rt.page;
    return () => {
      document.body.style.backgroundColor = prev;
    };
  }, [rt.page]);

  // 键盘:← → 翻章
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.altKey || e.ctrlKey || e.metaKey || t?.closest?.('input,textarea,[contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft') goTo(current - 1);
      else if (e.key === 'ArrowRight') goTo(current + 1);
      else if (e.key === 'Escape') setPanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, goTo]);

  const { liked, toggleLike } = useContentInteraction(contentId, {
    notify: (message, severity) => (severity === 'error' ? setErrMsg(message) : setOkMsg(message)),
  });

  const shelfMutation = useMutation({
    mutationFn: (params: { novelId: string; chapterId: string }) => addShelf({ id: params.novelId, chapterId: params.chapterId }),
    onSuccess: () => {
      setShelved(true);
      setOkMsg('已加入书架,可在「我的书架」查看');
    },
    onError: (err) => setErrMsg(formatApiError(err) || '加入书架失败,请稍后重试'),
  });
  const addToShelf = () => {
    if (shelved || shelfMutation.isPending || !contentId) return;
    if (authStatus !== 'authenticated') {
      router.push(loginHref());
      return;
    }
    shelfMutation.mutate({ novelId: contentId, chapterId: currentChapter?.id ?? '' });
  };

  const scrollToId = (elId: string) => requestAnimationFrame(() => document.getElementById(elId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

  if (!id) {
    return (
      <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>缺少参数</Box>
    );
  }

  const columnWidth = isMobile ? viewport : Math.min(prefs.width || (viewport >= 1600 ? 1000 : 800), viewport);
  const chapterTotal = Number(detail?.totalChapters) || detail?.chapterCount || chapters.length;
  const bookTitle = detail?.title || '';
  const paper = { backgroundColor: rt.paper, backgroundImage: noiseLayer(rt.dark) };
  const showCover = !tocLoading && (chapters.length === 0 || showInfo || range?.start === 0);
  const sourceLink = [detail?.sourceUrl, detail?.source].find((u) => !!u && /^https?:\/\//.test(u));
  const platforms = platformsOf(detail);

  const emptyNotice = chapters.length === 0 && !tocLoading && (
    <Box sx={{ mt: 4, pt: 3, borderTop: `1px dashed ${rt.line}`, color: rt.sub, fontSize: 14 }}>
      <Box sx={{ mb: 1.5 }}>{tocQuery.data?.backfilling ? '正在获取章节目录…' : playNoticeOf(detail) || '这本书暂时没有可在线阅读的章节'}</Box>
      {platforms.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <PlatformLinks platforms={platforms} title="" dense />
        </Box>
      )}
      {sourceLink && platforms.length === 0 && (
        <Button variant="outlined" color="inherit" size="small" href={sourceLink} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}>
          去原站阅读
        </Button>
      )}
    </Box>
  );

  const chapterNav = (i: number) => {
    const hasNext = i + 1 < chapters.length;
    const cell = (label: string, onClick: () => void, disabled?: boolean, strong?: boolean) => (
      <ButtonBase
        onClick={onClick}
        disabled={disabled}
        sx={{ flex: 1, height: '100%', fontSize: 'inherit', color: strong ? READER_ACCENT : rt.text, '&.Mui-disabled': { color: rt.sub, opacity: 0.6 } }}
      >
        {label}
      </ButtonBase>
    );
    const sep = <Box sx={{ width: '1px', height: 20, bgcolor: rt.line }} />;
    return (
      <Box sx={{ mt: 6 }}>
        {prefs.mode === 'scroll' && !hasNext && (
          <Box sx={{ mb: 2, textAlign: 'center', fontSize: 13, color: rt.sub }}>已读到最新章节</Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', height: 56, borderRadius: '28px', bgcolor: rt.fill, fontSize: { xs: 15, sm: 18 }, overflow: 'hidden' }}>
          {cell('上一章', () => goTo(i - 1), i <= 0)}
          {sep}
          {cell('目录', () => setPanel('toc'))}
          {sep}
          {cell(hasNext ? '下一章' : '没有了', () => goTo(i + 1), !hasNext, hasNext)}
        </Box>
      </Box>
    );
  };

  const rendered = range ? chapters.slice(range.start, range.end + 1) : [];

  return (
    <ReaderMuiScope theme={rt}>
      <Box sx={{ minHeight: '100vh', colorScheme: rt.dark ? 'dark' : 'light', color: rt.text, backgroundColor: rt.page, backgroundImage: noiseLayer(rt.dark), transition: 'background-color .3s' }}>
        <Snackbar open={!!errMsg} autoHideDuration={2500} onClose={() => setErrMsg(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
          <Alert severity="error" variant="filled" onClose={() => setErrMsg(null)}>
            {errMsg}
          </Alert>
        </Snackbar>
        <Snackbar open={!!okMsg && !errMsg} autoHideDuration={2500} onClose={() => setOkMsg(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
          <Alert severity="success" variant="filled" onClose={() => setOkMsg(null)}>
            {okMsg}
          </Alert>
        </Snackbar>

        <ReaderChrome
          isMobile={isMobile}
          theme={rt}
          prefs={prefs}
          onPrefs={updatePrefs}
          onToggleNight={toggleNight}
          columnWidth={columnWidth}
          panel={panel}
          onPanel={setPanel}
          mobileChrome={mobileChrome || !!panel}
          chapters={chapters}
          current={current}
          onGo={goTo}
          title={currentChapter?.title || bookTitle || '章节阅读'}
          progress={progress}
          onBack={() => router.back()}
          onBookInfo={() => {
            setShowInfo(true);
            scrollToId('book-info');
          }}
          onComments={() => scrollToId('reader-comments')}
          onTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          shelved={shelved}
          onShelf={addToShelf}
          liked={liked}
          onLike={toggleLike}
        />

        <Box
          sx={{ ...paper, width: columnWidth, maxWidth: '100%', mx: 'auto', minHeight: '100vh', transition: 'width .3s, background-color .3s' }}
          onClick={(e) => {
            if (!isMobile || (e.target as Element).closest('a,button,input,textarea,[role="button"]')) return;
            setMobileChrome((v) => !v);
          }}
        >
          {/* 面包屑:返回 / 书名 / 当前章 */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.5, px: '64px', height: 56, borderBottom: `1px solid ${rt.line}`, fontSize: 14, color: rt.sub }}>
            <ButtonBase onClick={() => router.back()} sx={{ gap: 0.5, fontSize: 'inherit', color: 'inherit', '&:hover': { color: rt.text } }}>
              <ArrowBackIosNewIcon sx={{ fontSize: 12 }} />
              返回
            </ButtonBase>
            <Box component="span" sx={{ mx: 1, opacity: 0.5 }}>|</Box>
            <ButtonBase
              onClick={() => {
                setShowInfo(true);
                scrollToId('book-info');
              }}
              sx={{ fontSize: 'inherit', color: 'inherit', maxWidth: 240, '&:hover': { color: rt.text } }}
            >
              <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookTitle || '小说'}</Box>
            </ButtonBase>
            {currentChapter && (
              <>
                <ChevronRightIcon sx={{ fontSize: 16 }} />
                <Box component="span" sx={{ color: rt.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentChapter.title}
                </Box>
              </>
            )}
          </Box>

          {detailQuery.isLoading || tocLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
              <CircularProgress size={28} sx={{ color: rt.sub }} />
            </Box>
          ) : (
            <>
              {showCover && (
                <BookCover
                  detail={detail}
                  theme={rt}
                  chapterTotal={chapterTotal}
                  empty={emptyNotice}
                  onStart={showInfo && range && range.start > 0 ? () => goTo(0) : undefined}
                />
              )}
              {rendered.map((c, k) => {
                const i = range!.start + k;
                const isLast = i === range!.end;
                return (
                  <ChapterBlock
                    key={c.id}
                    chapter={c}
                    index={i}
                    bookTitle={bookTitle}
                    author={detail?.author}
                    theme={rt}
                    fontFamily={fontFamily}
                    fontSize={prefs.fontSize}
                    fetchBody={fetchBody}
                    divider={k > 0 || showCover}
                    onReachEnd={prefs.mode === 'scroll' && isLast && i + 1 < chapters.length ? () => appendAfter(i) : undefined}
                    footer={isLast && (prefs.mode === 'page' || i + 1 >= chapters.length) ? chapterNav(i) : null}
                  />
                );
              })}
            </>
          )}

          <Box id="reader-comments" sx={{ px: { xs: '20px', sm: '64px' }, pt: 4, pb: { xs: 16, md: 8 }, borderTop: `1px solid ${rt.line}` }}>
            {contentId && <DetailFooter contentId={contentId} detail={detail} kind="read" />}
            {contentId && <DetailComments contentId={contentId} initialCount={detail?.commentCount || 0} />}
          </Box>
        </Box>
      </Box>
    </ReaderMuiScope>
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
