/**
 * 直播实时数据 Hook
 * 支持 WebSocket 实时推送直播在线人数、热度榜单等
 */

'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { getWSClient, type WSMessage, type LiveStatsPayload } from './client';

// 直播间信息
export interface LiveRoom {
  id: number;
  hostId: number;
  hostName: string;
  hostAvatar?: string;
  title: string;
  cover: string;
  viewers: number;
  likes: number;
  category: string;
  region: string;
  startedAt: number;
  isLive: boolean;
  isTop: boolean;
  hotRank?: number;
}

// 直播榜单项
export interface LiveRankingItem {
  roomId: number;
  rank: number;
  title: string;
  hostName: string;
  hostAvatar?: string;
  viewers: number;
  hotRank: number;
  cover: string;
}

// 直播数据 Hook 选项
export interface UseLiveStatsOptions {
  /** 房间 ID，为空则订阅所有房间更新 */
  roomId?: number;
  /** 启用 WebSocket 实时推送 */
  enabled?: boolean;
  /** WebSocket 未连接时的轮询间隔 (ms) */
  pollInterval?: number;
  /** 房间数据更新回调 */
  onRoomUpdate?: (room: Partial<LiveRoom>) => void;
  /** 热度变化回调 */
  onHotRankChange?: (roomId: number, newRank: number, oldRank: number) => void;
}

export interface UseLiveStatsReturn {
  /** 房间实时数据 */
  rooms: Map<number, LiveRoom>;
  /** 获取单个房间数据 */
  getRoom: (roomId: number) => LiveRoom | undefined;
  /** 更新单个房间数据 */
  updateRoom: (roomId: number, data: Partial<LiveRoom>) => void;
  /** 是否通过 WebSocket 连接 */
  isWSConnected: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 刷新数据 */
  refresh: () => Promise<void>;
}

// 榜单 Hook 选项
export interface UseLiveRankingOptions {
  /** 榜单类型 */
  type?: 'viewers' | 'likes' | 'hot';
  /** 榜单数量 */
  limit?: number;
  /** 启用 WebSocket 实时推送 */
  enabled?: boolean;
  /** WebSocket 未连接时的轮询间隔 */
  pollInterval?: number;
  /** 排名变化回调 */
  onRankChange?: (item: LiveRankingItem, oldRank: number, newRank: number) => void;
}

export interface UseLiveRankingReturn {
  /** 榜单数据 */
  rankings: LiveRankingItem[];
  /** 是否通过 WebSocket 连接 */
  isWSConnected: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 刷新榜单 */
  refresh: () => Promise<void>;
}

/**
 * 直播数据 Hook
 */
export function useLiveStats(options: UseLiveStatsOptions = {}): UseLiveStatsReturn {
  const {
    roomId,
    enabled = true,
    pollInterval = 30000,
    onRoomUpdate,
    onHotRankChange,
  } = options;

  const [rooms, setRooms] = useState<Map<number, LiveRoom>>(new Map());
  const [isWSConnected, setIsWSConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roomsRef = useRef(rooms);

  // 保持 roomsRef 同步
  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  // 获取单个房间数据
  const getRoom = useCallback((id: number): LiveRoom | undefined => {
    return rooms.get(id);
  }, [rooms]);

  // 更新单个房间数据
  const updateRoom = useCallback((id: number, data: Partial<LiveRoom>) => {
    setRooms(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(id);
      if (existing) {
        const oldRank = existing.hotRank;
        const newRoom = { ...existing, ...data };
        newMap.set(id, newRoom);

        // 触发热度变化回调
        if (data.hotRank !== undefined && oldRank !== data.hotRank && onHotRankChange) {
          onHotRankChange(id, data.hotRank, oldRank ?? 0);
        }

        return newMap;
      }
      return prev;
    });
  }, [onHotRankChange]);

  // 刷新数据（通过 HTTP）
  const refresh = useCallback(async () => {
    // 如果有 roomId，获取单个房间
    if (roomId) {
      try {
        const resp = await fetch(`/api/live/room/${roomId}`);
        if (resp.ok) {
          const data = await resp.json();
          setRooms(prev => {
            const newMap = new Map(prev);
            newMap.set(roomId, data);
            return newMap;
          });
        }
      } catch (error) {
        console.error('[useLiveStats] refresh error:', error);
      }
    }
  }, [roomId]);

  // 初始加载
  useEffect(() => {
    if (!enabled) return;
    setIsLoading(false);
  }, [enabled]);

  // WebSocket 连接
  useEffect(() => {
    if (!enabled) return;

    const wsClient = getWSClient();

    // 监听连接状态
    const unsubState = wsClient.onStateChange((state) => {
      setIsWSConnected(state === 'connected');
    });

    // 监听直播数据更新
    const unsubLive = wsClient.subscribe<LiveStatsPayload>('live_stats', (message: WSMessage<LiveStatsPayload>) => {
      const { roomId: updateRoomId, viewers, likes, hotRank } = message.payload;

      // 如果指定了 roomId，只处理对应的更新
      if (roomId && updateRoomId !== roomId) return;

      setRooms(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(updateRoomId);

        if (existing) {
          const updates: Partial<LiveRoom> = {};
          if (viewers !== undefined) updates.viewers = viewers;
          if (likes !== undefined) updates.likes = likes;
          if (hotRank !== undefined) updates.hotRank = hotRank;

          const oldRank = existing.hotRank;
          const newRoom = { ...existing, ...updates };
          newMap.set(updateRoomId, newRoom);

          // 触发回调
          onRoomUpdate?.(updates);
          if (hotRank !== undefined && oldRank !== hotRank && onHotRankChange) {
            onHotRankChange(updateRoomId, hotRank, oldRank ?? 0);
          }

          return newMap;
        }

        return prev;
      });
    });

    // 启动连接
    wsClient.connect();

    return () => {
      unsubState();
      unsubLive();
    };
  }, [enabled, roomId, onRoomUpdate, onHotRankChange]);

  // HTTP 轮询降级
  useEffect(() => {
    if (!enabled || isWSConnected || !roomId) return;

    refresh();

    pollTimerRef.current = setInterval(refresh, pollInterval);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [enabled, isWSConnected, roomId, pollInterval, refresh]);

  return {
    rooms,
    getRoom,
    updateRoom,
    isWSConnected,
    isLoading,
    refresh,
  };
}

