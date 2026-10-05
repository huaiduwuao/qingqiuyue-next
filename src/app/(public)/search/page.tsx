'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { trackSearchClick } from '@/lib/track';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Skeleton from '@mui/material/Skeleton';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { useContentNavigate } from '@/lib/contentRoute';
import { isDiscoverPending, searchContent, type DiscoverState, type GuessState, type SearchPersonCard } from '@/apis/search';
import { fetchContentTypes, fetchFacets, type ContentTypeItem, type FacetItem } from '@/apis/home-discover';
import { topKeywordInThirdMonth } from '@/apis/home';
import { homeClient, formatApiError } from '@/lib/api/client';
import { useAIPrefs } from '@/lib/aiPrefs';
import { AISearchResults } from '@/components/ai/AISearchResults';
import { ListLayoutSwitch } from '@/components/common/ListLayout';
import { useAutoLoad } from '@/hooks/useAutoLoad';
import {
  DISCOVER_MAX_POLLS,
  DISCOVER_POLL_INTERVAL,
  parseResultTab,
  searchHref,
  toSearchItems,
  type ResultTab,
  type SearchContentItem,
  type SearchCreatorItem,
  type SearchTopicItem,
} from './searchModel';
import { useSearchImpressions, useSearchStreamRefetch, useSearchSuggest } from './useSearchEffects';
import { SearchHeader } from './SearchHeader';
import { SearchFilterBar } from './SearchFilterBar';
import { AISuggestHint, DiscoverBanner, GuessTypeBanner } from './SearchBanners';
import { PersonCard } from './PersonCard';
import { ContentResult, CreatorResult, Section, TopicResult } from './SearchResultCards';
import { AIEmptyState, EmptyState, LoadingSkeleton, NoResults } from './SearchEmptyStates';

// 查询未返回时的稳定空数组:筛选条是 memo 的,每次渲染新建 [] 会让它白白重渲染。
const NO_TYPES: ContentTypeItem[] = [];
const NO_FACETS: FacetItem[] = [];

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchLoadingShell />}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchLoadingShell() {
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'var(--bg-body, #0a0a0f)', color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Skeleton variant="text" width={200} sx={{ bgcolor: 'var(--bg-input, rgba(255,255,255,0.06))' }} />
    </Box>
  );
}

