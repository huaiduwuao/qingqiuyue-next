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
import { ListLayout, LIST_ROW } from '@/components/common/ListLayout';
import MusicPlayButton from '@/components/player/MusicPlayButton';
import { useApp } from '@/contexts/AppContext';

interface RelatedContentProps {
  /** 当前内容 id,作为相关推荐的种子(字符串:雪花 id 超出 JS 安全整数)。 */
  contentId: string | number;
  /** 当前内容类型。已不参与请求(后端按种子类型自取),保留给老调用方。 */
  contentType?: string;
  title?: string;
  size?: number;
}

/** 竖版封面的内容类型(书、漫画、影视海报),其余按横版 16:9。 */
const PORTRAIT_TYPES = new Set(['NOVEL', 'COMICS', 'FILM', 'TELEPLAY', 'SHORT_DRAMA', 'ANIMATION', 'VSHOW']);

const DEFAULT_SIZE = 12;

/**
 * 相关推荐的查询参数,组件和详情页 layout 的预取共用同一个 key。
 * 同类型优先、不足再跨类型补齐由后端做,这里只发一次请求 —— 以前前端先按类型查、
 * 不够再查一次,两个请求串行,还得等详情接口返回拿到类型之后才能发出。
 * userId 只进 key(登录态变了要重取),请求本身靠会话识别用户。
 */
export function relatedQueryOptions(seedId: string, userId: number | undefined, size = DEFAULT_SIZE) {
  return {
    queryKey: ['related', seedId, size, userId ?? 0] as const,
    queryFn: () => getRelated({ seedId, size }).then((r) => r?.list ?? []),
    staleTime: 10 * 60 * 1000,
  };
}

/**
 * 详情页底部的"相关推荐"。数据来自推荐引擎以当前内容为种子的召回(向量相似 +
 * 同歌手/同专辑/同题材 + 协同过滤),点击进入对应类型的详情页。没有结果时不渲染。
 */
export function RelatedContent({ contentId, title = '相关推荐', size = DEFAULT_SIZE }: RelatedContentProps) {
  const { currentUser } = useApp();
  const seedId = String(contentId ?? '');

  const query = useQuery({
    ...relatedQueryOptions(seedId, currentUser?.id, size),
    enabled: !!seedId,
  });

  const items = (query.data ?? []).filter((it) => getDetailRoute(it.contentType, it.id));
  if (!query.isLoading && items.length === 0) return null;

  return (
    <Box component="section" aria-label={title} sx={{ mt: 4 }}>
      <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700, mb: 1.5 }}>
        {title}
      </Typography>
      {/* 竖版/横版封面混排,高度不一 */}
      <ListLayout minColumnWidth={140} gap={12} packing="masonry">
        {query.isLoading
          ? Array.from({ length: 6 }, (_, i) => (
              <Box key={i}>
                <Skeleton variant="rounded" sx={{ width: '100%', aspectRatio: '16 / 9', height: 'auto' }} />
                <Skeleton width="80%" sx={{ mt: 0.5 }} />
              </Box>
            ))
          : items.map((it) => <RelatedCard key={it.id} item={it} />)}
      </ListLayout>
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
        [LIST_ROW]: {
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        },
      }}
    >
      <CoverImage
        src={item.cover}
        alt={item.title}
        sx={{
          width: '100%',
          aspectRatio: portrait ? '3 / 4' : '16 / 9',
          borderRadius: 1.5,
          bgcolor: 'action.hover',
          [LIST_ROW]: { width: portrait ? { xs: 72, sm: 96 } : { xs: 120, sm: 200 }, flexShrink: 0 },
        }}
      />
      <Box sx={{ [LIST_ROW]: { flex: 1, minWidth: 0, pr: isMusic ? 6 : 0 } }}>
      <Typography
        className="related-title"
        sx={{
          mt: 0.75,
          [LIST_ROW]: { mt: 0, fontSize: 14 },
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
    </Box>
    {/* 音乐:封面右上角直接播放(放在链接外面,不嵌套可交互元素) */}
    {isMusic && (
      <MusicPlayButton id={item.id} title={item.title} size={34} sx={{ position: 'absolute', right: 8, top: 8, [LIST_ROW]: { top: 'calc(50% - 17px)' } }} />
    )}
    </Box>
  );
}

export default RelatedContent;
