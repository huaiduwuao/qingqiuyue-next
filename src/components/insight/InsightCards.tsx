'use client';

// 人生感悟专题的卡片。诗词是纯文字卡(这批语料没有配图),其余作品带封面。

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { CoverImage } from '@/components/common/CoverImage';
import { PlayTag } from '@/components/common/PlayTag';
import { useContentNavigate, TYPE_LABEL } from '@/lib/contentRoute';
import type { InsightAvail, InsightItem, InsightStory } from '@/apis/insight';

/** 每组一个主色。心脉受损偏朱砂,人生真相偏青铜,三情偏暖,七情偏紫,六欲偏青。 */
export const GROUP_ACCENT: Record<string, string> = {
  wound: '#C8553D',
  truth: '#A07A3C',
  bond: '#E08E45',
  qiqing: '#8B6FC9',
  liuyu: '#3A9E9A',
};

export const accentOf = (group?: string) => GROUP_ACCENT[group || ''] || '#C8553D';

const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif';

/** 站内可用性的颜色与文案。只有两种能直接消费的状态打标;没有标 = 只有资料,要去原站。 */
export const AVAIL_META: Record<Exclude<InsightAvail, ''>, { label: string; short: string; color: string }> = {
  play: { label: '本站可播', short: '可播', color: '#2E9E6A' },
  read: { label: '直接可看', short: '可看', color: '#3B7DD8' },
};

/** 封面左上角的小标。 */
export function AvailBadge({ avail }: { avail?: InsightAvail }) {
  if (!avail) return null;
  const m = AVAIL_META[avail];
  return (
    <Box
      sx={{
        position: 'absolute',
        left: 4,
        top: 4,
        px: 0.6,
        py: 0.1,
        borderRadius: 0.75,
        fontSize: 10,
        lineHeight: 1.6,
        fontWeight: 600,
        color: '#fff',
        bgcolor: m.color,
        boxShadow: '0 1px 3px rgba(0,0,0,.25)',
      }}
    >
      {m.short}
    </Box>
  );
}

/** 专题接口的 avail 只标了两种能直接消费的状态,翻成 playability 状态交给 PlayTag;没标的让 PlayTag 自己去问。 */
const availStatus = (avail?: InsightAvail) => (avail === 'play' ? 'playable' : avail === 'read' ? 'readable' : undefined);

/** 编者论:观点文字,和史料 / 原文在视觉上分开 —— 标题下写明「编者观点」。 */
export function EssayCard({ paras, accent }: { paras: string[]; accent: string }) {
  if (!paras.length) return null;
  return (
    <Box
      sx={{
        p: { xs: 2.25, md: 3 },
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: (th) => (th.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)'),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5 }}>
        <Typography sx={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700, color: accent, letterSpacing: '0.1em' }}>
          论
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>编者观点 · 文中引文出自原典</Typography>
      </Box>
      {paras.map((t, i) => (
        <Typography
          key={i}
          sx={{
            fontSize: { xs: 14.5, md: 15 },
            lineHeight: 2,
            color: 'text.primary',
            textIndent: '2em',
            mb: i === paras.length - 1 ? 0 : 1.25,
          }}
        >
          {t}
        </Typography>
      ))}
    </Box>
  );
}

/** 故事卡:角度 + 标题 + 白话转述 + 出处。长的默认收起四行,点开看全文。 */
export function StoryCard({ story, accent }: { story: InsightStory; accent: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Box
      onClick={() => setOpen((v) => !v)}
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: open ? accent : 'divider',
        cursor: 'pointer',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color .15s',
        '&:hover': { borderColor: accent },
      }}
    >
      <Box
        sx={{
          alignSelf: 'flex-start',
          px: 1,
          py: 0.1,
          borderRadius: 5,
          fontSize: 11,
          color: accent,
          border: '1px solid',
          borderColor: accent,
          mb: 1,
        }}
      >
        {story.angle}
      </Box>
      <Typography sx={{ fontFamily: SERIF, fontSize: 16, fontWeight: 700, mb: 0.75 }}>{story.title}</Typography>
      <Typography
        sx={{
          fontSize: 13.5,
          lineHeight: 1.9,
          color: 'text.secondary',
          flex: 1,
          ...(open
            ? {}
            : { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
        }}
      >
        {story.body}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1, gap: 1 }}>
        <Typography sx={{ fontSize: 11, color: 'text.disabled', minWidth: 0 }}>出自 {story.src}</Typography>
        <Typography sx={{ fontSize: 11, color: accent, flexShrink: 0 }}>{open ? '收起' : '展开'}</Typography>
      </Box>
    </Box>
  );
}

/** 诗词卡:题目 / 作者 / 头两句。 */
export function VerseCard({ item, accent }: { item: InsightItem; accent: string }) {
  const go = useContentNavigate();
  return (
    <Box
      data-work-id={String(item.id)}
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
      <PlayTag id={item.id} contentType={item.contentType} status={availStatus(item.avail)} variant="inline" sx={{ mt: 0.75 }} />
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
    <Box data-work-id={String(item.id)} onClick={() => go(item.contentType, item.id)} sx={{ cursor: 'pointer', minWidth: 0 }}>
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
        <PlayTag id={item.id} contentType={item.contentType} status={availStatus(item.avail)} variant="overlay" top={4} left={4} />
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
