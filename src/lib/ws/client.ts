/**
 * 统一 WebSocket 客户端
 * 支持多路复用、心跳重连、自动降级、权限验证
 */

// 获取认证 token
function getAuthToken(): string | null {
  // 从 localStorage 获取
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) return token;

    // 从 cookie 获取
    const match = document.cookie.match(/(?:^|;\s*)auth-token=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

// WebSocket 消息类型
export type WSMessageType =
  | 'notification'   // 通知消息
  | 'dm'            // 私信消息
  | 'live_stats'    // 直播数据
  | 'crawl_progress' // 爬虫进度
  | 'system'        // 系统消息
  | 'ping'          // 心跳
  | 'pong';         // 心跳响应

// 通用消息格式
export interface WSMessage<T = unknown> {
  type: WSMessageType;
  payload: T;
  timestamp: number;
  seq?: number;      // 消息序列号，用于排序
  id?: string;       // 消息唯一 ID
}

// 通知消息负载 (对齐后端 NotifyMessage)
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
  heartbeatInterval?: number;  // 心跳间隔 ms
  reconnectDelay?: number;    // 基础重连延迟 ms
  maxReconnectDelay?: number; // 最大重连延迟 ms
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

  /**
   * 获取当前连接状态
   */
  getState(): WSConnectionState {
    return this.state;
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * 连接服务器
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.manualClose = false;
    this.setState('connecting');

    try {
      // 构建 URL，添加 token 参数
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

  /**
   * 断开连接
   */
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

  /**
   * 发送消息
   */
  send<T>(type: WSMessageType, payload: T): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Cannot send, not connected');
      return false;
    }

    try {
      const message: WSMessage<T> = {
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

  /**
   * 订阅消息类型
   */
  subscribe<T>(type: WSMessageType, callback: WSEventCallback<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback as WSEventCallback);

    // 返回取消订阅函数
    return () => {
      this.listeners.get(type)?.delete(callback as WSEventCallback);
    };
  }

  /**
   * 订阅连接状态变化
   */
  onStateChange(callback: (state: WSConnectionState) => void): () => void {
    this.stateListeners.add(callback);
    return () => {
      this.stateListeners.delete(callback);
    };
  }

  /**
   * 发送心跳
   */
  private sendHeartbeat(): void {
    this.send('ping', { time: Date.now() });
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.manualClose) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[WS] Max reconnect attempts reached');
      this.setState('error');
      return;
    }

    this.setState('reconnecting');

    // 指数退避
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

  /**
   * 清除重连定时器
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * 处理连接打开
   */
  private handleOpen(): void {
    console.log('[WS] Connected');
    this.setState('connected');
    this.reconnectAttempts = 0;
    this.startHeartbeat();

    // 触发连接回调
    const listeners = Array.from(this.stateListeners);
    listeners.forEach(cb => cb('connected'));
  }

  /**
   * 处理连接关闭
   */
  private handleClose(event: CloseEvent): void {
    console.log('[WS] Disconnected:', event.code, event.reason);
    this.stopHeartbeat();

    const listeners = Array.from(this.stateListeners);
    listeners.forEach(cb => cb('disconnected'));

    // 非正常关闭则重连
    if (!this.manualClose && event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  /**
   * 处理错误
   */
  private handleError(error: Event): void {
    console.error('[WS] Error:', error);
    this.setState('error');

    const listeners = Array.from(this.stateListeners);
    listeners.forEach(cb => cb('error'));
  }

  /**
   * 处理收到的消息
   * 兼容两种消息格式：
   * 1. 后端扁平格式: { type, title, content, data, timestamp }
   * 2. 前端包装格式: { type, payload, timestamp }
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);

      // 忽略 pong 消息
      if (data.type === 'pong') return;

      // 统一消息格式：如果是扁平格式，转换为包装格式
      let message: WSMessage;
      if ('payload' in data) {
        // 已经是包装格式
        message = data as WSMessage;
      } else {
        // 扁平格式转换：后端 NotifyMessage -> 前端 WSMessage
        // 后端类型: tip|review|message|subscription|achievement|system|reward
        // 前端类型映射
        const typeMap: Record<string, WSMessageType> = {
          tip: 'notification',
          review: 'notification',
          message: 'dm',
          subscription: 'notification',
          achievement: 'notification',
          system: 'system',
          reward: 'notification',
        };
        const mappedType = typeMap[data.type] || 'notification';
        message = {
          type: mappedType,
          payload: data,
          timestamp: data.timestamp || Date.now(),
        };
      }

      // 分发到对应的监听器
      const typeListeners = this.listeners.get(message.type);
      if (typeListeners) {
        typeListeners.forEach(cb => cb(message));
      }

      // 同时通知所有监听器
      const allListeners = this.listeners.get('*' as WSMessageType);
      if (allListeners) {
        allListeners.forEach(cb => cb(message));
      }
    } catch (error) {
      console.error('[WS] Parse error:', error);
    }
  }

  /**
   * 设置状态
   */
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
 * WebSocket 连接通过 API 网关，支持通知和私信
 *
 * 连接地址: ws(s)://host/ws/notify
 * 后端路由: core-api /ws/notify (wsnotify.ClientHandler)
 * APISIX 路由: /ws -> core-api (enable_websocket: true)
 */
export function getWSClient(): WSClient {
  if (!wsInstance) {
    // 根据当前页面协议选择 WS 或 WSS
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // 通过 API 网关访问后端 WebSocket
    // APISIX 路由: /ws/* -> core-api (:10001) /ws/notify
    const host = window.location.host;
    // 生产环境: ws://host/ws/notify -> APISIX (:9080) -> core-api (:10001) /ws/notify
    const wsUrl = `${protocol}//${host}/ws/notify`;

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

/**
 * 销毁全局实例
 */
export function destroyWSClient(): void {
  if (wsInstance) {
    wsInstance.disconnect();
    wsInstance = null;
  }
}
