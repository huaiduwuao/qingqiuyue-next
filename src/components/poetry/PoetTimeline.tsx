'use client';

// PoetTimeline —— 诗人生平时间线(兼容壳)。
//
// 该组件原本是单一形态实现;现在转发到通用 Timeline 组件
// (components/detail/Timeline.tsx),保留 PoetTimelineItem 接口以免破坏现有调用方。
// 后续可以从 import 路径直接切到 Timeline,删除此兼容层。

import * as React from 'react';
import { Timeline, type TimelineItem } from '@/components/detail/Timeline';

export interface PoetTimelineItem {
  year: number;
  event: string;
}

export interface PoetTimelineProps {
  items: PoetTimelineItem[] | undefined;
}

function PoetTimeline({ items }: PoetTimelineProps) {
  const adapted: TimelineItem[] | undefined = items?.map((i) => ({
    year: i.year,
    title: i.event,
  }));
  return (
    <Timeline
      items={adapted}
      sourceLabel={`数据源:中文维基百科 · 共 ${items?.length ?? 0} 条`}
    />
  );
}

export default PoetTimeline;