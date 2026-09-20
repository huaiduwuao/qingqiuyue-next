'use client';

import React from 'react';
import Box from '@mui/material/Box';
import QueueMusicRoundedIcon from '@mui/icons-material/QueueMusicRounded';
import { CoverImage } from '@/components/common/CoverImage';
import { mediaUrl } from '@/lib/media';

/** 歌单封面:设了封面用封面;没设就拿前几首歌的封面拼(4 张拼田字,不足 4 张用第一张)。 */
export default function PlaylistCover({
  covers,
  coverUrl,
  size,
  radius = 1.5,
}: {
  covers?: string[];
  coverUrl?: string;
  size: number | string;
  radius?: number;
}) {
  const imgs = (coverUrl ? [coverUrl] : (covers ?? [])).map((c) => mediaUrl(c)).filter(Boolean);
  const tiles = imgs.length >= 4 ? imgs.slice(0, 4) : imgs.slice(0, 1);
  return (
    <Box
      sx={{
        width: size,
        aspectRatio: '1 / 1',
        flexShrink: 0,
        borderRadius: radius,
        overflow: 'hidden',
        bgcolor: 'action.selected',
        display: 'grid',
        gridTemplateColumns: tiles.length === 4 ? '1fr 1fr' : '1fr',
        alignItems: 'center',
        justifyItems: 'center',
      }}
    >
      {tiles.length === 0 ? (
        <QueueMusicRoundedIcon sx={{ color: 'text.secondary', fontSize: typeof size === 'number' ? size * 0.45 : 48 }} />
      ) : (
        tiles.map((src, i) => (
          <CoverImage key={i} src={src} alt="" loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ))
      )}
    </Box>
  );
}
