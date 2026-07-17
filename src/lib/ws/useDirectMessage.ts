/**
 * 私信实时收发 Hook
 * 支持 WebSocket 实时推送和 HTTP 轮询降级
 */

'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getWSClient, type WSMessage, type DMPayload } from './client';
import { imClient } from '@/lib/api/client';

// 会话信息
export interface DMSession {
  id: number;
  userId: number;
  nickname: string;
  avatar?: string;
  bio?: string;
  isFollowed: boolean;
  isOfficial: boolean;
  unread: number;
  lastMessage?: string;
  lastMessageType?: 'text' | 'image' | 'audio';
  lastTime?: number;
  pinned: boolean;
  doNotDisturb: boolean;
}

// 私信 Hook 选项
export interface UseDirectMessageOptions {
  /** 启用 WebSocket 实时推送 */
  enabled?: boolean;
  /** WebSocket 未连接时的轮询间隔 (ms) */
  pollInterval?: number;
  /** 新消息到达时的回调 */
  onNewMessage?: (message: DMPayload, session: DMSession) => void;
  /** 新会话创建时的回调 */
  onNewSession?: (session: DMSession) => void;
}

export interface UseDirectMessageReturn {
  /** 会话列表 */
  sessions: DMSession[];
  /** 总未读数 */
  totalUnread: number;
  /** 是否通过 WebSocket 连接 */
  isWSConnected: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 刷新会话列表 */
  refresh: () => Promise<void>;
  /** 标记会话已读 */
  markSessionRead: (sessionId: number) => Promise<void>;
  /** 发送消息 */
  sendMessage: (sessionId: number, content: string, type?: 'text' | 'image' | 'audio') => Promise<DMPayload>;
  /** 发送草稿（不等待服务器响应） */
  sendMessageOptimistic: (sessionId: number, content: string, type?: 'text' | 'image' | 'audio') => DMPayload;
}

/**
 * 获取会话列表
 */
async function fetchSessions(): Promise<DMSession[]> {
  try {
    const resp = await imClient.get<{ list: DMSession[] }>('/msg/session/list');
    // resp.data 是 axios 拦截器包装的 { code, msg, data }
    const list = (resp.data as any)?.data?.list;
    return list ?? [];
  } catch {
    return [];
  }
}

/**
 * 获取消息历史
 */
async function fetchMessages(sessionId: number, page = 1, size = 50): Promise<{ list: DMPayload[]; hasMore: boolean }> {
  try {
    const resp = await imClient.get<{ list: DMPayload[]; hasMore: boolean }>('/msg/message/list', {
      params: { sessionId, page, size },
    });
    const result = (resp.data as any)?.data;
    return result ?? { list: [], hasMore: false };
  } catch {
    return { list: [], hasMore: false };
  }
}

/**
 * 标记会话已读
 */
async function markRead(sessionId: number): Promise<void> {
  await imClient.post('/msg/session/read', { sessionId });
}

/**
 * 发送消息
 */
async function sendDM(sessionId: number, content: string, type: 'text' | 'image' | 'audio' = 'text'): Promise<DMPayload> {
  const resp = await imClient.post<DMPayload>('/msg/message/send', { sessionId, content, type });
  return (resp.data as any)?.data;
}

/**
 * 私信 Hook
 */
