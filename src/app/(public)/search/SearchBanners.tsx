'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import SearchIcon from '@mui/icons-material/Search';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { ACCENT } from '@/constants/accents';
import type { GuessState } from '@/apis/search';
import { AI_GRADIENT } from '@/components/ai/AISearchResults';
import { TYPE_ACCENT, TYPE_LABEL, type SearchContentItem } from './searchModel';

/**
 * 全网检索提示。站内结果少时后端去各平台(360 影视/爱奇艺/网易云/酷我/QQ 音乐/七猫/纵横…)
 * 找同名作品并收录,这里告诉用户正在找、找完了多了几条;收录的作品即使本站播不了,
 * 详情页也会写明原因并给出原平台入口。
 */
export function DiscoverBanner({
  query,
  discovering,
  justDone,
  indexed,
  merged,
  total,
  empty,
}: {
  query: string;
  discovering: boolean;
  justDone: boolean;
  /** 这轮全网检索新建的条目数 */
  indexed: number;
  /** 搜到、但并进了站内已有条目的数 */
  merged: number;
  /** 站内现在一共命中多少条(含刚收录的) */
  total: number;
  empty: boolean;
}) {
  if (!discovering && !(justDone && indexed + merged > 0)) return null;
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        mb: 2,
        px: 1.5,
        py: empty && discovering ? 3 : 1.25,
        borderRadius: 1.5,
        border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
        bgcolor: 'var(--bg-hover, rgba(255,255,255,0.04))',
        justifyContent: empty && discovering ? 'center' : 'flex-start',
      }}
    >
      {discovering ? (
        <CircularProgress size={16} thickness={5} sx={{ color: 'primary.main', flexShrink: 0 }} />
      ) : (
        <TravelExploreIcon sx={{ fontSize: 18, color: 'primary.main', flexShrink: 0 }} />
      )}
      <Typography sx={{ fontSize: 13, color: 'var(--text-secondary, rgba(255,255,255,0.75))' }}>
        {discovering
          ? `站内${empty ? '暂无' : '结果较少'}，正在全网检索「${query}」，新收录的作品会自动出现在这里…`
          : indexed > 0
            ? `全网检索完成，新收录 ${indexed} 条，站内共 ${total} 条相关结果`
            : `全网检索完成，站内已有这些作品，共 ${total} 条相关结果`}
      </Typography>
    </Box>
  );
}

// GuessTypeBanner 类型猜测提示:后端猜出用户想找的类型(他没手动选分类)时展示,
// 告知「已按小说优先检索」,可一键切到该分类。点击后 setFType 触发按该类型重搜。
export function GuessTypeBanner({ guess, onSwitch }: { guess: GuessState; onSwitch: () => void }) {
  const label = TYPE_LABEL[guess.type as SearchContentItem['contentType']] ?? guess.type;
  const accent = TYPE_ACCENT[guess.type as SearchContentItem['contentType']] ?? 'var(--text-secondary)';
  // 来源说明:让用户知道为什么猜这个(可解释性)。
  const why =
    guess.source === 'click'
      ? '多数人在找它时看的是这一类'
      : guess.source === 'hot-exact'
        ? '站内这一类有高热同名作品'
        : '从关键词看更像这一类';
  return (
    <Box
      role="status"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        mb: 2,
        px: 1.5,
        py: 1,
        borderRadius: 1.5,
        border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
        bgcolor: 'var(--bg-hover, rgba(255,255,255,0.04))',
      }}
    >
      <TipsAndUpdatesIcon sx={{ fontSize: 17, color: accent, flexShrink: 0 }} />
      <Typography sx={{ fontSize: 13, color: 'var(--text-secondary, rgba(255,255,255,0.75))', flex: 1, minWidth: 0 }}>
        猜你想找
        <Box component="span" sx={{ color: accent, fontWeight: 600, mx: 0.5 }}>{label}</Box>
        · {why},已按这一类优先检索
      </Typography>
      <Button
        size="small"
        onClick={onSwitch}
        sx={{
          flexShrink: 0,
          fontSize: 12,
          color: accent,
          borderColor: accent,
          textTransform: 'none',
          py: 0.25,
          minWidth: 0,
        }}
        variant="outlined"
      >
        只看{label}
      </Button>
    </Box>
  );
}

export function SearchModeSwitch({ ai, onChange }: { ai: boolean; onChange: (ai: boolean) => void }) {
  const item = (active: boolean, activeBg: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.5,
    px: 1.25,
    py: 0.4,
    border: 0,
    borderRadius: 999,
    cursor: 'pointer',
    font: 'inherit',
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
    color: active ? '#fff' : 'var(--text-secondary, rgba(255,255,255,0.7))',
    background: active ? activeBg : 'transparent',
  });
  return (
    <Box
      role="radiogroup"
      aria-label="搜索方式"
      sx={{ display: 'inline-flex', flexShrink: 0, p: 0.25, borderRadius: 999, bgcolor: 'var(--bg-input, rgba(255,255,255,0.06))' }}
    >
      <Box component="button" role="radio" aria-checked={!ai} onClick={() => onChange(false)} sx={item(!ai, 'var(--brand-color, #FE2C55)')}>
        <SearchIcon sx={{ fontSize: 13 }} />
        搜索
      </Box>
      <Box component="button" role="radio" aria-checked={ai} onClick={() => onChange(true)} sx={item(ai, AI_GRADIENT)}>
        <AutoAwesomeIcon sx={{ fontSize: 13 }} />
        AI 搜索
      </Box>
    </Box>
  );
}

export function AISuggestHint({ onClick }: { onClick: () => void }) {
  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        width: '100%', mb: 2, px: 1.5, py: 1, display: 'flex', alignItems: 'center', gap: 1,
        borderRadius: 2, cursor: 'pointer', font: 'inherit', textAlign: 'left',
        color: 'var(--text-secondary, rgba(255,255,255,0.75))',
        bgcolor: ACCENT.blue.soft12,
        border: `1px dashed ${ACCENT.blue.border30}`,
        '&:hover': { borderStyle: 'solid' },
      }}
    >
      <AutoAwesomeIcon sx={{ fontSize: 16, color: ACCENT.blue.main }} />
      <Typography component="span" sx={{ fontSize: 12.5, flex: 1 }}>
        结果不对味?试试 <Box component="span" sx={{ color: ACCENT.blue.main, fontWeight: 600 }}>AI 搜索</Box>,用整句话描述也能找
      </Typography>
    </Box>
  );
}
