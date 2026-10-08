'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { PlaylistTile } from '@/components/player/MusicPlaylistShelf';
import type { MyListItem } from '@/apis/my-list';
import { playlistHref, playPlaylist } from '@/lib/player/playlist';

/**
 * 搜索结果顶上的「歌单」一排:搜「民谣」「摇滚」这类曲风词时,用户要的是一张能直接播的歌单,
 * 而不是十首恰好叫「民谣」的歌。数据来自歌单广场(平台编排的主题歌单 + 用户公开歌单),
 * 后端会把曲风词映射到主题歌单(「嘻哈」→「说唱 Hip-Hop」),见 playlistcurator.ThemeAutoKeys。
 */
export function SearchPlaylists({ lists, total }: { lists: MyListItem[]; total: number }) {
  const router = useRouter();
  return (
    <Box component="section" aria-label="歌单">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted, rgba(255,255,255,0.55))', letterSpacing: 1 }}>歌单</Typography>
        <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'var(--text-muted, rgba(255,255,255,0.3))' }} />
        <Typography sx={{ fontSize: 11, color: 'var(--text-disabled, rgba(255,255,255,0.35))' }}>{total} 张</Typography>
      </Box>
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          pb: 1,
          scrollSnapType: 'x proximity',
          '&::-webkit-scrollbar': { height: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'action.selected', borderRadius: 3 },
        }}
      >
        {lists.map((l) => (
          <PlaylistTile
            key={String(l.id)}
            list={l}
            onOpen={() => router.push(playlistHref(l.id))}
            onPlay={() => void playPlaylist(l.id).catch(() => undefined)}
          />
        ))}
      </Box>
    </Box>
  );
}
