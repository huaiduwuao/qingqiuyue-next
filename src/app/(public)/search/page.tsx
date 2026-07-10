'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import VerifiedIcon from '@mui/icons-material/Verified';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { ThemeProvider } from '@mui/material/styles';
import { darkTheme } from '@/styles/theme';
import { ACCENT } from '@/constants/accents';
import { useContentNavigate } from '@/lib/contentRoute';
import { searchContent } from '@/apis/global';
import { topKeywordInThirdMonth } from '@/apis/home';
import RecommendBoard from '@/components/home/RecommendBoard';
import { adminClient, homeClient, formatApiError } from '@/lib/api/client';

// 搜索域占位:后端 `/api/core/search/*` 就绪后,以下数据/函数替换为 API 调用
type SearchContentItemContentType =
  | 'NOVEL' | 'FILM' | 'MUSIC' | 'VIDEO' | 'COMICS'
  | 'TELEPLAY' | 'ARTICLE' | 'ANIMATION' | 'NEWS' | 'VSHOW';
interface SearchContentItem {
  id: number;
  title: string;
  subtitle?: string;
  contentType: SearchContentItemContentType;
  coverGradient: string;
  author: string;
  views: number;
  comments: number;
  likes: number;
  matchField: 'title' | 'subtitle' | 'author';
}
interface SearchCreatorItem {
  id: number;
  name: string;
  bio: string;
  avatarGradient: string;
  followers: number;
  works: number;
  verified: boolean;
  tags: string[];
}
interface SearchTopicItem {
  id: number;
  title: string;
  description: string;
  discussCount: number;
  viewCount: number;
  hot: boolean;
  gradient: string;
}
function formatNumber(n: number): string { return n.toString(); }

type ResultTab = 'all' | 'content' | 'creator' | 'topic';

const TYPE_LABEL: Record<SearchContentItem['contentType'], string> = {
  NOVEL: '小说',
  FILM: '电影',
  MUSIC: '音乐',
  VIDEO: '视频',
  COMICS: '漫画',
  TELEPLAY: '剧集',
  ARTICLE: '文章',
  ANIMATION: '动画',
  NEWS: '资讯',
  VSHOW: '综艺',
};

const TYPE_ACCENT: Record<SearchContentItem['contentType'], string> = {
  NOVEL: '#FE2C55',
  FILM: '#8B5CF6',
  MUSIC: '#D4AF37',
  VIDEO: '#25F4EE',
  COMICS: '#5B8DEF',
  TELEPLAY: '#FF8A3D',
  ARTICLE: '#FFB400',
  ANIMATION: '#F472B6',
  NEWS: '#C5C8D6',
  VSHOW: '#FE2C55',
};

export default function SearchPage() {
  return (
    <ThemeProvider theme={darkTheme}>
      <Suspense fallback={<SearchLoadingShell />}>
        <SearchPageContent />
      </Suspense>
    </ThemeProvider>
  );
}

function SearchLoadingShell() {
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: '#0a0a0f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Skeleton variant="text" width={200} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
    </Box>
  );
}

