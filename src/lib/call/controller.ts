'use client';

/**
 * 一对一通话的浏览器端:状态(zustand)+ WebRTC。网站和 App(Tauri WebView)共用这一份。
 *
 *   主叫  startCall → POST /call/invite(先开好麦克风/摄像头)→ 响铃
 *         ← call.accepted → 建 RTCPeerConnection → offer ─┐
 *   被叫  ← call.invite → 响铃 → accept():开设备 → POST accept → 等 offer → answer
 *         两边的 ICE 候选随时互发;SDP / ICE 都走全站长连接的上行(call.signal),服务端只转发
 *
 * 媒体点对点直连,不经服务器,也没有 TURN 中转(2026-10-04 的决定)。两端都在对称 NAT 后面时
 * 打不通 —— ICE 进 failed(或 disconnected 超过 10 秒)就以 failed 挂断,并如实告诉用户。
 *
 * 信令里的 toDev 是接起电话的那个标签页:同一个人开着多个页面 / 网站和 App 同时在线时,
 * 只有它处理,其余的收到 call.taken 就停止响铃。
 */

import { create } from 'zustand';
import { realtime, deviceId, type RealtimeEvent } from '@/lib/realtime';
import { acceptCall, endCall, getIceServers, inviteCall, type CallMedia, type EndReason, type IceServer } from '@/apis/call';
import { formatApiError } from '@/lib/api/client';
import { startRing, stopRing } from './ring';

export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended';

export interface CallPeerInfo {
  userId: string;
  nickname: string;
  avatar?: string;
}

interface CallState {
  phase: CallPhase;
  callId: string;
  media: CallMedia;
  peer: CallPeerInfo | null;
  /** 主叫时:对方不在线(仍在响,只是提示) */
  peerOffline: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  cameraOff: boolean;
  /** 接通的时间(ms),计时用 */
  startedAt: number;
  /** 结束 / 出错时给人看的一句话 */
  note: string;
}

const initial: CallState = {
  phase: 'idle',
  callId: '',
  media: 'audio',
  peer: null,
  peerOffline: false,
  localStream: null,
  remoteStream: null,
  muted: false,
  cameraOff: false,
  startedAt: 0,
  note: '',
};

export const useCall = create<CallState>(() => ({ ...initial }));
const set = (p: Partial<CallState>) => useCall.setState(p);
const get = () => useCall.getState();

const RING_TIMEOUT = 45_000; // 主叫等这么久没人接就挂(服务端状态 70 秒过期)
const INCOMING_TIMEOUT = 60_000; // 被叫这边兜底:主叫页面崩了也别一直响
const KEEP_EVERY = 30_000;
const DISCONNECT_GRACE = 10_000;

let pc: RTCPeerConnection | null = null;
let iceServers: IceServer[] = [];
let pendingIce: RTCIceCandidateInit[] = [];
let ringTimer: ReturnType<typeof setTimeout> | null = null;
let keepTimer: ReturnType<typeof setInterval> | null = null;
let discTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let facing: 'user' | 'environment' = 'user';
/** 每次 teardown 加一:异步动作 await 回来时据此判断「还是不是同一通」 */
let session = 0;

/** 这个环境能不能打电话。不能时返回原因。 */
export function callUnsupportedReason(media: CallMedia): string | null {
  if (typeof window === 'undefined') return '不支持';
  if (typeof RTCPeerConnection === 'undefined') return '当前环境不支持通话(缺少 WebRTC),请换用网站或手机 App';
  if (!navigator.mediaDevices?.getUserMedia) return '这里拿不到麦克风' + (media === 'video' ? '和摄像头' : '') + '(需要 https 或 App 的权限)';
  return null;
}

async function openDevices(media: CallMedia): Promise<MediaStream> {
  const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio,
      video: media === 'video' ? { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
  } catch (e) {
    const name = (e as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new Error(media === 'video' ? '没有摄像头或麦克风权限,请在系统 / 浏览器设置里允许' : '没有麦克风权限,请在系统 / 浏览器设置里允许');
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      throw new Error(media === 'video' ? '没找到可用的摄像头或麦克风' : '没找到可用的麦克风');
    }
    throw new Error('打开设备失败:' + ((e as Error)?.message || name || '未知错误'));
  }
}

