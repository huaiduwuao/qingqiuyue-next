/**
 * vrm/useVrmLipSync.ts — 音频频谱 → VRM 表情 (aa/ih/ou/oh)
 *
 * 用法：
 *   const lipApi = useVrmLipSync({ expressionManager, audio });
 *   lipApi.tick(dt);  // 每帧调
 *   // audio 由 VrmStage 创建并传入（与 useVrmDance 共享同一 AudioContext）
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioHandle, LipFrame } from './audio';

export interface UseVrmLipSyncOptions {
  /** VRM expressionManager（无 vrm 时为 null，自动 noop） */
  expressionManager: any;
  /** 由父组件传入的 audio handle（与 useVrmDance 共享） */
  audio: AudioHandle;
  /** 手动 UI 是否在用口型滑杆（true 时跳过自动覆盖） */
  userLipOverride?: boolean;
}

export function useVrmLipSync(opts: UseVrmLipSyncOptions) {
  const { expressionManager, audio, userLipOverride = false } = opts;
  const [songOn, setSongOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const lastFrameRef = useRef<LipFrame>({ aa: 0, ih: 0, ou: 0, oh: 0, bass: 0 });

  const tick = useCallback((_dt: number) => {
    if (!expressionManager || userLipOverride) return;
    const frame = audio.poll();
    lastFrameRef.current = frame;
    expressionManager.setValue('aa', frame.aa);
    expressionManager.setValue('ih', frame.ih);
    expressionManager.setValue('ou', frame.ou);
    expressionManager.setValue('oh', frame.oh);
  }, [audio, expressionManager, userLipOverride]);

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
