'use client';

/**
 * 同一部作品往往被几个数据源各收录一条(B 站番剧页、维基条目、Bangumi……),只有其中一条绑到了
 * 能播的片源。这一条看不了、而同一部作品另有能看的那条时(后端详情的 playableAlternative,
 * 见 qingqiuyue-go internal/handler/content_alternative.go),在播放器下面给一个直达入口。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutlined';
import { useRouter } from 'next/navigation';
import { getDetailRoute } from '@/lib/contentRoute';

export interface PlayableAlternativeInfo {
  id: number | string;
  contentType: string;
  title?: string;
  sourceLabel?: string;
}

export function PlayableAlternative({ alt }: { alt?: PlayableAlternativeInfo | null }) {
  const router = useRouter();
  const href = alt ? getDetailRoute(alt.contentType, alt.id) : null;
  if (!alt || !href) return null;
  const from = (alt.sourceLabel || '').replace(/\s*\[.*?\]/g, '').trim();
  return (
    <Container maxWidth="lg" sx={{ pt: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
          px: 2,
          py: 1.25,
          borderRadius: 2,
          border: '1px solid #22c55e55',
          bgcolor: '#22c55e14',
        }}
      >
        <PlayCircleOutlineIcon sx={{ color: '#22c55e' }} />
        <Typography sx={{ flex: 1, minWidth: 180, fontSize: 14, color: 'text.primary' }}>
          这一条暂时看不了,同一部作品有能播放的版本{from ? `(收录自 ${from})` : ''}。
        </Typography>
        <Button variant="contained" color="success" size="small" onClick={() => router.push(href)}>
          去看能播放的版本
        </Button>
      </Box>
    </Container>
  );
}
