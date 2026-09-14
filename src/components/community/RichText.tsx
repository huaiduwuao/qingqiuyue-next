'use client';

import Link from 'next/link';
import Box from '@mui/material/Box';
import type { TopicBrief } from '@/apis/community';
import { topicHref } from './format';

// 与后端 service.ParseHashtags 一致:#话题名#,1~30 字,不跨行、不含 #
const HASHTAG = /#([^#\r\n]{1,30})#/g;

/** 帖子正文:保留换行,#话题# 高亮,已挂上的话题可点进话题页 */
export function RichText({ text, topics }: { text: string; topics: TopicBrief[] }) {
  const byName = new Map(topics.map((t) => [t.title.toLowerCase(), t]));
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(HASHTAG)) {
    const start = m.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    const name = m[1].trim();
    const topic = byName.get(name.toLowerCase());
    parts.push(
      topic ? (
        <Box
          key={start}
          component={Link}
          href={topicHref(topic.id)}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          sx={{ color: 'var(--brand-color, #FE2C55)', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
        >
          #{name}#
        </Box>
      ) : (
        <Box key={start} component="span" sx={{ color: 'var(--brand-color, #FE2C55)', fontWeight: 600 }}>
          #{name}#
        </Box>
      ),
    );
    last = start + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <Box component="div" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14, lineHeight: 1.65, color: 'var(--text-primary, #fff)' }}>
      {parts}
    </Box>
  );
}
