'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { Timeline, type TimelineItem } from '../Timeline';
import { SubcategoryChip } from '@/components/subcategory/SubcategoryChip';
import { SubscribeButton } from '@/components/subscription/SubscribeButton';
import MarkdownView from '@/components/common/MarkdownView';
import CoverImage from '@/components/common/CoverImage';

interface Props {
  data: any;
}

/**
 * HistoryEventView —— 历史事件详情主区。
 *
 * 与 HistoryFigureView 同骨架,差异:
 *   - 主标题下加 "发生于 X 年" 副标
 *   - timeline 分组键按朝代(事件通常跨朝代较少,多半只一个 era)
 *   - 正文强调"背景/经过/影响"三段式
 */
export function HistoryEventView({ data }: Props) {
  const md = data.metadata ?? {};
  const timeline: TimelineItem[] = Array.isArray(md.timeline)
    ? md.timeline.map((i: any) => ({
        year: i.year,
        era: md.dynasty,
        title: i.title ?? i.event,
        summary: i.summary,
        source: '中文维基百科',
      }))
    : [];

  const eras = Array.from(new Set(timeline.map((i) => i.era).filter(Boolean))) as string[];

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
        <SubcategoryChip code={data.subcategory_code} />
        {md.dynasty && (
          <Chip
            label={md.dynasty}
            size="small"
            sx={{ bgcolor: 'rgba(254,44,85,0.12)', color: 'primary.main', fontWeight: 600 }}
          />
        )}
        {md.event_year && (
          <Chip
            label={`发生于 ${md.event_year} 年`}
            size="small"
            variant="outlined"
          />
        )}
      </Box>

      <Typography
        component="h1"
        sx={{ fontWeight: 800, fontSize: { xs: 22, sm: 28 }, mb: 1, lineHeight: 1.3 }}
      >
        {data.title}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <SubscribeButton
          targetType="subcategory"
          targetKey={data.subcategory_code ?? 'history.event'}
          variant="button"
        />
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          订阅后数字人会在相关新事件入库时推送
        </Typography>
      </Box>

      {data.cover && (
        <CoverImage
          src={data.cover}
          alt={data.title}
          sx={{ width: '100%', borderRadius: 2, mb: 2, aspectRatio: '16 / 9' }}
        />
      )}

      {data.content && (
        <Box sx={{ mb: 3 }}>
          <MarkdownView>{data.content}</MarkdownView>
        </Box>
      )}

      <Timeline
        items={timeline}
        sourceLabel={`中文维基百科 · 共 ${timeline.length} 条`}
        groupByEra
        eras={eras}
        collapseAt={20}
      />
    </Box>
  );
}

export default HistoryEventView;