/**
 * 数字人 WebSocket 连接管理:换票建连、指数退避重连、断开(从 useChatAvatarWS.ts 拆出,行为不变)。
 */
import type { VisemeFrame } from './useChatAvatar';
import { withTicket } from '@/lib/realtime/ticket';

// ─── WS 消息类型(对齐 Go wsmux.go) ───

export interface WSClientMsg {
  type: string;
  text?: string;
  history?: Array<{ role: string; content: string }>;
  agentId?: string;
  conversationId?: string; // 002:服务端会话 id,空 → server 创建
  pcm?: string;
  energy?: number;
  language?: string;
  token?: string;
}

export interface WSServerMsg {
  type: string;          // text_token | audio_chunk | viseme_frames | done | error | asr_result | pong | frame
  token?: string;
  textDone?: boolean;
  audioDone?: boolean;
  audioB64?: string;
  visemes?: VisemeFrame[];
  emotion?: string;
  action?: string;
  fullText?: string;
  asrText?: string;
  asrIsFinal?: boolean;
  error?: string;
  mouthOpen?: number;
  blendshapes?: Record<string, number>;
  pose?: number[];
  expressions?: number[];
  seq?: number;
  /** 后端在 done 消息里携带的工具调用(Hermes/数字人用) */
  toolCalls?: Array<{ name: string; args?: Record<string, any> }>;
  /** 002:服务端创建/复用后回传的会话 id,前端写 localStorage */
  conversationId?: string;
}

// ─── WebSocket 连接管理 ───

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

/** 第 attempts 次重连前等多久(指数退避,封顶 RECONNECT_MAX_MS) */
export function reconnectDelay(attempts: number): number {
  return Math.min(
    RECONNECT_MAX_MS,
    RECONNECT_BASE_MS * Math.pow(2, attempts),
  );
}

export interface WSConnection {
  ws: WebSocket;
  url: string;
  seq: number;
  agentId: string;
  // 待发送队列(重连时缓存)
  pending: WSClientMsg[];
  // 回调
  onMessage: (msg: WSServerMsg) => void;
  onOpen: () => void;
  onClose: (err?: string) => void;
  // 状态
  connected: boolean;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempts: number;
  // 用户主动断开标记(disconnect 调用后置 true)
  // 用于:
  //   1. 阻止 CONNECTING 状态下调 close()(避免浏览器原生报
  //      "WebSocket is closed before the connection is established")
  //   2. 阻止重连逻辑
  cancelled: boolean;
}

export function createWSConnection(
  url: string,
  agentId: string,
  onMessage: (msg: WSServerMsg) => void,
  onOpen: () => void,
  onClose: (err?: string) => void,
): WSConnection {
  const conn: WSConnection = {
    ws: null as unknown as WebSocket,
    url,
    seq: 0,
    agentId,
    pending: [],
    onMessage,
    onOpen,
    onClose,
    connected: false,
    reconnectTimer: null,
    reconnectAttempts: 0,
    cancelled: false,
  };
  void connect(conn);
  return conn;
}

/** 断线 / 建连失败后按指数退避重连,次数用完降级到 HTTP */
function scheduleReconnect(conn: WSConnection) {
  if (conn.cancelled) return;
  if (conn.reconnectAttempts < 10) {
    const delay = reconnectDelay(conn.reconnectAttempts);
    conn.reconnectAttempts++;
    conn.reconnectTimer = setTimeout(() => void connect(conn), delay);
  } else {
    conn.onClose('WebSocket 连接失败, 已降级到 HTTP');
  }
}

async function connect(conn: WSConnection) {
  if (conn.cancelled) return;
  if (conn.ws && conn.ws.readyState === WebSocket.OPEN) return;

  // realtime-api 的 WS 握手凭一次性票(浏览器 WebSocket 发不出 Authorization 头)。
  // 票用过即失效,所以每次建连(含重连)都重新换一张。
  let ticketed: string;
  try {
    const base = conn.url.startsWith('ws')
      ? conn.url
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${conn.url}`;
    ticketed = await withTicket(base);
  } catch {
    // 没登录 / 换票失败:算一次建连失败,照常退避重试,次数用完降级 HTTP
    scheduleReconnect(conn);
    return;
  }
  if (conn.cancelled) return;

  try {
    const ws = new WebSocket(ticketed);
    conn.ws = ws;

    ws.onopen = () => {
      // 用户在 CONNECTING 期间点了 disconnect → 等到 OPEN 后再安静关闭,
      // 避免浏览器报 "WebSocket is closed before the connection is established"
      if (conn.cancelled) {
        try { ws.close(1000, 'cancelled'); } catch { /* noop */ }
        return;
      }
      conn.connected = true;
      conn.reconnectAttempts = 0;
      // 发送缓存的消息
      while (conn.pending.length > 0) {
        const msg = conn.pending.shift();
        if (msg) sendRaw(conn, msg);
      }
      conn.onOpen();
    };

    ws.onmessage = (e) => {
      // 已取消的连接忽略后续消息
      if (conn.cancelled) return;
      try {
        const msg: WSServerMsg = JSON.parse(e.data);
        if (msg.seq != null) conn.seq = msg.seq;
        conn.onMessage(msg);
      } catch {
        // 非 JSON 消息忽略
      }
    };

    ws.onclose = () => {
      conn.connected = false;
      if (conn.cancelled) return; // 用户主动断开,不重连、不报错
      scheduleReconnect(conn);
    };

    ws.onerror = () => {
      // 用户主动断开导致的 error 静默,不污染控制台
      if (conn.cancelled) return;
      // onclose 会紧随其后触发
    };
  } catch {
    if (!conn.cancelled) {
      conn.onClose('WebSocket 初始化失败');
    }
  }
}

export function sendRaw(conn: WSConnection, msg: WSClientMsg) {
  if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
    conn.ws.send(JSON.stringify(msg));
  } else {
    conn.pending.push(msg);
  }
}

export function disconnect(conn: WSConnection) {
  // 标记主动断开 → 所有 onopen/onmessage/onclose/onerror handler 见到此标志都直接 return
  conn.cancelled = true;
  if (conn.reconnectTimer) {
    clearTimeout(conn.reconnectTimer);
    conn.reconnectTimer = null;
  }
  conn.reconnectAttempts = 999; // 阻止重连
  if (conn.ws) {
    const state = conn.ws.readyState;
    if (state === WebSocket.OPEN || state === WebSocket.CLOSING) {
      // 只有 OPEN/CLOSING 状态调 close() 不会触发浏览器原生 onerror
      conn.ws.close(1000, 'client disconnect');
    }
    // CONNECTING 状态:不要调 close(),让 onopen 触发时检测 cancelled 并安静关闭
    // 避免浏览器报 "WebSocket is closed before the connection is established"
  }
  conn.connected = false;
}
