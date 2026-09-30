/**
 * lib/world/roomSocket.ts — 创世房间的多人同步连接(core-api worldapp/hub.go)
 *
 * 地址复用全站推送的网关路由:ws(s)://<host>/ws/notify?ch=world&ticket=…(core-api 按 ch 转给房间集线器,
 * 不用新开 APISIX 路由)。票和推送是同一种:POST /api/core/realtime/ticket,每次连接换一张。
 *
 * 一个页面一条连接,同一时刻只在一间房里。断线按 1→2→4…→15 秒退避重连,连上后自动重新 join,
 * 服务端回 hello 全量(房里的人 + 房间版本),客户端据此补齐。
 *
 * 本地 next dev 连不上(rewrite 不代理 WebSocket),把 NEXT_PUBLIC_WS_BASE 指到网关(ws://10.9.1.2:10005)。
 */

import { getRealtimeTicket } from '@/lib/realtime/ticket';

export interface PeerLook {
  base: string;
  params: Record<string, unknown>;
  version: number;
}

export interface PeerPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** 在走 */
  m?: boolean;
  /** 动作(walk / run / jump / dance…) */
  a?: string;
}

export interface PeerInfo extends PeerPose {
  id: string;
  nickname: string;
  avatar?: string;
  owner?: boolean;
  /** AI 成员(管家 / 做客的 agent) */
  ai?: boolean;
  look: PeerLook;
}

export type RoomFrame =
  | { t: 'hello'; you: string; room: { ownerId: string; version: number; name: string }; peers: PeerInfo[] }
  | { t: 'join'; peer: PeerInfo }
  | { t: 'leave'; id: string }
  | { t: 'peers'; list: (PeerPose & { id: string })[] }
  | { t: 'say'; id: string; nickname: string; text: string; ts: number; ai?: boolean }
  | { t: 'edit'; op: 'upsert' | 'remove'; version: number; placement?: unknown; id?: string }
  | { t: 'avatar'; id: string; look: PeerLook }
  | { t: 'room'; room: unknown }
  | { t: 'kick'; msg: string }
  | { t: 'error'; msg: string }
  | { t: 'pong' };

export type RoomSocketStatus = 'idle' | 'connecting' | 'open' | 'reconnecting';

function socketURL(ticket: string): string {
  const q = `ch=world&ticket=${encodeURIComponent(ticket)}`;
  const base = process.env.NEXT_PUBLIC_WS_BASE;
  if (base) return `${base.replace(/\/$/, '')}/ws/notify?${q}`;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/notify?${q}`;
}

export class RoomSocket {
  private ws: WebSocket | null = null;
  private room: string | null = null;
  private joined = false;
  private retry = 0;
  private retryTimer: number | null = null;
  private pingTimer: number | null = null;
  private closed = false;
  private connecting = false;
  status: RoomSocketStatus = 'idle';

  constructor(private onFrame: (f: RoomFrame) => void, private onStatus: (s: RoomSocketStatus) => void) {}

  private setStatus(s: RoomSocketStatus) {
    if (this.status === s) return;
    this.status = s;
    this.onStatus(s);
  }

  /** 进某人的房间(房主 uid);没连上就先连 */
  join(ownerId: string) {
    this.closed = false;
    if (this.room === ownerId && this.joined) return;
    this.room = ownerId;
    this.joined = false;
    if (this.ws?.readyState === WebSocket.OPEN) this.sendJoin();
    else void this.connect();
  }

  /** 离开房间(连接也关掉:不在房间里就不占着) */
  leave() {
    this.room = null;
    this.joined = false;
    this.close();
  }

  private sendJoin() {
    if (!this.room) return;
    this.raw({ t: 'join', room: this.room });
    this.joined = true;
  }

  sendState(p: PeerPose & { tp?: boolean }) {
    if (!this.joined) return;
    this.raw({ t: 'state', ...p });
  }

  say(text: string) {
    if (!this.joined) return false;
    return this.raw({ t: 'say', text });
  }

  private raw(v: unknown): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    try { this.ws.send(JSON.stringify(v)); return true; } catch { return false; }
  }

  private async connect() {
    if (this.connecting || this.closed || !this.room) return;
    this.connecting = true;
    this.setStatus(this.retry > 0 ? 'reconnecting' : 'connecting');
    let ticket: string;
    try {
      ticket = await getRealtimeTicket();
    } catch {
      this.connecting = false;
      this.scheduleRetry();
      return;
    }
    if (this.closed || !this.room) { this.connecting = false; return; }
    let ws: WebSocket;
    try {
      ws = new WebSocket(socketURL(ticket));
    } catch {
      this.connecting = false;
      this.scheduleRetry();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.connecting = false;
      this.retry = 0;
      this.setStatus('open');
      this.sendJoin();
      if (this.pingTimer) window.clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => this.raw({ t: 'ping' }), 25_000);
    };
    ws.onmessage = (ev) => {
      let f: RoomFrame;
      try { f = JSON.parse(String(ev.data)); } catch { return; }
      if (f && typeof f === 'object' && 't' in f) this.onFrame(f);
    };
    ws.onclose = () => {
      this.connecting = false;
      if (this.ws === ws) this.ws = null;
      this.joined = false;
      if (this.pingTimer) { window.clearInterval(this.pingTimer); this.pingTimer = null; }
      if (!this.closed && this.room) this.scheduleRetry();
      else this.setStatus('idle');
    };
    ws.onerror = () => { /* onclose 会跟着来 */ };
  }

  private scheduleRetry() {
    if (this.closed || !this.room) { this.setStatus('idle'); return; }
    this.setStatus('reconnecting');
    const delay = Math.min(15_000, 1000 * 2 ** this.retry);
    this.retry = Math.min(this.retry + 1, 6);
    if (this.retryTimer) window.clearTimeout(this.retryTimer);
    this.retryTimer = window.setTimeout(() => { this.retryTimer = null; void this.connect(); }, delay);
  }

  close() {
    this.closed = true;
    this.joined = false;
    if (this.retryTimer) { window.clearTimeout(this.retryTimer); this.retryTimer = null; }
    if (this.pingTimer) { window.clearInterval(this.pingTimer); this.pingTimer = null; }
    const ws = this.ws;
    this.ws = null;
    if (ws) { ws.onclose = null; ws.onmessage = null; try { ws.close(); } catch { /* ignore */ } }
    this.retry = 0;
    this.setStatus('idle');
  }
}
