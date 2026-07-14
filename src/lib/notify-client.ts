import React from 'react';

// WebSocket 实时通知客户端
// 用于连接后端的 wsnotify 服务

export type NotifyType =
  | 'tip'           // 打赏
  | 'review'        // 审核结果
  | 'message'        // 新消息
  | 'subscription'   // 订阅
  | 'achievement'   // 成就
  | 'system'        // 系统
  | 'reward';       // 奖励

export interface NotifyMessage {
  type: NotifyType;
  title: string;
  content: string;
  data?: Record<string, any>;
  timestamp: number;
}

type NotifyHandler = (msg: NotifyMessage) => void;

class NotifyClient {
  private ws: WebSocket | null = null;
  private url: string = '';
  private handlers: Map<NotifyType, Set<NotifyHandler>> = new Map();
  private globalHandlers: Set<NotifyHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private isConnecting = false;

  // 获取 WebSocket URL
  private getWebSocketUrl(): string {
    if (typeof window === 'undefined') return '';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_WS_URL || window.location.host;
    return `${protocol}//${host}/api/ws/notify`;
  }

  // 连接
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        resolve();
        return;
      }

      this.isConnecting = true;
      this.url = this.getWebSocketUrl();

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[Notify] WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startPing();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg: NotifyMessage = JSON.parse(event.data);
            this.dispatch(msg);
          } catch (e) {
            console.error('[Notify] Failed to parse message:', e);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[Notify] WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[Notify] WebSocket closed');
          this.isConnecting = false;
          this.stopPing();
          this.reconnect();
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  // 断开连接
  disconnect() {
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // 阻止重连
  }

  // 重新连接
  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[Notify] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[Notify] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(console.error);
    }, delay);
  }

  // 心跳
  private startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // 分发消息
  private dispatch(msg: NotifyMessage) {
    // 全局处理器
    this.globalHandlers.forEach(handler => {
      try {
        handler(msg);
      } catch (e) {
        console.error('[Notify] Handler error:', e);
      }
    });

    // 类型处理器
    const typeHandlers = this.handlers.get(msg.type);
    if (typeHandlers) {
      typeHandlers.forEach(handler => {
        try {
          handler(msg);
        } catch (e) {
          console.error('[Notify] Handler error:', e);
        }
      });
    }
  }

  // 订阅消息
  on(type: NotifyType, handler: NotifyHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    // 返回取消订阅函数
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  // 订阅所有消息
  onAll(handler: NotifyHandler): () => void {
    this.globalHandlers.add(handler);
    return () => {
      this.globalHandlers.delete(handler);
    };
  }

  // 发送消息
  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  // 连接状态
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// 单例
let notifyClient: NotifyClient | null = null;

export function getNotifyClient(): NotifyClient {
  if (!notifyClient) {
    notifyClient = new NotifyClient();
  }
  return notifyClient;
}

// React Hook
export function useNotify() {
  const [lastMessage, setLastMessage] = React.useState<NotifyMessage | null>(null);

  React.useEffect(() => {
    const client = getNotifyClient();

    // 自动连接
    client.connect().catch(console.error);

    // 订阅所有消息
    const unsubscribe = client.onAll((msg) => {
      setLastMessage(msg);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    lastMessage,
    on: getNotifyClient().on.bind(getNotifyClient()),
    onAll: getNotifyClient().onAll.bind(getNotifyClient()),
    connect: () => getNotifyClient().connect(),
    disconnect: () => getNotifyClient().disconnect(),
    isConnected: getNotifyClient().isConnected,
  };
}
