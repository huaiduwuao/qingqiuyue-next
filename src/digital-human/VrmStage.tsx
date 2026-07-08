'use client';

/**
 * VrmStage.tsx — 全身取景 + 多场景 + 5 hooks 编排的 VRM 舞台
 *
 * 设计要点：
 *   - 替代 BlenderAvatar 用在 /digital-human 公共页。保留 emotion/viseme/action 三个 prop
 *     （向后兼容 useChatAvatarWS 的输出）。
 *   - 用 forwardRef 暴露 VrmStageHandle（接 Hermes 工具调用的入口）。
 *   - 内部用 5 个独立 hook 拆解关注点：renderer / scene / lipSync / dance / camera。
 *   - 复用 ./vrm/loadAvatar 的 cache + 加载逻辑（与 BlenderAvatar 共享）。
 *
 * 关键 prop：
 *   - modelUrl    VRM 路径，默认 /avatars/character.vrm
 *   - emotion     表情 blendshape dict（chat hook 推过来）
 *   - viseme      口型 blendshape dict（chat hook 推过来）
 *   - currentAction  动作名（idle/wave/...，chat hook 推过来）
 *
 * VrmStageHandle（ref.current）：
 *   - setEmotion(dict) / setViseme(dict) / setAction(name)
 *   - setScene(name) / setCameraPreset(name) / setDanceStyle(name)
 *   - setDanceAmp(n) / setBpm(n)
 *   - speak(text, audioUrl?)
 *   - getScreenshot()  (debug)
 */

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

import { loadAvatar, type Cached } from './vrm/loadAvatar';
import { useVrmRenderer } from './vrm/useVrmRenderer';
import { useVrmScene } from './vrm/useVrmScene';
import { useVrmLipSync } from './vrm/useVrmLipSync';
import { useVrmDance } from './vrm/useVrmDance';
import { useVrmCamera } from './vrm/useVrmCamera';
import { makeConfetti, updateConfetti } from './vrm/particles';
import { createAudioHandle, type AudioHandle } from './vrm/audio';
import type { ScenePresetName, CameraPresetName, DanceStyle, PoseName } from './vrm/types';
import { POSES } from './vrm/poses';

export interface VrmStageHandle {
  setEmotion: (dict: Record<string, number>) => void;
  setViseme: (dict: Record<string, number>) => void;
  setAction: (name: string) => void;
  setScene: (name: ScenePresetName) => void;
  setCameraPreset: (name: CameraPresetName) => void;
  setDanceStyle: (s: DanceStyle) => void;
  setDanceAmp: (v: number) => void;
  setBpm: (v: number) => void;
  setDancing: (on: boolean) => void;
  setPose: (name: PoseName) => void;
  /** 触发口型时间线（TTS+viseme） */
  speak: (text: string, audioUrl?: string) => void;
  /** 切换"是否被手动 UI 覆盖"（表情/口型/眨眼滑杆时） */
  setUserLipOverride: (on: boolean) => void;
  setUserBlinkOverride: (on: boolean) => void;
  /** 彩屑开关 */
  setConfetti: (on: boolean) => void;
  /** 演示歌曲 */
  startSong: () => void;
  stopSong: () => void;
  /** 麦克风 */
  startMic: () => Promise<boolean>;
  stopMic: () => void;
  getScreenshot: () => string | null;
}

export interface VrmStageProps {
  modelUrl?: string;
  /** 表情（chat hook 推过来） */
  emotion?: Record<string, number>;
  /** 口型（chat hook 推过来） */
  viseme?: Record<string, number>;
  /** 动作（chat hook 推过来） */
  currentAction?: string;
  /** 自动眨眼（默认 true） */
  autoBlink?: boolean;
  /** 视线跟随相机（默认 true） */
  lookAtCamera?: boolean;
  /** 背景色（默认透明，让场景 sky dome 显示） */
  background?: string;
  /** 透传样式 */
  sx?: React.CSSProperties;
  /** 调试：按 1 跳过 three.js */
  debugNoThree?: boolean;
  /**
   * handle 就绪回调（首帧 mount 后触发，useImperativeHandle 跑完才 fire）。
   * 父组件用这个把 handle 存到 state，避免首次渲染时 ref.current 还没填的坑。
   */
  onReady?: (handle: VrmStageHandle) => void;
}

const EXPRESSION_PASSTHROUGH = new Set([
  'happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral',
  'aa', 'ih', 'ou', 'ee', 'oh', 'blink', 'blinkLeft', 'blinkRight',
  'joy', 'sorrow', 'fun',  // 兼容 VRM 0.0 旧名
  'viseme_sil', 'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U', 'viseme_ou', 'viseme_ih',
  'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR',
]);

