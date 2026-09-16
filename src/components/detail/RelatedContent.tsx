'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import { getRelated, type FeedItem } from '@/apis/recommend';
import { getDetailRoute, TYPE_LABEL } from '@/lib/contentRoute';
import { CoverImage } from '@/components/common/CoverImage';
import MusicPlayButton from '@/components/player/MusicPlayButton';
import { useApp } from '@/contexts/AppContext';

interface RelatedContentProps {
  /** 当前内容 id,作为相关推荐的种子(字符串:雪花 id 超出 JS 安全整数)。 */
  contentId: string | number;
  /** 当前内容类型(大写 content_type)。优先推同类型,不足时用全站相关补齐。 */
  contentType?: string;
  title?: string;
  size?: number;
}

/** 同类型结果少于这个数就用全站相关补齐,避免冷门类型下"相关推荐"只有一两条。 */
const MIN_SAME_TYPE = 4;

/** 竖版封面的内容类型(书、漫画、影视海报),其余按横版 16:9。 */
const PORTRAIT_TYPES = new Set(['NOVEL', 'COMICS', 'FILM', 'TELEPLAY', 'SHORT_DRAMA', 'ANIMATION', 'VSHOW']);

async function fetchRelated(seedId: string, contentType: string | undefined, userId: number | undefined, size: number) {
  const list = (params: { types?: string }) =>
    getRelated({ seedId, userId, size, ...params }).then((r) => r.data?.list ?? []);

  const sameType = contentType ? await list({ types: contentType }) : [];
  if (sameType.length >= MIN_SAME_TYPE) return sameType;
  const seen = new Set([seedId, ...sameType.map((i) => i.id)]);
  const anyType = (await list({})).filter((i) => !seen.has(i.id));
  return [...sameType, ...anyType].slice(0, size);
}

/**
 * 详情页底部的"相关推荐"。数据来自推荐引擎的 i2i 召回(以当前内容为种子,
 * 向量相似 + 同作者 + 同标签),点击进入对应类型的详情页。没有结果时不渲染。
 */
export function RelatedContent({ contentId, contentType, title = '相关推荐', size = 12 }: RelatedContentProps) {
  const { currentUser } = useApp();
  const seedId = String(contentId ?? '');
  const type = contentType?.toUpperCase();

  const query = useQuery({
    queryKey: ['related', seedId, type, currentUser?.id],
    queryFn: () => fetchRelated(seedId, type, currentUser?.id, size),
    enabled: !!seedId,
    staleTime: 10 * 60 * 1000,
  });

  const items = (query.data ?? []).filter((it) => getDetailRoute(it.contentType, it.id));
  if (!query.isLoading && items.length === 0) return null;

  return (
    <Box component="section" aria-label={title} sx={{ mt: 4 }}>
      <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700, mb: 1.5 }}>
        {title}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 1.5,
        }}
      >
        {query.isLoading
          ? Array.from({ length: 6 }, (_, i) => (
              <Box key={i}>
                <Skeleton variant="rounded" sx={{ width: '100%', aspectRatio: '16 / 9', height: 'auto' }} />
                <Skeleton width="80%" sx={{ mt: 0.5 }} />
              </Box>
            ))
          : items.map((it) => <RelatedCard key={it.id} item={it} />)}
      </Box>
    </Box>
  );
}

function RelatedCard({ item }: { item: FeedItem }) {
  const href = getDetailRoute(item.contentType, item.id)!;
  const portrait = PORTRAIT_TYPES.has(item.contentType?.toUpperCase());
  const isMusic = item.contentType?.toUpperCase() === 'MUSIC';
  return (
    <Box sx={{ position: 'relative' }}>
    <Box
      component={Link}
      href={href}
      sx={{
        display: 'block',
        color: 'inherit',
        textDecoration: 'none',
        borderRadius: 1.5,
        '&:hover .related-title': { color: 'primary.main' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      }}
    >
      <CoverImage
        src={item.cover}
        alt={item.title}
        sx={{ width: '100%', aspectRatio: portrait ? '3 / 4' : '16 / 9', borderRadius: 1.5, bgcolor: 'action.hover' }}
      />
      <Typography
        className="related-title"
        sx={{
          mt: 0.75,
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          transition: 'color 0.15s',
        }}
      >
        {item.title}
      </Typography>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25 }} noWrap>
        {[TYPE_LABEL[item.contentType?.toUpperCase()], item.author].filter(Boolean).join(' · ')}
      </Typography>
    </Box>
    {/* 音乐:封面右上角直接播放(放在链接外面,不嵌套可交互元素) */}
    {isMusic && (
      <MusicPlayButton id={item.id} title={item.title} size={34} sx={{ position: 'absolute', right: 8, top: 8 }} />
    )}
    </Box>
  );
}

export default RelatedContent;
