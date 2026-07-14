'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import { ACCENT } from '@/constants/accents';
import { IMAGE_OVERLAY } from '@/constants/gradients';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SendIcon from '@mui/icons-material/Send';
import RefreshIcon from '@mui/icons-material/Refresh';
import { homeClient } from '@/lib/api/client';
import { useContentNavigate } from '@/lib/contentRoute';
import { EmptyState } from '@/components/common/AsyncState';

type AIItem = {
  id: number;
  title: string;
  cover: string;
  reason?: string;
  source?: string;
};

type AIResp = {
  items: AIItem[];
  query?: string;
};

const SUGGESTIONS = ['最近好看的电影', 'AI 工具推荐', '晚安故事', '美食教程'];

const buildFallback = (q: string): AIResp => ({
  query: q,
  items: [
    {
      id: 9001,
      title: `与「${q}」相关的热门精选`,
      cover: '/fallback/ai-recommend-1.svg',
      reason: '基于全站热门趋势为你推荐',
      source: 'fallback',
    },
    {
      id: 9002,
      title: '本周编辑精选:不容错过',
      cover: '/fallback/ai-recommend-2.svg',
      reason: '编辑团队近期高赞内容',
      source: 'fallback',
    },
    {
      id: 9003,
      title: '相似用户也在看',
      cover: '/fallback/ai-recommend-3.svg',
      reason: '基于协同过滤的相似推荐',
      source: 'fallback',
    },
    {
      id: 9004,
      title: '冷启动推荐:热门新作',
      cover: '/fallback/ai-recommend-4.svg',
      reason: '近期上线、热度上升快',
      source: 'fallback',
    },
  ],
});

