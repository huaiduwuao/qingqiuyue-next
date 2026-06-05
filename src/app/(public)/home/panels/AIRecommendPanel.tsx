'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import { ACCENT } from '@/constants/accents';
import { IMAGE_OVERLAY } from '@/constants/gradients';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SendIcon from '@mui/icons-material/Send';
import { homeClient } from '@/lib/api/client';
import { AsyncState, EmptyState } from '@/components/common/AsyncState';

type AIChunk = { type: 'text' | 'card'; content: string; meta?: { items?: { id: number; title: string; cover: string }[] } };
type AIResp = { query: string; chunks: AIChunk[] };

const SUGGESTIONS = ['最近好看的电影', 'AI 工具推荐', '晚安故事', '美食教程'];

export function AIRecommendPanel() {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');

  const query = useQuery({
    queryKey: ['home', 'ai', 'search', submitted],
    queryFn: () =>
      homeClient.get<AIResp>(`/ai/search?q=${encodeURIComponent(submitted)}`).then((r) => r.data),
    enabled: submitted.length > 0,
  });

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
            if (e.key === 'Enter' && q.trim()) setSubmitted(q.trim());
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
          onClick={() => setSubmitted(q.trim())}
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

      {submitted === '' ? (
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
                  setSubmitted(s);
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
      ) : (
        <AsyncState
          query={query}
          isEmpty={(d) => d.chunks.length === 0}
          emptyText="没有找到相关内容"
          emptyVariant="sad"
        >
          {(data) => (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {data.chunks.map((chunk, i) =>
                chunk.type === 'text' ? (
                  <Box
                    key={i}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: 'rgba(91, 141, 239, 0.06)',
                      border: '1px solid rgba(91, 141, 239, 0.2)',
                    }}
                  >
                    <Typography sx={{ fontSize: 13, color: 'var(--text-primary, rgba(255,255,255,0.85))', lineHeight: 1.7 }}>
                      {chunk.content}
                    </Typography>
                  </Box>
                ) : (
                  <Box key={i}>
                    <Typography sx={{ fontSize: 12, color: 'var(--text-muted, rgba(255,255,255,0.5))', mb: 1, fontWeight: 600 }}>
                      {chunk.content}
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5 }}>
                      {chunk.meta?.items?.map((it) => (
                        <Box
                          key={it.id}
                          sx={{
                            position: 'relative',
                            aspectRatio: '3/4',
                            borderRadius: 1.5,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            '&:hover': { transform: 'scale(1.02)' },
                            transition: 'transform 0.2s',
                          }}
                        >
                          <img src={it.cover} alt={it.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <Box
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              background: IMAGE_OVERLAY.LIGHT,
                            }}
                          />
                          <Typography
                            sx={{
                              position: 'absolute',
                              bottom: 8,
                              left: 8,
                              right: 8,
                              fontSize: 11,
                              color: 'var(--text-primary, #ffffff)',
                              fontWeight: 600,
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {it.title}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )
              )}
            </Box>
          )}
        </AsyncState>
      )}

      {!submitted && <EmptyState text="开始一段 AI 对话吧" hint="试试上方的推荐问题" />}
    </Box>
  );
}
