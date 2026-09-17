'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import Box, { type BoxProps } from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded';
import ViewComfyRoundedIcon from '@mui/icons-material/ViewComfyRounded';
import ViewAgendaRoundedIcon from '@mui/icons-material/ViewAgendaRounded';
import {
  LIST_LAYOUT_LABEL,
  LIST_LAYOUT_MODES,
  useListLayout,
  type ListLayoutMode,
} from '@/lib/listLayoutPrefs';

const MODE_ICON: Record<ListLayoutMode, React.ReactNode> = {
  comfortable: <ViewModuleRoundedIcon sx={{ fontSize: 16 }} />,
  compact: <ViewComfyRoundedIcon sx={{ fontSize: 16 }} />,
  list: <ViewAgendaRoundedIcon sx={{ fontSize: 16 }} />,
};

/** 列表样式切换(舒适/紧凑/列表),全站共用一个偏好。withLabel 用在设置抽屉里。 */
export function ListLayoutSwitch({ sx, withLabel }: { sx?: BoxProps['sx']; withLabel?: boolean }) {
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
          px: withLabel ? 1 : 0.75,
          py: 0.35,
          gap: 0.5,
          fontSize: 12,
          lineHeight: 1.4,
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
      {LIST_LAYOUT_MODES.map((m) => {
        const btn = (
          <ToggleButton key={m} value={m} aria-label={LIST_LAYOUT_LABEL[m]}>
            {MODE_ICON[m]}
            {withLabel && LIST_LAYOUT_LABEL[m]}
          </ToggleButton>
        );
        return withLabel ? btn : <Tooltip key={m} title={LIST_LAYOUT_LABEL[m]}>{btn}</Tooltip>;
      })}
    </ToggleButtonGroup>
  );
}

/**
 * 卡片在列表样式下改横排:卡片(及其子元素)sx 里写 `[LIST_ROW]: {...}`,不用层层传 mode。
 * 例:`{ [LIST_ROW]: { display: 'flex' } }`
 */
export const LIST_ROW = '[data-list-layout="list"] &';
/** 紧凑样式下收小内边距/字号:`{ [LIST_COMPACT]: { p: 1 } }` */
export const LIST_COMPACT = '[data-list-layout="compact"] &';

/** 紧凑样式卡片缩到舒适的这个比例,间距同理 */
const COMPACT_SCALE = 0.72;
const ROWS_COMPACT_SCALE = 0.82;
const ROWS_COMPACT_MIN = 340;

interface Props {
  children: React.ReactNode;
  /** 舒适样式下每列最小宽度(px),紧凑样式自动缩小;列数按容器宽度算,宽屏自动多列 */
  minColumnWidth?: number;
  /** 窄屏也至少保留的列数(海报类卡片用 2) */
  minColumns?: number;
  maxColumns?: number;
  /** 舒适样式的间距(px) */
  gap?: number;
  /**
   * 卡片怎么排:等高卡片用 grid(默认,行对齐);高度不一(帖子、原图比例)用 masonry,
   * 按下标轮流分列,无限滚动追加时已有卡片不挪位置。
   */
  packing?: 'grid' | 'masonry';
  /**
   * 条目本身是横排行(搜索结果、历史、帖子…):紧凑样式只略收窄,且不窄于 340px,
   * 否则标题列被挤到一百多像素、行高翻倍。
   */
  rows?: boolean;
  /** 列表样式的最大宽度,居中;不设则铺满 */
  listMaxWidth?: number | string;
  /** 不跟全局偏好,强制某种样式 */
  mode?: ListLayoutMode;
  sx?: BoxProps['sx'];
}

function columnsFor(width: number, min: number, gap: number, lo: number, hi: number) {
  const n = Math.floor((width + gap) / (min + gap));
  return Math.max(lo, Math.min(hi, n));
}

function keyOf(c: React.ReactNode, i: number) {
  return (c as React.ReactElement)?.key ?? i;
}

/**
 * 按全局偏好渲染内容列表。列数跟着容器宽度走(ResizeObserver),
 * 不跟视口断点走 —— 同一个列表在有/无右侧栏时可用宽度差 300px。
 */
export function ListLayout({
  children,
  minColumnWidth = 260,
  minColumns = 1,
  maxColumns = 10,
  gap = 12,
  packing = 'grid',
  rows = false,
  listMaxWidth = 'var(--page-max-narrow)',
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

  const compact = mode === 'compact';
  const colMin = !compact
    ? minColumnWidth
    : rows
      ? Math.min(minColumnWidth, Math.max(Math.round(minColumnWidth * ROWS_COMPACT_SCALE), ROWS_COMPACT_MIN))
      : Math.round(minColumnWidth * COMPACT_SCALE);
  const g = compact ? Math.max(6, Math.round(gap * 0.6)) : gap;
  const items = React.Children.toArray(children).filter(Boolean);
  const cols = width > 0 ? columnsFor(width, colMin, g, minColumns, maxColumns) : 0;

  let body: React.ReactNode;
  if (mode === 'list') {
    body = (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${g}px`, width: '100%', maxWidth: listMaxWidth, mx: 'auto' }}>
        {items.map((c, i) => <Box key={keyOf(c, i)} sx={{ minWidth: 0 }}>{c}</Box>)}
      </Box>
    );
  } else if (packing === 'masonry' && cols > 0) {
    const buckets: React.ReactNode[][] = Array.from({ length: cols }, () => []);
    items.forEach((c, i) => buckets[i % cols].push(c));
    body = (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: `${g}px` }}>
        {buckets.map((col, ci) => (
          <Box key={ci} sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: `${g}px` }}>
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
          gap: `${g}px`,
          gridTemplateColumns: cols > 0
            ? `repeat(${cols}, minmax(0, 1fr))`
            : `repeat(auto-fill, minmax(min(${colMin}px, 100%), 1fr))`,
          // 同一行卡片等高:单元格里的卡片撑满
          '& > * > *': packing === 'grid' ? { height: '100%', boxSizing: 'border-box' } : undefined,
        }}
      >
        {items.map((c, i) => <Box key={keyOf(c, i)} sx={{ minWidth: 0 }}>{c}</Box>)}
      </Box>
    );
  }

  return (
    <Box ref={ref} data-list-layout={mode} sx={{ width: '100%', minWidth: 0, ...(sx as object) }}>
      {body}
    </Box>
  );
}
