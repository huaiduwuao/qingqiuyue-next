/**
 * scene-ui/useRoomSocket.ts — 创世二期:在房间里时连上多人同步(lib/world/roomSocket.ts)
 *
 *   - 进房间场景就 join(房主 uid),离开 / 换到广场就断开;
 *   - 每 100ms 看一眼自己的位置,变了才报(换场景的那一下带 tp,服务端不当瞬移挡掉);
 *   - 房里的人:hello 全量 + join / leave 增减 + peers 位置帧 + avatar 换形象 → 交给舞台画(setRoomPeers);
 *   - 说话:say 帧进聊天记录,说话人头顶冒气泡(自己的也冒);
 *   - edit:别人(或自己另一个标签页)改了摆放 → useWorldObjects.applyRemote;
 *   - room:房间设置变了 → useRoom.applyRemote;kick:被请出去 → 回自己家。
 */

import React from 'react';
import { RoomSocket, type PeerInfo, type RoomFrame, type RoomSocketStatus } from '@/lib/world/roomSocket';
import type { WorldRoom } from '@/apis/world';
import type { VrmStageHandle } from '../VrmStage';
import type { WorldDef } from '../vrm/world/worldLayout';

export interface ChatLine {
  id: string;
  nickname: string;
  text: string;
  ts: number;
  mine: boolean;
}

export interface UseRoomSocketOptions {
  handle: VrmStageHandle | null;
  def: WorldDef;
  enabled: boolean;
  applyEdit: (op: 'upsert' | 'remove', data: unknown) => void;
  applyRoom: (r: WorldRoom) => void;
  onKick: (msg: string) => void;
  toast: (icon: string, text: string) => void;
  /** 测试用:换掉连接实现 */
  makeSocket?: (onFrame: (f: RoomFrame) => void, onStatus: (s: RoomSocketStatus) => void) => RoomSocket;
}

const STATE_EVERY = 100;

