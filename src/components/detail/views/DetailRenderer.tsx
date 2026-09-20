'use client';

import * as React from 'react';
import { NewsView } from './NewsView';
import { HistoryFigureView } from './HistoryFigureView';
import { HistoryEventView } from './HistoryEventView';
import { DefaultView } from './DefaultView';

interface Props {
  /** 内容数据。DetailLayout 已经 await 过 */
  data: any;
  /** subcategory.code,如 'history.figure' */
  sub?: string;
}

/**
 * DetailRenderer — 按 subcategory_code 派发 View。
 *
 * 注册规则:subcategory_code 首段('history'/'automotive'/'poetry')派发到对应桶,
 * 二段('figure'/'event')决定 View。匹配失败走 DefaultView。
 *
 * 新增专题流程:
 *   1. SQL seed 加 subcategory 行 + content_source 行
 *   2. 新建 components/detail/views/<Family>View.tsx
 *   3. 在本文件 switch 中加 case
 */
export function DetailRenderer({ data, sub }: Props) {
  const [family, variant] = (sub || '').split('.');
  switch (family) {
    case 'history':
      return variant === 'event' ? (
        <HistoryEventView data={data} />
      ) : (
        <HistoryFigureView data={data} />
      );
    case 'automotive':
      return <DefaultView data={data} />; // Phase 2 单独建 AutomotiveView
    default:
      return <NewsView data={data} />; // default 同今天 news-detail 体例
  }
}

export default DetailRenderer;