function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((t) => t.stop());
}

function clearTimers() {
  for (const t of [ringTimer, discTimer, closeTimer]) if (t) clearTimeout(t);
  if (keepTimer) clearInterval(keepTimer);
  ringTimer = discTimer = closeTimer = keepTimer = null;
}

/** 收拾干净:关设备、关连接、回到 idle(延迟一会儿让人看到结束提示)。 */
function teardown(note: string, delay = 1800) {
  session++;
  stopRing();
  clearTimers();
  if (pc) {
    pc.onicecandidate = pc.ontrack = pc.onconnectionstatechange = pc.oniceconnectionstatechange = null;
    try {
      pc.close();
    } catch {
      /* 已关 */
    }
  }
  pc = null;
  pendingIce = [];
  get().localStream?.getTracks().forEach((t) => t.stop());
  set({ phase: 'ended', note, localStream: null, remoteStream: null });
  closeTimer = setTimeout(() => useCall.setState({ ...initial }), delay);
}

function signal(kind: 'offer' | 'answer' | 'ice', payload: unknown) {
  const ok = realtime.send({ type: 'call.signal', data: { callId: get().callId, kind, payload } });
  if (!ok && kind !== 'ice') {
    void hangup('failed', '实时连接断开,通话无法建立');
  }
}

function buildPeer(stream: MediaStream) {
  const conn = new RTCPeerConnection({ iceServers: iceServers as RTCIceServer[] });
  pc = conn;
  stream.getTracks().forEach((t) => conn.addTrack(t, stream));
  conn.onicecandidate = (e) => {
    if (e.candidate) signal('ice', e.candidate.toJSON());
  };
  conn.ontrack = (e) => {
    const remote = e.streams[0] || new MediaStream([e.track]);
    set({ remoteStream: remote });
  };
  const watch = () => {
    const st = conn.connectionState || conn.iceConnectionState;
    if (st === 'connected' || conn.iceConnectionState === 'connected' || conn.iceConnectionState === 'completed') {
      if (discTimer) {
        clearTimeout(discTimer);
        discTimer = null;
      }
      if (get().phase !== 'active') set({ phase: 'active', startedAt: Date.now() });
      return;
    }
    if (st === 'failed' || conn.iceConnectionState === 'failed') {
      void hangup('failed', get().phase === 'active' ? '网络中断,通话已结束' : '网络无法直连:双方网络都比较严格,暂时打不通');
      return;
    }
    if ((st === 'disconnected' || conn.iceConnectionState === 'disconnected') && !discTimer) {
      discTimer = setTimeout(() => void hangup('failed', '网络中断,通话已结束'), DISCONNECT_GRACE);
    }
  };
  conn.onconnectionstatechange = watch;
  conn.oniceconnectionstatechange = watch;
  return conn;
}

async function flushIce() {
  if (!pc?.remoteDescription) return;
  const list = pendingIce;
  pendingIce = [];
  for (const c of list) {
    try {
      await pc.addIceCandidate(c);
    } catch {
      /* 过期的候选,忽略 */
    }
  }
}

function startKeep() {
  if (keepTimer) clearInterval(keepTimer);
  keepTimer = setInterval(() => realtime.send({ type: 'call.keep', data: { callId: get().callId } }), KEEP_EVERY);
}

// ── 对外动作 ───────────────────────────────────────────────────────────────

