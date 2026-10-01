/**
 * scene-ui/useRoomVoice.ts — 创世四期:房间里的语音
 *
 *   - 「开启声音」(用户点一下,浏览器才让放声音)→ 建 VoiceEngine,接上房间连接的二进制帧,报 voice=1;
 *   - 「开麦」= 接上麦克风 + 人声闸门,说话才发;「按住说话」/ 按住 V 键 = 按着就发;接上麦克风后报 voice=2;
 *   - 每 100ms:自己的位置和镜头朝向 → 听者;同伴(插值后的)位置 → 各自的声像;谁在说话 → 界面和嘴型;
 *   - 房里的 AI 说的话用浏览器朗读念出来(按距离调音量),可以关;
 *   - 我这边屏蔽某人只影响自己听到的;房主「禁言」走服务端(vmute),被禁言的人发了也不转。
 *   - 离开房间 / 房主关了语音 / 被禁言:麦克风立即关掉(浏览器的录音指示灯也灭)。
 *
 * 测试台没有麦克风:页面上挂 window.__qqVoiceMicStream(ctx) => MediaStream 就用它代替(只有测试台会挂)。
 */

import React from 'react';
import { VoiceEngine, voiceSupport, type VoiceSupport } from '@/lib/world/voice/voiceEngine';
import { AiSpeech, volumeForDistance } from '@/lib/world/voice/aiSpeech';
import type { VrmStageHandle } from '../VrmStage';
import type { RoomSocketState } from './useRoomSocket';

const AI_VOICE_KEY = 'qq.room.aiVoice';

function readAiVoicePref(): boolean {
  try { return window.localStorage.getItem(AI_VOICE_KEY) !== '0'; } catch { return true; }
}

function isTyping(el: EventTarget | null): boolean {
  const e = el as HTMLElement | null;
  if (!e) return false;
  return e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' || e.isContentEditable;
}

export interface UseRoomVoiceOptions {
  rs: RoomSocketState;
  handle: VrmStageHandle | null;
  toast: (icon: string, text: string) => void;
}

