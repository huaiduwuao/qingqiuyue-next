'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { ACCENT } from '@/constants/accents';
import RecommendBoard from '@/components/home/RecommendBoard';
import { AI_GRADIENT, AI_SEARCH_EXAMPLES } from '@/components/ai/AISearchResults';

export function EmptyState({
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
              <HistoryIcon sx={{ fontSize: 14, color: 'var(--text-muted, rgba(255,255,255,0.45))' }} />
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text-muted, rgba(255,255,255,0.55))',
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
                  color: 'var(--text-muted, rgba(255,255,255,0.4))',
                  '&:hover': { color: 'var(--text-primary, #fff)', bgcolor: 'transparent' },
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
                    bgcolor: 'var(--bg-input, rgba(255,255,255,0.05))',
                    color: 'var(--text-primary, rgba(255,255,255,0.85))',
                    fontSize: 12,
                    fontWeight: 500,
                    border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
                    '&:hover': { bgcolor: 'var(--bg-active, rgba(255,255,255,0.08))' },
                    '& .MuiChip-deleteIcon': { color: 'var(--text-muted, rgba(255,255,255,0.4))', '&:hover': { color: 'var(--text-primary, #fff)' } },
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
              color: 'var(--text-muted, rgba(255,255,255,0.55))',
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
                '&:hover': { bgcolor: 'var(--bg-hover, rgba(255,255,255,0.04))' },
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
                      : 'var(--bg-active, rgba(255,255,255,0.08))',
                  color: idx < 3 ? '#fff' : 'var(--text-muted, rgba(255,255,255,0.55))',
                }}
              >
                {idx + 1}
              </Box>
              <Typography sx={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary, #fff)' }}>{kw}</Typography>
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
              <TrendingUpIcon sx={{ fontSize: 12, color: 'var(--text-disabled, rgba(255,255,255,0.25))' }} />
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

export function NoResults({
  query,
  hotKeywords,
  onPickKeyword,
  searchedWeb = false,
}: {
  query: string;
  hotKeywords: string[];
  onPickKeyword: (k: string) => void;
  /** 全网检索也跑过了,仍然没有 */
  searchedWeb?: boolean;
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
          bgcolor: 'var(--bg-hover, rgba(255,255,255,0.04))',
          border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SearchOffIcon sx={{ fontSize: 40, color: 'var(--text-muted, rgba(255,255,255,0.3))' }} />
      </Box>
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary, rgba(255,255,255,0.75))' }}>
        没有找到与「{query}」相关的内容
      </Typography>
      <Typography sx={{ fontSize: 12, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
        {searchedWeb ? "已在各大音乐/视频/小说平台检索过,仍未找到;换个写法(如作品全名、作者名)再试试" : "换个关键词试试,或者看看热门搜索"}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5, justifyContent: 'center', maxWidth: 480 }}>
        {hotKeywords.slice(0, 4).map((kw) => (
          <Chip
            key={kw}
            label={kw}
            onClick={() => onPickKeyword(kw)}
            sx={{
              bgcolor: 'var(--bg-input, rgba(255,255,255,0.05))',
              color: 'var(--text-primary, rgba(255,255,255,0.85))',
              fontSize: 12,
              '&:hover': { bgcolor: 'var(--bg-active, rgba(255,255,255,0.1))' },
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

export function LoadingSkeleton() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25 }}>
          <Skeleton variant="rectangular" width={72} height={90} sx={{ borderRadius: 1.5, bgcolor: 'var(--bg-input, rgba(255,255,255,0.06))' }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" sx={{ bgcolor: 'var(--bg-input, rgba(255,255,255,0.06))' }} />
            <Skeleton variant="text" width="40%" sx={{ bgcolor: 'var(--bg-hover, rgba(255,255,255,0.04))' }} />
            <Skeleton variant="text" width="30%" sx={{ bgcolor: 'var(--bg-hover, rgba(255,255,255,0.04))' }} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export function AIEmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', py: { xs: 3, md: 6 }, textAlign: 'center' }}>
      <Box
        sx={{
          width: 52, height: 52, mx: 'auto', mb: 2, borderRadius: '50%',
          background: AI_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <AutoAwesomeIcon sx={{ fontSize: 26, color: '#fff' }} />
      </Box>
      <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 1 }}>说说你想看什么</Typography>
      <Typography sx={{ fontSize: 13, color: 'var(--text-secondary, rgba(255,255,255,0.7))', lineHeight: 1.8, mb: 3 }}>
        普通搜索按关键词精确匹配;AI 搜索读懂整句话,
        <br />
        自动拆出题材、类型、人名去找,并告诉你为什么推荐。
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
        {AI_SEARCH_EXAMPLES.map((s) => (
          <Box
            key={s}
            component="button"
            onClick={() => onPick(s)}
            sx={{
              px: 1.5, py: 0.75, borderRadius: 999, cursor: 'pointer', font: 'inherit', fontSize: 12.5,
              color: 'var(--text-secondary, rgba(255,255,255,0.75))',
              bgcolor: ACCENT.blue.soft12,
              border: `1px solid ${ACCENT.blue.border30}`,
              '&:hover': { color: ACCENT.blue.main },
            }}
          >
            {s}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