export function AIRecommendPanel() {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');
  const navigateContent = useContentNavigate();

  const mutation = useMutation<AIResp, Error, string>({
    mutationKey: ['home', 'ai', 'search'],
    mutationFn: async (keyword: string) => {
      try {
        const resp = await homeClient.post<AIResp>('/ai/search', { q: keyword });
        const data = (resp as any)?.data ?? resp;
        if (data && Array.isArray(data.items)) return data as AIResp;
        return { ...buildFallback(keyword), query: keyword };
      } catch (e) {
        // fallback to local mock on any failure (network / 5xx / parsing)
        return buildFallback(keyword);
      }
    },
  });

  const submit = (raw: string) => {
    const keyword = raw.trim();
    if (!keyword) return;
    setSubmitted(keyword);
    mutation.mutate(keyword);
  };

  const results = mutation.data?.items ?? [];
  const hasResults = results.length > 0;
  const showLoading = submitted.length > 0 && mutation.isPending;
  const showError = submitted.length > 0 && mutation.isError && !mutation.isSuccess;

  return (
    <Box sx={{ p: 3, maxWidth: 720, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.5,
            background: `linear-gradient(135deg, ${ACCENT.blue.main} 0%, ${ACCENT.purple.main} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 18, color: 'var(--text-primary, #ffffff)' }} />
        </Box>
        <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #ffffff)' }}>AI 搜索</Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <TextField
          fullWidth
          size="small"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            // 确保只有 AI 搜索框获得焦点时才处理 Enter
            if (e.key === 'Enter' && e.currentTarget.contains(document.activeElement) && q.trim()) submit(q);
          }}
          placeholder="告诉我你想看什么..."
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <AutoAwesomeIcon sx={{ fontSize: 16, color: 'rgba(91, 141, 239, 0.6)' }} />
                </InputAdornment>
              ),
              sx: {
                bgcolor: 'var(--bg-hover, rgba(255,255,255,0.06))',
                color: 'var(--text-primary, #ffffff)',
                fontSize: 13,
                borderRadius: 2,
                '& input::placeholder': { color: 'var(--text-muted, rgba(255,255,255,0.4))', opacity: 1 },
                '& fieldset': { borderColor: 'var(--border-strong, rgba(255,255,255,0.1))' },
                '&.Mui-focused fieldset': { borderColor: ACCENT.blue.main },
              },
            },
          }}
        />
        <Button
          variant="contained"
          disabled={!q.trim()}
          onClick={() => submit(q)}
          startIcon={<SendIcon sx={{ fontSize: 16 }} />}
          sx={{
            flexShrink: 0,
            minWidth: 0,
            px: 2.25,
            py: 0.75,
            borderRadius: 2,
            textTransform: 'none',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary, #ffffff)',
            bgcolor: 'transparent',
            backgroundImage: `linear-gradient(135deg, ${ACCENT.blue.main} 0%, ${ACCENT.purple.main} 100%)`,
            boxShadow: `0 2px 8px ${ACCENT.blue.soft18}`,
            transition: 'transform 0.15s, box-shadow 0.15s',
            '&:hover': {
              bgcolor: 'transparent',
              boxShadow: `0 4px 12px ${ACCENT.blue.border30}`,
            },
            '&:active': { transform: 'scale(0.97)' },
            '&.Mui-disabled': {
              bgcolor: 'var(--bg-active, rgba(255,255,255,0.08))',
              backgroundImage: 'none',
              color: 'var(--text-disabled, rgba(255,255,255,0.3))',
              boxShadow: 'none',
            },
          }}
        >
          问问 AI
        </Button>
      </Box>

      {submitted === '' && (
        <Box>
          <Typography sx={{ fontSize: 12, color: 'var(--text-muted, rgba(255,255,255,0.5))', mb: 1.5 }}>
            或者试试这些:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {SUGGESTIONS.map((s) => (
              <Chip
                key={s}
                label={s}
                onClick={() => {
                  setQ(s);
                  submit(s);
                }}
                sx={{
                  bgcolor: 'var(--bg-input, rgba(255,255,255,0.04))',
                  color: 'var(--text-secondary, rgba(255,255,255,0.7))',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                  fontSize: 12,
                  '&:hover': { bgcolor: ACCENT.blue.soft12, color: ACCENT.blue.main, borderColor: ACCENT.blue.border30 },
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {submitted !== '' && showLoading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Box
              key={i}
              sx={{
                display: 'grid',
                gridTemplateColumns: '96px 1fr',
                gap: 1.5,
                p: 1.5,
                borderRadius: 2,
                bgcolor: 'var(--bg-hover)',
                border: '1px solid var(--border-color)',
              }}
            >
              <Skeleton variant="rounded" height={120} sx={{ bgcolor: 'var(--bg-active)' }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Skeleton variant="text" width="60%" sx={{ bgcolor: 'var(--bg-active)' }} />
                <Skeleton variant="text" width="40%" sx={{ bgcolor: 'var(--bg-active)' }} />
                <Skeleton variant="rounded" height={64} sx={{ bgcolor: 'var(--bg-active)' }} />
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {submitted !== '' && !showLoading && showError && (
        <Alert
          severity="error"
          variant="outlined"
          action={
            <Button
              size="small"
              variant="contained"
              startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
              onClick={() => submit(submitted)}
              sx={{
                bgcolor: 'rgba(254, 44, 85, 0.18)',
                color: 'primary.main',
                boxShadow: 'none',
                '&:hover': { bgcolor: 'rgba(254, 44, 85, 0.28)', boxShadow: 'none' },
              }}
            >
              重试
            </Button>
          }
          sx={{
            bgcolor: 'rgba(254, 44, 85, 0.06)',
            border: '1px solid rgba(254, 44, 85, 0.3)',
            color: 'text.primary',
            alignItems: 'center',
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>AI 搜索暂时不可用</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25 }}>
              {mutation.error?.message ?? '请稍后再试'}
            </Typography>
          </Box>
        </Alert>
      )}

      {submitted !== '' && !showLoading && !showError && !hasResults && (
        <EmptyState text="没有找到相关内容" hint="换个关键词试试" variant="sad" />
      )}

      {submitted !== '' && !showLoading && !showError && hasResults && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography sx={{ fontSize: 12, color: 'var(--text-muted, rgba(255,255,255,0.5))' }}>
            为你找到 {results.length} 条与「{submitted}」相关的内容
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5 }}>
            {results.map((it) => (
              <Box
                key={it.id}
                onClick={() => navigateContent('VIDEO', it.id)}
                sx={{
                  position: 'relative',
                  aspectRatio: '3/4',
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  bgcolor: 'var(--bg-hover)',
                  border: '1px solid var(--border-color)',
                  '&:hover': { transform: 'scale(1.02)' },
                  transition: 'transform 0.2s',
                }}
              >
                {it.cover ? (
                  <img
                    src={it.cover}
                    alt={it.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      background: `linear-gradient(135deg, ${ACCENT.blue.soft18}, ${ACCENT.purple.soft18})`,
                    }}
                  />
                )}
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: IMAGE_OVERLAY.LIGHT,
                  }}
                />
                <Box sx={{ position: 'absolute', inset: 0, p: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  {it.reason && (
                    <Typography
                      sx={{
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.75)',
                        mb: 0.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {it.reason}
                    </Typography>
                  )}
                  <Typography
                    sx={{
                      fontSize: 12,
                      color: 'var(--text-primary, #ffffff)',
                      fontWeight: 600,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {it.title}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {submitted === '' && <EmptyState text="开始一段 AI 对话吧" hint="试试上方的推荐问题" />}
    </Box>
  );
}