export function useRoomVoice({ rs, handle, toast }: UseRoomVoiceOptions) {
  const [support, setSupport] = React.useState<VoiceSupport | null>(null);
  const [soundOn, setSoundOn] = React.useState(false);
  const [micOn, setMicOn] = React.useState(false);
  const [micReady, setMicReady] = React.useState(false);
  const [ptt, setPttState] = React.useState(false);
  const [talking, setTalking] = React.useState(false);
  const [selfLevel, setSelfLevel] = React.useState(0);
  const [speaking, setSpeaking] = React.useState<string[]>([]);
  const [aiVoice, setAiVoiceState] = React.useState(true);
  const [blocked, setBlocked] = React.useState<Record<string, boolean>>({});
  const [busy, setBusy] = React.useState(false);
  const [aiSpeechOk, setAiSpeechOk] = React.useState(false);
  const engineRef = React.useRef<VoiceEngine | null>(null);
  const aiRef = React.useRef<AiSpeech | null>(null);
  const rsRef = React.useRef(rs);
  rsRef.current = rs;
  const handleRef = React.useRef(handle);
  handleRef.current = handle;
  const toastRef = React.useRef(toast);
  toastRef.current = toast;

  React.useEffect(() => {
    let alive = true;
    voiceSupport().then((s) => { if (alive) setSupport(s); }).catch(() => { if (alive) setSupport({ listen: false, talk: false, reason: '这个浏览器不支持房间语音' }); });
    setAiVoiceState(readAiVoicePref());
    // 中文朗读声音是异步加载的
    aiRef.current ??= new AiSpeech();
    const ai = aiRef.current;
    const check = () => { if (alive) setAiSpeechOk(ai.hasChineseVoice()); };
    check();
    if (ai.supported) window.speechSynthesis.addEventListener?.('voiceschanged', check);
    return () => { alive = false; if (ai.supported) window.speechSynthesis.removeEventListener?.('voiceschanged', check); };
  }, []);

  // 同伴的嘴型:真人看解出来的音量,AI 看朗读
  const levelOf = React.useCallback((id: string) => {
    const e = engineRef.current;
    const a = aiRef.current;
    return Math.max(e ? e.level(id) : 0, a ? a.level(id) : 0);
  }, []);

  const disable = React.useCallback(() => {
    const e = engineRef.current;
    engineRef.current = null;
    e?.dispose();
    aiRef.current?.cancel();
    rsRef.current.setVoiceHandler(null);
    rsRef.current.setVoiceState(0);
    handleRef.current?.setPeerVoiceLevels(null);
    setSoundOn(false);
    setMicOn(false);
    setMicReady(false);
    setPttState(false);
    setTalking(false);
    setSpeaking([]);
  }, []);

  const enable = React.useCallback(async () => {
    if (engineRef.current) return engineRef.current;
    if (!rsRef.current.roomVoice) {
      toastRef.current('🔇', '房主关了房间语音');
      return null;
    }
    if (!support?.listen) {
      toastRef.current('🔇', support?.reason || '这个浏览器不支持房间语音');
      return null;
    }
    const micStream = (window as unknown as { __qqVoiceMicStream?: (ctx: AudioContext) => Promise<MediaStream> }).__qqVoiceMicStream;
    const e = new VoiceEngine({ send: (b) => rsRef.current.sendVoice(b), micStream });
    await e.resume();
    engineRef.current = e;
    aiRef.current ??= new AiSpeech();
    rsRef.current.setVoiceHandler((b) => e.receive(b));
    rsRef.current.setVoiceState(1);
    handleRef.current?.setPeerVoiceLevels(levelOf);
    setSoundOn(true);
    return e;
  }, [support, levelOf]);

  // 接上麦克风(会弹权限);成功后报 voice=2
  const ensureMic = React.useCallback(async (): Promise<VoiceEngine | null> => {
    const r = rsRef.current;
    if (!support?.talk) { toastRef.current('🎤', support?.reason || '这里不能开麦'); return null; }
    if (!r.roomVoice) { toastRef.current('🔇', '房主关了房间语音'); return null; }
    if (r.selfMuted) { toastRef.current('🔇', '房主让你先别说话'); return null; }
    const e = engineRef.current ?? await enable();
    if (!e) return null;
    if (!e.micReady) {
      setBusy(true);
      try {
        await e.startMic();
      } catch (err) {
        toastRef.current('🎤', (err as Error)?.message || '麦克风打不开');
        return null;
      } finally {
        setBusy(false);
      }
      if (engineRef.current !== e) return null;
      setMicReady(true);
      rsRef.current.setVoiceState(2);
    }
    return e;
  }, [support, enable]);

  const closeMic = React.useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    e.openMic = false;
    e.ptt = false;
    e.stopMic();
    setMicOn(false);
    setMicReady(false);
    setPttState(false);
    rsRef.current.setVoiceState(1);
  }, []);

  const toggleMic = React.useCallback(async () => {
    if (micOn) { closeMic(); return; }
    const e = await ensureMic();
    if (!e) return;
    e.openMic = true;
    setMicOn(true);
  }, [micOn, closeMic, ensureMic]);

  const pttDownRef = React.useRef(false);
  const setPtt = React.useCallback(async (down: boolean) => {
    pttDownRef.current = down;
    if (!down) {
      if (engineRef.current) engineRef.current.ptt = false;
      setPttState(false);
      return;
    }
    const e = await ensureMic();
    // 等权限的时候已经松手了:不发
    if (!e || !pttDownRef.current) return;
    e.ptt = true;
    setPttState(true);
  }, [ensureMic]);

  const setAiVoice = React.useCallback((on: boolean) => {
    setAiVoiceState(on);
    try { window.localStorage.setItem(AI_VOICE_KEY, on ? '1' : '0'); } catch { /* 隐私模式 */ }
    if (!on) aiRef.current?.cancel();
  }, []);

  const toggleBlock = React.useCallback((id: string) => {
    setBlocked((b) => {
      const next = { ...b, [id]: !b[id] };
      engineRef.current?.setPeerVolume(id, 1, !!next[id]);
      return next;
    });
  }, []);

  // 离开房间:全关(麦克风也放掉)
  React.useEffect(() => { if (!rs.inRoom && engineRef.current) disable(); }, [rs.inRoom, disable]);
  React.useEffect(() => () => { engineRef.current?.dispose(); engineRef.current = null; aiRef.current?.cancel(); }, []);
  // 房主关了语音 / 我被禁言:关麦
  React.useEffect(() => {
    if ((!rs.roomVoice || rs.selfMuted) && engineRef.current?.micReady) {
      closeMic();
      toastRef.current('🔇', rs.selfMuted ? '房主让你先别说话' : '房主关了房间语音');
    }
  }, [rs.roomVoice, rs.selfMuted, closeMic]);
  // 关了房间语音:声音也停(服务端不再转发,留着空的引擎没意义)
  React.useEffect(() => { if (!rs.roomVoice && engineRef.current) disable(); }, [rs.roomVoice, disable]);

  // 按住 V 说话
  React.useEffect(() => {
    if (!rs.inRoom || !soundOn || !support?.talk) return;
    const down = (ev: KeyboardEvent) => {
      if (ev.code !== 'KeyV' || ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey || isTyping(ev.target)) return;
      void setPtt(true);
    };
    const up = (ev: KeyboardEvent) => { if (ev.code === 'KeyV' && pttDownRef.current) void setPtt(false); };
    const blur = () => { if (pttDownRef.current) void setPtt(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [rs.inRoom, soundOn, support, setPtt]);

  // 每 100ms:听者 / 声像 / 谁在说话
  React.useEffect(() => {
    if (!soundOn) return;
    const timer = window.setInterval(() => {
      const e = engineRef.current;
      if (!e) return;
      const snap = handleRef.current?.getWorldSnapshot();
      if (snap) {
        e.setListener(snap.x, snap.z, snap.camYaw);
        for (const p of snap.peers) e.setSpeakerPos(p.id, p.x, p.z);
      }
      const ids = e.speaking();
      const ai = aiRef.current?.speakingId;
      if (ai) ids.push(ai);
      ids.sort();
      setSpeaking((prev) => (prev.length === ids.length && prev.every((v, i) => v === ids[i]) ? prev : ids));
      setTalking(e.talking);
      setSelfLevel((v) => (Math.abs(v - e.selfLevel) > 0.04 ? e.selfLevel : v));
    }, 100);
    return () => window.clearInterval(timer);
  }, [soundOn]);

  // 走了的人:拆掉他的解码器
  const peerIds = rs.peers.map((p) => p.id).join(',');
  React.useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    const keep = new Set(peerIds ? peerIds.split(',') : []);
    for (const id of e.speakerIds()) if (!keep.has(id)) e.removeSpeaker(id);
  }, [peerIds]);

  // AI 说的话念出来
  const lastSpoken = React.useRef(0);
  const lastLine = rs.chat[rs.chat.length - 1];
  React.useEffect(() => {
    if (!lastLine || lastLine.ts <= lastSpoken.current) return;
    lastSpoken.current = lastLine.ts;
    if (!soundOn || !aiVoice || !lastLine.ai || blocked[lastLine.id]) return;
    const snap = handleRef.current?.getWorldSnapshot();
    const p = rsRef.current.peers.find((x) => x.id === lastLine.id);
    const d = snap && p ? Math.hypot(p.x - snap.x, p.z - snap.z) : 3;
    aiRef.current?.speak(lastLine.id, lastLine.text, volumeForDistance(d));
  }, [lastLine, soundOn, aiVoice, blocked]);

  const engineStats = React.useCallback(() => engineRef.current?.stats ?? null, []);

  return {
    support, soundOn, micOn, micReady, ptt, talking, selfLevel, speaking, aiVoice, blocked, busy,
    enable, disable, toggleMic, closeMic, setPtt, setAiVoice, toggleBlock, engineStats,
    aiSpeechSupported: aiSpeechOk,
  };
}

export type RoomVoiceState = ReturnType<typeof useRoomVoice>;