export const VrmStage = forwardRef<VrmStageHandle, VrmStageProps>(function VrmStage(props, ref) {
  const {
    modelUrl = '/avatars/character.vrm',
    emotion = {},
    viseme = {},
    currentAction = 'idle',
    autoBlink = true,
    lookAtCamera = true,
    background = 'transparent',
    sx,
    debugNoThree,
    onReady,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vrmSceneRef = useRef<any>(null);  // THREE.Object3D of the loaded VRM
  const vrmDataRef = useRef<Cached | null>(null);
  const expressionManagerRef = useRef<any>(null);
  const vrmRef = useRef<any>(null);
  const handleInternalRef = useRef<VrmStageHandle | null>(null);  // useImperativeHandle 工厂里同步存 handle

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confettiOn, setConfettiOn] = useState(false);
  const confettiRef = useRef<any>(null);

  const userLipOverrideRef = useRef(false);
  const userBlinkOverrideRef = useRef(false);
  const blinkTRef = useRef(1.5);
  const blinkVRef = useRef(0);

  // 0. 共享 audio handle（dance 需要它来同步 BPM）
  const audioRef = useRef<AudioHandle | null>(null);
  if (!audioRef.current) audioRef.current = createAudioHandle();
  const audio = audioRef.current;

  // 1. renderer
  const rendererApi = useVrmRenderer({ canvas: canvasRef.current, fov: 30, enableControls: true });
  const rendererState = rendererApi.state;

  // 2. scene
  const sceneApi = useVrmScene({ rendererState, vrmScene: vrmSceneRef.current, initialPreset: 'concert' });

  // 3. dance
  const danceApi = useVrmDance({ vrm: vrmRef.current, audio, initialDancing: false });

  // 4. lip sync
  const lipApi = useVrmLipSync({ expressionManager: expressionManagerRef.current, audio, userLipOverride: false });

  // 5. camera
  const camApi = useVrmCamera({ camera: rendererState?.camera ?? null, controls: rendererState?.controls ?? null });

  // 加载 VRM
  useEffect(() => {
    if (!rendererState) return;
    if (debugNoThree) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const cached = await loadAvatar(modelUrl, { rotateVRM0: true, removeUnnecessaryJoints: true });
        if (cancelled) return;
        vrmDataRef.current = cached;
        vrmRef.current = cached.vrm;
        vrmSceneRef.current = cached.scene;
        expressionManagerRef.current = cached.expressionManager;
        cached.scene.traverse((o: any) => { o.castShadow = true; o.frustumCulled = false; });
        rendererState.scene.add(cached.scene);
        // 贴地
        const THREE_NS = (rendererState as any).THREE_NS as typeof import('three');
        const box = new THREE_NS.Box3().setFromObject(cached.scene);
        const minY = box.min.y;
        cached.scene.position.y -= minY;
        // 记录 hip 基线
        const hips = cached.humanoid?.getNormalizedBoneNode?.('hips');
        if (hips) {
          const baseY = hips.getWorldPosition(new THREE_NS.Vector3()).y;
          danceApi.setHipsBaseY(baseY);
        }
        // 视线
        if (cached.vrm.lookAt) {
          cached.vrm.lookAt.target = lookAtCamera ? rendererState.camera : null;
        }
        setLoading(false);
      } catch (e: any) {
        console.error('[VrmStage] load failed', e);
        setError(e?.message || String(e));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      const cached = vrmDataRef.current;
      if (cached && rendererState) rendererState.scene.remove(cached.scene);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendererState, modelUrl]);

  // 启动 rAF（拿到 rendererState 后）
  useEffect(() => {
    if (!rendererState) return;
    rendererApi.setOnFrame((dt, t) => {
      // 1. lip sync
      lipApi.tick(dt);
      // 2. 自动眨眼
      if (autoBlink && vrmDataRef.current?.expressionManager && !userBlinkOverrideRef.current) {
        blinkTRef.current -= dt;
        if (blinkTRef.current <= 0) blinkTRef.current = 1.2 + Math.random() * 3.5;
        blinkVRef.current = blinkTRef.current > 0.12 ? 0 : Math.sin((0.12 - blinkTRef.current) / 0.12 * Math.PI);
        vrmDataRef.current.expressionManager.setValue('blink', blinkVRef.current);
      }
      // 3. 应用 chat 推过来的 emotion / viseme
      if (vrmDataRef.current?.expressionManager) {
        const em = vrmDataRef.current.expressionManager;
        for (const [k, v] of Object.entries(emotion)) {
          if (EXPRESSION_PASSTHROUGH.has(k)) em.setValue(k, v);
        }
        for (const [k, v] of Object.entries(viseme)) {
          if (EXPRESSION_PASSTHROUGH.has(k)) em.setValue(k, v);
        }
      }
      // 4. dance
      danceApi.tick(t, dt);
      // 5. scene breath
      const bass = lipApi.audio.poll().bass;
      sceneApi.tick(t, dt, bass, danceApi.dancing, 1);
      // 6. camera anim
      camApi.tick(dt);
      // 7. confetti
      if (confettiOn && confettiRef.current && rendererState) {
        updateConfetti((rendererState as any).THREE_NS, confettiRef.current, dt);
      }
      // 8. VRM 内部更新（spring bone / lookAt）
      vrmDataRef.current?.vrm?.update?.(dt);
    });
    rendererApi.start();
    return () => rendererApi.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendererState, autoBlink, confettiOn]);

  // 暴露 handle
  useImperativeHandle(ref, () => {
    const h: VrmStageHandle = {
      setEmotion: (dict) => {
        if (!vrmDataRef.current?.expressionManager) return;
        for (const [k, v] of Object.entries(dict)) vrmDataRef.current.expressionManager.setValue(k, v);
      },
      setViseme: (dict) => {
        if (!vrmDataRef.current?.expressionManager) return;
        for (const [k, v] of Object.entries(dict)) vrmDataRef.current.expressionManager.setValue(k, v);
      },
      setAction: (name) => { danceApi.setPose(name as PoseName); },
      setScene: (name) => { sceneApi.setPreset(name); rebuildConfetti(name); },
      setCameraPreset: (name) => { camApi.switchTo(name); },
      setDanceStyle: (s) => { danceApi.setStyle(s); },
      setDanceAmp: (v) => { danceApi.setAmp(v); },
      setBpm: (v) => { danceApi.setBpm(v); },
      setDancing: (on) => { danceApi.setDancing(on); },
      setPose: (name) => { danceApi.setPose(name); },
      speak: (text, audioUrl) => {
        console.log('[VrmStage] speak:', text, audioUrl);
      },
      setUserLipOverride: (on) => { userLipOverrideRef.current = on; },
      setUserBlinkOverride: (on) => { userBlinkOverrideRef.current = on; },
      setConfetti: (on) => {
        setConfettiOn(on);
        if (on) rebuildConfetti(sceneApi.preset);
        else removeConfetti();
      },
      startSong: () => { lipApi.startSong(); },
      stopSong: () => { lipApi.stopSong(); },
      startMic: async () => { const ok = await lipApi.startMic(); return ok; },
      stopMic: () => { lipApi.stopMic(); },
      getScreenshot: () => {
        const r = (rendererState as any)?.renderer;
        if (!r) return null;
        try { return r.domElement.toDataURL('image/png'); } catch { return null; }
      },
    };
    // 同步保存到内部 ref，下面的 useEffect 会读它再调 onReady
    handleInternalRef.current = h;
    return h;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendererState, sceneApi, danceApi, camApi, confettiOn, sceneApi.preset]);

  // useEffect: handle 重建后通知父组件（onReady 是 useState 的 setter，引用稳定）
  useEffect(() => {
    if (!onReady || !handleInternalRef.current) return;
    onReady(handleInternalRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReady, rendererState, sceneApi, danceApi, camApi, confettiOn, sceneApi.preset]);

  function rebuildConfetti(_name: ScenePresetName) {
    if (!rendererState || !confettiOn) return;
    const THREE_NS = (rendererState as any).THREE_NS as typeof import('three');
    removeConfetti();
    confettiRef.current = makeConfetti(THREE_NS);
    // 挂到主 scene（彩屑应当浮在整个舞台上）
    rendererState.scene.add(confettiRef.current);
  }
  function removeConfetti() {
    if (confettiRef.current && rendererState) {
      rendererState.scene.remove(confettiRef.current);
      confettiRef.current.geometry.dispose();
      confettiRef.current.material.dispose();
      confettiRef.current = null;
    }
  }

  // resize 容器
  useEffect(() => {
    const id = setInterval(() => rendererApi.resize(), 250);
    return () => clearInterval(id);
  }, [rendererApi]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', background, ...sx }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', outline: 'none', touchAction: 'none' }}
      />
      {loading && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, pointerEvents: 'none' }}>
          <CircularProgress size={28} sx={{ color: 'rgba(255,255,255,0.6)' }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>加载数字人…</Typography>
        </Box>
      )}
      {error && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <Typography sx={{ color: 'error.main', fontSize: 13, textAlign: 'center', maxWidth: 320 }}>{error}</Typography>
        </Box>
      )}
    </Box>
  );
});