function SearchPageContent() {
  const router = useRouter();
  const navigateContent = useContentNavigate();
  const searchParams = useSearchParams();
  // ?mode=ai:AI 搜索(一句话描述 → AI 拆条件 → 带理由的结果)。用户关掉 AI 入口后一律按普通搜索。
  const [aiPrefs] = useAIPrefs();
  const aiEnabled = aiPrefs.aiEntry;
  const aiMode = aiEnabled && searchParams.get('mode') === 'ai';
  const initialQ = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initialQ);
  // 结果页签和筛选的初值取自 URL,改动后写回 URL(见下方 filterQs),
  // 点进详情再返回时还原 —— 以前只有关键词能回来,页签和筛选全丢。
  const [tab, setTab] = useState<ResultTab>(() => parseResultTab(searchParams.get('tab')));
  // 结构化筛选:类型/导演/演员/类型标签/年代(走后端 /search 的 metadata 结构化参数)
  const [fType, setFType] = useState(() => searchParams.get('type') ?? '');
  const [fDirector, setFDirector] = useState(() => searchParams.get('director') ?? '');
  const [fActor, setFActor] = useState(() => searchParams.get('actor') ?? '');
  const [fGenre, setFGenre] = useState(() => searchParams.get('genre') ?? '');
  const [fYear, setFYear] = useState(() => searchParams.get('year') ?? '');
  // 只看站内能看 / 能读的(后端 usable=1)
  const [fUsable, setFUsable] = useState(() => searchParams.get('usable') === '1');
  const filterQs = React.useMemo(() => {
    const p = new URLSearchParams();
    if (tab !== 'all') p.set('tab', tab);
    if (fType) p.set('type', fType);
    if (fDirector) p.set('director', fDirector);
    if (fActor) p.set('actor', fActor);
    if (fGenre) p.set('genre', fGenre);
    if (fYear) p.set('year', fYear);
    if (fUsable) p.set('usable', '1');
    return p.toString();
  }, [tab, fType, fDirector, fActor, fGenre, fYear, fUsable]);
  // 导演/演员是文本框,边打边改 URL 会打断输入法,停手 300ms 再写。
  useEffect(() => {
    const t = setTimeout(() => {
      const cur = new URLSearchParams(window.location.search);
      const href = searchHref(cur.get('q') ?? '', cur.get('mode') === 'ai', filterQs);
      if (href !== window.location.pathname + window.location.search) router.replace(href, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [filterQs]); // eslint-disable-line react-hooks/exhaustive-deps
  // 动态聚合建议当前字段(聚焦导演/演员输入时拉取候选)
  const [facetField, setFacetField] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [followBusyId, setFollowBusyId] = useState<number | null>(null);

  const { creators, topics } = useSearchSuggest(query, aiMode);

  const hotKeywordsQuery = useQuery({
    queryKey: ['search-hot'],
    queryFn: async () => {
      const res = (await topKeywordInThirdMonth()) as any;
      const list = res?.list || res || [];
      return (Array.isArray(list) ? list : [])
        .map((it: any) => it.keyword || it.word || it.title || String(it))
        .filter(Boolean)
        .slice(0, 10) as string[];
    },
    enabled: query.trim().length === 0,
    staleTime: 5 * 60 * 1000,
  });
  const hotKeywords = hotKeywordsQuery.data ?? [];

  // 内容类型大类(后台可维护):搜索页类型下拉选项来源
  const typesQuery = useQuery({
    queryKey: ['dict', 'types'],
    queryFn: async () => {
      const res = (await fetchContentTypes()) as any;
      const list = res?.list || res || [];
      return (Array.isArray(list) ? list : []) as ContentTypeItem[];
    },
    staleTime: 10 * 60 * 1000,
  });
  const contentTypes = typesQuery.data ?? NO_TYPES;

  // 演员/导演/歌手动态聚合建议(聚焦输入时拉取,按频次降序)
  const facetsQuery = useQuery({
    queryKey: ['dict', 'facets', fType, facetField],
    queryFn: async () => {
      if (!facetField) return [] as FacetItem[];
      const res = (await fetchFacets({ type: fType || undefined, field: facetField, limit: 20 })) as any;
      const list = res?.list || [];
      return (Array.isArray(list) ? list : []) as FacetItem[];
    },
    enabled: !!facetField,
    staleTime: 5 * 60 * 1000,
  });
  const facetSuggestions = facetsQuery.data ?? NO_FACETS;

  const searchKey = [query.trim(), fType, fDirector, fActor, fGenre, fYear, fUsable ? 'u' : ''].join('|');
  const searchQueryKey = ['search-content', query.trim(), fType, fDirector, fActor, fGenre, fYear, fUsable];
  const queryClient = useQueryClient();

  const searchQuery = useQuery({
    queryKey: searchQueryKey,
    queryFn: async (): Promise<{
      items: SearchContentItem[];
      total: number;
      hasMore: boolean;
      discover: DiscoverState | null;
      guess: GuessState | null;
      person: SearchPersonCard | null;
    }> => {
      const q = query.trim();
      const hasFilter = !!(fType || fDirector || fActor || fGenre || fYear);
      if (!q && !hasFilter) return { items: [], total: 0, hasMore: false, discover: null, guess: null, person: null };
      // 走统一 GET /search(kw + 结构化筛选参数),见 src/apis/search.ts
      const res = (await searchContent(q, {
        type: fType || undefined,
        director: fDirector || undefined,
        actor: fActor || undefined,
        genre: fGenre || undefined,
        year: fYear || undefined,
        usable: fUsable ? 1 : undefined,
      })) as any;
      const items = toSearchItems(res, q);
      // 类型猜测:后端在用户没选分类时猜他想找的类型(并据此收窄全网检索源)。
      const guess: GuessState | null = res?.guessed_type
        ? { type: res.guessed_type, confidence: res.guessed_confidence ?? 0, source: res.guessed_source ?? '' }
        : null;
      return {
        items,
        total: typeof res?.total === 'number' ? res.total : items.length,
        hasMore: Boolean(res?.hasMore),
        discover: (res?.discover as DiscoverState | undefined) ?? null,
        guess,
        person: (res?.person as SearchPersonCard | undefined) ?? null,
      };
    },
    enabled: !aiMode && (query.trim().length > 0 || !!(fType || fDirector || fActor || fGenre || fYear)),
    staleTime: 60 * 1000,
    // 全网检索进行中:定时重搜,新收录的作品随时出现;次数用完就停,不无限轮询。
    refetchInterval: (qr) =>
      isDiscoverPending(qr.state.data?.discover) && qr.state.dataUpdateCount < DISCOVER_MAX_POLLS ? DISCOVER_POLL_INTERVAL : false,
  });

  // URL ?q= → query 同步(支持深链 / 浏览器后退)
  useEffect(() => {
    const urlQ = searchParams.get('q') ?? '';
    if (urlQ !== query) setQuery(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useSearchStreamRefetch(query, aiMode, searchQuery.refetch);
  useSearchImpressions(query);

  const q = query.trim();
  const hasQuery = q.length > 0;

  // 滚到底自动翻出来的后续页;换关键词/筛选(searchKey 变)就作废。
  const [more, setMore] = useState<{ key: string; items: SearchContentItem[]; page: number; hasMore: boolean }>({
    key: '',
    items: [],
    page: 1,
    hasMore: false,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  // 自动翻页失败时记下是哪次搜索,停下等用户点重试,免得哨兵还在可视区就无限重试
  const [moreFailedKey, setMoreFailedKey] = useState<string | null>(null);
  const firstPage = searchQuery.data?.items ?? [];
  const extra = more.key === searchKey ? more.items : [];
  // 搜人名:人物卡片单独放在结果最上面,列表里同一个人物条目就不再重复出现。
  const person = searchQuery.data?.person ?? null;
  const contents = (extra.length
    ? [...firstPage, ...extra.filter((x) => !firstPage.some((f) => f.id === x.id))]
    : firstPage
  ).filter((c) => !person || String(c.id) !== String(person.id));
  const contentHasMore = more.key === searchKey ? more.hasMore : Boolean(searchQuery.data?.hasMore);
  // 后端给的是全部命中数,页面一次只拿一页;两者取大,别出现「共 20 条」其实还有几百条。
  const contentTotal = Math.max(searchQuery.data?.total ?? 0, contents.length);
  const loadMoreContents = async () => {
    if (loadingMore) return;
    const page = (more.key === searchKey ? more.page : 1) + 1;
    setLoadingMore(true);
    setMoreFailedKey(null);
    try {
      const res = (await searchContent(query.trim(), {
        page,
        type: fType || undefined,
        director: fDirector || undefined,
        actor: fActor || undefined,
        genre: fGenre || undefined,
        year: fYear || undefined,
        usable: fUsable ? 1 : undefined,
      })) as any;
      const items = toSearchItems(res, query.trim());
      setMore((prev) => ({
        key: searchKey,
        items: [...(prev.key === searchKey ? prev.items : []), ...items],
        page,
        hasMore: Boolean(res?.hasMore),
      }));
    } catch {
      setMoreFailedKey(searchKey);
      setSnack({ open: true, message: '加载更多失败，请稍后再试', severity: 'error' });
    } finally {
      setLoadingMore(false);
    }
  };
  const moreFailed = moreFailedKey === searchKey;
  const contentSentinel = useAutoLoad(tab === 'content' && contentHasMore && !moreFailed, loadingMore, () => void loadMoreContents());
  const discover = searchQuery.data?.discover ?? null;
  // 类型猜测:仅在用户没手动选分类时展示(选了就不必提示)。
  const guess = searchQuery.data?.guess ?? null;
  const discovering =
    isDiscoverPending(discover) &&
    (queryClient.getQueryState(searchQueryKey)?.dataUpdateCount ?? 0) < DISCOVER_MAX_POLLS;
  // 本次搜索里亲眼看到过"检索中",完成时才提示新收录了几条(缓存里的旧 done 不提示)。
  const [sawDiscovering, setSawDiscovering] = useState('');
  if (discovering && sawDiscovering !== searchKey) setSawDiscovering(searchKey);
  const discoverJustDone = !discovering && discover?.status === 'done' && sawDiscovering === searchKey;
  const total = contentTotal + creators.length + topics.length;
  const loading = searchQuery.isPending;

  const pushQuery = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      router.replace(searchHref(trimmed, aiMode, filterQs), { scroll: false });
    },
    [router, aiMode, filterQs],
  );

  const handleSubmit = useCallback(() => {
    if (!q) return;
    pushQuery(q);
    if (!history.includes(q)) {
      setHistory((prev) => [q, ...prev].slice(0, 8));
    }
  }, [q, pushQuery, history]);

  const handleClear = useCallback(() => {
    setQuery('');
    router.replace(searchHref('', aiMode, filterQs), { scroll: false });
  }, [router, aiMode, filterQs]);

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/home/recommend');
    }
  }, [router]);

  const switchMode = useCallback((ai: boolean) => {
    router.replace(searchHref(q, ai, filterQs), { scroll: false });
  }, [router, q, filterQs]);

  const handleKeywordPick = (kw: string) => {
    if (!history.includes(kw)) {
      setHistory((prev) => [kw, ...prev].slice(0, 8));
    }
    pushQuery(kw);
  };

  const handleClearHistory = () => setHistory([]);
  const handleRemoveHistory = (kw: string) =>
    setHistory((prev) => prev.filter((h) => h !== kw));

  // 结果卡片是 memo 的:下面这几个回调做成稳定引用,改筛选/输入时卡片不跟着重渲染。
  // 关注中的 id 用 ref 判重,回调就不用依赖 followBusyId 这个 state
  const followBusyRef = React.useRef<number | null>(null);
  const handleFollowCreator = useCallback(async (creator: SearchCreatorItem) => {
    if (followBusyRef.current === creator.id) return;
    followBusyRef.current = creator.id;
    setFollowBusyId(creator.id);
    try {
      await homeClient.post(`/follow/${creator.id}`);
      setSnack({ open: true, message: '关注成功', severity: 'success' });
    } catch (err) {
      setSnack({ open: true, message: formatApiError(err) || '关注失败,请重试', severity: 'error' });
    } finally {
      followBusyRef.current = null;
      setFollowBusyId(null);
    }
  }, []);

  const handleOpenTopic = useCallback(
    (topic: SearchTopicItem) => {
      // /search/topic 路由不存在(死链 404);话题详情页是 /detail/topic-detail,
      // 与 TopicCard.tsx、home/recommend 处的跳转保持一致。
      router.push(`/detail/topic-detail?id=${topic.id}`);
    },
    [router],
  );

  const handleOpenContent = useCallback(
    (c: SearchContentItem, i: number) => {
      trackSearchClick(q, c.id, c.contentType, i);
      navigateContent(c.contentType, c.id);
    },
    [q, navigateContent],
  );

  // 只随关键词变:关键词不变时(切筛选、翻页)高亮函数引用不变
  const renderHighlight = useCallback((text: string) => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <Box
          component="span"
          sx={{
            color: 'primary.main',
            fontWeight: 700,
            bgcolor: 'rgba(254, 44, 85, 0.12)',
            borderRadius: 0.5,
            px: 0.25,
          }}
        >
          {text.slice(idx, idx + q.length)}
        </Box>
        {text.slice(idx + q.length)}
      </>
    );
  }, [q]);

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: 'var(--bg-body, #0a0a0f)',
        color: 'var(--text-primary, rgba(255,255,255,0.92))',
        overflowX: 'hidden',
        position: 'relative',
      }}
    >
      {/* 顶部固定栏:返回 + 大搜索框 + 搜索按钮 + 清空 */}
      <SearchHeader
        query={query}
        setQuery={setQuery}
        aiMode={aiMode}
        onSubmit={handleSubmit}
        onBack={handleBack}
        onClear={handleClear}
      />

      {/* 结构化筛选:类型/导演/演员/类型标签/年代(走后端 /search metadata 筛选) */}
      <SearchFilterBar
        aiEnabled={aiEnabled}
        aiMode={aiMode}
        onSwitchMode={switchMode}
        contentTypes={contentTypes}
        facetField={facetField}
        setFacetField={setFacetField}
        facetSuggestions={facetSuggestions}
        fType={fType}
        setFType={setFType}
        fDirector={fDirector}
        setFDirector={setFDirector}
        fActor={fActor}
        setFActor={setFActor}
        fGenre={fGenre}
        setFGenre={setFGenre}
        fYear={fYear}
        setFYear={setFYear}
        fUsable={fUsable}
        setFUsable={setFUsable}
      />

      <Box sx={{ maxWidth: 'var(--page-max)', mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
        {aiMode ? (
          hasQuery ? <AISearchResults query={q} onRetryHint="改用普通搜索" /> : <AIEmptyState onPick={handleKeywordPick} />
        ) : !hasQuery ? (
          <EmptyState
            hotKeywords={hotKeywords}
            history={history}
            onPickKeyword={handleKeywordPick}
            onClearHistory={handleClearHistory}
            onRemoveHistory={handleRemoveHistory}
          />
        ) : (
          <>
            {/* 顶部结果摘要 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Box
                sx={{
                  width: 4,
                  height: 18,
                  borderRadius: 2,
                  background: 'linear-gradient(180deg, #FE2C55 0%, #FFB400 100%)',
                }}
              />
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
                搜索:<Box component="span" sx={{ color: 'primary.main' }}>{q}</Box>
              </Typography>
              {!loading && (
                <Box
                  sx={{
                    ml: 0.5,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 0.75,
                    bgcolor: 'var(--bg-input, rgba(255,255,255,0.06))',
                    color: 'var(--text-secondary, rgba(255,255,255,0.7))',
                    fontSize: 11,
                  }}
                >
                  共 {total} 条结果
                </Box>
              )}
              {loading && (
                <Box sx={{ ml: 0.5, fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.45))' }}>搜索中…</Box>
              )}
            </Box>

            {/* 描述比较长的查询,关键词匹配往往不理想:提示可以换 AI 搜索 */}
            {aiEnabled && Array.from(q).length >= 6 && <AISuggestHint onClick={() => switchMode(true)} />}

            {/* Tab 切换 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))', mb: 3 }}>
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 36,
                  '& .MuiTab-root': {
                    minHeight: 36,
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-muted, rgba(255,255,255,0.55))',
                    textTransform: 'none',
                    py: 1,
                  },
                  '& .Mui-selected': { color: 'var(--text-primary) !important', fontWeight: 700 },
                  '& .MuiTabs-indicator': { backgroundColor: 'primary.main', height: 2 },
                }}
              >
                <Tab value="all" label={`全部 ${total}`} />
                <Tab value="content" label={`内容 ${contentTotal}`} />
                <Tab value="creator" label={`创作者 ${creators.length}`} />
                <Tab value="topic" label={`话题 ${topics.length}`} />
              </Tabs>
              <ListLayoutSwitch />
            </Box>

            <DiscoverBanner
              query={q}
              discovering={discovering}
              justDone={discoverJustDone}
              indexed={discover?.indexed ?? 0}
              merged={discover?.merged ?? 0}
              total={contentTotal}
              empty={total === 0}
            />

            {!fType && guess && (
              <GuessTypeBanner
                guess={guess}
                onSwitch={() => setFType(guess.type)}
              />
            )}

            {loading ? (
              <LoadingSkeleton />
            ) : total === 0 ? (
              discovering ? null : (
                <NoResults
                  query={q}
                  hotKeywords={hotKeywords}
                  onPickKeyword={handleKeywordPick}
                  searchedWeb={discover?.status === 'done'}
                />
              )
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(tab === 'all' || tab === 'content') && person && (
                  <PersonCard
                    person={person}
                    activeType={fType}
                    onOpen={() => navigateContent('PERSON', person.id)}
                    onPickType={(t) => setFType(fType === t ? '' : t)}
                  />
                )}
                {(tab === 'all' || tab === 'content') && contents.length > 0 && (
                  <Section
                    title="内容"
                    count={contentTotal}
                    visible={tab === 'all' ? Math.min(contents.length, 4) : contents.length}
                    onMore={tab === 'all' && contentTotal > 4 ? () => setTab('content') : undefined}
                    moreLabel="查看全部内容"
                  >
                    {contents
                      .slice(0, tab === 'all' ? 4 : undefined)
                      .map((c, i) => (
                        <ContentResult
                          key={c.id}
                          item={c}
                          onClick={handleOpenContent}
                          renderHL={renderHighlight}
                          positionForImpression={i}
                        />
                      ))}
                    {tab === 'content' && contentHasMore && (
                      <Box ref={contentSentinel} sx={{ display: 'flex', justifyContent: 'center', pt: 1, minHeight: 24 }}>
                        {loadingMore && <CircularProgress size={18} />}
                        {moreFailed && !loadingMore && (
                          <Button size="small" onClick={() => void loadMoreContents()} sx={{ color: 'text.secondary' }}>
                            加载失败,点此重试
                          </Button>
                        )}
                      </Box>
                    )}
                  </Section>
                )}
                {(tab === 'all' || tab === 'creator') && creators.length > 0 && (
                  <Section
                    title="创作者"
                    count={creators.length}
                    visible={tab === 'all' ? Math.min(creators.length, 3) : creators.length}
                    onMore={tab === 'all' && creators.length > 3 ? () => setTab('creator') : undefined}
                    moreLabel="查看全部创作者"
                  >
                    {creators
                      .slice(0, tab === 'all' ? 3 : undefined)
                      .map((c) => (
                        <CreatorResult
                          key={c.id}
                          item={c}
                          renderHL={renderHighlight}
                          onFollow={handleFollowCreator}
                          following={followBusyId === c.id}
                        />
                      ))}
                  </Section>
                )}
                {(tab === 'all' || tab === 'topic') && topics.length > 0 && (
                  <Section
                    title="话题"
                    count={topics.length}
                    visible={tab === 'all' ? Math.min(topics.length, 3) : topics.length}
                    onMore={tab === 'all' && topics.length > 3 ? () => setTab('topic') : undefined}
                    moreLabel="查看全部话题"
                  >
                    {topics
                      .slice(0, tab === 'all' ? 3 : undefined)
                      .map((t) => (
                        <TopicResult
                          key={t.id}
                          item={t}
                          renderHL={renderHighlight}
                          onClick={handleOpenTopic}
                        />
                      ))}
                  </Section>
                )}
              </Box>
            )}
          </>
        )}
      </Box>

      <Divider sx={{ borderColor: 'var(--border-color, rgba(255,255,255,0.06))' }} />
      <Box sx={{ py: 4, px: { xs: 2, md: 3 }, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 12, color: 'var(--text-disabled, rgba(255,255,255,0.35))' }}>
          © 2026 清秋月 · 按 Enter 搜索 · Esc 返回
        </Typography>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={2200}
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
