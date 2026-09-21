'use client';

// CardArchiveView —— 「卡片档案集」展现形式模板。
//
// 数据复用 lineups 的卡片条目,但渲染成更密集的「档案卡」网格:突出封面 +
// 标题 + vendor 标签,强调收藏/归档感而非热门阵容。由 TopicInsightSection 的
// INSIGHT_RENDERERS 按 kind="cardArchive" 分发。数据为空 → return null。

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import type { TopicInsight, TopicInsightLineup } from '@/apis/community';
import { CoverImage } from '@/components/common/CoverImage';
import { ListLayout } from '@/components/common/ListLayout';
import { SectionHeader } from './TopicInsightSection';

interface Props {
  insight: TopicInsight;
}

export function CardArchiveView({ insight }: Props) {
  const items = insight.lineups ?? [];
  if (items.length === 0) return null;
  return (
    <Box sx={{ mt: 3 }}>
      <SectionHeader
        icon={<Inventory2OutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />}
        title={insight.title}
        hint={insight.hint}
        count={items.length}
      />
      <ListLayout minColumnWidth={140} gap={10} listMaxWidth="none">
        {items.map((it) => (
          <ArchiveCard key={String(it.id ?? it.title)} item={it} />
        ))}
      </ListLayout>
    </Box>
  );
}

function ArchiveCard({ item }: { item: TopicInsightLineup }) {
  const isExternal = !!item.sourceUrl;
  return (
    <Box
      {...(isExternal ? { component: 'a' as const, href: item.sourceUrl, target: '_blank', rel: 'noopener noreferrer' } : {})}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'var(--bg-card, rgba(20,22,32,0.6))',
        border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'transform .2s',
        '&:hover': { transform: 'translateY(-2px)' },
      }}
    >
      <Box sx={{ position: 'relative', width: '100%', aspectRatio: '4/3' }}>
        <CoverImage src={item.cover} alt={item.title} sx={{ width: '100%', height: '100%' }} />
        {item.vendor && (
          <Box
            sx={{
              position: 'absolute',
              left: 6,
              bottom: 6,
              px: 0.75,
              py: 0.25,
              borderRadius: 0.75,
              fontSize: 10,
              fontWeight: 600,
              color: '#fff',
              bgcolor: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(4px)',
              maxWidth: 'calc(100% - 12px)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.vendor}
          </Box>
        )}
        {isExternal && (
          <LaunchRoundedIcon
            sx={{ position: 'absolute', right: 6, top: 6, fontSize: 14, color: '#fff', bgcolor: 'rgba(0,0,0,0.45)', borderRadius: 999, p: 0.25 }}
          />
        )}
      </Box>
      <Box sx={{ p: 1 }}>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-primary, #fff)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: 32,
          }}
        >
          {item.title}
        </Typography>
      </Box>
    </Box>
  );
}

export default CardArchiveView;
