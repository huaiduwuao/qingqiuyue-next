/**
 * 统一 WebSocket 客户端
 * 支持多路复用，心跳重连、自动降级、权限验证
 * 统一 WebSocket 网关: ws(s)://host/ws/gateway
 */

// 获取认证 token（优先 session_id）
function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    // 优先使用 session_id
    const sessionId = localStorage.getItem('session_id');
    if (sessionId) return sessionId;
    // 兼容旧的 token
    const token = localStorage.getItem('token');
    if (token) return token;
  }
  return null;
}

// WebSocket 消息类型
export type WSMessageType =
  | 'notification'   // 通知消息
  | 'dm'            // 私信消息
  | 'live_stats'    // 直播数据
  | 'crawl_progress' // 爬虫进度
  | 'avatar'        // 数字人
  | 'system'        // 系统消息
  | 'ping'          // 心跳
  | 'pong'          // 心跳响应
  | 'connected';     // 连接成功

// Channel 常量（与后端 wsgateway 一致）
export const WSChannel = {
  AVATAR: 'avatar',
  SPIDER: 'spider',
  NOTIFY: 'notify',
} as const;
export type WSChannel = typeof WSChannel[keyof typeof WSChannel];

// 通用消息格式
export interface WSMessage<T = unknown> {
  channel?: WSChannel;  // 服务通道
  type: WSMessageType;
  payload?: T;
  data?: T;
  timestamp?: number;
  ts?: number;
  seq?: number;      // 消息序列号，用于排序
  id?: string;       // 消息唯一 ID
}

// 通知消息负载
export interface NotificationPayload {
  id?: number;
  type: 'tip' | 'review' | 'message' | 'subscription' | 'achievement' | 'system' | 'reward';
  title: string;
  content: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

// 私信消息负载
export interface DMPayload {
  id: number;
  sessionId: number;
  fromUserId: number;
  fromNickname: string;
  fromAvatar?: string;
  type: 'text' | 'image' | 'audio';
  content: string;
  timestamp: number;
}

// 直播数据负载
export interface LiveStatsPayload {
  roomId: number;
  viewers: number;
  likes: number;
  hotRank?: number;
}

// 连接状态
export type WSConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

// 事件回调类型
type WSEventCallback<T = unknown> = (message: WSMessage<T>) => void;

interface WSClientOptions {
  url: string;
  token?: string;
  heartbeatInterval?: number;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  maxReconnectAttempts?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

/**
 * 统一 WebSocket 客户端类
 */
export class WSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private heartbeatInterval: number;
  private reconnectDelay: number;
  private maxReconnectDelay: number;
  private maxReconnectAttempts: number;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private manualClose = false;

  private listeners: Map<WSMessageType, Set<WSEventCallback>> = new Map();
  private channelListeners: Map<WSChannel, Set<WSEventCallback>> = new Map();
  private stateListeners: Set<(state: WSConnectionState) => void> = new Set();

  private state: WSConnectionState = 'disconnected';

  constructor(options: WSClientOptions) {
    this.url = options.url;
    this.token = options.token || getAuthToken() ?? null;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    this.reconnectDelay = options.reconnectDelay || 1000;
    this.maxReconnectDelay = options.maxReconnectDelay || 15000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
  }

  getState(): WSConnectionState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.manualClose = false;
    this.setState('connecting');

    try {
      const wsUrl = this.token
        ? `${this.url}?token=${encodeURIComponent(this.token)}`
        : this.url;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
    } catch (error) {
      console.error('[WS] Connection error:', error);
      this.setState('error');
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.manualClose = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close(1000, 'Client closed');
      this.ws = null;
    }

    this.setState('disconnected');
  }

  send<T>(type: WSMessageType, payload: T, channel?: WSChannel): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Cannot send, not connected');
      return false;
    }

    try {
      const message: WSMessage<T> = {
        channel,
        type,
        payload,
        timestamp: Date.now(),
      };

      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('[WS] Send error:', error);
      return false;
    }
  }

  subscribe<T>(type: WSMessageType, callback: WSEventCallback<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback as WSEventCallback);

    return () => {
      this.listeners.get(type)?.delete(callback as WSEventCallback);
    };
  }

  // 按 channel 订阅
  subscribeByChannel<T>(channel: WSChannel, callback: WSEventCallback<T>): () => void {
    if (!this.channelListeners.has(channel)) {
      this.channelListeners.set(channel, new Set());
    }
    this.channelListeners.get(channel)!.add(callback as WSEventCallback);

    return () => {
      this.channelListeners.get(channel)?.delete(callback as WSEventCallback);
    };
  }

  onStateChange(callback: (state: WSConnectionState) => void): () => void {
    this.stateListeners.add(callback);
    return () => {
      this.stateListeners.delete(callback);
    };
  }

  private sendHeartbeat(): void {
    this.send('ping', { time: Date.now() });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.manualClose) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[WS] Max reconnect attempts reached');
      this.setState('error');
      return;
    }

    this.setState('reconnecting');

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private handleOpen(): void {
    console.log('[WS] Connected to', this.url);
    this.setState('connected');
    this.reconnectAttempts = 0;
    this.startHeartbeat();

    const listeners = Array.from(this.stateListeners);
    listeners.forEach(cb => cb('connected'));
  }

  private handleClose(event: CloseEvent): void {
    console.log('[WS] Disconnected:', event.code, event.reason);
    this.stopHeartbeat();

    const listeners = Array.from(this.stateListeners);
    listeners.forEach(cb => cb('disconnected'));

    if (!this.manualClose && event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Event): void {
    console.error('[WS] Error:', error);
    this.setState('error');

    const listeners = Array.from(this.stateListeners);
    listeners.forEach(cb => cb('error'));
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);

      // 忽略 pong 消息
      if (data.type === 'pong') return;

      // 构建消息对象
      const message: WSMessage = {
        channel: data.channel,
        type: data.type,
        payload: data.payload || data.data,
        timestamp: data.timestamp || data.ts || Date.now(),
      };

      // 按 type 分发
      const typeListeners = this.listeners.get(message.type);
      if (typeListeners) {
        typeListeners.forEach(cb => cb(message));
      }

      // 按 channel 分发
      if (message.channel) {
        const channelListeners = this.channelListeners.get(message.channel);
        if (channelListeners) {
          channelListeners.forEach(cb => cb(message));
        }
      }

      // 全局监听
      const allListeners = this.listeners.get('*' as WSMessageType);
      if (allListeners) {
        allListeners.forEach(cb => cb(message));
      }
    } catch (error) {
      console.error('[WS] Parse error:', error);
    }
  }

  private setState(state: WSConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.stateListeners.forEach(cb => cb(state));
    }
  }
}

// 导出默认实例工厂
let wsInstance: WSClient | null = null;

/**
 * 获取全局 WebSocket 实例
 * 统一 WebSocket 网关: ws(s)://host/ws/gateway
 */
export function getWSClient(): WSClient {
  if (!wsInstance) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/gateway`;

    wsInstance = new WSClient({
      url: wsUrl,
      heartbeatInterval: 30000,
      reconnectDelay: 1000,
      maxReconnectDelay: 15000,
      maxReconnectAttempts: 10,
    });
  }
  return wsInstance;
}

export function destroyWSClient(): void {
  if (wsInstance) {
    wsInstance.disconnect();
    wsInstance = null;
  }
}
