'use client';

// 人生感悟专题的卡片。诗词是纯文字卡(这批语料没有配图),其余作品带封面。

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { CoverImage } from '@/components/common/CoverImage';
import { useContentNavigate, TYPE_LABEL } from '@/lib/contentRoute';
import type { InsightItem } from '@/apis/insight';

/** 每组一个主色。心脉受损偏朱砂,三情偏暖,七情偏紫,六欲偏青。 */
export const GROUP_ACCENT: Record<string, string> = {
  wound: '#C8553D',
  bond: '#E08E45',
  qiqing: '#8B6FC9',
  liuyu: '#3A9E9A',
};

export const accentOf = (group?: string) => GROUP_ACCENT[group || ''] || '#C8553D';

/** 诗词卡:题目 / 作者 / 头两句。 */
export function VerseCard({ item, accent }: { item: InsightItem; accent: string }) {
  const go = useContentNavigate();
  return (
    <Box
      onClick={() => go(item.contentType, item.id)}
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: `3px solid ${accent}`,
        cursor: 'pointer',
        minWidth: 0,
        transition: 'background-color .15s',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Typography
        sx={{
          fontSize: 14,
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.title}
      </Typography>
      <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.25 }}>
        {[item.dynasty, item.author].filter(Boolean).join(' · ')}
      </Typography>
      {item.excerpt && (
        <Typography
          sx={{
            fontSize: 13,
            color: 'text.secondary',
            mt: 1,
            lineHeight: 1.8,
            letterSpacing: '0.04em',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.excerpt}
        </Typography>
      )}
    </Box>
  );
}

/** 作品卡:封面 + 标题 + 类型/年份。音乐用方图,其余用竖图。 */
export function WorkCard({ item, showType = false }: { item: InsightItem; showType?: boolean }) {
  const go = useContentNavigate();
  const square = item.contentType === 'MUSIC' || item.contentType === 'VIDEO' || item.contentType === 'ARTICLE';
  const meta = [showType ? TYPE_LABEL[item.contentType] : '', item.year ? String(item.year) : '']
    .filter(Boolean)
    .join(' · ');
  return (
    <Box onClick={() => go(item.contentType, item.id)} sx={{ cursor: 'pointer', minWidth: 0 }}>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: square ? '1 / 1' : '3 / 4',
          borderRadius: 1.5,
          overflow: 'hidden',
          bgcolor: 'action.hover',
        }}
      >
        <CoverImage src={item.cover} alt={item.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {typeof item.rating === 'number' && item.rating > 0 && (
          <Box
            sx={{
              position: 'absolute',
              right: 4,
              bottom: 4,
              px: 0.5,
              borderRadius: 0.5,
              fontSize: 11,
              color: '#fff',
              bgcolor: 'rgba(0,0,0,0.55)',
            }}
          >
            {item.rating.toFixed(1)}
          </Box>
        )}
      </Box>
      <Typography
        sx={{
          fontSize: 13,
          mt: 0.75,
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {item.title}
      </Typography>
      {meta && <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.25 }}>{meta}</Typography>}
    </Box>
  );
}

/** 按类型自动选卡片。 */
export function InsightCard({ item, accent, showType }: { item: InsightItem; accent: string; showType?: boolean }) {
  return item.contentType === 'POETRY' ? (
    <VerseCard item={item} accent={accent} />
  ) : (
    <WorkCard item={item} showType={showType} />
  );
}

/** 题记:原句 + 出处。原句用衬线体,出处小字右对齐。 */
export function Epigraph({ line, src, accent, size = 18 }: { line: string; src: string; accent: string; size?: number }) {
  return (
    <Box sx={{ borderLeft: `2px solid ${accent}`, pl: 2, py: 0.5 }}>
      <Typography
        sx={{
          fontSize: size,
          lineHeight: 1.8,
          letterSpacing: '0.08em',
          fontFamily: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif',
        }}
      >
        {line}
      </Typography>
      <Typography sx={{ fontSize: 12, color: 'text.disabled', mt: 0.5 }}>—— {src}</Typography>
    </Box>
  );
}
