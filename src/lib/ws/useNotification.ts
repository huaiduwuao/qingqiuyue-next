/**
 * 通知推送 Hook
 * 支持 WebSocket 实时推送和 HTTP 轮询降级
 */

'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getWSClient, type WSMessage, type NotificationPayload } from './client';
import { adminClient } from '@/lib/api/client';

// 通知未读数
interface NoticeCount {
  notification: number;
  message: number;
  event: number;
  total: number;
}

// 通知 Hook 返回类型
export interface UseNotificationOptions {
  /** 启用 WebSocket 实时推送 */
  enabled?: boolean;
  /** WebSocket 未连接时的轮询间隔 (ms) */
  pollInterval?: number;
  /** 新通知到达时的回调 */
  onNewNotification?: (notification: NotificationPayload) => void;
}

export interface UseNotificationReturn {
  /** 通知未读数 */
  counts: NoticeCount;
  /** 是否通过 WebSocket 连接 */
  isWSConnected: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 刷新未读数 */
  refresh: () => Promise<void>;
  /** 标记全部已读 */
  markAllRead: () => Promise<void>;
  /** 标记单条已读 */
  markRead: (id: number) => Promise<void>;
  /** 通知列表 */
  notifications: NotificationPayload[];
  /** 标记加载更多 */
  loadMore: () => Promise<void>;
  /** 是否有更多 */
  hasMore: boolean;
}

/**
 * 获取通知未读数
 */
async function fetchNoticeCount(): Promise<NoticeCount> {
  try {
    const resp = await adminClient.get<NoticeCount>('/notice/count');
    // resp.data 是 axios 拦截器包装的 { code, msg, data }
    // data.data 才是实际的 NoticeCount
    const count = (resp.data as any)?.data;
    return count ?? { notification: 0, message: 0, event: 0, total: 0 };
  } catch {
    return { notification: 0, message: 0, event: 0, total: 0 };
  }
}

/**
 * 获取通知列表
 */
async function fetchNotifications(page = 1, size = 20): Promise<{ list: NotificationPayload[]; total: number }> {
  try {
    const resp = await adminClient.get<{ list: NotificationPayload[]; total: number }>('/notice/list', {
      params: { page, size },
    });
    // resp.data 是 axios 拦截器包装的 { code, msg, data }
    const result = (resp.data as any)?.data;
    return result ?? { list: [], total: 0 };
  } catch {
    return { list: [], total: 0 };
  }
}

/**
 * 标记已读
 */
async function markNoticeRead(id?: number): Promise<void> {
  if (id) {
    await adminClient.post(`/notice/interaction/read/${id}`);
  }
}

/**
 * 标记全部已读
 */
async function markAllNoticeRead(): Promise<void> {
  await adminClient.post('/notice/interaction/readAll');
}

/**
 * 通知推送 Hook
 */
export function useNotification(options: UseNotificationOptions = {}): UseNotificationReturn {
  const {
    enabled = true,
    pollInterval = 60000,
    onNewNotification,
  } = options;

  const queryClient = useQueryClient();
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isWSConnected, setIsWSConnected] = useState(false);
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [counts, setCounts] = useState<NoticeCount>({ notification: 0, message: 0, event: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const pageRef = useRef(1);

  // 刷新未读数
  const refresh = useCallback(async () => {
    try {
      const newCounts = await fetchNoticeCount();
      setCounts(newCounts);
      queryClient.setQueryData(['notice', 'count'], newCounts);
    } catch (error) {
      console.error('[useNotification] refresh error:', error);
    }
  }, [queryClient]);

  // 加载通知列表
  const loadMore = useCallback(async () => {
    if (!hasMore) return;
    try {
      const { list, total } = await fetchNotifications(pageRef.current + 1, 20);
      if (list.length > 0) {
        pageRef.current += 1;
        setNotifications(prev => [...prev, ...list]);
        setHasMore(notifications.length + list.length < total);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('[useNotification] loadMore error:', error);
    }
  }, [hasMore, notifications.length]);

  // 初始加载
  useEffect(() => {
    if (!enabled) return;

    const init = async () => {
      setIsLoading(true);
      try {
        const [newCounts, { list }] = await Promise.all([
          fetchNoticeCount(),
          fetchNotifications(1, 20),
        ]);
        setCounts(newCounts);
        setNotifications(list);
        setHasMore(list.length < 20);
        pageRef.current = 1;
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [enabled]);

  // 标记已读
  const markRead = useCallback(async (id: number) => {
    await markNoticeRead(id);
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, status: 'read' as const } : n)
    );
    await refresh();
  }, [refresh]);

  // 标记全部已读
  const markAllRead = useCallback(async () => {
    await markAllNoticeRead();
    setNotifications(prev => prev.map(n => ({ ...n, status: 'read' as const })));
    await refresh();
  }, [refresh]);

  // WebSocket 连接
  useEffect(() => {
    if (!enabled) return;

    const wsClient = getWSClient();

    // 监听连接状态
    const unsubState = wsClient.onStateChange((state) => {
      setIsWSConnected(state === 'connected');
    });

    // 监听通知消息
    const unsubNotification = wsClient.subscribe<NotificationPayload>('notification', (message: WSMessage<NotificationPayload>) => {
      const notification = message.payload;

      // 更新未读数
      setCounts(prev => ({
        ...prev,
        notification: prev.notification + 1,
        total: prev.total + 1,
      }));

      // 插入到列表头部
      setNotifications(prev => [notification, ...prev]);

      // 触发回调
      onNewNotification?.(notification);
    });

    // 启动连接
    wsClient.connect();

    return () => {
      unsubState();
      unsubNotification();
    };
  }, [enabled, onNewNotification]);

  // HTTP 轮询降级（WebSocket 未连接时）
  useEffect(() => {
    if (!enabled || isWSConnected) return;

    // 立即执行一次
    refresh();

    // 设置轮询
    pollTimerRef.current = setInterval(refresh, pollInterval);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [enabled, isWSConnected, pollInterval, refresh]);

  return {
    counts,
    isWSConnected,
    isLoading,
    refresh,
    markAllRead,
    markRead,
    notifications,
    loadMore,
    hasMore,
  };
}
