/**
 * 全站实时通知的单条长连接。
 *
 * 在此之前站内没有推送通道:铃铛未读数 60s 一次、私信列表 15s、会话内消息 5s、
 * 客服 3s —— 用户要么等,要么刷新页面,而每个在线标签页每分钟都在往网关打十几个
 * 空请求。现在整个应用共用一条 WebSocket,断线时才退回慢速轮询。
 *
 * 握手:
 *   1. POST /api/core/realtime/ticket(带 Authorization)换一张 60 秒的一次性票
 *   2. ws(s)://<host>/ws/notify?ticket=…
 *
 * 之所以绕一道票:浏览器的 WebSocket 构造函数不能设请求头,凭据只能进 URL,
 * 而 session_id 进了 URL 就会落进网关 access log 和浏览器历史。票用完即焚。
 *
 * 只有一个实例(模块级单例):React StrictMode 会把 effect 跑两遍,多个组件也各自
 * 要订阅,按组件建连接会瞬间开出四五条。这里靠引用计数,最后一个订阅者走了才断开。
 *
 * 本地 `next dev` 连不上是正常的:Next 的 rewrites 不转发 WebSocket 升级
 * (见 next.config.ts 里 /ws 那条的注释),开发时整站会停在 offline 状态走降级轮询。
 * 要在本地验证推送,把 NEXT_PUBLIC_WS_BASE 指向网关(如 ws://10.9.1.2:10005)。
 */

import { adminClient } from '@/lib/api/client';

export type RealtimeEventType =
  | 'connected'
  | 'dm'
  | 'dm.sent'
  | 'dm.recall'
  | 'notice'
  | 'system'
  | 'kf';

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType | string;
  title?: string;
  body?: string;
  data?: T;
  ts?: number;
}

/** 私信事件(后端 realtime.DMEvent)。id 都是字符串:超过 2^53 的雪花 id。 */
export interface DMEventData {
  sessionId: string;
  messageId: string;
  peerUserId: string;
  fromUserId: string;
  nickname?: string;
  avatar?: string;
  msgType: string;
  preview: string;
  /** 会话设了免打扰:未读照常更新,但不弹提示 */
  muted?: boolean;
}

/** 互动/系统通知事件(后端 realtime.NoticeEvent)。 */
export interface NoticeEventData {
  noticeId?: string;
  kind: string;
  fromUserId?: string;
  nickname?: string;
  avatar?: string;
  contentId?: string;
  targetType?: string;
  feedId?: string;
}

/** 在线客服事件(后端 realtime.KfEvent)。 */
export interface KfEventData {
  sessionId: string;
  messageId: string;
  userId: string;
  role: 'user' | 'staff' | 'system';
  msgType: string;
  preview: string;
  nickname?: string;
  avatar?: string;
}

export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'offline';

type Listener = (ev: RealtimeEvent) => void;
type StatusListener = (s: RealtimeStatus) => void;

/** 重连退避:1s 起,翻倍到 30s 封顶,再叠一点抖动避免全站同时重连打爆网关。 */
const RECONNECT_BASE = 1000;
const RECONNECT_MAX = 30_000;
/** 客户端心跳。服务端 70s 没收到任何帧就判死,25s 一次留足余量。 */
const HEARTBEAT = 25_000;

