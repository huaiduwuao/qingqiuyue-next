'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { CrawlProgress } from '@/beans/spider';
import { spiderClient } from '@/lib/api/client';

export interface SpiderHealth {
  status: 'healthy' | 'unhealthy';
  engines: number;
  timestamp: number;
  uptime?: number;
}

export interface SpiderStats {
  runningEngines: number;
  totalPages: number;
  totalLinks: number;
  totalItems: number;
}

export interface CrawlTaskFromWS {
  id: string;
  source_id?: number;
  source_name?: string;
  start_url?: string;
  status?: string;
  type?: string;
  max_depth?: number;
  max_pages?: number;
  pages_crawled?: number;
  links_found?: number;
  items_saved?: number;
  error_msg?: string;
  created_at?: string;
  updated_at?: string;
  // 单条 task 推送用 camelCase
  pagesCrawled?: number;
  linksFound?: number;
  itemsSaved?: number;
  errorMsg?: string;
  progress?: CrawlProgress;
}

export interface SpiderWSState {
  health?: SpiderHealth;
  stats?: SpiderStats;
  tasks: CrawlTaskFromWS[];
  connected: boolean;
  error?: Event;
  revision: number;
}

interface WSMessage {
  type: 'health' | 'stats' | 'task' | 'tasks';
  payload: any;
  ts: number;
}

/**
 * 换一张 spider WS 的一次性票(60 秒、用过即失效)。
 * 浏览器的 WebSocket 握手带不了 Authorization 头,凭据只能进 URL;session 进 URL 会落进
 * 网关日志,所以先凭会话 POST /api/spider/ws/ticket 换票。响应已被 client 拆掉信封:
 * 一般是 { ticket },也兼容直接给字符串。
 */
async function fetchSpiderTicket(): Promise<string> {
  const data = (await spiderClient('/ws/ticket', { method: 'POST' })) as { ticket?: string } | string | undefined;
  const ticket = typeof data === 'string' ? data : data?.ticket;
  if (!ticket) throw new Error('no spider ws ticket');
  return ticket;
}

function buildWsUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  // dev 模式: NEXT_PUBLIC_WS_BASE 直连后端(Next.js rewrites 不支持 WS 升级)
  // 生产环境: 相对路径, 经 nginx/APISIX 代理(enable_websocket: true)
  const devBase = process.env.NEXT_PUBLIC_WS_BASE || '';
  if (devBase) {
    return `${devBase}/ws/spider`;
  }
  // 统一到 /ws/spider
  return '/ws/spider';
}

export function useSpiderWebSocket(): SpiderWSState {
  const [state, setState] = useState<SpiderWSState>({
    tasks: [],
    connected: false,
    revision: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(2000);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const unmountedRef = useRef(false);
  // 上限重连次数,达到后停止。避免 WS 永远失败时反复重连耗尽 socket buffer
  // (ERR_NO_BUFFER_SPACE) 和浏览器连接池。
  const MAX_RECONNECT_ATTEMPTS = 5;
  // 重连定时器通过 ref 调 connect:回调里直接引用自身会读到声明前的值
  const connectRef = useRef<() => void>(() => {});
  // 建连代次:换票是异步的,StrictMode 挂载→卸载→再挂载时,前一次 connect 拿到票回来
  // 不能再建一条连接。每次 connect / 卸载都 +1,换票回来代次不对就作罢。
  const genRef = useRef(0);

  const scheduleReconnect = useCallback(() => {
    if (unmountedRef.current) return;
    // 达到重连上限,停止。浏览器 socket buffer 耗尽时(ERR_NO_BUFFER_SPACE)
    // 反复重连只会让情况更糟。给用户/操作员机会介入。
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn(
        `[useSpiderWebSocket] WS reconnect 达上限 (${MAX_RECONNECT_ATTEMPTS} 次),停止重连。请检查 APISIX 路由与 spider-api 容器状态。`,
      );
      return;
    }
    reconnectAttemptsRef.current += 1;

    const delay = Math.min(reconnectDelayRef.current, 30000);
    reconnectDelayRef.current = reconnectDelayRef.current * 1.5;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    reconnectTimerRef.current = setTimeout(() => {
      connectRef.current();
    }, delay);
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || unmountedRef.current) {
      return;
    }

    const url = buildWsUrl();
    if (!url) return;

    const gen = ++genRef.current;
    // 每次建连(含重连)都换一张新票
    let ticket: string;
    try {
      ticket = await fetchSpiderTicket();
    } catch {
      if (gen === genRef.current) scheduleReconnect();
      return;
    }
    if (gen !== genRef.current || unmountedRef.current) return;

    try {
      const ws = new WebSocket(`${url}?ticket=${encodeURIComponent(ticket)}`);
      wsRef.current = ws;
      // 只处理「当前这条」连接的事件。StrictMode 下挂载→卸载→再挂载,旧连接的 onclose
      // 是异步到的:不拦的话会把新连接的 wsRef 清空,还按断线再连一条,变成两条并存。
      const stale = () => wsRef.current !== ws;

      ws.onopen = () => {
        if (stale()) return;
        reconnectDelayRef.current = 2000;
        reconnectAttemptsRef.current = 0;
        setState((prev) => ({ ...prev, connected: true, error: undefined }));
      };

      ws.onmessage = (event) => {
        if (stale()) return;
        try {
          const msg: WSMessage = JSON.parse(event.data);

          setState((prev) => {
            const next = { ...prev };

            if (msg.type === 'health') {
              next.health = msg.payload as SpiderHealth;
            } else if (msg.type === 'stats') {
              next.stats = msg.payload as SpiderStats;
            } else if (msg.type === 'tasks') {
              next.tasks = Array.isArray(msg.payload?.list) ? msg.payload.list : [];
              next.revision = prev.revision + 1;
            } else if (msg.type === 'task') {
              const updated: CrawlTaskFromWS = msg.payload;
              const exists = prev.tasks.find((t) => t.id === updated.id);
              if (updated.status === 'deleted') {
                next.tasks = prev.tasks.filter((t) => t.id !== updated.id);
              } else if (exists) {
                next.tasks = prev.tasks.map((t) => (t.id === updated.id ? { ...t, ...updated } : t));
              } else {
                next.tasks = [...prev.tasks, updated];
              }
              next.revision = prev.revision + 1;
            }

            return next;
          });
        } catch {
          // ignore malformed message
        }
      };

      ws.onerror = (event) => {
        if (stale()) return;
        setState((prev) => ({ ...prev, error: event }));
      };

      ws.onclose = () => {
        if (stale()) return;
        wsRef.current = null;
        setState((prev) => ({ ...prev, connected: false }));
        scheduleReconnect();
      };
    } catch {
      // ignore connection errors; reconnect loop handles it
    }
  }, [scheduleReconnect]);

  useEffect(() => {
    connectRef.current = () => void connect();
  }, [connect]);

  useEffect(() => {
    unmountedRef.current = false;
    void connect();

    return () => {
      unmountedRef.current = true;
      genRef.current += 1;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return state;
}
