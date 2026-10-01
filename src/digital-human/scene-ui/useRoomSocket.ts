/**
 * scene-ui/useRoomSocket.ts — 创世二期:在房间里时连上多人同步(lib/world/roomSocket.ts)
 *
 *   - 进房间场景就 join(房主 uid),离开 / 换到广场就断开;
 *   - 每 100ms 看一眼自己的位置,变了才报(换场景的那一下带 tp,服务端不当瞬移挡掉);
 *   - 房里的人:hello 全量 + join / leave 增减 + peers 位置帧 + avatar 换形象 → 交给舞台画(setRoomPeers);
 *   - 说话:say 帧进聊天记录,说话人头顶冒气泡(自己的也冒);
 *   - edit:别人(或自己另一个标签页)改了摆放 → useWorldObjects.applyRemote;
 *   - room:房间设置变了 → useRoom.applyRemote;kick:被请出去 → 回自己家。
 *   - 七期:公共场景(广场、庭院)也连(space = 'scene',不提示谁来谁走);caption 帧 = 说话转字幕:
 *     最终结果进聊天记录(voice: true)、说话人头顶冒气泡;中间结果只有说话人自己收到(myCaption)。
 *   - 四期语音:二进制帧交给 setVoiceHandler 登记的处理器(useRoomVoice);voice 帧更新每个人的声音状态
 *     (peer.voice / muted)和自己是否被禁言;hello 之后把自己的声音状态再报一次(服务端进房时清零)。
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
  ai?: boolean;
  /** 七期:开麦说的,字幕转出来的 */
  voice?: boolean;
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
  makeSocket?: (onFrame: (f: RoomFrame) => void, onStatus: (s: RoomSocketStatus) => void, onBinary: (b: ArrayBuffer) => void) => RoomSocket;
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
  // 四期语音
  const [roomVoice, setRoomVoice] = React.useState(true);
  const [selfMuted, setSelfMuted] = React.useState(false);
  // 七期:自己说话时的识别中字幕
  const [myCaption, setMyCaption] = React.useState('');
  const captionTimer = React.useRef<number | null>(null);
  const voiceStateRef = React.useRef<0 | 1 | 2>(0);
  const voiceHandlerRef = React.useRef<((b: ArrayBuffer) => void) | null>(null);
  const onBinary = React.useCallback((b: ArrayBuffer) => { voiceHandlerRef.current?.(b); }, []);

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
        setRoomVoice(f.room.voice !== false);
        setSelfMuted(!!f.muted);
        if (voiceStateRef.current > 0) sockRef.current?.voice(voiceStateRef.current);
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
        if (o.def.kind === 'room') o.toast('👋', `${f.peer.nickname || '有人'}来了`);
        return;
      case 'leave': {
        const p = peersRef.current.get(f.id);
        if (!p) return;
        peersRef.current.delete(f.id);
        pushPeers();
        if (o.def.kind === 'room') o.toast('🚪', `${p.nickname || '有人'}走了`);
        return;
      }
      case 'peers': {
        let changed = false;
        for (const u of f.list) {
          const p = peersRef.current.get(u.id);
          if (!p) continue;
          // m / a 为空时服务端不发(omitempty):以这一帧为准,别留着上一帧的「在走」「招手」
          peersRef.current.set(u.id, { ...p, ...u, m: !!u.m, a: u.a });
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
        setChat((c) => [...c.slice(-49), { id: f.id, nickname: f.nickname, text: f.text, ts: f.ts || Date.now(), mine, ai: !!f.ai }]);
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
        setRoomVoice(!(f.room as WorldRoom).voiceOff);
        return;
      case 'voice': {
        if (f.id === youRef.current) { setSelfMuted(!!f.muted); return; }
        const p = peersRef.current.get(f.id);
        if (!p) return;
        peersRef.current.set(f.id, { ...p, voice: f.v, muted: !!f.muted });
        pushPeers();
        return;
      }
      case 'kick':
        o.onKick(f.msg);
        return;
      case 'caption': {
        const mine = f.id === youRef.current;
        if (!f.final) {
          if (mine) setMyCaption(f.text);
          return;
        }
        if (mine) {
          setMyCaption(f.blocked ? '这句没显示出来(含敏感词)' : '');
          if (f.blocked) {
            if (captionTimer.current) window.clearTimeout(captionTimer.current);
            captionTimer.current = window.setTimeout(() => setMyCaption(''), 3000);
          }
        }
        if (!f.text) return;
        setChat((c) => [...c.slice(-49), { id: f.id, nickname: f.nickname || '', text: f.text, ts: f.ts || Date.now(), mine, voice: true }]);
        if (mine) o.handle?.floatText(f.text.length > 18 ? `${f.text.slice(0, 18)}…` : f.text, '#c8f7ff');
        else o.handle?.peerSay(f.id, f.text);
        return;
      }
      case 'event':
        // 六期:房间活动到点开始(门牌上的「进行中」由随后的 room 帧更新)
        o.toast('🎉', `「${f.event?.title ?? '活动'}」开始了`);
        return;
      case 'error':
        o.toast('⚠️', f.msg);
        return;
      default:
    }
  }, [pushPeers]);

  // 进 / 出房间(七期:公共场景用场景 key)
  const owner = !enabled ? null : def.kind === 'room' ? def.room?.ownerId ?? null : def.key;
  React.useEffect(() => {
    if (!owner) return;
    let sock = sockRef.current;
    if (!sock) {
      sock = (optsRef.current.makeSocket ?? ((f, s, b) => new RoomSocket(f, s, b)))(onFrame, setStatus, onBinary);
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
  }, [owner, onFrame, pushPeers, onBinary]);
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

  // 四期语音
  const setVoiceState = React.useCallback((v: 0 | 1 | 2) => {
    voiceStateRef.current = v;
    sockRef.current?.voice(v);
  }, []);
  const sendVoice = React.useCallback((b: Uint8Array) => sockRef.current?.sendBinary(b) ?? false, []);
  const vmute = React.useCallback((id: string, muted: boolean) => sockRef.current?.vmute(id, muted) ?? false, []);
  const setVoiceHandler = React.useCallback((fn: ((b: ArrayBuffer) => void) | null) => { voiceHandlerRef.current = fn; }, []);

  // online 只算真人(含自己);AI 另外数
  const aiCount = peers.filter((p) => p.ai).length;
  return {
    status, peers, chat, say, online: owner ? peers.length - aiCount + 1 : 0, aiCount, inRoom: !!owner,
    isOwner: !!owner && !!def.room?.mine,
    /** room = 某人的房间;scene = 公共场景(广场、庭院) */
    space: (owner ? (def.kind === 'room' ? 'room' : 'scene') : null) as 'room' | 'scene' | null,
    myCaption,
    roomVoice, selfMuted, setVoiceState, sendVoice, vmute, setVoiceHandler,
  };
}

export type RoomSocketState = ReturnType<typeof useRoomSocket>;
