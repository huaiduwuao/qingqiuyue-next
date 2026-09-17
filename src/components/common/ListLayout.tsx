'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import Box, { type BoxProps } from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import ViewAgendaRoundedIcon from '@mui/icons-material/ViewAgendaRounded';
import {
  LIST_LAYOUT_LABEL,
  LIST_LAYOUT_MODES,
  useListLayout,
  type ListLayoutMode,
} from '@/lib/listLayoutPrefs';

const MODE_ICON: Record<ListLayoutMode, React.ReactNode> = {
  masonry: <DashboardRoundedIcon sx={{ fontSize: 16 }} />,
  grid: <GridViewRoundedIcon sx={{ fontSize: 16 }} />,
  list: <ViewAgendaRoundedIcon sx={{ fontSize: 16 }} />,
};

/** 列表样式切换(瀑布流/网格/列表),全站共用一个偏好。 */
export function ListLayoutSwitch({ sx }: { sx?: BoxProps['sx'] }) {
  const [mode, setMode] = useListLayout();
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={mode}
      onChange={(_, v: ListLayoutMode | null) => v && setMode(v)}
      aria-label="列表样式"
      sx={{
        flexShrink: 0,
        '& .MuiToggleButton-root': {
          px: 0.75,
          py: 0.35,
          border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
          color: 'var(--text-muted, rgba(255,255,255,0.5))',
          '&.Mui-selected, &.Mui-selected:hover': {
            color: 'var(--brand-color, #FE2C55)',
            bgcolor: 'var(--bg-hover, rgba(255,255,255,0.06))',
          },
        },
        ...(sx as object),
      }}
    >
      {LIST_LAYOUT_MODES.map((m) => (
        <Tooltip key={m} title={LIST_LAYOUT_LABEL[m]}>
          <ToggleButton value={m} aria-label={LIST_LAYOUT_LABEL[m]}>
            {MODE_ICON[m]}
          </ToggleButton>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  );
}

/**
 * 卡片在列表模式下改横排:卡片(及其子元素)sx 里写 `[LIST_ROW]: {...}`,不用层层传 mode。
 * 例:`{ [LIST_ROW]: { display: 'flex' } }`
 */
export const LIST_ROW = '[data-list-layout="list"] &';

interface Props {
  children: React.ReactNode;
  /** 瀑布流/网格每列最小宽度(px),列数按容器宽度算,宽屏自动多列 */
  minColumnWidth?: number;
  /** 窄屏也至少保留的列数(海报类卡片用 2) */
  minColumns?: number;
  maxColumns?: number;
  /** 间距(px) */
  gap?: number;
  /** 列表模式的最大宽度,居中;不设则铺满 */
  listMaxWidth?: number | string;
  /** 不跟全局偏好,强制某种样式 */
  mode?: ListLayoutMode;
  sx?: BoxProps['sx'];
}

function columnsFor(width: number, min: number, gap: number, lo: number, hi: number) {
  const n = Math.floor((width + gap) / (min + gap));
  return Math.max(lo, Math.min(hi, n));
}

/**
 * 按全局偏好渲染内容列表。列数跟着容器宽度走(ResizeObserver),
 * 不跟视口断点走 —— 同一个列表在有/无右侧栏时可用宽度差 300px。
 * 瀑布流按下标轮流分列,无限滚动追加时已有卡片不挪位置。
 */
export function ListLayout({
  children,
  minColumnWidth = 260,
  minColumns = 1,
  maxColumns = 8,
  gap = 12,
  listMaxWidth,
  mode: forced,
  sx,
}: Props) {
  const [pref] = useListLayout();
  const mode = forced ?? pref;
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const items = React.Children.toArray(children).filter(Boolean);
  const cols = width > 0 ? columnsFor(width, minColumnWidth, gap, minColumns, maxColumns) : 0;

  let body: React.ReactNode;
  if (mode === 'list') {
    body = (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${gap}px`, width: '100%', maxWidth: listMaxWidth, mx: 'auto' }}>
        {items.map((c, i) => <Box key={(c as React.ReactElement).key ?? i} sx={{ minWidth: 0 }}>{c}</Box>)}
      </Box>
    );
  } else if (mode === 'masonry' && cols > 0) {
    const buckets: React.ReactNode[][] = Array.from({ length: cols }, () => []);
    items.forEach((c, i) => buckets[i % cols].push(c));
    body = (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: `${gap}px` }}>
        {buckets.map((col, ci) => (
          <Box key={ci} sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: `${gap}px` }}>
            {col}
          </Box>
        ))}
      </Box>
    );
  } else {
    // 网格;瀑布流在量到宽度前也先按网格排,免得首帧挤成一列
    body = (
      <Box
        sx={{
          display: 'grid',
          gap: `${gap}px`,
          gridTemplateColumns: cols > 0
            ? `repeat(${cols}, minmax(0, 1fr))`
            : `repeat(auto-fill, minmax(min(${minColumnWidth}px, 100%), 1fr))`,
          // 网格模式卡片等高:单元格里的卡片撑满
          '& > * > *': mode === 'grid' ? { height: '100%' } : undefined,
        }}
      >
        {items.map((c, i) => <Box key={(c as React.ReactElement).key ?? i} sx={{ minWidth: 0 }}>{c}</Box>)}
      </Box>
    );
  }

  return (
    <Box ref={ref} data-list-layout={mode} sx={{ width: '100%', minWidth: 0, ...(sx as object) }}>
      {body}
    </Box>
  );
}
