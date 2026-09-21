'use client';

// NarrativeWorldView —— 「叙事世界观」展现形式模板。
//
// 数据复用 versionHistory 的 versions(章节/版本条目),但渲染成纵向叙事流而非
// 竖向时间线:按时间正序(故事从旧到新),每条是一个叙事块(章节名 + 正文)。
// 由 TopicInsightSection 的 INSIGHT_RENDERERS 按 kind="narrativeWorld" 分发。
// 数据为空 → return null,与其它板块「没有就不显示」一致。

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import type { TopicInsight } from '@/apis/community';
import { SectionHeader } from './TopicInsightSection';

interface Props {
  insight: TopicInsight;
}

export function NarrativeWorldView({ insight }: Props) {
  const items = insight.versions ?? [];
  if (items.length === 0) return null;
  // 叙事从旧到新:后端/时间线默认按版本号倒序,这里反转成正序阅读。
  const chapters = [...items].reverse();
  return (
    <Box sx={{ mt: 3 }}>
      <SectionHeader
        icon={<AutoStoriesOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />}
        title={insight.title}
        hint={insight.hint}
        count={chapters.length}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {chapters.map((it, idx) => (
          <Box
            key={`${it.version}-${idx}`}
            sx={{
              borderRadius: 2,
              p: 1.75,
              bgcolor: 'var(--bg-card, rgba(20,22,32,0.6))',
              border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'primary.main' }}>{it.version}</Typography>
              {it.releasedAt && (
                <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.45))' }}>{it.releasedAt}</Typography>
              )}
            </Box>
            <Typography sx={{ fontSize: 14, color: 'text.primary', lineHeight: 1.8, mt: 0.75, wordBreak: 'break-word' }}>
              {it.summary}
              {it.sourceUrl && (
                <Box
                  component="a"
                  href={it.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ ml: 0.75, fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.45))', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}
                >
                  [源]
                </Box>
              )}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default NarrativeWorldView;
