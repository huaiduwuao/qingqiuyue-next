'use client';

// 人气榜:此刻(在播人气)/ 今日 / 本周(统计窗口内每个直播间的最高人气,含已下播)。

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import LeaderboardRoundedIcon from '@mui/icons-material/LeaderboardRounded';
import { CoverImage } from '@/components/common/CoverImage';
import { MEDAL } from '@/constants/gradients';
import { type LiveFilters, type LiveRoom, type RankBoard, fetchRank, formatDay, formatViewers } from './liveApi';
import { Clickable, EmptyNote, PlatformBadge, Segmented } from './LiveBits';

const BOARDS: { key: RankBoard; label: string }[] = [
  { key: 'now', label: '此刻' },
  { key: 'day', label: '今日' },
  { key: 'week', label: '本周' },
];

export function LiveRankBoard({ filters, onOpen }: { filters: LiveFilters; onOpen: (r: LiveRoom) => void }) {
  const [board, setBoard] = useState<RankBoard>('now');
  const q = useQuery({
    queryKey: ['home', 'live', 'rank', board, filters.platform, filters.category],
    queryFn: () => fetchRank(board, filters, 10),
    staleTime: 60_000,
  });
  const list = q.data?.list ?? [];
  const max = Math.max(1, ...list.map((r) => peakOf(r, board)));

  return (
    <Box
      component="section"
      aria-label="直播人气榜"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        p: 2,
        borderRadius: 3,
        bgcolor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
        <Typography component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
          <LeaderboardRoundedIcon sx={{ fontSize: 20, color: 'var(--brand-color, #FE2C55)' }} />
          人气榜
        </Typography>
        <Segmented ariaLabel="榜单周期" size="sm" value={board} options={BOARDS} onChange={setBoard} />
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {q.isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} variant="rounded" height={44} sx={{ mb: 0.5 }} />)
        ) : q.isError ? (
          <EmptyNote>
            榜单加载失败,
            <Box component="button" type="button" onClick={() => q.refetch()} sx={{ all: 'unset', cursor: 'pointer', color: 'var(--brand-color)', fontWeight: 600 }}>
              重试
            </Box>
          </EmptyNote>
        ) : list.length === 0 ? (
          <EmptyNote minHeight={200}>{emptyText(board, q.data?.since ?? 0)}</EmptyNote>
        ) : (
          list.map((r) => <RankRow key={String(r.id)} room={r} board={board} max={max} onOpen={() => onOpen(r)} />)
        )}
      </Box>
      <Typography sx={{ mt: 1.25, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        {board === 'now' ? '按各平台公开的在线人数排序,每小时更新。' : '取统计周期内每个直播间的最高人气,含已下播。'}
      </Typography>
    </Box>
  );
}

function peakOf(r: LiveRoom, board: RankBoard) {
  return board === 'now' ? r.viewers : r.peakViewers || 0;
}

function emptyText(board: RankBoard, since: number) {
  if (board === 'now') return '人气数据随各平台抓取每小时更新,稍后再来看看。';
  const start = since ? `${formatDay(since)}起` : '今天起';
  return `${board === 'day' ? '今日' : '本周'}榜${start}开始统计,暂时还没有数据。`;
}

function RankRow({ room, board, max, onOpen }: { room: LiveRoom; board: RankBoard; max: number; onOpen: () => void }) {
  const rank = room.hotRank;
  const medal = MEDAL[rank];
  const value = peakOf(room, board);
  return (
    <Clickable
      onClick={onOpen}
      label={`第 ${rank} 名 ${room.hostName} ${room.title}`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        px: 0.75,
        py: 0.75,
        borderRadius: 1.5,
        '&:hover': { bgcolor: 'var(--bg-hover)' },
      }}
    >
      <Box
        sx={{
          width: 22,
          flexShrink: 0,
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 800,
          fontStyle: 'italic',
          fontVariantNumeric: 'tabular-nums',
          ...(medal
            ? { background: medal.badge, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
            : { color: 'var(--text-muted)' }),
        }}
      >
        {rank}
      </Box>
      <Box sx={{ position: 'relative', width: 64, aspectRatio: '16/9', borderRadius: 1, overflow: 'hidden', flexShrink: 0, bgcolor: 'var(--bg-input)' }}>
        <CoverImage src={room.cover} alt={room.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {room.isLive && (
          <Box sx={{ position: 'absolute', top: 3, left: 3, width: 7, height: 7, borderRadius: '50%', bgcolor: 'var(--brand-color, #FE2C55)', boxShadow: '0 0 0 2px rgba(0,0,0,0.35)' }} />
        )}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography noWrap sx={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          {room.hostName || room.title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 11.5, color: 'var(--text-muted)', minWidth: 0 }}>
          <PlatformBadge platform={room.platform} label={room.platformLabel} />
          <Typography noWrap component="span" sx={{ fontSize: 11.5, color: 'inherit' }}>
            {room.area || room.categoryLabel}
          </Typography>
        </Box>
        <Box sx={{ mt: 0.5, height: 3, borderRadius: 2, bgcolor: 'var(--bg-input)', overflow: 'hidden' }}>
          <Box sx={{ width: `${Math.max(4, (value / max) * 100)}%`, height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #FE2C55, #FF8A3D)' }} />
        </Box>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0, minWidth: 52 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {formatViewers(value)}
        </Typography>
        <Typography sx={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{board === 'now' ? '人气' : room.isLive ? '峰值 · 在播' : '峰值'}</Typography>
      </Box>
    </Clickable>
  );
}
