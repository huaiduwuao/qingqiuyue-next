'use client';

/**
 * AI 搜索结果区:搜索页 AI 模式和首页「AI 助手」共用。
 *
 * 和普通搜索刻意长得不一样 —— 普通搜索是「关键词 → 结果列表」,
 * 这里是「一句话 → AI 的理解(回应 + 拆出的检索词/类型) → 每条都写明为什么选它」。
 * 检索词可以点,点了用普通搜索精确查,两种搜索互相能跳。
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { ACCENT } from '@/constants/accents';
import { IMAGE_OVERLAY } from '@/constants/gradients';
import { aiSearch, type AISearchItem } from '@/apis/aiSearch';
import { useContentNavigate } from '@/lib/contentRoute';
import { formatApiError } from '@/lib/api/client';

export const AI_GRADIENT = `linear-gradient(135deg, ${ACCENT.blue.main} 0%, ${ACCENT.purple.main} 100%)`;

const TYPE_LABEL: Record<string, string> = {
  FILM: '电影', TELEPLAY: '电视剧', VSHOW: '综艺', ANIMATION: '动画', VIDEO: '视频',
  MUSIC: '音乐', NOVEL: '小说', COMICS: '漫画', ARTICLE: '文章', NEWS: '资讯', LIVE: '直播',
};

export const AI_SEARCH_EXAMPLES = [
  '周末想看点轻松的国产动画',
  '有没有类似《流浪地球》的科幻片',
  '适合睡前听的安静音乐',
  '最近讨论多的悬疑小说',
];

export function AISearchResults({ query, onRetryHint }: { query: string; onRetryHint?: string }) {
  const router = useRouter();
  const q = query.trim();
  const result = useQuery({
    queryKey: ['ai-search', q],
    queryFn: () => aiSearch(q),
    enabled: q.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 0,
  });

  // 模型要几秒:分两段提示,让用户知道它在干什么
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!result.isFetching) return;
    const t = setTimeout(() => setSlow(true), 2500);
    return () => {
      clearTimeout(t);
      setSlow(false);
    };
  }, [result.isFetching, q]);

  if (!q) return null;

  const exactSearch = (kw: string) => router.push(`/search?q=${encodeURIComponent(kw)}`);

  if (result.isPending || (result.isFetching && !result.data)) {
    return (
      <Box>
        <AIBubble>
          <Typography sx={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {slow ? '正在站内查找相关作品…' : '正在理解你的需求…'}
          </Typography>
          <Skeleton variant="text" width="70%" sx={{ bgcolor: 'var(--bg-active)' }} />
        </AIBubble>
        <ResultGridSkeleton />
      </Box>
    );
  }

  if (result.isError) {
    return (
      <AIBubble tone="error">
        <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>AI 搜索暂时不可用</Typography>
        <Typography sx={{ fontSize: 12, color: 'var(--text-secondary)', mb: 1.5 }}>
          {formatApiError(result.error) || '请稍后再试'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="text" size="small" startIcon={<RefreshIcon />} onClick={() => result.refetch()} sx={{ textTransform: 'none' }}>
            重试
          </Button>
          <Button variant="text" size="small" startIcon={<SearchIcon />} onClick={() => exactSearch(q)} sx={{ textTransform: 'none' }}>
            {onRetryHint ?? '改用普通搜索'}
          </Button>
        </Box>
      </AIBubble>
    );
  }

  const data = result.data!;
  const fallback = data.mode === 'keyword';

  return (
    <Box>
      <AIBubble>
        {fallback ? (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <InfoOutlinedIcon sx={{ fontSize: 16, color: 'var(--text-muted)', mt: 0.25 }} />
            <Typography sx={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              AI 模型暂时没接上,下面是按原话匹配到的结果。
            </Typography>
          </Box>
        ) : (
          <Typography sx={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
            {data.answer || `我按「${q}」帮你找了找。`}
          </Typography>
        )}

        {!fallback && (data.intent.keywords.length > 0 || data.intent.types.length > 0) && (
          <Box sx={{ mt: 1.25, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
            <Typography sx={{ fontSize: 11, color: 'var(--text-muted)', mr: 0.25 }}>我理解为</Typography>
            {data.intent.types.map((t) => (
              <Box
                key={t}
                sx={{
                  px: 1, py: 0.25, borderRadius: 999, fontSize: 11, fontWeight: 600,
                  color: ACCENT.purple.main, bgcolor: ACCENT.purple.soft12, border: `1px solid ${ACCENT.purple.border30}`,
                }}
              >
                {TYPE_LABEL[t] ?? t}
              </Box>
            ))}
            {data.intent.keywords.map((k) => (
              <Box
                key={k}
                component="button"
                title={`用普通搜索精确查「${k}」`}
                onClick={() => exactSearch(k)}
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.5,
                  px: 1, py: 0.25, borderRadius: 999, fontSize: 11, cursor: 'pointer',
                  color: ACCENT.blue.main, bgcolor: ACCENT.blue.soft12, border: `1px solid ${ACCENT.blue.border30}`,
                  '&:hover': { bgcolor: ACCENT.blue.soft18 },
                }}
              >
                <SearchIcon sx={{ fontSize: 11 }} />
                {k}
              </Box>
            ))}
          </Box>
        )}
      </AIBubble>

      {data.items.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 14, color: 'var(--text-secondary)', mb: 0.5 }}>站内暂时没有相关作品</Typography>
          <Typography sx={{ fontSize: 12, color: 'var(--text-muted)', mb: 2 }}>
            换个说法,或者用普通搜索 —— 它会顺带去全网找并收录进来
          </Typography>
          <Button variant="outlined" size="small" startIcon={<SearchIcon />} onClick={() => exactSearch(data.intent.keywords[0] || q)} sx={{ textTransform: 'none', borderRadius: 999 }}>
            普通搜索「{data.intent.keywords[0] || q}」
          </Button>
        </Box>
      ) : (
        <>
          <Typography sx={{ fontSize: 12, color: 'var(--text-muted)', mb: 1.25 }}>
            挑出 {data.items.length} 个相关作品
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            {data.items.map((it) => (
              <AIResultCard key={it.id} item={it} />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}

function AIBubble({ children, tone = 'ai' }: { children: React.ReactNode; tone?: 'ai' | 'error' }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.25, mb: 2.5, alignItems: 'flex-start' }}>
      <Box
        sx={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: AI_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <AutoAwesomeIcon sx={{ fontSize: 16, color: '#fff' }} />
      </Box>
      <Box
        sx={{
          flex: 1, minWidth: 0, px: 1.75, py: 1.25,
          borderRadius: '4px 14px 14px 14px',
          bgcolor: tone === 'error' ? 'rgba(254, 44, 85, 0.06)' : ACCENT.blue.soft12,
          border: `1px solid ${tone === 'error' ? 'rgba(254, 44, 85, 0.3)' : ACCENT.blue.border30}`,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function AIResultCard({ item }: { item: AISearchItem }) {
  const navigateContent = useContentNavigate();
  const [broken, setBroken] = useState(false);
  return (
    <Box
      component="button"
      onClick={() => navigateContent(item.contentType, item.id)}
      sx={{
        p: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit',
        borderRadius: 2, overflow: 'hidden', bgcolor: 'var(--bg-hover)',
        border: '1px solid var(--border-color)',
        transition: 'transform 0.2s, border-color 0.2s',
        '&:hover': { transform: 'translateY(-2px)', borderColor: ACCENT.blue.border30 },
      }}
    >
      <Box sx={{ position: 'relative', aspectRatio: '4 / 3', background: `linear-gradient(135deg, ${ACCENT.blue.soft18}, ${ACCENT.purple.soft18})` }}>
        {item.cover && !broken && (
          <Box
            component="img"
            src={item.cover}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <Box sx={{ position: 'absolute', inset: 0, background: IMAGE_OVERLAY.LIGHT }} />
        <Typography
          sx={{
            position: 'absolute', left: 8, bottom: 6, right: 8,
            fontSize: 13, fontWeight: 600, color: '#fff',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {item.title}
        </Typography>
      </Box>
      <Box sx={{ px: 1, py: 0.75, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <AutoAwesomeIcon sx={{ fontSize: 11, color: ACCENT.blue.main, flexShrink: 0 }} />
        <Typography sx={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.reason}
        </Typography>
      </Box>
    </Box>
  );
}

function ResultGridSkeleton() {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} variant="rounded" sx={{ aspectRatio: '4 / 3', height: 'auto', bgcolor: 'var(--bg-active)' }} />
      ))}
    </Box>
  );
}
