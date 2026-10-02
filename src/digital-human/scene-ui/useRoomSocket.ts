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
 *   - 九期分线:场景里 hello / lines 帧带着自己在第几条线、各条线几个人;switchLine 换线(清掉聊天,重新收 hello)。
 */

import React from 'react';
import { playLibSound } from './soundLib';
import { RoomSocket, type PeerInfo, type RoomFrame, type RoomSocketStatus, type SceneLine } from '@/lib/world/roomSocket';
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
  applyEdit: (op: 'upsert' | 'remove' | 'reload' | 'blocks' | 'terrain', data: unknown) => void;
  applyRoom: (r: WorldRoom) => void;
  /** 规则的 env 效果:临时换时辰 / 天气 */
  onEnv?: (env: { time?: string; weather?: string }) => void;
  onKick: (msg: string) => void;
  toast: (icon: string, text: string) => void;
  /** 世界模型:规则让某个实体「说话」(头顶冒字);不给就用提示条 */
  onEntitySay?: (entityId: string, text: string) => void;
  /** 世界模型:规则把我传送到别的空间(房间 key,比如 room:12) */
  onTravel?: (spaceKey: string) => void;
  /** 测试用:换掉连接实现 */
  makeSocket?: (onFrame: (f: RoomFrame) => void, onStatus: (s: RoomSocketStatus) => void, onBinary: (b: ArrayBuffer) => void) => RoomSocket;
}

const STATE_EVERY = 100;

