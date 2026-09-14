'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import TopicCover, { formatCount } from './TopicCover';
import type { Topic } from '@/apis/topic';

interface Props {
  topic: Topic;
}

/**
 * TopicCard —— 专题卡片(抖音/榜单风)。
 *
 * 视觉对齐首页推荐卡 + 全网热榜:
 *  - 封面 16:9,顶部右上角压一个「N 内容」胶囊(像榜单的播放量角标)
 *  - 标题压图(底部渐变压暗),两行截断
 *  - 标题下方一行 meta:内容数 · 浏览量
 *  - 整卡 hover 上浮 + 阴影,圆角 2
 *  - 空封面走 TopicCover 的品牌渐变,不再有破图
 */
export default function TopicCard({ topic }: Props) {
  const router = useRouter();

  return (
    <Box
      onClick={() => router.push(`/detail/topic-detail?id=${topic.id}`)}
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        bgcolor: 'var(--bg-surface, transparent)',
        border: '1px solid var(--border-color, transparent)',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
        '&:hover': {
          transform: 'translateY(-3px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        },
      }}
    >
      {/* 封面 */}
      <Box sx={{ position: 'relative' }}>
        <TopicCover
          id={topic.id}
          cover={topic.cover}
          title={topic.title}
          contentType={topic.contentType}
        />

        {/* 内容数胶囊(右上,榜单播放量角标风) */}
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 0.4,
            px: 0.75,
            py: 0.3,
            borderRadius: 1,
            bgcolor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            color: '#fff',
            fontSize: 10,
            fontFamily: 'monospace',
            zIndex: 1,
          }}
        >
          <CollectionsRoundedIcon sx={{ fontSize: 11 }} />
          {topic.contentCount}
        </Box>

        {/* 标题压图(底部) */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            p: 1.25,
            zIndex: 1,
          }}
        >
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textShadow: '0 1px 4px rgba(0,0,0,0.5)',
            }}
          >
            {topic.title}
          </Typography>
        </Box>
      </Box>

      {/* 卡身:副标题 + meta */}
      <Box sx={{ px: 1.25, py: 1 }}>
        <Typography
          sx={{
            fontSize: 11,
            color: 'var(--text-secondary, currentColor)',
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: 15,
            mb: 0.5,
          }}
        >
          {topic.subtitle || topic.description || '精选合集 · 持续更新'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <VisibilityRoundedIcon sx={{ fontSize: 12, color: 'var(--text-muted, currentColor)' }} />
            <Typography
              sx={{
                fontSize: 10,
                color: 'var(--text-muted, currentColor)',
                fontFamily: 'monospace',
              }}
            >
              {formatCount(topic.viewCount)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <PlayArrowRoundedIcon sx={{ fontSize: 12, color: 'var(--text-muted, currentColor)' }} />
            <Typography
              sx={{
                fontSize: 10,
                color: 'var(--text-muted, currentColor)',
                fontFamily: 'monospace',
              }}
            >
              {topic.contentCount} 内容
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
