/**
 * lib/world/roomSocket.ts — 创世房间的多人同步连接(core-api worldapp/hub.go)
 *
 * 地址复用全站推送的网关路由:ws(s)://<host>/ws/notify?ch=world&ticket=…(core-api 按 ch 转给房间集线器,
 * 不用新开 APISIX 路由)。票和推送是同一种:POST /api/core/realtime/ticket,每次连接换一张。
 *
 * 七期:公共场景(广场、庭院)也走这条连接:join(场景 key),服务端当成没有房主的房间;
 * 说话转字幕:caption 帧(自己说话的识别中 / 房里任何人说完一句的最终结果)。
 *
 * 九期分线:场景一条线满 50 人自动开下一条;hello 里带 line / lines,join 可以指定线,断线重连回到原来那条。
 * 一个页面一条连接,同一时刻只在一间房里。断线按 1→2→4…→15 秒退避重连,连上后自动重新 join,
 * 服务端回 hello 全量(房里的人 + 房间版本),客户端据此补齐。
 *
 * 四期语音:同一条连接上的二进制帧(lib/world/voice/packet.ts),onBinary 收、sendBinary 发;
 * 状态用 voice {v} / vmute {id, muted}。
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
  /** 七期:广场光环(颜色值) */
  aura?: string;
  /** 四期:0 没开声音 / 1 在听 / 2 开着麦 */
  voice?: number;
  /** 被房主禁言 */
  muted?: boolean;
  look: PeerLook;
}

export type RoomFrame =
  | { t: 'hello'; you: string; room: { ownerId: string; version: number; name: string; voice?: boolean; scene?: string; line?: number; lines?: SceneLine[] }; peers: PeerInfo[]; muted?: boolean }
  | { t: 'lines'; scene: string; line: number; lines: SceneLine[] }
  | { t: 'join'; peer: PeerInfo }
  | { t: 'leave'; id: string }
  | { t: 'peers'; list: (PeerPose & { id: string })[] }
  | { t: 'say'; id: string; nickname: string; text: string; ts: number; ai?: boolean }
  | { t: 'edit'; op: 'upsert' | 'remove' | 'reload' | 'blocks'; version: number; placement?: unknown; id?: string; blocks?: unknown }
  | { t: 'avatar'; id: string; look: PeerLook }
  | { t: 'room'; room: unknown }
  | { t: 'kick'; msg: string }
  | { t: 'voice'; id: string; v: number; muted?: boolean }
  | { t: 'caption'; id: string; nickname?: string; text: string; final: boolean; blocked?: boolean; ts?: number }
  | { t: 'event'; phase: 'start'; event: { id: string; title: string; endAt: string } }
  | { t: 'error'; msg: string }
  // 世界模型(规则运行时)
  | { t: 'fx'; kind: 'toast' | 'say' | 'sound'; text?: string; entity?: string; sound?: string }
  | { t: 'tp'; x?: number; y?: number; z?: number; space?: string }
  | { t: 'me'; state: Record<string, unknown> }
  | { t: 'env'; env: Record<string, string> }
  | { t: 'ruleErr'; errors: string[] }
  | { t: 'pong' };

/** 九期:公共场景的一条线和人数 */
export interface SceneLine { line: number; n: number }

export type RoomSocketStatus = 'idle' | 'connecting' | 'open' | 'reconnecting';