/** 规则里的 sound:几种合成的短音(click / coin / door / whoosh),不下载音频 */
let cueCtx: AudioContext | null = null;
function playCue(name?: string) {
  try {
    if (typeof window === 'undefined' || !('AudioContext' in window)) return;
    cueCtx ??= new AudioContext();
    const ctx = cueCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    const known = ({ coin: [880, 1320, 0.18, 'square'], door: [180, 120, 0.35, 'sawtooth'], whoosh: [600, 150, 0.4, 'sine'], chime: [1568, 1760, 0.5, 'sine'], ding: [1320, 1300, 0.35, 'triangle'] } as Record<string, [number, number, number, OscillatorType]>)[name ?? ''];
    if (!known && name && name !== 'click') { void playLibSound(name).then((ok) => { if (!ok) playCue('click'); }); return; } // 声音库里的
    const spec = known ?? [1200, 900, 0.06, 'square'];
    o.type = spec[3];
    o.frequency.setValueAtTime(spec[0], t);
    o.frequency.exponentialRampToValueAtTime(spec[1], t + spec[2]);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + spec[2]);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + spec[2] + 0.02);
  } catch { /* 没有声音就算了 */ }
}

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
  // 世界模型:我身上的状态(规则给的分数、道具……)
  const [myState, setMyState] = React.useState<Record<string, unknown>>({});
  /** 憋气:还能憋几秒(null = 没在憋)*/
  const [breath, setBreath] = React.useState<{ left: number; max: number } | null>(null);
  React.useEffect(() => { setBreath(null); }, [def.key]);
  // 九期:场景分线
  const [line, setLine] = React.useState(0);
  const [lines, setLines] = React.useState<SceneLine[]>([]);
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
        setLine(f.room.line ?? 0);
        setLines(f.room.lines ?? []);
        sockRef.current?.noteLine(f.room.line ?? 0);
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
        else if (f.op === 'reload') o.applyEdit('reload', null); // 十一期:套了样板间,整个重读
        else if (f.op === 'blocks') o.applyEdit('blocks', f.blocks); // 十二期:积木
        else if (f.op === 'terrain') o.applyEdit('terrain', f.terrain); // 地形
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
      case 'lines':
        setLine(f.line);
        setLines(f.lines ?? []);
        return;
      // ── 世界模型(规则运行时推过来的)──
      case 'fx':
        if (f.kind === 'toast' && f.text) o.toast('✨', f.text);
        else if (f.kind === 'say' && f.text) { if (f.entity && o.onEntitySay) o.onEntitySay(f.entity, f.text); else o.toast('💬', f.text); }
        else if (f.kind === 'sound') playCue(f.sound);
        return;
      case 'tp':
        if (f.space) { o.onTravel?.(f.space); return; }
        if (typeof f.x === 'number' && typeof f.z === 'number') { tpRef.current = true; o.handle?.setPosition(f.x, f.z); }
        return;
      case 'me':
        setMyState(f.state ?? {});
        return;
      case 'ruleErr':
        if (f.errors?.length) o.toast('⚠️', `规则出错:${f.errors[0]}`);
        return;
      case 'breath':
        // 头泡在会憋气的液体里:还能憋几秒(-1 = 出水了)
        setBreath(f.left < 0 ? null : { left: f.left, max: f.max ?? f.left });
        return;
      case 'env':
        // 规则改了时辰 / 天气(env 效果):这一趟在房里时生效,不改房间设置
        if (f.env && (f.env.time || f.env.weather)) o.onEnv?.({ time: f.env.time, weather: f.env.weather });
        return;
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
    setMyState({}); // 换房间:分数之类是那间房的规则给的
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
    let last: { x: number; z: number; yaw: number; at: number; sit?: number | null; y?: number } | null = null;
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
      // 十期:坐着 = a 'sit'、y 座面高度(坐下 / 站起来那一下也要报)
      const sit = s.sit ?? null;
      const sitChanged = !last || (last.sit ?? null) !== sit || Math.abs((last.y ?? 0) - (s.y ?? 0)) > 0.01;
      if (!last || moved > 0.01 || turned > 0.01 || tp || sitChanged) {
        if (sit !== null) sock.sendState({ x: +s.x.toFixed(3), y: +sit.toFixed(3), z: +s.z.toFixed(3), yaw: +s.yaw.toFixed(3), m: false, a: 'sit', tp: tp || undefined });
        else sock.sendState({ x: +s.x.toFixed(3), y: +(s.y ?? 0).toFixed(3), z: +s.z.toFixed(3), yaw: +s.yaw.toFixed(3), m: speed > 0.2, a: speed > 3 ? 'run' : speed > 0.2 ? 'walk' : undefined, tp: tp || undefined });
        tpRef.current = false;
        last = { x: s.x, z: s.z, yaw: s.yaw, at: now, sit, y: s.y ?? 0 };
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
  // 九期:换线 / 刷新各条线人数
  const refreshLines = React.useCallback(() => sockRef.current?.lines() ?? false, []);
  /** 世界模型:点了一个实体 */
  const use = React.useCallback((id: string) => sockRef.current?.use(id) ?? false, []);
  const push = React.useCallback((id: string, dx: number, dz: number) => sockRef.current?.push(id, dx, dz) ?? false, []);
  const switchLine = React.useCallback((n: number) => {
    if (!owner || n === line) return;
    setChat([]);
    tpRef.current = true;
    sockRef.current?.join(owner, n);
  }, [owner, line]);

  // online 只算真人(含自己);AI 另外数
  const aiCount = peers.filter((p) => p.ai).length;
  return {
    status, peers, chat, say, online: owner ? peers.length - aiCount + 1 : 0, aiCount, inRoom: !!owner,
    isOwner: !!owner && !!def.room?.mine,
    /** room = 某人的房间;scene = 公共场景(广场、庭院) */
    space: (owner ? (def.kind === 'room' ? 'room' : 'scene') : null) as 'room' | 'scene' | null,
    myCaption,
    /** 九期:场景里在第几条线(0 = 不分线 / 不在场景)、开着的线 */
    line, lines, refreshLines, switchLine,
    /** 世界模型:点实体、我身上的状态 */
    use, push, myState, breath,
    roomVoice, selfMuted, setVoiceState, sendVoice, vmute, setVoiceHandler,
  };
}

export type RoomSocketState = ReturnType<typeof useRoomSocket>;
