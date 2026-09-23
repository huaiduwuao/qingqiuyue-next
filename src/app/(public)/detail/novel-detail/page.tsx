'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import LockIcon from '@mui/icons-material/Lock';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CoverImage } from '@/components/common/CoverImage';
import { detail as contentDetail } from '@/apis/content-video';
import { page as chapterPage, get as getChapterDetail, addShelf } from '@/apis/content-novel-chapter';
import {
  useContentItems,
  fetchContentItemsAll,
  contentItemsQueryKey,
  type ContentItem,
} from '@/hooks/useContentItems';
import { useContentInteraction } from '@/hooks/useContentInteraction';
import { useAuth } from '@/contexts/AuthContext';
import { loginHref } from '@/lib/auth/redirect';
import { track, recordHistory } from '@/lib/track';
import { formatApiError } from '@/lib/api/client';
import { lightTheme, darkTheme } from '@/styles/theme';
import { DetailComments } from '@/components/detail/DetailComments';
import { DetailFooter } from '@/components/detail/DetailFooter';
import { PlatformLinks, platformsOf, playNoticeOf } from '@/components/detail/ExternalPlatforms';
import ShareButtons from '@/components/share/ShareButtons';
import { AvailabilityBadge } from '@/components/common/AvailabilityBadge';
import type { PlaybackStatus } from '@/apis/recommend';
import { ChapterBlock } from '@/components/novel-reader/ChapterBlock';
import type { ChapterBody } from '@/components/novel-reader/chapterText';
import { ReaderChrome, type ReaderPanel } from '@/components/novel-reader/ReaderChrome';
import { PaginatedReader } from '@/components/novel-reader/PaginatedReader';
import { usePaginatedReader } from '@/hooks/usePaginatedReader';
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
        /* 封面图过 CoverImage → mediaUrl:MinIO 内网直链会被改成同源 /qq-media/...,
           外站封面会包 /api/proxy?url=,防盗链 + 失败兜底。 */
        <CoverImage src={detail.cover} alt={detail.title || ''} sx={{ width: 94, height: 125, objectFit: 'cover', borderRadius: '6px', boxShadow: '0 4px 16px rgba(0,0,0,.18)' }} />
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
  const pageParam = searchParams.get('page');
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
  // 章内页(overlay/swipe 模式生效;scroll 模式始终 0)
  const [page, setPage] = useState(0);
  const [panel, setPanel] = useState<ReaderPanel>(null);
  const [mobileChrome, setMobileChrome] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [progress, setProgress] = useState(0);
  const [viewport, setViewport] = useState(1280);
  const [shelved, setShelved] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  // 用户主动退出阅读态(点章节标题回目录)后置位,阻止"起始章节"effect 立刻
  // 又按 localStorage/URL 里的章节把 range 设回去。点章节进阅读时清除。
  const [exitReading, setExitReading] = useState(false);

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

  // 目录窗口的锚点章节(给 useContentItems 当 untilChapterId —— 长篇小说初次进入只拉
  // 目标章节所在页,不一次拉全本)。进入这本书时定一次:地址栏 chapter 优先,否则本地进度。
  //
  // 之后不能再跟着地址栏变:翻章时 setUrlChapter 用 history.replaceState 改地址,
  // Next 15 给 replaceState 打了补丁,state 里不带 __NA 时会把新 URL 同步进
  // useSearchParams(见 next/dist/client/components/app-router.js)。锚点一变就是新的
  // queryKey:目录整份重拉、整页换成加载圈(分页模式下 PaginatedReader 被卸载重来),
  // loadFullToc 补全的全本目录也丢在旧 key 下。
  // SSR 期 localStorage 不存在,本地进度挂载后再读;读到之前先不发目录请求。
  const [tocAnchor, setTocAnchor] = useState(() => ({ id, chapter: chapterParam || undefined, ready: !!chapterParam }));
  if (tocAnchor.id !== id) setTocAnchor({ id, chapter: chapterParam || undefined, ready: !!chapterParam });
  useEffect(() => {
    if (!id || tocAnchor.ready) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 同步外部(localStorage)到 React
    setTocAnchor({ id, chapter: loadProgress(id)?.chapterId || undefined, ready: true });
  }, [id, tocAnchor.ready]);

  // 目录只要标题:lite 模式下后端不逐章从 MinIO 拉正文,几千章的目录也是一次轻请求。
  // untilChapterId 让循环翻页"拉到含目标章节的页就停",首次进入只取 1-2 页。
  const tocQuery = useContentItems('novel', id, chapterPage, {
    lite: true,
    untilChapterId: tocAnchor.chapter,
    enabled: tocAnchor.ready,
  });
  const queryClient = useQueryClient();
  const legacy = useMemo(() => legacyChapters(id ?? '', detail), [id, detail]);
  const chapters = useMemo(() => {
    const rows = tocQuery.data?.items ?? [];
    return rows.length ? rows : legacy;
  }, [tocQuery.data, legacy]);
  // 只在还没有任何目录数据时才算加载中(整页换成加载圈);已有数据时后台刷新不打断阅读。
  // 用 isLoading(= isPending && isFetching)而不是 isPending:query 被禁用(没有 id)时一直是 pending,
  // 加载圈会转个没完。锚点还没从 localStorage 读出来的那一帧 query 也是禁用的,单独算加载中。
  const tocLoading = tocQuery.isLoading || (!tocAnchor.ready && !!id) || detailQuery.isLoading;

  const fetchBody = useCallback(
    (chapterId: string) => getChapterDetail({ id: chapterId } as never).then((r) => (r ?? {}) as ChapterBody),
    [],
  );

  // 抽屉打开时异步把目录补到全本(忽略 untilChapterId 的窗口截断)。
  // 期间目录仍可用 —— 抽屉里展示的是当前缓存里的部分目录。
  const loadFullToc = useCallback(async () => {
    if (!id) return;
    const key = contentItemsQueryKey('novel', id, {
      lite: true,
      untilChapterId: tocAnchor.chapter,
    });
    const current = queryClient.getQueryData<{ items?: ContentItem[]; total?: number }>(key);
    if (!current || (current.total ?? 0) <= (current.items?.length ?? 0)) return;
    const full = await fetchContentItemsAll(chapterPage, id, { lite: true });
    queryClient.setQueryData(key, full);
  }, [id, queryClient, tocAnchor.chapter]);

  const setUrlChapter = useCallback(
    (chapterId: string, pageNum: number) => {
      if (!id) return;
      // 只改地址栏,不走路由:滚动时频繁换章不该触发重新渲染整页
      const pageQs = pageNum > 0 ? `&page=${pageNum}` : '';
      window.history.replaceState(window.history.state, '', `${pathname}?id=${encodeURIComponent(id)}&chapter=${encodeURIComponent(chapterId)}${pageQs}`);
    },
    [id, pathname],
  );

  // 起始章节只定一次:地址栏带 chapter 的定位到那一章,否则续读上次的位置。
  // wanted 不在缓存目录里(长篇小说初次进入时还没翻到那一页)就保持 null,
  // 等抽屉打开时 loadFullToc 补全后再用 useEffect 依赖 chapters 重算 —— 不要
  // 偷偷 reset 到 0,那样用户带 ?chapter= 进入会被弹回首章。
  useEffect(() => {
    if (range || tocLoading || chapters.length === 0 || !id) return;
    if (exitReading) return; // 用户刚退出到详情,不要立刻又按上次进度弹回阅读态
    const saved = loadProgress(id);
    const wanted = chapterParam || saved?.chapterId;
    const found = wanted ? chapters.findIndex((c) => c.id === wanted) : -1;
    if (found < 0) return;
    setRange({ start: found, end: found });
    setCurrent(found);
    // 章内页:URL 优先;没带 chapter 参数时按本地进度续到上次那一页
    const savedPage = !chapterParam || saved?.chapterId === chapterParam ? saved?.page : 0;
    setPage(Math.max(0, Number(pageParam) || savedPage || 0));
    if (!chapterParam && found > 0) setOkMsg(`已为你定位到上次读到的「${chapters[found].title || `第 ${found + 1} 章`}」`);
  }, [range, tocLoading, chapters, chapterParam, pageParam, id, exitReading]);

  // 目录抽屉打开时异步补全全本目录。已补到 total 时 loadFullToc 内部短路,
  // 反复打开不会重复请求。补完后 useEffect(range) 依赖 chapters 也会重新跑,
  // 处理"wanted 不在第一页"的情况。
  useEffect(() => {
    if (panel === 'toc') loadFullToc();
  }, [panel, loadFullToc]);

  const goTo = useCallback(
    (i: number) => {
      const target = chapters[i];
      if (!target) return;
      setExitReading(false);
      setRange({ start: i, end: i });
      setCurrent(i);
      // 从目录 / 上下章按钮跳章一律从章首开始,不能沿用上一章的页码
      setPage(0);
      setPanel(null);
      setShowInfo(false);
      setUrlChapter(target.id, 0);
      if (id) saveProgress(id, { chapterId: target.id, page: 0 });
      window.scrollTo({ top: 0 });
    },
    [chapters, id, setUrlChapter],
  );

  // 回目录/详情:退出阅读态。把地址栏的 chapter 参数去掉,并滚回顶部。
  const backToDetail = useCallback(() => {
    setExitReading(true);
    setRange(null);
    setCurrent(0);
    setPage(0);
    setPanel(null);
    setShowInfo(false);
    if (id) window.history.replaceState(window.history.state, '', `${pathname}?id=${encodeURIComponent(id)}`);
    window.scrollTo({ top: 0 });
  }, [id, pathname]);

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
    setUrlChapter(currentChapter.id, page);
    saveProgress(id, { chapterId: currentChapter.id, page });
  }, [range, currentChapter, id, page, setUrlChapter]);

  // 页面底色跟主题走,避免回弹/超出内容时露出站点底色
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = rt.page;
    return () => {
      document.body.style.backgroundColor = prev;
    };
  }, [rt.page]);

  // 键盘:← → 翻章(分页模式下 ← → 由 PaginatedReader 翻页,这里只管 Esc)
  const scrollMode = prefs.mode === 'scroll';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.altKey || e.ctrlKey || e.metaKey || t?.closest?.('input,textarea,[contenteditable="true"]')) return;
      if (e.key === 'Escape') setPanel(null);
      else if (!scrollMode) return;
      else if (e.key === 'ArrowLeft') goTo(current - 1);
      else if (e.key === 'ArrowRight') goTo(current + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, goTo, scrollMode]);

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

  // 页级阅读区 ref:hook 在这里量页面尺寸(ResizeObserver),离屏排版节点也挂在它下面。
  // 详情态(ref 不挂)和 scroll 模式下不生效。
  const paginatedRef = useRef<HTMLDivElement | null>(null);
  const paginated = usePaginatedReader({
    chapter: range ? chapters[current] ?? null : null,
    chapterIdx: range && prefs.mode !== 'scroll' ? current : null,
    pageIdx: page,
    chapters,
    fetchBody,
    fontSize: prefs.fontSize,
    fontFamily,
    containerRef: paginatedRef,
    bookTitle: detail?.title,
    author: detail?.author,
    onPageChange: (p) => setPage(p),
    onChapterChange: (chapterIdx, p) => {
      const target = chapters[chapterIdx];
      if (!target) return;
      setExitReading(false);
      setRange({ start: chapterIdx, end: chapterIdx });
      setCurrent(chapterIdx);
      setPage(p);
      setUrlChapter(target.id, p);
      if (id) saveProgress(id, { chapterId: target.id, page: p });
      window.scrollTo({ top: 0 });
    },
  });

  if (!id) {
    return (
      <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>缺少参数</Box>
    );
  }

  const columnWidth = isMobile ? viewport : Math.min(prefs.width || (viewport >= 1600 ? 1000 : 800), viewport);
  const chapterTotal = Number(detail?.totalChapters) || detail?.chapterCount || chapters.length;
  const bookTitle = detail?.title || '';
  const paper = { backgroundColor: rt.paper, backgroundImage: noiseLayer(rt.dark) };
  // 详情态:还没开始读(range 为 null)。此时显示书籍详情 + 章节列表,不渲染正文。
  const showDetail = !tocLoading && range === null;
  const showCover = showDetail || (!tocLoading && (chapters.length === 0 || showInfo || range?.start === 0));
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

  /** 详情态的章节列表:点某一章跳到阅读态(从该章开始渲染正文)。 */
  const chapterCatalog = chapters.length > 0 && (
    <Box id="chapter-list" sx={{ mx: { xs: '16px', sm: '24px' }, mt: 2, mb: 6 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
        <Box component="h3" sx={{ m: 0, fontSize: 18, fontWeight: 600, color: rt.text }}>
          章节目录
        </Box>
        <Box sx={{ fontSize: 13, color: rt.sub }}>共 {chapterTotal || chapters.length} 章</Box>
      </Box>
      <Box sx={{ borderRadius: '16px', border: `1px solid ${rt.line}`, overflow: 'hidden' }}>
        {chapters.map((c, i) => (
          <ButtonBase
            key={c.id}
            onClick={() => goTo(i)}
            sx={{
              width: '100%',
              justifyContent: 'flex-start',
              gap: 1.5,
              px: 2.5,
              py: 1.5,
              fontSize: 15,
              textAlign: 'left',
              color: rt.text,
              borderTop: i > 0 ? `1px solid ${rt.line}` : 'none',
              '&:hover': { bgcolor: rt.fill },
            }}
          >
            <Box component="span" sx={{ fontSize: 12, color: rt.sub, fontVariantNumeric: 'tabular-nums', flexShrink: 0, width: 32, textAlign: 'right' }}>
              {i + 1}
            </Box>
            <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.title || `第 ${i + 1} 章`}
            </Box>
            {c.locked && <LockIcon sx={{ fontSize: 15, color: rt.sub, flexShrink: 0 }} />}
          </ButtonBase>
        ))}
      </Box>
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
          mobileChrome={showDetail || mobileChrome || !!panel}
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
          showComments={showDetail}
        />

        <Box
          sx={{ ...paper, width: columnWidth, maxWidth: '100%', mx: 'auto', minHeight: '100vh', transition: 'width .3s, background-color .3s' }}
          onClick={(e) => {
            if (!isMobile || (e.target as Element).closest('a,button,input,textarea,[role="button"]')) return;
            setMobileChrome((v) => !v);
          }}
        >
          {/* 顶部标题栏:吸顶(sticky),返回 / 分享 / 书名 / 当前章。
              详情态与阅读态都在;滚动到底部评论区时钉在顶部。 */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, position: 'sticky', top: 0, zIndex: 1100, backgroundColor: rt.paper, backgroundImage: noiseLayer(rt.dark), alignItems: 'center', gap: 0.5, px: '64px', height: 56, borderBottom: `1px solid ${rt.line}`, fontSize: 14, color: rt.sub }}>
            <ButtonBase onClick={() => router.back()} sx={{ gap: 0.5, fontSize: 'inherit', color: 'inherit', '&:hover': { color: rt.text } }}>
              <ArrowBackIosNewIcon sx={{ fontSize: 12 }} />
              返回
            </ButtonBase>
            <Box sx={{ ml: 'auto' }}>
              <ShareButtons
                contentType="novel"
                contentId={id ?? ''}
                title={bookTitle || '小说详情'}
                url={typeof window !== 'undefined' ? window.location.href : ''}
                cover={detail?.cover}
                desc={(detail as any)?.desc || (detail as any)?.intro}
              />
            </Box>
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
          ) : showDetail ? (
            <>
              <BookCover
                detail={detail}
                theme={rt}
                chapterTotal={chapterTotal}
                empty={emptyNotice}
                onStart={chapters.length ? () => goTo(0) : undefined}
              />
              {chapterCatalog}
            </>
          ) : (
            <>
              {/* 扉页:scroll 模式渲染(连排会滚过扉页);overlay/swipe 是全屏固定高度
                  的分页容器,上面压着 BookCover 会把它顶到视口外,这里不渲染。 */}
              {showCover && prefs.mode === 'scroll' && (
                <BookCover
                  detail={detail}
                  theme={rt}
                  chapterTotal={chapterTotal}
                  empty={emptyNotice}
                  onStart={showInfo && range && range.start > 0 ? () => goTo(0) : undefined}
                />
              )}
              {prefs.mode === 'scroll' ? (
                // scroll:整章连排,到章末自动接下一章(原路径)
                rendered.map((c, k) => {
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
                      onTitleClick={backToDetail}
                      onReachEnd={isLast && i + 1 < chapters.length ? () => appendAfter(i) : undefined}
                      footer={isLast && i + 1 >= chapters.length ? chapterNav(i) : null}
                    />
                  );
                })
              ) : (
                // overlay/swipe:页级分页 + 翻页 wrapper
                <Box
                  ref={paginatedRef}
                  sx={{
                    height: isMobile
                      ? 'calc(100dvh - var(--sat, 0px) - var(--sab, 0px))'
                      : 'calc(100dvh - 56px)',
                    width: '100%',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <PaginatedReader
                    chapters={chapters}
                    current={paginated.current}
                    prev={paginated.prev}
                    next={paginated.next}
                    pageCount={paginated.pageCount}
                    pageWidth={paginated.pageWidth}
                    pageHeight={paginated.pageHeight}
                    bookTitle={bookTitle}
                    author={detail?.author}
                    theme={rt}
                    fontFamily={fontFamily}
                    fontSize={prefs.fontSize}
                    onGoNext={paginated.goNext}
                    onGoPrev={paginated.goPrev}
                    onRetry={paginated.retry}
                    keyboardEnabled={!panel}
                    mode={prefs.mode === 'swipe' ? 'curl' : 'cover'}
                  />
                </Box>
              )}
            </>
          )}

          {/* 推荐/打赏/评论:仅详情态展示(进入阅读态后,这套是阅读器 chrome 的扩展,
              不是正文的一部分,留着只会把用户拉到页面底部毁掉沉浸感)。 */}
          {showDetail && contentId && (
            <Box id="reader-comments" sx={{ px: { xs: '20px', sm: '64px' }, pt: 4, pb: { xs: 16, md: 8 }, borderTop: `1px solid ${rt.line}` }}>
              <DetailFooter contentId={contentId} detail={detail} kind="read" />
              <DetailComments contentId={contentId} initialCount={detail?.commentCount || 0} />
            </Box>
          )}
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
