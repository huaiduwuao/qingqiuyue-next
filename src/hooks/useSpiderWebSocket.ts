'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

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
  created_at?: string;
  updated_at?: string;
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

function buildWsUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  // dev 模式: NEXT_PUBLIC_WS_BASE 直连后端(Next.js rewrites 不支持 WS 升级)
  // 生产环境: 相对路径, 经 nginx/APISIX 代理(enable_websocket: true)
  const devBase = process.env.NEXT_PUBLIC_WS_BASE || '';
  if (devBase) {
    return `${devBase}/api/spider/ws`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/spider/ws`;
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

  const connect = useCallback(() => {
    if (typeof window === 'undefined' || unmountedRef.current) {
      return;
    }

    const url = buildWsUrl();
    if (!url) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectDelayRef.current = 2000;
        reconnectAttemptsRef.current = 0;
        setState((prev) => ({ ...prev, connected: true, error: undefined }));
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          const now = Date.now();

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
        } catch (err) {
          // ignore malformed message
        }
      };

      ws.onerror = (event) => {
        setState((prev) => ({ ...prev, error: event }));
      };

      ws.onclose = () => {
        wsRef.current = null;
        setState((prev) => ({ ...prev, connected: false }));

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
          connect();
        }, delay);
      };
    } catch (err) {
      // ignore connection errors; reconnect loop handles it
    }
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
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