/** 发起通话。失败时抛出可以直接给人看的错误。 */
export async function startCall(peer: CallPeerInfo, media: CallMedia): Promise<void> {
  if (get().phase !== 'idle') throw new Error('正在通话中');
  const why = callUnsupportedReason(media);
  if (why) throw new Error(why);
  if (realtime.getStatus() !== 'open') throw new Error('实时连接未就绪,稍后再试');
  facing = 'user';
  const stream = await openDevices(media);
  // 等权限弹窗期间可能又点了一次呼叫 / 来了电话:这条流没人管就会让麦克风一直亮着
  if (get().phase !== 'idle') {
    stopStream(stream);
    throw new Error('正在通话中');
  }
  set({ ...initial, phase: 'outgoing', media, peer, localStream: stream, cameraOff: false });
  const mine = session;
  let res;
  try {
    res = await inviteCall(peer.userId, media, deviceId());
  } catch (e) {
    if (session === mine) teardown(formatApiError(e) || '呼叫失败', 2200);
    return;
  }
  // 邀请还在路上时已经点了「取消」:hangup 那会儿没有 callId,没通知服务端,
  // 这里补一个 cancel;也不能再起回铃(否则嘟声每 4 秒响一次,永远停不下来)
  if (session !== mine) {
    void endCall(res.callId, 'cancel').catch(() => {});
    return;
  }
  iceServers = res.iceServers || [];
  set({ callId: res.callId, peerOffline: !res.online });
  if (res.busy) {
    teardown('对方忙线中', 2200);
    return;
  }
  startRing('outgoing');
  ringTimer = setTimeout(() => void hangup('timeout', '对方暂时无人接听'), RING_TIMEOUT);
}

/** 接听来电。 */
export async function accept(): Promise<void> {
  const st = get();
  if (st.phase !== 'incoming') return;
  stopRing();
  const why = callUnsupportedReason(st.media);
  if (why) {
    void hangup('failed', why);
    return;
  }
  set({ phase: 'connecting' });
  let stream: MediaStream;
  try {
    const [st2, ice] = await Promise.all([openDevices(st.media), getIceServers().catch(() => [] as IceServer[])]);
    stream = st2;
    iceServers = ice;
  } catch (e) {
    if (get().phase === 'connecting' && get().callId === st.callId) void hangup('failed', (e as Error).message);
    return;
  }
  // 授权弹窗期间对方取消 / 自己挂断:通话已结束,刚拿到的设备立刻关掉,别再建连接
  if (get().phase !== 'connecting' || get().callId !== st.callId) {
    stopStream(stream);
    return;
  }
  set({ localStream: stream });
  if (ringTimer) clearTimeout(ringTimer);
  // 先把连接建好再去接:主叫收到 call.accepted 立刻发 offer,可能比 accept 的 HTTP 回包先到。
  buildPeer(stream);
  try {
    await acceptCall(st.callId, deviceId());
  } catch (e) {
    teardown(formatApiError(e) || '接听失败');
    return;
  }
  startKeep();
}

/** 挂断 / 拒接 / 取消。 */
export async function hangup(reason?: EndReason, note?: string): Promise<void> {
  const st = get();
  if (st.phase === 'idle' || st.phase === 'ended') return;
  const r: EndReason = reason || (st.phase === 'incoming' ? 'reject' : st.phase === 'outgoing' ? 'cancel' : 'hangup');
  const id = st.callId;
  teardown(note || (r === 'reject' ? '已拒绝' : r === 'cancel' ? '已取消' : '通话已结束'));
  if (id) {
    try {
      await endCall(id, r);
    } catch {
      /* 服务端状态会自己过期 */
    }
  }
}

export function toggleMute() {
  const st = get();
  const next = !st.muted;
  st.localStream?.getAudioTracks().forEach((t) => (t.enabled = !next));
  set({ muted: next });
}

export function toggleCamera() {
  const st = get();
  const next = !st.cameraOff;
  st.localStream?.getVideoTracks().forEach((t) => (t.enabled = !next));
  set({ cameraOff: next });
}

/** 手机上前后摄像头切换:换掉发送中的视频轨,不用重新协商。 */
export async function flipCamera() {
  const st = get();
  if (st.media !== 'video' || !st.localStream) return;
  const mine = session;
  facing = facing === 'user' ? 'environment' : 'user';
  let fresh: MediaStream | null = null;
  try {
    fresh = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
    // 切换途中挂断了:teardown 已经关过旧设备,新开的摄像头也得关,否则指示灯一直亮
    if (session !== mine) {
      stopStream(fresh);
      return;
    }
    const track = fresh.getVideoTracks()[0];
    const sender = pc?.getSenders().find((s) => s.track?.kind === 'video');
    await sender?.replaceTrack(track);
    st.localStream.getVideoTracks().forEach((t) => {
      st.localStream?.removeTrack(t);
      t.stop();
    });
    track.enabled = !st.cameraOff;
    st.localStream.addTrack(track);
    set({ localStream: new MediaStream(st.localStream.getTracks()) });
  } catch {
    if (fresh) stopStream(fresh);
    facing = facing === 'user' ? 'environment' : 'user';
  }
}