export function useDirectMessage(options: UseDirectMessageOptions = {}): UseDirectMessageReturn {
  const {
    enabled = true,
    pollInterval = 30000,
    onNewMessage,
    onNewSession,
  } = options;

  const queryClient = useQueryClient();
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [sessions, setSessions] = useState<DMSession[]>([]);
  const [isWSConnected, setIsWSConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 计算总未读数
  const totalUnread = sessions.reduce((sum, s) => sum + s.unread, 0);

  // 刷新会话列表
  const refresh = useCallback(async () => {
    try {
      const newSessions = await fetchSessions();
      setSessions(newSessions);
      queryClient.setQueryData(['dm', 'sessions'], newSessions);
    } catch (error) {
      console.error('[useDirectMessage] refresh error:', error);
    }
  }, [queryClient]);

  // 标记会话已读
  const markSessionRead = useCallback(async (sessionId: number) => {
    await markRead(sessionId);
    setSessions(prev =>
      prev.map(s =>
        s.id === sessionId ? { ...s, unread: 0 } : s
      )
    );
  }, []);

  // 发送消息
  const sendMessage = useCallback(async (sessionId: number, content: string, type: 'text' | 'image' | 'audio' = 'text') => {
    const message = await sendDM(sessionId, content, type);

    // 更新会话列表
    setSessions(prev => {
      return prev.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            lastMessage: content,
            lastMessageType: type,
            lastTime: message.timestamp,
          };
        }
        return s;
      });
    });

    return message;
  }, []);

  // 乐观发送消息（不等待服务器响应）
  const sendMessageOptimistic = useCallback((sessionId: number, content: string, type: 'text' | 'image' | 'audio' = 'text'): DMPayload => {
    const tempId = -Date.now(); // 临时 ID
    const optimisticMessage: DMPayload = {
      id: tempId,
      sessionId,
      fromUserId: 0, // 自己
      fromNickname: '',
      type,
      content,
      timestamp: Date.now(),
    };

    // 乐观更新
    setSessions(prev => {
      return prev.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            lastMessage: content,
            lastMessageType: type,
            lastTime: optimisticMessage.timestamp,
          };
        }
        return s;
      });
    });

    return optimisticMessage;
  }, []);

  // 初始加载
  useEffect(() => {
    if (!enabled) return;

    const init = async () => {
      setIsLoading(true);
      try {
        const newSessions = await fetchSessions();
        setSessions(newSessions);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [enabled]);

  // WebSocket 连接
  useEffect(() => {
    if (!enabled) return;

    const wsClient = getWSClient();

    // 监听连接状态
    const unsubState = wsClient.onStateChange((state) => {
      setIsWSConnected(state === 'connected');
    });

    // 监听私信消息
    const unsubDM = wsClient.subscribe<DMPayload>('dm', (message: WSMessage<DMPayload>) => {
      const dmMessage = message.payload;
      const session = sessions.find(s => s.id === dmMessage.sessionId);

      if (session) {
        // 更新会话
        setSessions(prev => {
          return prev.map(s => {
            if (s.id === dmMessage.sessionId) {
              return {
                ...s,
                unread: s.unread + 1,
                lastMessage: dmMessage.content,
                lastMessageType: dmMessage.type,
                lastTime: dmMessage.timestamp,
              };
            }
            return s;
          });
        });

        // 触发回调
        onNewMessage?.(dmMessage, session);
      } else {
        // 新会话
        const newSession: DMSession = {
          id: dmMessage.sessionId,
          userId: dmMessage.fromUserId,
          nickname: dmMessage.fromNickname,
          avatar: dmMessage.fromAvatar,
          isFollowed: false,
          isOfficial: false,
          unread: 1,
          lastMessage: dmMessage.content,
          lastMessageType: dmMessage.type,
          lastTime: dmMessage.timestamp,
          pinned: false,
          doNotDisturb: false,
        };

        setSessions(prev => [newSession, ...prev]);
        onNewSession?.(newSession);
      }
    });

    // 启动连接
    wsClient.connect();

    return () => {
      unsubState();
      unsubDM();
    };
  }, [enabled, sessions, onNewMessage, onNewSession]);

  // HTTP 轮询降级
  useEffect(() => {
    if (!enabled || isWSConnected) return;

    refresh();

    pollTimerRef.current = setInterval(refresh, pollInterval);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [enabled, isWSConnected, pollInterval, refresh]);

  return {
    sessions,
    totalUnread,
    isWSConnected,
    isLoading,
    refresh,
    markSessionRead,
    sendMessage,
    sendMessageOptimistic,
  };
}

// 消息历史 Hook
export interface UseDMHistoryOptions {
  sessionId: number;
  enabled?: boolean;
  pageSize?: number;
}

export interface UseDMHistoryReturn {
  messages: DMPayload[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  prependMessage: (message: DMPayload) => void;
}

export function useDMHistory(options: UseDMHistoryOptions): UseDMHistoryReturn {
  const { sessionId, enabled = true, pageSize = 50 } = options;

  const [messages, setMessages] = useState<DMPayload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  // 初始加载
  useEffect(() => {
    if (!enabled || !sessionId) return;

    const init = async () => {
      setIsLoading(true);
      try {
        const { list, hasMore: more } = await fetchMessages(sessionId, 1, pageSize);
        setMessages(list);
        setHasMore(more);
        setPage(1);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [enabled, sessionId, pageSize]);

  // 加载更多
  const loadMore = useCallback(async () => {
    if (!hasMore || !sessionId) return;

    try {
      const nextPage = page + 1;
      const { list, hasMore: more } = await fetchMessages(sessionId, nextPage, pageSize);
      setMessages(prev => [...prev, ...list]);
      setHasMore(more);
      setPage(nextPage);
    } catch (error) {
      console.error('[useDMHistory] loadMore error:', error);
    }
  }, [hasMore, sessionId, page, pageSize]);

  // 前置消息（发送消息后调用）
  const prependMessage = useCallback((message: DMPayload) => {
    setMessages(prev => [message, ...prev]);
  }, []);

  return {
    messages,
    isLoading,
    hasMore,
    loadMore,
    prependMessage,
  };
}
