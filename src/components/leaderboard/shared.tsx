'use client';

import React from 'react';
import Box from '@mui/material/Box';
import ArrowDropUpRoundedIcon from '@mui/icons-material/ArrowDropUpRounded';
import ArrowDropDownRoundedIcon from '@mui/icons-material/ArrowDropDownRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';

import type { LeaderboardEntry, LeaderboardMetric } from '@/apis/leaderboard';
import { RANK_PILL, gradient2 } from '@/constants/gradients';

// 各榜型的主题色(按钮高亮、分数条)。
export const METRIC_GRADIENT: Record<LeaderboardMetric, string> = {
  hot: gradient2('#FE2C55', '#FF8A3D'),
  rising: gradient2('#8B5CF6', '#25F4EE'),
  new: gradient2('#25F4EE', '#5DDB96'),
  praise: gradient2('#FFB400', '#FF8A3D'),
};

export function formatCount(n: number = 0): string {
  if (!n || n < 0 || Number.isNaN(n)) return '0';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function formatBuiltAt(s?: string): string {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export function relativeTime(s?: string): string {
  if (!s) return '';
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return '';
  const min = Math.floor((Date.now() - t) / 60_000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(t).toLocaleDateString('zh-CN');
}

// 封面比例:书/剧/番是竖版,音乐是方形,视频/直播/资讯是横版。
const PORTRAIT = new Set(['NOVEL', 'COMICS', 'FILM', 'TELEPLAY', 'SHORT_DRAMA', 'ANIMATION', 'VSHOW']);
export function coverShape(contentType: string): { w: number; h: number } {
  const t = (contentType || '').toUpperCase();
  if (PORTRAIT.has(t)) return { w: 42, h: 56 };
  if (t === 'MUSIC') return { w: 48, h: 48 };
  return { w: 72, h: 44 };
}

/** 一条榜单项在当前榜型下最该展示的那个数。 */
export function metricStat(e: LeaderboardEntry, metric: LeaderboardMetric): string {
  switch (metric) {
    case 'rising':
      if (e.isNew) return '新上榜';
      if (e.delta && e.delta > 0) return `↑ ${e.delta} 名`;
      return `热度 ${e.score.toFixed(1)}`;
    case 'praise':
      if (e.rating) return `★ ${e.rating.toFixed(1)}`;
      return `${formatCount(e.likes + e.collects)} 赞藏`;
    case 'new':
      return relativeTime(e.publishTime);
    default:
      return `热度 ${e.score.toFixed(1)}`;
  }
}

export function RankNumber({ rank, small = false }: { rank: number; small?: boolean }) {
  const top = rank <= 3;
  const size = small ? 20 : 28;
  return (
    <Box
      sx={{
        minWidth: size,
        height: size,
        px: 0.5,
        borderRadius: small ? 1 : 1.5,
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontWeight: 800,
        fontSize: small ? 11 : rank > 99 ? 12 : 15,
        color: top ? '#fff' : rank <= 10 ? 'var(--text-primary, currentColor)' : 'var(--text-muted, currentColor)',
        background: top ? RANK_PILL[rank] : 'transparent',
        flexShrink: 0,
      }}
    >
      {rank}
    </Box>
  );
}

/**
 * 排名变化。没有可比的上期快照时什么都不画 —— 不给用户看编出来的"持平"。
 * solid:叠在封面上时加深底色保证可读。
 */
export function DeltaBadge({ entry, compared, solid = false }: { entry: LeaderboardEntry; compared: boolean; solid?: boolean }) {
  if (!compared) return null;
  if (entry.isNew) {
    return (
      <Box
        component="span"
        sx={{
          px: 0.5,
          borderRadius: 0.75,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: 0.3,
          lineHeight: '15px',
          color: '#fff',
          background: gradient2('#FE2C55', '#FFB400'),
          flexShrink: 0,
        }}
      >
        NEW
      </Box>
    );
  }
  const d = entry.delta ?? 0;
  const bg = solid ? { bgcolor: 'rgba(0,0,0,0.55)', borderRadius: 1, pr: 0.5 } : {};
  if (d === 0) {
    return (
      <Box component="span" sx={{ display: 'inline-flex', ...bg }}>
        <RemoveRoundedIcon sx={{ fontSize: 12, color: solid ? '#fff' : 'var(--text-muted, currentColor)', mx: solid ? 0.25 : 0 }} />
      </Box>
    );
  }
  const up = d > 0;
  const Icon = up ? ArrowDropUpRoundedIcon : ArrowDropDownRoundedIcon;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1,
        color: up ? 'success.main' : 'error.main',
        flexShrink: 0,
        ...bg,
      }}
    >
      <Icon sx={{ fontSize: 16, mx: -0.25 }} />
      {Math.abs(d)}
    </Box>
  );
}