function socketURL(ticket: string): string {
  const q = `ch=world&ticket=${encodeURIComponent(ticket)}`;
  const base = process.env.NEXT_PUBLIC_WS_BASE;
  if (base) return `${base.replace(/\/$/, '')}/ws/notify?${q}`;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/notify?${q}`;
}

const TICKET_TIMEOUT = 8000;

export class RoomSocket {
  private ws: WebSocket | null = null;
  private room: string | null = null;
  /** 九期:场景里在第几条线(0 = 让服务端挑);重连时回到这条 */
  private line = 0;
  private joined = false;
  private retry = 0;
  private retryTimer: number | null = null;
  private pingTimer: number | null = null;
  private closed = false;
  private connecting = false;
  /** 第几次连接尝试:close() / 新的一次连接开始后,还在等票的旧尝试作废(它回来时什么都不做) */
  private gen = 0;
  status: RoomSocketStatus = 'idle';

  constructor(private onFrame: (f: RoomFrame) => void, private onStatus: (s: RoomSocketStatus) => void, private onBinary?: (b: ArrayBuffer) => void) {}

  private setStatus(s: RoomSocketStatus) {
    if (this.status === s) return;
    this.status = s;
    this.onStatus(s);
  }

  /** 进某人的房间(房主 uid)或公共场景(场景 key,比如 plaza);没连上就先连 */
  join(ownerId: string, line?: number) {
    this.closed = false;
    if (this.room === ownerId && this.joined && (line === undefined || line === this.line)) return;
    if (this.room !== ownerId) this.line = 0;
    if (line !== undefined) this.line = line;
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
    this.raw(/^\d+$/.test(this.room) ? { t: 'join', room: this.room } : { t: 'join', scene: this.room, ...(this.line > 0 ? { line: this.line } : {}) });
    this.joined = true;
  }

  /** 九期:服务端分到了哪条线(hello 里来的),记下来重连用 */
  noteLine(line: number) { this.line = line > 0 ? line : 0; }

  /** 九期:问一下各条线现在几个人(回 lines 帧) */
  lines() {
    if (!this.joined) return false;
    return this.raw({ t: 'lines' });
  }

  sendState(p: PeerPose & { tp?: boolean }) {
    if (!this.joined) return;
    this.raw({ t: 'state', ...p });
  }

  say(text: string) {
    if (!this.joined) return false;
    return this.raw({ t: 'say', text });
  }

  /** 报自己的声音状态:0 没开声音 / 1 在听 / 2 开着麦 */
  voice(v: 0 | 1 | 2) {
    if (!this.joined) return false;
    return this.raw({ t: 'voice', v });
  }

  /** 世界模型:点了一个实体(服务端跑它的 use 规则) */
  use(id: string) {
    if (!this.joined) return false;
    return this.raw({ t: 'use', id });
  }

  /** 房主禁言 / 解禁 */
  vmute(id: string, muted: boolean) {
    if (!this.joined) return false;
    return this.raw({ t: 'vmute', id, muted });
  }

  /** 发一包语音;发送缓冲积压(网络卡了)就丢,不让语音越积越晚 */
  sendBinary(b: Uint8Array): boolean {
    const ws = this.ws;
    if (!this.joined || ws?.readyState !== WebSocket.OPEN) return false;
    if (ws.bufferedAmount > 16_384) return false;
    try { ws.send(b); return true; } catch { return false; }
  }

  private raw(v: unknown): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    try { this.ws.send(JSON.stringify(v)); return true; } catch { return false; }
  }

  private async connect() {
    if (this.connecting || this.closed || !this.room) return;
    this.connecting = true;
    const gen = ++this.gen;
    this.setStatus(this.retry > 0 ? 'reconnecting' : 'connecting');
    let ticket: string;
    try {
      // 换票的请求卡住(网络抖、页面刷新那一下)不能把连接永远卡在「连接中」:8 秒没回就当失败重试
      ticket = await Promise.race([
        getRealtimeTicket(),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('ticket timeout')), TICKET_TIMEOUT)),
      ]);
    } catch {
      if (gen !== this.gen) return;
      this.connecting = false;
      this.scheduleRetry();
      return;
    }
    if (gen !== this.gen) return;
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
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => {
      this.connecting = false;
      this.retry = 0;
      this.setStatus('open');
      this.sendJoin();
      if (this.pingTimer) window.clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => this.raw({ t: 'ping' }), 25_000);
    };
    ws.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) { this.onBinary?.(ev.data); return; }
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
    this.connecting = false;
    this.gen++;
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
