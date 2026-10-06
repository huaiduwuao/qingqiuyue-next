'use client';

// 感悟主题页里「作品里说出的」:作品解析引擎从作品里拆出来、挂在这个主题上的感悟(不是字面匹配)。
// 每句带出处作品;还没有解析过的就整块不显示。

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { LAYER_NAME, cogInsights } from '@/apis/cog';
import { getDetailRoute } from '@/lib/contentRoute';

const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif';

export function ThemeInsights({ theme, accent }: { theme: string; accent: string }) {
  const q = useQuery({ queryKey: ['cog-insights', theme], queryFn: () => cogInsights({ theme, limit: 12 }), staleTime: 10 * 60_000, retry: false });
  const list = q.data?.list || [];
  if (list.length === 0) return null;
  return (
    <Box sx={{ mt: 5 }}>
      <Typography sx={{ fontSize: 13, color: 'text.disabled', mb: 1.5 }}>作品里说出的</Typography>
      {list.map(({ insight: x, work: w }) => (
        <Box key={x.id} sx={{ py: 1.4, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.9 }}>{x.text}</Typography>
          {x.quote && <Typography sx={{ fontFamily: SERIF, fontSize: 13, color: 'text.secondary' }}>「{x.quote}」</Typography>}
          <Typography sx={{ fontSize: 12, color: 'text.disabled', mt: 0.3 }}>
            {LAYER_NAME[x.layer]} ·{' '}
            <Link href={getDetailRoute(w.contentType, w.id) || '#'} style={{ color: accent, textDecoration: 'none' }}>
              《{w.title}》
            </Link>
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default ThemeInsights;