/**
 * 直播榜单 Hook
 */
export function useLiveRanking(options: UseLiveRankingOptions = {}): UseLiveRankingReturn {
  const {
    type = 'hot',
    limit = 10,
    enabled = true,
    pollInterval = 60000,
    onRankChange,
  } = options;

  const [rankings, setRankings] = useState<LiveRankingItem[]>([]);
  const [isWSConnected, setIsWSConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rankingsRef = useRef(rankings);

  useEffect(() => {
    rankingsRef.current = rankings;
  }, [rankings]);

  // 刷新榜单
  const refresh = useCallback(async () => {
    try {
      const resp = await fetch(`/api/live/ranking?type=${type}&limit=${limit}`);
      if (resp.ok) {
        const data = await resp.json();
        setRankings(data);
      }
    } catch (error) {
      console.error('[useLiveRanking] refresh error:', error);
    }
  }, [type, limit]);

  // 初始加载
  useEffect(() => {
    if (!enabled) return;

    const init = async () => {
      setIsLoading(true);
      try {
        await refresh();
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [enabled, refresh]);

  // WebSocket 连接
  useEffect(() => {
    if (!enabled) return;

    const wsClient = getWSClient();

    // 监听连接状态
    const unsubState = wsClient.onStateChange((state) => {
      setIsWSConnected(state === 'connected');
    });

    // 监听直播数据更新（用于更新榜单）
    const unsubLive = wsClient.subscribe<LiveStatsPayload>('live_stats', (message: WSMessage<LiveStatsPayload>) => {
      const { roomId, hotRank } = message.payload;

      if (hotRank === undefined) return;

      setRankings(prev => {
        const oldRankings = [...prev];
        const itemIndex = oldRankings.findIndex(item => item.roomId === roomId);

        if (itemIndex >= 0) {
          // 更新现有项
          const newRankings = oldRankings.map(item => {
            if (item.roomId === roomId) {
              return { ...item, hotRank };
            }
            return item;
          });

          // 按热度重新排序
          newRankings.sort((a, b) => a.hotRank - b.hotRank);

          // 更新 rank 字段
          const finalRankings = newRankings.map((item, index) => ({
            ...item,
            rank: index + 1,
          }));

          // 检查排名变化
          const oldItem = oldRankings[itemIndex];
          const newItem = finalRankings[itemIndex];

          if (oldItem.rank !== newItem.rank) {
            onRankChange?.(newItem, oldItem.rank, newItem.rank);
          }

          return finalRankings;
        }

        // 如果有新的高热度数据，可以考虑插入
        return oldRankings;
      });
    });

    // 启动连接
    wsClient.connect();

    return () => {
      unsubState();
      unsubLive();
    };
  }, [enabled, onRankChange]);

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
    rankings,
    isWSConnected,
    isLoading,
    refresh,
  };
}

/**
 * 通用实时数据 Hook
 * 可用于任何需要 WebSocket 更新的场景
 */
export interface UseRealtimeOptions<T> {
  /** 初始数据 */
  initialData?: T;
  /** 消息类型 */
  messageType: string;
  /** 启用 WebSocket */
  enabled?: boolean;
  /** 初始加载函数 */
  loadFn?: () => Promise<T>;
  /** 数据更新回调 */
  onUpdate?: (data: T, message: WSMessage) => void;
}

export interface UseRealtimeReturn<T> {
  /** 实时数据 */
  data: T | undefined;
  /** 是否通过 WebSocket 连接 */
  isWSConnected: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 刷新数据 */
  refresh: () => Promise<void>;
  /** 更新数据 */
  setData: React.Dispatch<React.SetStateAction<T | undefined>>;
}

export function useRealtime<T>(options: UseRealtimeOptions<T>): UseRealtimeReturn<T> {
  const {
    initialData,
    messageType,
    enabled = true,
    loadFn,
    onUpdate,
  } = options;

  const [data, setData] = useState<T | undefined>(initialData);
  const [isWSConnected, setIsWSConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(!!loadFn);
  const dataRef = useRef(data);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // 刷新数据
  const refresh = useCallback(async () => {
    if (!loadFn) return;

    setIsLoading(true);
    try {
      const newData = await loadFn();
      setData(newData);
    } catch (error) {
      console.error('[useRealtime] refresh error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadFn]);

  // 初始加载
  useEffect(() => {
    if (!enabled || !loadFn) return;
    refresh();
  }, [enabled, loadFn, refresh]);

  // WebSocket 连接
  useEffect(() => {
    if (!enabled) return;

    const wsClient = getWSClient();

    const unsubState = wsClient.onStateChange((state) => {
      setIsWSConnected(state === 'connected');
    });

    const unsub = wsClient.subscribe(messageType as any, (message: WSMessage) => {
      const currentData = dataRef.current;
      if (currentData !== undefined) {
        onUpdate?.(currentData, message);
      }
    });

    wsClient.connect();

    return () => {
      unsubState();
      unsub();
    };
  }, [enabled, messageType, onUpdate]);

  return {
    data,
    isWSConnected,
    isLoading,
    refresh,
    setData,
  };
}