function SearchPageContent() {
  const router = useRouter();
  const navigateContent = useContentNavigate();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initialQ);
  const [tab, setTab] = useState<ResultTab>('all');
  const [history, setHistory] = useState<string[]>([]);
  const [creators, setCreators] = useState<SearchCreatorItem[]>([]);
  const [topics, setTopics] = useState<SearchTopicItem[]>([]);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [followBusyId, setFollowBusyId] = useState<number | null>(null);

  // 联想:创作者 + 话题(suggest API)
  useEffect(() => {
    const kw = query.trim();
    if (!kw) {
      setCreators([]);
      setTopics([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = (await adminClient('/search/suggest', {
          params: { q: kw },
        })) as any;
        if (cancelled) return;
        const payload = res?.data ?? res ?? {};
        const creatorList: any[] = Array.isArray(payload.creators) ? payload.creators : [];
        const topicList: any[] = Array.isArray(payload.topics) ? payload.topics : [];
        setCreators(
          creatorList.map((c) => ({
            id: Number(c.id ?? 0),
            name: c.name || c.username || c.userName || '创作者',
            bio: c.bio || c.description || '',
            avatarGradient:
              c.avatarGradient ||
              c.coverGradient ||
              'linear-gradient(135deg, #FE2C55, #8B5CF6)',
            followers: Number(c.followers ?? c.fans ?? 0),
            works: Number(c.works ?? c.workCount ?? 0),
            verified: Boolean(c.verified),
            tags: Array.isArray(c.tags) ? c.tags : [],
          })) as SearchCreatorItem[],
        );
        setTopics(
          topicList.map((t) => ({
            id: Number(t.id ?? 0),
            title: t.title || t.name || '话题',
            description: t.description || t.info || '',
            discussCount: Number(t.discussCount ?? t.commentNum ?? 0),
            viewCount: Number(t.viewCount ?? t.views ?? 0),
            hot: Boolean(t.hot),
            gradient:
              t.gradient ||
              t.coverGradient ||
              'linear-gradient(135deg, #FE2C55, #FFB400)',
          })) as SearchTopicItem[],
        );
      } catch (err) {
        if (cancelled) return;
        // 后端未就绪时静默兜底,保持为空数组即可
        console.warn('load search/suggest failed', formatApiError(err));
        setCreators([]);
        setTopics([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  const hotKeywordsQuery = useQuery({
    queryKey: ['search-hot'],
    queryFn: async () => {
      const res = (await topKeywordInThirdMonth()) as any;
      const list = res?.data?.list || res?.data || [];
      return (Array.isArray(list) ? list : [])
        .map((it: any) => it.keyword || it.word || it.title || String(it))
        .filter(Boolean)
        .slice(0, 10) as string[];
    },
    enabled: query.trim().length === 0,
    staleTime: 5 * 60 * 1000,
  });
  const hotKeywords = hotKeywordsQuery.data ?? [];

  const searchQuery = useQuery({
    queryKey: ['search-content', query.trim()],
    queryFn: async () => {
      const q = query.trim();
      if (!q) return [];
      const res = (await searchContent({ keyword: q })) as any;
      const list = res?.data?.list || res?.data || [];
      return (Array.isArray(list) ? list : []).map((it: any) => ({
        id: it.id ?? 0,
        title: it.title || it.name || '未命名',
        subtitle: it.subtitle || it.info || it.description,
        contentType: (it.contentType || it.type || 'VIDEO').toUpperCase() as SearchContentItem['contentType'],
        coverGradient: it.cover || it.coverGradient || 'linear-gradient(135deg, #FE2C55, #8B5CF6)',
        author: it.author || it.username || it.userName || '清秋月',
        views: it.views || it.readNum || 0,
        comments: it.comments || it.commentNum || 0,
        likes: it.likes || it.agreeNum || 0,
        matchField: (it.matchField || 'title') as SearchContentItem['matchField'],
      })) as SearchContentItem[];
    },
    enabled: query.trim().length > 0,
    staleTime: 60 * 1000,
  });

  // URL ?q= → query 同步(支持深链 / 浏览器后退)
  useEffect(() => {
    const urlQ = searchParams.get('q') ?? '';
    if (urlQ !== query) setQuery(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const q = query.trim();
  const hasQuery = q.length > 0;

  const contents = searchQuery.data ?? [];
  const total = contents.length + creators.length + topics.length;
  const loading = searchQuery.isPending;

  const pushQuery = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      if (!trimmed) {
        router.replace('/search', { scroll: false });
      } else {
        router.replace(`/search?q=${encodeURIComponent(trimmed)}`, { scroll: false });
      }
    },
    [router],
  );

  const handleSubmit = () => {
    if (!q) return;
    pushQuery(q);
    if (!history.includes(q)) {
      setHistory((prev) => [q, ...prev].slice(0, 8));
    }
  };

  const handleClear = () => {
    setQuery('');
    router.replace('/search', { scroll: false });
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/home/recommend');
    }
  };

  const handleKeywordPick = (kw: string) => {
    if (!history.includes(kw)) {
      setHistory((prev) => [kw, ...prev].slice(0, 8));
    }
    pushQuery(kw);
  };

  const handleClearHistory = () => setHistory([]);
  const handleRemoveHistory = (kw: string) =>
    setHistory((prev) => prev.filter((h) => h !== kw));

  const handleFollowCreator = async (creator: SearchCreatorItem) => {
    if (followBusyId === creator.id) return;
    setFollowBusyId(creator.id);
    try {
      await homeClient.post(`/follow/${creator.id}`);
      setSnack({ open: true, message: '关注成功', severity: 'success' });
    } catch (err) {
      setSnack({ open: true, message: formatApiError(err) || '关注失败,请重试', severity: 'error' });
    } finally {
      setFollowBusyId(null);
    }
  };

  const handleOpenTopic = (topic: SearchTopicItem) => {
    router.push(`/search/topic?id=${topic.id}`);
  };

  const renderHighlight = (text: string) => {
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
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: '#0a0a0f',
        color: 'rgba(255,255,255,0.92)',
        overflowX: 'hidden',
        position: 'relative',
      }}
    >
      {/* 顶部固定栏:返回 + 大搜索框 + 搜索按钮 + 清空 */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          height: 68,
          px: { xs: 2, md: 3 },
          bgcolor: 'rgba(10, 10, 15, 0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <IconButton onClick={handleBack} size="small" aria-label="返回" sx={{ color: 'rgba(255,255,255,0.75)' }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <TextField
          fullWidth
          size="small"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            } else if (e.key === 'Escape') {
              handleBack();
            }
          }}
          placeholder="搜索你感兴趣的内容、创作者或话题"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }} />
                </InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={handleClear}
                    aria-label="清空"
                    sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
              sx: {
                bgcolor: 'rgba(255,255,255,0.06)',
                color: '#fff',
                fontSize: 14,
                borderRadius: 2,
                '& input::placeholder': { color: 'rgba(255,255,255,0.4)', opacity: 1 },
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                '&.Mui-focused fieldset': { borderColor: '#FE2C55' },
              },
            },
          }}
          sx={{ maxWidth: 560 }}
        />
        <Button
          disableElevation
          size="medium"
          onClick={handleSubmit}
          disabled={!q}
          sx={{
            flexShrink: 0,
            minWidth: 80,
            px: 2.5,
            py: 0.75,
            borderRadius: 2,
            bgcolor: 'primary.main',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            textTransform: 'none',
            boxShadow: 'none',
            // 让涟漪在 primary.main 上更明显
            '& .MuiTouchRipple-child': { bgcolor: 'rgba(255,255,255,0.45)' },
            '&:hover': { bgcolor: 'primary.main', filter: 'brightness(1.1)' },
            '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' },
          }}
        >
          搜索
        </Button>
      </Box>

      <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
        {!hasQuery ? (
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
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                搜索:<Box component="span" sx={{ color: 'primary.main' }}>{q}</Box>
              </Typography>
              {!loading && (
                <Box
                  sx={{
                    ml: 0.5,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 0.75,
                    bgcolor: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 11,
                  }}
                >
                  共 {total} 条结果
                </Box>
              )}
              {loading && (
                <Box sx={{ ml: 0.5, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>搜索中…</Box>
              )}
            </Box>

            {/* Tab 切换 */}
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              sx={{
                minHeight: 36,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                mb: 3,
                '& .MuiTab-root': {
                  minHeight: 36,
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.55)',
                  textTransform: 'none',
                  py: 1,
                },
                '& .Mui-selected': { color: '#fff !important', fontWeight: 700 },
                '& .MuiTabs-indicator': { backgroundColor: 'primary.main', height: 2 },
              }}
            >
              <Tab value="all" label={`全部 ${total}`} />
              <Tab value="content" label={`内容 ${contents.length}`} />
              <Tab value="creator" label={`创作者 ${creators.length}`} />
              <Tab value="topic" label={`话题 ${topics.length}`} />
            </Tabs>

            {loading ? (
              <LoadingSkeleton />
            ) : total === 0 ? (
              <NoResults query={q} hotKeywords={hotKeywords} onPickKeyword={handleKeywordPick} />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(tab === 'all' || tab === 'content') && contents.length > 0 && (
                  <Section title="内容" count={contents.length}>
                    {contents
                      .slice(0, tab === 'all' ? 4 : undefined)
                      .map((c) => (
                        <ContentResult
                          key={c.id}
                          item={c}
                          onClick={() => navigateContent(c.contentType, c.id)}
                          renderHL={renderHighlight}
                        />
                      ))}
                  </Section>
                )}
                {(tab === 'all' || tab === 'creator') && creators.length > 0 && (
                  <Section title="创作者" count={creators.length}>
                    {creators
                      .slice(0, tab === 'all' ? 3 : undefined)
                      .map((c) => (
                        <CreatorResult
                          key={c.id}
                          item={c}
                          renderHL={renderHighlight}
                          onFollow={() => handleFollowCreator(c)}
                          following={followBusyId === c.id}
                        />
                      ))}
                  </Section>
                )}
                {(tab === 'all' || tab === 'topic') && topics.length > 0 && (
                  <Section title="话题" count={topics.length}>
                    {topics
                      .slice(0, tab === 'all' ? 3 : undefined)
                      .map((t) => (
                        <TopicResult
                          key={t.id}
                          item={t}
                          renderHL={renderHighlight}
                          onClick={() => handleOpenTopic(t)}
                        />
                      ))}
                  </Section>
                )}
              </Box>
            )}
          </>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
      <Box sx={{ py: 4, px: { xs: 2, md: 3 }, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
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

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </Typography>
        <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.3)' }} />
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{count} 条</Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{children}</Box>
    </Box>
  );
}

function ContentResult({
  item,
  onClick,
  renderHL,
}: {
  item: SearchContentItem;
  onClick: () => void;
  renderHL: (text: string) => React.ReactNode;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.25,
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 0.15s',
        border: '1px solid transparent',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.06)' },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: 72,
          height: 90,
          flexShrink: 0,
          borderRadius: 1.5,
          overflow: 'hidden',
          background: item.coverGradient,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 50%)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 4,
            left: 4,
            px: 0.5,
            py: 0.15,
            borderRadius: 0.5,
            bgcolor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 600,
          }}
        >
          {TYPE_LABEL[item.contentType]}
        </Box>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {renderHL(item.title)}
        </Typography>
        {item.subtitle && (
          <Typography
            sx={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.55)',
              lineHeight: 1.5,
              mt: 0.25,
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {renderHL(item.subtitle)}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, color: 'rgba(255,255,255,0.45)' }}>
          <Box
            sx={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: item.coverGradient,
              fontSize: 10,
              fontWeight: 700,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {item.author[0]}
          </Box>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{item.author}</Typography>
          <Box sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.25)' }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <PlayArrowRoundedIcon sx={{ fontSize: 11 }} />
            <Typography sx={{ fontSize: 10 }}>{formatNumber(item.views)}</Typography>
          </Box>
          <Box sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.25)' }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <ChatBubbleOutlineIcon sx={{ fontSize: 10 }} />
            <Typography sx={{ fontSize: 10 }}>{formatNumber(item.comments)}</Typography>
          </Box>
          <Box sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.25)' }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <FavoriteBorderIcon sx={{ fontSize: 10 }} />
            <Typography sx={{ fontSize: 10 }}>{formatNumber(item.likes)}</Typography>
          </Box>
        </Box>
      </Box>
      <Box
        sx={{
          flexShrink: 0,
          px: 0.75,
          py: 0.25,
          borderRadius: 0.75,
          bgcolor: `${TYPE_ACCENT[item.contentType]}1A`,
          color: TYPE_ACCENT[item.contentType],
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        {item.matchField === 'title' ? '标题命中' : item.matchField === 'subtitle' ? '描述命中' : '作者命中'}
      </Box>
    </Box>
  );
}

