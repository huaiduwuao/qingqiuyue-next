'use client';

// PoetTimeline —— 诗人生平时间线。
//
// 数据形态:{ year: number, event: string }[],由后端 poet 接口从 metadata.timeline
// 透出(数据源:中文维基 REST,见 internal/crawler/poet_timeline.go)。
//
// 数据缺失(没爬到的诗人)整个模块不渲染 —— 与「没有就不显示」约定一致。
// 不对事件做任何改写,只是把 year/event 排版成竖向时间轴。

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';

export interface PoetTimelineItem {
  year: number;
  event: string;
}

export interface PoetTimelineProps {
  items: PoetTimelineItem[] | undefined;
}

function PoetTimeline({ items }: PoetTimelineProps) {
  if (!items || items.length === 0) return null;

  // 按年份升序展示。源数据可能不严格排序,前端兜底。
  const sorted = [...items].sort((a, b) => a.year - b.year);

  return (
    <Box sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5 }}>
        <HistoryEduIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>生平时间线</Typography>
        <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
          数据源:中文维基百科 · 共 {sorted.length} 条
        </Typography>
      </Box>

      <Box
        sx={{
          position: 'relative',
          pl: 3,
          // 主竖线
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 7,
            top: 6,
            bottom: 6,
            width: 2,
            bgcolor: 'divider',
            borderRadius: 1,
          },
        }}
      >
        {sorted.map((it, idx) => (
          <Box
            key={`${it.year}-${idx}`}
            sx={{
              position: 'relative',
              pb: idx === sorted.length - 1 ? 0 : 2,
              display: 'flex',
              gap: 1.5,
              alignItems: 'flex-start',
            }}
          >
            {/* 节点圆点 */}
            <Box
              sx={{
                position: 'absolute',
                left: -22,
                top: 6,
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: 'background.paper',
                border: '2px solid',
                borderColor: 'primary.main',
              }}
            />
            <Typography
              sx={{
                fontSize: 13,
                fontWeight: 600,
                color: 'primary.main',
                minWidth: 56,
                flexShrink: 0,
              }}
            >
              {it.year}
            </Typography>
            <Typography
              sx={{
                fontSize: 14,
                color: 'text.primary',
                lineHeight: 1.7,
                flex: 1,
                wordBreak: 'break-word',
              }}
            >
              {it.event}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default PoetTimeline;