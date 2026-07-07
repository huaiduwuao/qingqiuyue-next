'use client';

import { useEffect, useState } from 'react';

/**
 * 渲染相对时间字符串(例如 "35 分钟前" / "2 小时后"),只使用 ts 作为输入。
 *
 * 实现要点:
 * 1. SSR 阶段不计算 Date.now() —— 用 fallback(默认空字符串),避免 server/client 时间不同
 *    引发的 React hydration mismatch("35 分钟前" vs "45 分钟前")。
 * 2. 客户端 mount 后才计算并 setState,触发二次渲染替换成真实相对时间。
 * 3. 每分钟刷一次,让用户能继续看到 "X 分钟前" 数字变化(可选,可关)。
 */
export interface RelativeTimeProps {
  /** Unix 毫秒时间戳 */
  ts: number | string | null | undefined;
  /** SSR 阶段 placeholder,默认空字符串,传 '—' 避免布局抖动 */
  fallback?: string;
  /** 是否显示"刚刚" / "X 分钟后" / "X 小时后" 未来时间形态;默认 false 只显示过去 */
  showFuture?: boolean;
  /** 是否每分钟自动刷新;默认 true */
  autoRefresh?: boolean;
  className?: string;
}

function compute(ts: number, showFuture: boolean): string {
  const diff = Date.now() - ts;
  const abs = Math.abs(diff);
  const isPast = diff > 0;
  const m = Math.floor(abs / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) {
    if (showFuture) return isPast ? `${m} 分钟前` : `${m} 分钟后`;
    return `${m} 分钟前`;
  }
  const h = Math.floor(m / 60);
  if (h < 24) {
    if (showFuture) return isPast ? `${h} 小时前` : `${h} 小时后`;
    return `${h} 小时前`;
  }
  const d = Math.floor(h / 24);
  if (showFuture) return isPast ? `${d} 天前` : `${d} 天后`;
  return `${d} 天前`;
}

export function RelativeTime({
  ts,
  fallback = '',
  showFuture = false,
  autoRefresh = true,
  className,
}: RelativeTimeProps) {
  const [label, setLabel] = useState<string>(fallback);

  useEffect(() => {
    if (ts == null) return;
    const numTs = typeof ts === 'string' ? Number(ts) : ts;
    if (!Number.isFinite(numTs)) return;

    const tick = () => setLabel(compute(numTs, showFuture));
    tick();

    if (!autoRefresh) return;
    // 30s 刷新一次,够细且开销低
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [ts, showFuture, autoRefresh]);

  if (ts == null) return null;
  return <span className={className}>{label}</span>;
}

export default RelativeTime;
