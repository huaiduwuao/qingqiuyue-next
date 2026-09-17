/**
 * vrm/useVrmLipSync.ts — 音频频谱 → VRM 表情 (aa/ih/ou/oh)
 *
 * 用法：
 *   const lipApi = useVrmLipSync({ emRef, audio });
 *   lipApi.tick(dt);  // 每帧调
 *   // audio 由 VrmStage 创建并传入（与 useVrmAnimation 共享同一 AudioContext）
 */

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { AudioHandle, LipFrame } from './audio';
import { setExpression } from './vrmCompat';

export interface UseVrmLipSyncOptions {
  /**
   * VRM expressionManager 的 ref。必须是 ref:VRM 是异步加载的,而帧循环只注册一次,
   * 闭包里拿到的是注册那一刻的值。以前这里传的是 expressionManagerRef.current(当时还是 null),
   * tick 每帧都在第一行 return —— 音频驱动的口型从来没有生效过,嘴只能靠「每字 150ms」的
   * 计时器硬猜,和真实语音对不上。
   */
  emRef: MutableRefObject<any>;
  /** 由父组件传入的 audio handle（与 useVrmAnimation 共享） */
  audio: AudioHandle;
  /** 手动 UI 是否在用口型滑杆（true 时跳过自动覆盖） */
  userLipOverride?: boolean;
  /** VRM 版本 ref（0 = 0.0 用 viseme_aa 前缀，1 = 1.0 用 aa） */
  vrmVersionRef?: MutableRefObject<0 | 1>;
}

/** 低于这个能量视为没在出声 */
const SPEAKING_FLOOR = 0.03;

export function useVrmLipSync(opts: UseVrmLipSyncOptions) {
  const { emRef, audio, userLipOverride = false, vrmVersionRef } = opts;
  const [songOn, setSongOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const lastFrameRef = useRef<LipFrame>({ aa: 0, ih: 0, ou: 0, oh: 0, bass: 0 });
  /** 上一帧是不是由音频在驱动嘴 —— 从「在说」变成「不说」的那一帧要把口型清零 */
  const drivingRef = useRef(false);

  /**
   * 每帧调。返回这一帧嘴是不是由真实音频在驱动:是的话调用方不要再用文本时间线去猜口型,
   * 两路同时写会互相打架。
   */
  const tick = useCallback((_dt: number): boolean => {
    const em = emRef.current;
    if (!em || userLipOverride) return false;
    const frame = audio.poll();
    lastFrameRef.current = frame;
    const speaking = frame.aa + frame.ih + frame.ou > SPEAKING_FLOOR;
    if (!speaking && !drivingRef.current) return false;
    const ver = vrmVersionRef?.current ?? 1;
    const w = speaking ? 1 : 0;
    setExpression(em, 'aa', frame.aa * w, ver);
    setExpression(em, 'ih', frame.ih * w, ver);
    setExpression(em, 'ou', frame.ou * w, ver);
    setExpression(em, 'oh', frame.oh * w, ver);
    drivingRef.current = speaking;
    return speaking;
  }, [audio, emRef, userLipOverride, vrmVersionRef]);

  const startSong = useCallback(() => {
    audio.startSong();
    setSongOn(true);
  }, [audio]);
  const stopSong = useCallback(() => { audio.stopSong(); setSongOn(false); }, [audio]);
  const toggleSong = useCallback(() => { songOn ? stopSong() : startSong(); }, [songOn, startSong, stopSong]);

  const startMic = useCallback(async () => {
    const ok = await audio.startMic();
    setMicOn(ok);
    return ok;
  }, [audio]);
  const stopMic = useCallback(() => { audio.stopMic(); setMicOn(false); }, [audio]);
  const toggleMic = useCallback(async () => { micOn ? stopMic() : await startMic(); }, [micOn, startMic, stopMic]);

  const connectElement = useCallback((el: HTMLAudioElement) => { audio.connectElement(el); }, [audio]);

  return { tick, audio, songOn, micOn, startSong, stopSong, toggleSong, startMic, stopMic, toggleMic, connectElement };
}