function CreatorResult({
  item,
  renderHL,
  onFollow,
  following,
}: {
  item: SearchCreatorItem;
  renderHL: (text: string) => React.ReactNode;
  onFollow: () => void;
  following?: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 0.15s',
        border: '1px solid transparent',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.06)' },
      }}
    >
      <Box
        sx={{
          width: 52,
          height: 52,
          flexShrink: 0,
          borderRadius: '50%',
          background: item.avatarGradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          fontWeight: 800,
          color: '#fff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        {item.name[0]}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
            {renderHL(item.name)}
          </Typography>
          {item.verified && <VerifiedIcon sx={{ fontSize: 14, color: 'primary.main' }} />}
        </Box>
        <Typography
          sx={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.55)',
            mt: 0.25,
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {renderHL(item.bio)}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          {item.tags.slice(0, 3).map((t) => (
            <Box
              key={t}
              sx={{
                px: 0.5,
                py: 0.1,
                borderRadius: 0.5,
                bgcolor: 'rgba(139, 92, 246, 0.15)',
                color: ACCENT.purple.main,
                fontSize: 9,
                fontWeight: 600,
              }}
            >
              {t}
            </Box>
          ))}
        </Box>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>
          {formatNumber(item.followers)}
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>粉丝</Typography>
      </Box>
      <Button
        size="small"
        variant="contained"
        disableElevation
        disabled={following}
        onClick={onFollow}
        sx={{
          minWidth: 56,
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'none',
          borderRadius: 1.5,
          py: 0.5,
          px: 1.5,
          background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
          '&:hover': { filter: 'brightness(1.1)' },
        }}
      >
        + 关注
      </Button>
    </Box>
  );
}

