'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { realtime, type RealtimeEvent, type RealtimeStatus } from './client';

export { realtime } from './client';
export type {
  RealtimeEvent,
  RealtimeEventType,
  RealtimeStatus,
  DMEventData,
  NoticeEventData,
  KfEventData,
} from './client';

/**
 * 订阅实时事件。
 *
 * handler 存在 ref 里,所以组件每次渲染换一个新闭包也不会重新建订阅 ——
 * 否则依赖数组里放一个内联函数就等于每渲染一次断连重连一次。
 */
export function useRealtimeEvent(handler: (ev: RealtimeEvent) => void, enabled = true) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  }, [handler]);
  const stable = useCallback((ev: RealtimeEvent) => ref.current(ev), []);
  useEffect(() => {
    if (!enabled) return;
    return realtime.subscribe(stable);
  }, [enabled, stable]);
}

/** 当前连接状态。组件据此决定要不要开降级轮询。 */
export function useRealtimeStatus(): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>(() => realtime.getStatus());
  useEffect(() => realtime.onStatus(setStatus), []);
  return status;
}

/**
 * 推送不可用时的兜底轮询间隔。
 *
 * 连上了就返回 false(react-query 的 refetchInterval 认这个值为「不轮询」),
 * 断开时才用传入的间隔 —— 组件里到处写 `refetchInterval: 5000` 的日子到此为止。
 */
export function usePollFallback(ms: number): number | false {
  const status = useRealtimeStatus();
  return status === 'open' ? false : ms;
}
