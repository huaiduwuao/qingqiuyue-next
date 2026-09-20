'use client';

import * as React from 'react';
import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';

/** 单条事件。year 允许负数(公元前);era 用于分组(唐/宋) */
export interface TimelineItem {
  year: number;
  era?: string;
  title: string;
  summary?: string;
  source?: string;
  image?: string;
  relatedFigure?: { id: number | string; title: string };
  links?: Array<{ label: string; href: string }>;
}

export interface TimelineProps {
  items: TimelineItem[] | undefined;
  /** 数据来源显示用,如 "中文维基百科 · 共 N 条"。不传则按 source 字段计数 */
  sourceLabel?: string;
  /** 按 era 分组时是否显示分组标题(默认 true) */
  groupByEra?: boolean;
  /** 分组/筛选开关。空数组表示全部 */
  eras?: string[];
  /** 限制显示条数(超出折叠)。0 = 不折叠 */
  collapseAt?: number;
  /** 是否按年份升序(默认 true) */
  ascending?: boolean;
  /** 点击事件回调(关联人物、链接等) */
  onItemClick?: (item: TimelineItem, index: number) => void;
}

/**
 * 通用 Timeline —— 取代 components/poetry/PoetTimeline 的单一形态。
 *
 * 三种渲染模式:
 *   - 默认(无 eras 参数):竖向时间轴,按 year 升序,dot + year + title + 可选 summary
 *   - groupByEra:true 且 item 含 era:在 era 分界处插分组标题
 *   - eras:['唐','宋']... 显示 toggle 过滤
 *
 * PoetTimeline 现在已改为转发到此组件(见 components/poetry/PoetTimeline.tsx)。
 */
export function Timeline({
  items,
  sourceLabel,
  groupByEra = false,
  eras,
  collapseAt = 0,
  ascending = true,
  onItemClick,
}: TimelineProps) {
  const [activeEras, setActiveEras] = useState<string[]>([]);

  const sorted = useMemo(() => {
    if (!items) return [] as TimelineItem[];
    const arr = [...items].sort((a, b) => (ascending ? a.year - b.year : b.year - a.year));
    if (activeEras.length > 0) {
      return arr.filter((it) => it.era && activeEras.includes(it.era));
    }
    return arr;
  }, [items, activeEras, ascending]);

  if (!items || items.length === 0) return null;

  const visible =
    collapseAt > 0 && sorted.length > collapseAt ? sorted.slice(0, collapseAt) : sorted;
  const collapsed = collapseAt > 0 && sorted.length > collapseAt;

  return (
    <Box sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5 }}>
        <HistoryEduIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>生平时间线</Typography>
        <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
          {sourceLabel ?? `数据源:${items[0]?.source ?? '未知'} · 共 ${sorted.length} 条`}
        </Typography>
      </Box>

      {eras && eras.length > 0 && (
        <ToggleButtonGroup
          size="small"
          value={activeEras}
          onChange={(_, v) => setActiveEras(v as string[])}
          sx={{ mb: 2, flexWrap: 'wrap' }}
        >
          {eras.map((era) => (
            <ToggleButton key={era} value={era} sx={{ fontSize: 12, px: 1.5 }}>
              {era}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}

      <Box
        sx={{
          position: 'relative',
          pl: 3,
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
        {visible.map((it, idx) => (
          <React.Fragment key={`${it.year}-${idx}`}>
            {groupByEra &&
              it.era &&
              (idx === 0 || visible[idx - 1].era !== it.era) && (
                <Typography
                  sx={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'primary.main',
                    mt: idx === 0 ? 0 : 2,
                    mb: 0.5,
                    ml: -2,
                  }}
                >
                  {it.era}
                </Typography>
              )}
            <Box
              sx={{
                position: 'relative',
                pb: 2,
                display: 'flex',
                gap: 1.5,
                alignItems: 'flex-start',
                cursor: onItemClick ? 'pointer' : 'default',
              }}
              onClick={() => onItemClick?.(it, idx)}
            >
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
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>
                  {it.title}
                </Typography>
                {it.summary && (
                  <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5, lineHeight: 1.7 }}>
                    {it.summary}
                  </Typography>
                )}
                {it.relatedFigure && (
                  <Typography sx={{ fontSize: 12, color: 'primary.main', mt: 0.5 }}>
                    相关人物: {it.relatedFigure.title}
                  </Typography>
                )}
              </Box>
            </Box>
          </React.Fragment>
        ))}
        {collapsed && (
          <Typography sx={{ fontSize: 12, color: 'text.disabled', ml: -2 }}>
            还有 {sorted.length - collapseAt} 条未展开…
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default Timeline;