function TopicResult({
  item,
  renderHL,
  onClick,
}: {
  item: SearchTopicItem;
  renderHL: (text: string) => React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 0.15s',
        border: '1px solid transparent',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.06)' },
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          flexShrink: 0,
          borderRadius: 1.5,
          background: item.gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.2), transparent 50%)',
          }}
        />
        <Typography
          sx={{ fontSize: 24, fontWeight: 800, position: 'relative', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
        >
          #
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
            {renderHL(item.title)}
          </Typography>
          {item.hot && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.25,
                px: 0.5,
                py: 0.1,
                borderRadius: 0.5,
                background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                color: '#fff',
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              <TrendingUpIcon sx={{ fontSize: 9 }} />
              热门
            </Box>
          )}
        </Box>
        <Typography
          sx={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.55)',
            mt: 0.25,
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {renderHL(item.description)}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5, color: 'rgba(255,255,255,0.45)' }}>
          <Typography sx={{ fontSize: 10 }}>{formatNumber(item.viewCount)} 浏览</Typography>
          <Box sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.25)' }} />
          <Typography sx={{ fontSize: 10 }}>{formatNumber(item.discussCount)} 讨论</Typography>
        </Box>
      </Box>
    </Box>
  );
}

function EmptyState({
  hotKeywords,
  history,
  onPickKeyword,
  onClearHistory,
  onRemoveHistory,
}: {
  hotKeywords: string[];
  history: string[];
  onPickKeyword: (k: string) => void;
  onClearHistory: () => void;
  onRemoveHistory: (k: string) => void;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* 历史 + 全网热搜(Phase 3 Doris 实时数据) */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {history.length > 0 ? (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <HistoryIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }} />
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.55)',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                搜索历史
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Button
                size="small"
                onClick={onClearHistory}
                sx={{
                  minWidth: 0,
                  textTransform: 'none',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.4)',
                  '&:hover': { color: '#fff', bgcolor: 'transparent' },
                }}
              >
                清空
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {history.map((h) => (
                <Chip
                  key={h}
                  label={h}
                  onClick={() => onPickKeyword(h)}
                  onDelete={() => onRemoveHistory(h)}
                  deleteIcon={<CloseIcon sx={{ fontSize: 14 }} />}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: 12,
                    fontWeight: 500,
                    border: '1px solid rgba(255,255,255,0.06)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                    '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff' } },
                  }}
                />
              ))}
            </Box>
          </Box>
        ) : (
          <Box />
        )}
      </Box>

      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <WhatshotIcon sx={{ fontSize: 14, color: 'warning.main' }} />
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.55)',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            热门搜索
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {hotKeywords.map((kw, idx) => (
            <Box
              key={kw}
              onClick={() => onPickKeyword(kw)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                p: 1.25,
                borderRadius: 1.5,
                cursor: 'pointer',
                transition: 'background 0.15s',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
              }}
            >
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: 0.5,
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'monospace',
                  background:
                    idx < 3
                      ? 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)'
                      : 'rgba(255,255,255,0.08)',
                  color: idx < 3 ? '#fff' : 'rgba(255,255,255,0.55)',
                }}
              >
                {idx + 1}
              </Box>
              <Typography sx={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{kw}</Typography>
              {idx < 2 && (
                <Box
                  sx={{
                    px: 0.5,
                    py: 0.1,
                    borderRadius: 0.5,
                    bgcolor: 'rgba(254, 44, 85, 0.15)',
                    color: 'primary.main',
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                >
                  HOT
                </Box>
              )}
              <Box sx={{ flex: 1 }} />
              <TrendingUpIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }} />
            </Box>
          ))}
        </Box>
      </Box>

      {/* 个性化推荐(Phase 3 /home/recommend 真实数据,4 类混合) */}
      <RecommendBoard
        types={['NEWS', 'ARTICLE', 'VIDEO', 'MUSIC']}
        size={12}
        title="猜你想看"
      />
    </Box>
  );
}

function NoResults({
  query,
  hotKeywords,
  onPickKeyword,
}: {
  query: string;
  hotKeywords: string[];
  onPickKeyword: (k: string) => void;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 8,
        gap: 1.5,
        textAlign: 'center',
      }}
    >
      <Box
        sx={{
          width: 88,
          height: 88,
          borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SearchOffIcon sx={{ fontSize: 40, color: 'rgba(255,255,255,0.3)' }} />
      </Box>
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>
        没有找到与「{query}」相关的内容
      </Typography>
      <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
        换个关键词试试,或者看看热门搜索
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5, justifyContent: 'center', maxWidth: 480 }}>
        {hotKeywords.slice(0, 4).map((kw) => (
          <Chip
            key={kw}
            label={kw}
            onClick={() => onPickKeyword(kw)}
            sx={{
              bgcolor: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.85)',
              fontSize: 12,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

function LoadingSkeleton() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25 }}>
          <Skeleton variant="rectangular" width={72} height={90} sx={{ borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.06)' }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
            <Skeleton variant="text" width="40%" sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
            <Skeleton variant="text" width="30%" sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}