function socketURL(ticket: string): string {
  // 客户端(Tauri)页面不在站点源上,由 NEXT_PUBLIC_WS_BASE 指向网关
  const base = process.env.NEXT_PUBLIC_WS_BASE;
  if (base) return `${base.replace(/\/$/, '')}/ws/notify?ticket=${encodeURIComponent(ticket)}`;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/notify?ticket=${encodeURIComponent(ticket)}`;
}

class RealtimeClient {
  private ws: WebSocket | null = null;
  private status: RealtimeStatus = 'idle';
  private listeners = new Set<Listener>();
  private statusListeners = new Set<StatusListener>();
  private refs = 0;
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private stopped = true;
  /**
   * 每次发起连接自增。换票是异步的,这中间可能又来一次 connect()(重连计时器到点、
   * 标签页回到前台、登录态变化都会触发)。拿到票之后先核对这个序号,不是最新的
   * 那一次就直接放弃 —— 否则两条 connect 各自 new 一个 WebSocket,先完成的那条
   * 被后者覆盖引用却还开着,成了一条谁也关不掉的野连接。
   */
  private connectSeq = 0;

  getStatus(): RealtimeStatus {
    return this.status;
  }

  /** 订阅事件。返回的函数解除订阅,并在最后一个订阅者离开时断连。 */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    this.retain();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.listeners.delete(fn);
      this.release();
    };
  }

  onStatus(fn: StatusListener): () => void {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => {
      this.statusListeners.delete(fn);
    };
  }

  private retain() {
    this.refs += 1;
    if (this.refs === 1) {
      this.stopped = false;
      this.connect();
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', this.onVisible);
      }
      if (typeof window !== 'undefined') {
        window.addEventListener('online', this.onVisible);
      }
    }
  }

  private release() {
    this.refs = Math.max(0, this.refs - 1);
    if (this.refs === 0) this.close();
  }

  /** 标签页回到前台 / 网络恢复:如果连接已经断了就立刻重连,不等退避计时。 */
  private onVisible = () => {
    if (this.stopped) return;
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    if (hidden) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this.attempts = 0;
    this.clearReconnect();
    this.connect();
  };

  /** 外部触发重连(例如刚登录完拿到新会话)。 */
  restart() {
    if (this.refs === 0) return;
    this.stopped = false;
    this.connectSeq += 1; // 作废在途的那一次换票
    this.teardownSocket();
    this.attempts = 0;
    this.clearReconnect();
    this.connect();
  }

  close() {
    this.stopped = true;
    this.connectSeq += 1; // 在途的换票回来后自行放弃
    this.clearReconnect();
    this.teardownSocket();
    this.setStatus('idle');
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisible);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onVisible);
    }
  }

  private setStatus(s: RealtimeStatus) {
    if (this.status === s) return;
    this.status = s;
    this.statusListeners.forEach((fn) => {
      try {
        fn(s);
      } catch {
        /* 订阅者自己抛错不该拖垮连接 */
      }
    });
  }

  private async connect() {
    if (this.stopped || typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    this.connectSeq += 1;
    const seq = this.connectSeq;
    this.setStatus(this.attempts === 0 ? 'connecting' : 'reconnecting');
    let ticket: string;
    try {
      const res = await adminClient('/realtime/ticket', { method: 'POST' });
      ticket = res?.data?.ticket;
      if (!ticket) throw new Error('no ticket');
    } catch {
      // 换票失败多半是没登录或会话过期 —— 退避后再试,同时订阅者会看到 offline
      // 并打开自己的慢速轮询兜底。
      if (seq === this.connectSeq) this.scheduleReconnect();
      return;
    }
    if (this.stopped || seq !== this.connectSeq) return;

    let ws: WebSocket;
    try {
      ws = new WebSocket(socketURL(ticket));
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.setStatus('open');
      this.startHeartbeat();
    };
    ws.onmessage = (e) => {
      let ev: RealtimeEvent;
      try {
        ev = JSON.parse(e.data);
      } catch {
        return;
      }
      if (!ev || ev.type === 'pong') return;
      this.listeners.forEach((fn) => {
        try {
          fn(ev);
        } catch (err) {
          console.error('[realtime] listener', err);
        }
      });
    };
    ws.onerror = () => {
      /* onclose 紧随其后,重连逻辑放在那里,避免同一次断线排两次 */
    };
    ws.onclose = () => {
      this.stopHeartbeat();
      if (this.ws !== ws) return; // 已经被更新的一次连接取代,不要替它排重连
      this.ws = null;
      if (this.stopped) return;
      this.scheduleReconnect();
    };
  }

  private teardownSocket() {
    this.stopHeartbeat();
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
    try {
      ws.close(1000, 'client');
    } catch {
      /* 已经关了 */
    }
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    this.setStatus('offline');
    const delay = Math.min(RECONNECT_BASE * 2 ** this.attempts, RECONNECT_MAX);
    const jitter = Math.floor(Math.random() * 400);
    this.attempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay + jitter);
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send('{"type":"ping"}');
        } catch {
          /* 下一轮 onclose 会接管 */
        }
      }
    }, HEARTBEAT);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export const realtime = new RealtimeClient();
