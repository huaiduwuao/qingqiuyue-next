'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import {
  PUBLISH_HUB_TYPE_LABEL,
  type PublishHubType,
} from '@/lib/contentRoute';

interface Props {
  value: PublishHubType;
  onChange: (next: PublishHubType) => void;
  /** 控制「全部」chip 是否显示 — 默认 true */
  showAll?: boolean;
}

/**
 * 创作者中心「发布」中枢顶部的内容类型 chip 选择器。
 * 显示顺序:全部 / 视频 / 图文 / 图片 MV / 文章 / 小说 / 新闻 /
 * 音乐 / 漫画 / 短剧 / 电视剧 / 电影 / 动画 / 直播。
 */
export default function PublishTypeChips({ value, onChange, showAll = true }: Props) {
  const orderedTypes: PublishHubType[] = [
    'all',
    'video',
    'picture-album',
    'picture-mv',
    'article',
    'novel',
    'news',
    'music',
    'comics',
    'vshow',
    'teleplay',
    'film',
    'animation',
    'live',
  ];
  const visible = showAll ? orderedTypes : orderedTypes.filter((t) => t !== 'all');

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexWrap: 'wrap',
        p: 1.5,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box
        component="span"
        sx={{
          fontSize: 11,
          fontWeight: 700,
          color: 'text.secondary',
          letterSpacing: 1,
          textTransform: 'uppercase',
          pr: 0.5,
        }}
      >
        发布类型
      </Box>
      {visible.map((t) => (
        <Chip
          key={t}
          label={PUBLISH_HUB_TYPE_LABEL[t]}
          size="small"
          onClick={() => onChange(t)}
          color={value === t ? 'primary' : 'default'}
          variant={value === t ? 'filled' : 'outlined'}
          sx={{
            height: 26,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
            '&:hover': {
              bgcolor: value === t ? 'primary.main' : 'action.hover',
            },
          }}
        />
      ))}
    </Box>
  );
}