export function useRoomSocket(opts: UseRoomSocketOptions) {
  const { handle, def, enabled } = opts;
  const optsRef = React.useRef(opts);
  optsRef.current = opts;
  const [status, setStatus] = React.useState<RoomSocketStatus>('idle');
  const [peers, setPeers] = React.useState<PeerInfo[]>([]);
  const [chat, setChat] = React.useState<ChatLine[]>([]);
  const peersRef = React.useRef(new Map<string, PeerInfo>());
  const youRef = React.useRef<string | null>(null);
  const sockRef = React.useRef<RoomSocket | null>(null);
  const tpRef = React.useRef(true);

  const pushPeers = React.useCallback(() => {
    const list = Array.from(peersRef.current.values());
    setPeers(list);
    optsRef.current.handle?.setRoomPeers(list.map((p) => ({ ...p, look: p.look ?? { base: '', params: {}, version: 0 } })));
  }, []);

  const onFrame = React.useCallback((f: RoomFrame) => {
    const o = optsRef.current;
    switch (f.t) {
      case 'hello': {
        youRef.current = f.you;
        peersRef.current = new Map(f.peers.filter((p) => p.id !== f.you).map((p) => [p.id, p]));
        tpRef.current = true;
        pushPeers();
        // 出生点上已经站着人:往旁边错开一点,别叠在一起
        const snap = o.handle?.getWorldSnapshot();
        if (o.handle && snap && f.peers.some((p) => p.id !== f.you && Math.hypot(p.x - snap.x, p.z - snap.z) < 0.9)) {
          const ang = Math.random() * Math.PI;
          o.handle.setPosition(snap.x + Math.cos(ang) * 1.3, snap.z + Math.sin(ang) * 0.9);
        }
        return;
      }
      case 'join':
        if (f.peer.id === youRef.current) return;
        peersRef.current.set(f.peer.id, f.peer);
        pushPeers();
        o.toast('👋', `${f.peer.nickname || '有人'}来了`);
        return;
      case 'leave': {
        const p = peersRef.current.get(f.id);
        if (!p) return;
        peersRef.current.delete(f.id);
        pushPeers();
        o.toast('🚪', `${p.nickname || '有人'}走了`);
        return;
      }
      case 'peers': {
        let changed = false;
        for (const u of f.list) {
          const p = peersRef.current.get(u.id);
          if (!p) continue;
          peersRef.current.set(u.id, { ...p, ...u });
          changed = true;
        }
        if (changed) pushPeers();
        return;
      }
      case 'avatar': {
        const p = peersRef.current.get(f.id);
        if (!p) return;
        peersRef.current.set(f.id, { ...p, look: f.look });
        pushPeers();
        return;
      }
      case 'say': {
        const mine = f.id === youRef.current;
        setChat((c) => [...c.slice(-49), { id: f.id, nickname: f.nickname, text: f.text, ts: f.ts || Date.now(), mine }]);
        if (mine) o.handle?.floatText(f.text.length > 18 ? `${f.text.slice(0, 18)}…` : f.text, '#ffffff');
        else o.handle?.peerSay(f.id, f.text);
        return;
      }
      case 'edit':
        if (f.op === 'remove') o.applyEdit('remove', f.id);
        else o.applyEdit('upsert', f.placement);
        return;
      case 'room':
        o.applyRoom(f.room as WorldRoom);
        return;
      case 'kick':
        o.onKick(f.msg);
        return;
      case 'error':
        o.toast('⚠️', f.msg);
        return;
      default:
    }
  }, [pushPeers]);

  // 进 / 出房间
  const owner = enabled && def.kind === 'room' ? def.room?.ownerId ?? null : null;
  React.useEffect(() => {
    if (!owner) return;
    let sock = sockRef.current;
    if (!sock) {
      sock = (optsRef.current.makeSocket ?? ((f, s) => new RoomSocket(f, s)))(onFrame, setStatus);
      sockRef.current = sock;
    }
    peersRef.current = new Map();
    pushPeers();
    setChat([]);
    tpRef.current = true;
    sock.join(owner);
    return () => {
      sock?.leave();
      peersRef.current = new Map();
      optsRef.current.handle?.setRoomPeers([]);
      setPeers([]);
    };
  }, [owner, onFrame, pushPeers]);
  React.useEffect(() => () => { sockRef.current?.close(); sockRef.current = null; }, []);

  // 报自己的位置:变了才发
  React.useEffect(() => {
    if (!owner || !handle) return;
    let last: { x: number; z: number; yaw: number; at: number } | null = null;
    const timer = window.setInterval(() => {
      const s = handle.getWorldSnapshot();
      const sock = sockRef.current;
      if (!s || !sock) return;
      const now = performance.now();
      const moved = last ? Math.hypot(s.x - last.x, s.z - last.z) : 0;
      const turned = last ? Math.abs(s.yaw - last.yaw) : 1;
      const speed = last ? moved / Math.max(0.05, (now - last.at) / 1000) : 0;
      // 突然跳了好几米(换场景、回舞台前)= 瞬移
      const tp = tpRef.current || moved > 3;
      if (!last || moved > 0.01 || turned > 0.01 || tp) {
        sock.sendState({ x: +s.x.toFixed(3), y: 0, z: +s.z.toFixed(3), yaw: +s.yaw.toFixed(3), m: speed > 0.2, a: speed > 3 ? 'run' : speed > 0.2 ? 'walk' : undefined, tp: tp || undefined });
        tpRef.current = false;
        last = { x: s.x, z: s.z, yaw: s.yaw, at: now };
      } else if (last) {
        last.at = now;
      }
    }, STATE_EVERY);
    return () => window.clearInterval(timer);
  }, [owner, handle]);

  const say = React.useCallback((text: string) => {
    const t = text.trim();
    if (!t) return false;
    return sockRef.current?.say(t.slice(0, 120)) ?? false;
  }, []);

  return { status, peers, chat, say, online: owner ? peers.length + 1 : 0, inRoom: !!owner };
}

export type RoomSocketState = ReturnType<typeof useRoomSocket>;