// ── 长连接事件 ─────────────────────────────────────────────────────────────

interface InviteData {
  callId: string;
  fromUserId: string;
  nickname: string;
  avatar?: string;
  media: CallMedia;
}

/** CallLayer 把所有 call.* 事件交到这里。 */
export async function onCallEvent(ev: RealtimeEvent): Promise<void> {
  const d = (ev.data || {}) as Record<string, unknown>;
  const st = get();
  switch (ev.type) {
    case 'call.invite': {
      const inv = d as unknown as InviteData;
      if (st.phase !== 'idle') {
        // 本页面正在另一通里(服务端的忙线只按人算,同一个人另一台设备的来电理论上到不了这里)
        if (st.callId !== inv.callId) void endCall(inv.callId, 'busy').catch(() => {});
        return;
      }
      if (closeTimer) clearTimeout(closeTimer);
      set({
        ...initial,
        phase: 'incoming',
        callId: inv.callId,
        media: inv.media === 'video' ? 'video' : 'audio',
        peer: { userId: inv.fromUserId, nickname: inv.nickname || '有人', avatar: inv.avatar },
      });
      startRing('incoming');
      ringTimer = setTimeout(() => {
        if (get().phase === 'incoming' && get().callId === inv.callId) teardown('未接来电', 1200);
      }, INCOMING_TIMEOUT);
      return;
    }
    case 'call.taken': {
      if (st.phase === 'incoming' && st.callId === d.callId && d.dev !== deviceId()) teardown('已在其他设备上接听', 1200);
      return;
    }
    case 'call.accepted': {
      if (st.phase !== 'outgoing' || st.callId !== d.callId || d.toDev !== deviceId() || !st.localStream) return;
      stopRing();
      if (ringTimer) clearTimeout(ringTimer);
      set({ phase: 'connecting' });
      const conn = buildPeer(st.localStream);
      startKeep();
      try {
        const offer = await conn.createOffer();
        await conn.setLocalDescription(offer);
        signal('offer', { type: offer.type, sdp: offer.sdp });
      } catch {
        void hangup('failed', '建立通话失败');
      }
      return;
    }
    case 'call.signal': {
      if (st.callId !== d.callId || d.toDev !== deviceId() || !pc) return;
      const payload = d.payload as RTCSessionDescriptionInit & RTCIceCandidateInit;
      try {
        if (d.kind === 'offer') {
          await pc.setRemoteDescription(payload);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          signal('answer', { type: answer.type, sdp: answer.sdp });
          await flushIce();
        } else if (d.kind === 'answer') {
          await pc.setRemoteDescription(payload);
          await flushIce();
        } else if (d.kind === 'ice') {
          if (pc.remoteDescription) await pc.addIceCandidate(payload);
          else pendingIce.push(payload);
        }
      } catch (e) {
        console.warn('[call] signal', d.kind, e);
      }
      return;
    }
    case 'call.end': {
      if (st.callId !== d.callId || st.phase === 'idle' || st.phase === 'ended') return;
      const result = d.result as string;
      const byPeer = d.by !== undefined && st.peer && String(d.by) === st.peer.userId;
      let note = '通话已结束';
      if (st.phase === 'outgoing') note = result === 'rejected' ? '对方已拒绝' : result === 'busy' ? '对方忙线中' : '对方未接听';
      else if (st.phase === 'incoming') note = byPeer ? '对方已取消' : '已结束';
      else if (byPeer) note = d.reason === 'failed' ? '网络中断,通话已结束' : '对方已挂断';
      teardown(note);
      return;
    }
  }
}
