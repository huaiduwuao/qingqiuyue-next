'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import SportsEsportsRoundedIcon from '@mui/icons-material/SportsEsportsRounded';
import TheaterComedyRoundedIcon from '@mui/icons-material/TheaterComedyRounded';
import { gradient2 } from '@/constants/gradients';
import { mediaUrl } from '@/lib/media';

/**
 * 专题封面渐变 —— 按专题 ID 轮换,空封面也能有稳定、好看的品牌渐变背景。
 * 与 constants/gradients.ts 的 TYPE_GRADIENT 同一套视觉语言。
 */
const COVER_GRADIENTS = [
  gradient2('#FE2C55', '#FF6B8A'),   // 红粉
  gradient2('#8B5CF6', '#C4B5FD'),   // 紫
  gradient2('#25F4EE', '#5DF7F2'),   // 青
  gradient2('#FFB400', '#FFD566'),   // 黄
  gradient2('#5B8DEF', '#8B5CF6'),   // 蓝紫
  gradient2('#FF8A3D', '#FF6B8A'),   // 橙粉
];

/** 按内容类型选图标(专题可标注内容类型)。 */
function iconByType(contentType?: string) {
  const t = (contentType || '').toUpperCase();
  const p = { sx: { fontSize: 40, color: 'rgba(255,255,255,0.85)' } } as const;
  switch (t) {
    case 'FILM':
    case 'VIDEO':
    case 'SHORT_DRAMA':
      return <MovieRoundedIcon {...p} />;
    case 'TELEPLAY':
    case 'VSHOW':
      return <TheaterComedyRoundedIcon {...p} />;
    case 'NOVEL':
    case 'COMICS':
      return <MenuBookRoundedIcon {...p} />;
    case 'MUSIC':
      return <MusicNoteRoundedIcon {...p} />;
    case 'VIDEO_GAME':
      return <SportsEsportsRoundedIcon {...p} />;
    case 'NEWS':
    case 'ARTICLE':
      return <ArticleRoundedIcon {...p} />;
    default:
      return <CollectionsRoundedIcon {...p} />;
  }
}

interface Props {
  id: number | string;
  cover?: string | null;
  title?: string;
  contentType?: string;
  /** 封面高宽比,默认 16/9(卡片用)。详情页 hero 可传 '21/9'。 */
  aspectRatio?: string;
  /** 图标缩放(默认封面中央大图标的尺寸)。 */
  iconSize?: number;
}

/**
 * TopicCover —— 专题封面。
 *
 * 有 cover 用真实图(经 mediaUrl 改写,处理内网 MinIO/外站防盗链);
 * 没有 cover 时按专题 ID 取一道稳定的品牌渐变 + 中央类型图标,
 * 不再依赖不存在的 /placeholder.png(那是破图的根源)。
 */
export default function TopicCover({
  id,
  cover,
  title,
  contentType,
  aspectRatio = '16/9',
  iconSize = 40,
}: Props) {
  const numId = typeof id === 'string' ? parseInt(id, 10) || 0 : id;
  const gradient = COVER_GRADIENTS[numId % COVER_GRADIENTS.length];
  const src = cover ? mediaUrl(cover) : '';

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio,
        overflow: 'hidden',
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* 装饰光斑(抖音风:左上角一层柔光) */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 25% 20%, rgba(255,255,255,0.22), transparent 55%)',
          pointerEvents: 'none',
        }}
      />

      {src ? (
        <Box
          component="img"
          src={src}
          alt={title || ''}
          loading="lazy"
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <Box sx={{ fontSize: iconSize, display: 'flex', position: 'relative' }}>
          {iconByType(contentType)}
        </Box>
      )}

      {/* 底部压暗,标题压在图上时可读(详情页 hero 用) */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />
    </Box>
  );
}

/** 数字格式化(1.2w / 3.4k),与首页推荐卡一致。 */
export function formatCount(n: number = 0): string {
  if (n == null || isNaN(n) || n < 0) return '0';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
