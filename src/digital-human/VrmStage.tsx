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

import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

import { loadAvatar, type Cached } from './vrm/loadAvatar';
import { useVrmRenderer } from './vrm/useVrmRenderer';
import { useVrmScene } from './vrm/useVrmScene';
import { useVrmLipSync } from './vrm/useVrmLipSync';
import { useVrmDance } from './vrm/useVrmDance';
import { useVrmCamera } from './vrm/useVrmCamera';
import { makeConfetti, updateConfetti } from './vrm/particles';
import { createAudioHandle, type AudioHandle } from './vrm/audio';
import { detectVrmVersion, setExpression, setExpressionDict, listAvailableExpressions } from './vrm/vrmCompat';
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
  /** 身体位置（body.move tool） */
  move: (target: { x: number; y?: number; z: number } | 'left' | 'right' | 'center' | 'forward' | 'back', opts?: { durationMs?: number; style?: 'walk' | 'run' | 'teleport' }) => void;
  /** 直接设位置（瞬移） */
  setPosition: (x: number, z: number) => void;
  /** 获取当前 (x, z) */
  getPosition: () => { x: number; z: number };
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

  // 关键：把 hook 返回值（每次 render 都是新对象）存到 ref，handle 内部读 ref
  // 这样 useImperativeHandle 的 factory 用空 deps 只跑一次，handle 引用稳定
  const sceneApiRef = useRef<any>(null);
  const danceApiRef = useRef<any>(null);
  const camApiRef = useRef<any>(null);
  const rendererStateRef = useRef<any>(null);
  const lipApiRef = useRef<any>(null);
  const rendererApiRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confettiOn, setConfettiOn] = useState(false);
  const confettiRef = useRef<any>(null);
  const vrmVersionRef = useRef<0 | 1>(1);  // VRM 0.0/1.0 — 0 用 joy/sorrow/fun/viseme_aa，1 用 happy/aa
  // 角色位置（x, z，y 始终 0 在地面上）
  const positionRef = useRef({ x: 0, z: 0, prevX: 0, prevZ: 0 });
  // 行走状态（useVrmDance 通过 walkRef 读这个来播放行走动画）
  // 移动动画状态
  const moveAnimRef = useRef<{ active: boolean; startTime: number; duration: number; fromX: number; fromZ: number; toX: number; toZ: number; style: 'walk' | 'run' | 'teleport' }>({
    active: false, startTime: 0, duration: 0, fromX: 0, fromZ: 0, toX: 0, toZ: 0, style: 'walk',
  });
  // 行走状态（useVrmDance 通过 walkRef 读这个来播放行走动画）
  const walkRef = useRef<{ moving: boolean; phase: number; style: 'walk' | 'run' | 'idle' | 'teleport' }>({ moving: false, phase: 0, style: 'idle' });
  // 行走步进（每帧 dt 累积）
  const walkStepRef = useRef(0);

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
  rendererApiRef.current = rendererApi;
  rendererStateRef.current = rendererState;

  // 2. scene
  const sceneApi = useVrmScene({ rendererState, vrmScene: vrmSceneRef.current, initialPreset: 'concert' });
  sceneApiRef.current = sceneApi;

  // 3. dance（用 ref 传 vrm —— VRM 是异步加载的，首次渲染时 vrmRef.current 是 null）
  const danceApi = useVrmDance({ vrmRef, audio, walkRef, initialDancing: false });
  danceApiRef.current = danceApi;

  // 4. lip sync
  const lipApi = useVrmLipSync({
    expressionManager: expressionManagerRef.current,
    audio,
    userLipOverride: false,
    vrmVersion: vrmVersionRef.current,
  });
  lipApiRef.current = lipApi;

  // 5. camera
  const camApi = useVrmCamera({ camera: rendererState?.camera ?? null, controls: rendererState?.controls ?? null });
  camApiRef.current = camApi;

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
        // 检测 VRM 版本 + 列出可用的 expression（调试用）
        const ver = detectVrmVersion(cached.vrm);
        vrmVersionRef.current = ver;
        const available = listAvailableExpressions(cached.expressionManager);
        console.log(`[VrmStage] VRM 版本: ${ver}, 可用 expressions (${available.length}):`, available.slice(0, 30));
        cached.scene.traverse((o: any) => { o.castShadow = true; o.frustumCulled = false; });
        rendererState.scene.add(cached.scene);
        // 贴地（Box3 minY 加 tolerance：0 < minY < 0.1 视为 0，避免 shadow plane 之类的微正数把模型降到地板下）
        const THREE_NS = (rendererState as any).THREE_NS as typeof import('three');
        const box = new THREE_NS.Box3().setFromObject(cached.scene);
        const rawMinY = box.min.y;
        const minY = (rawMinY > 0 && rawMinY < 0.1) ? 0 : rawMinY;
        console.log(`[VrmStage] Box3 minY=${rawMinY.toFixed(3)}, 调整后=${minY.toFixed(3)}`);
        cached.scene.position.y -= minY;
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

  // WASD/QE 键盘控制 — 自由轨道
  const keysRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e'].includes(k)) {
        keysRef.current[k] = true;
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key.toLowerCase()] = false; };
    const onBlur = () => { keysRef.current = {}; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // 启动 rAF（拿到 rendererState 后）
  useEffect(() => {
    if (!rendererState) return;
    rendererApi.setOnFrame((dt, t) => {
      // 0. WASD 键盘控制（先于其他，避免 camera 动画冲突）
      const keys = keysRef.current;
      if (keys.w) camApi.orbit('in', dt);
      if (keys.s) camApi.orbit('out', dt);
      if (keys.a) camApi.orbit('left', dt);
      if (keys.d) camApi.orbit('right', dt);
      if (keys.q) camApi.orbit('up', dt);
      if (keys.e) camApi.orbit('down', dt);
      // 1. lip sync
      lipApi.tick(dt);
      // 2. 自动眨眼（用 vrmVersion 兼容 0.0 的 blink / 1.0 的 blink）
      if (autoBlink && vrmDataRef.current?.expressionManager && !userBlinkOverrideRef.current) {
        blinkTRef.current -= dt;
        if (blinkTRef.current <= 0) blinkTRef.current = 1.2 + Math.random() * 3.5;
        blinkVRef.current = blinkTRef.current > 0.12 ? 0 : Math.sin((0.12 - blinkTRef.current) / 0.12 * Math.PI);
        vrmDataRef.current.expressionManager.setValue('blink', blinkVRef.current);
      }
      // 3. 应用 chat 推过来的 emotion / viseme（兼容 0.0/1.0）
      if (vrmDataRef.current?.expressionManager) {
        const em = vrmDataRef.current.expressionManager;
        for (const [k, v] of Object.entries(emotion)) {
          if (EXPRESSION_PASSTHROUGH.has(k)) setExpression(em, k, v, vrmVersionRef.current);
        }
        for (const [k, v] of Object.entries(viseme)) {
          if (EXPRESSION_PASSTHROUGH.has(k)) setExpression(em, k, v, vrmVersionRef.current);
        }
      }
      // 4. 位置 / 行走动画
      const mv = moveAnimRef.current;
      const pos = positionRef.current;
      if (mv.active) {
        const elapsed = performance.now() - mv.startTime;
        const k = Math.min(1, elapsed / mv.duration);
        const eased = 1 - Math.pow(1 - k, 2);  // easeOutQuad
        pos.prevX = pos.x; pos.prevZ = pos.z;
        pos.x = mv.fromX + (mv.toX - mv.fromX) * eased;
        pos.z = mv.fromZ + (mv.toZ - mv.fromZ) * eased;
        if (k >= 1) {
          mv.active = false;
          walkRef.current.moving = false;
        }
        // 行走步进（基于速度：walk 4 步/秒，run 8 步/秒）
        const speed = mv.style === 'run' ? 8 : 4;
        walkStepRef.current += dt * speed * 2 * Math.PI;
        walkRef.current.phase = walkStepRef.current;
      } else {
        pos.prevX = pos.x; pos.prevZ = pos.z;
        // 静止时步进慢衰减（让最后的相位平滑停下，不跳）
        walkStepRef.current *= 0.92;
        walkRef.current.phase = walkStepRef.current;
        walkRef.current.moving = false;
      }
      // 把位置应用到模型 + 让相机跟随平移
      if (vrmDataRef.current?.scene) {
        vrmDataRef.current.scene.position.x = pos.x;
        vrmDataRef.current.scene.position.z = pos.z;
      }
      const dx = pos.x - pos.prevX;
      const dz = pos.z - pos.prevZ;
      if ((dx !== 0 || dz !== 0) && rendererState) {
        rendererState.camera.position.x += dx;
        rendererState.camera.position.z += dz;
        if (rendererState.controls) {
          rendererState.controls.target.x += dx;
          rendererState.controls.target.z += dz;
        }
      }
      // 5. dance
      danceApi.tick(t, dt);
      // 6. scene breath
      const bass = lipApi.audio.poll().bass;
      sceneApi.tick(t, dt, bass, danceApi.dancing, 1);
      // 7. camera anim
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

  // 暴露 handle — 用 useMemo 直接构造（不用 useImperativeHandle，React 19 行为不稳）
  // handle 引用稳定（deps=[] 只跑一次），方法内部用 ref 读最新值
  const handle: VrmStageHandle = useMemo(() => {
    console.log('[VrmStage] handle 已构造（useMemo, 只跑一次）');
    return {
      setEmotion: (dict) => {
        if (!vrmDataRef.current?.expressionManager) { console.warn('[VrmStage.setEmotion] expressionManager 未就绪'); return; }
        console.log('[VrmStage.setEmotion] ver=' + vrmVersionRef.current, dict);
        setExpressionDict(vrmDataRef.current.expressionManager, dict, vrmVersionRef.current);
      },
      setViseme: (dict) => {
        if (!vrmDataRef.current?.expressionManager) { console.warn('[VrmStage.setViseme] expressionManager 未就绪'); return; }
        console.log('[VrmStage.setViseme] ver=' + vrmVersionRef.current, dict);
        setExpressionDict(vrmDataRef.current.expressionManager, dict, vrmVersionRef.current);
      },
      setAction: (name) => { console.log('[VrmStage.setAction]', name); danceApiRef.current?.setPose(name as PoseName); },
      setScene: (name) => {
        console.log('[VrmStage.setScene]', name);
        sceneApiRef.current?.setPreset(name);
        rebuildConfetti(name);
      },
      setCameraPreset: (name) => { console.log('[VrmStage.setCameraPreset]', name); camApiRef.current?.switchTo(name); },
      setDanceStyle: (s) => { console.log('[VrmStage.setDanceStyle]', s); danceApiRef.current?.setStyle(s); },
      setDanceAmp: (v) => { console.log('[VrmStage.setDanceAmp]', v); danceApiRef.current?.setAmp(v); },
      setBpm: (v) => { console.log('[VrmStage.setBpm]', v); danceApiRef.current?.setBpm(v); },
      setDancing: (on) => { console.log('[VrmStage.setDancing]', on); danceApiRef.current?.setDancing(on); },
      setPose: (name) => { console.log('[VrmStage.setPose]', name); danceApiRef.current?.setPose(name); },
      speak: (text, audioUrl) => { console.log('[VrmStage.speak]', text, audioUrl); },
      setUserLipOverride: (on) => { console.log('[VrmStage.setUserLipOverride]', on); userLipOverrideRef.current = on; },
      setUserBlinkOverride: (on) => { console.log('[VrmStage.setUserBlinkOverride]', on); userBlinkOverrideRef.current = on; },
      setConfetti: (on) => {
        console.log('[VrmStage.setConfetti]', on);
        setConfettiOn(on);
        if (on) rebuildConfetti(sceneApiRef.current?.preset ?? 'concert');
        else removeConfetti();
      },
      startSong: () => { console.log('[VrmStage.startSong]'); lipApiRef.current?.startSong(); },
      stopSong: () => { console.log('[VrmStage.stopSong]'); lipApiRef.current?.stopSong(); },
      startMic: async () => { console.log('[VrmStage.startMic]'); const ok = await lipApiRef.current?.startMic() ?? false; console.log('[VrmStage.startMic] result=', ok); return ok; },
      stopMic: () => { console.log('[VrmStage.stopMic]'); lipApiRef.current?.stopMic(); },
      move: (target, opts = {}) => {
        const durationMs = opts.durationMs ?? 1500;
        const style = opts.style ?? 'walk';
        // target 解析
        let tx = positionRef.current.x, tz = positionRef.current.z;
        if (target === 'left') { tx -= 2; }
        else if (target === 'right') { tx += 2; }
        else if (target === 'forward') { tz -= 2; }
        else if (target === 'back') { tz += 2; }
        else if (target === 'center') { tx = 0; tz = 0; }
        else if (typeof target === 'object') { tx = target.x ?? tx; tz = target.z ?? tz; }
        // 边界：限制在 ±6
        tx = Math.max(-6, Math.min(6, tx));
        tz = Math.max(-6, Math.min(6, tz));
        console.log(`[VrmStage.move] style=${style} duration=${durationMs}ms from=(${positionRef.current.x.toFixed(2)}, ${positionRef.current.z.toFixed(2)}) to=(${tx.toFixed(2)}, ${tz.toFixed(2)})`);
        walkRef.current.style = style;
        if (style === 'teleport') {
          positionRef.current.prevX = positionRef.current.x;
          positionRef.current.prevZ = positionRef.current.z;
          positionRef.current.x = tx;
          positionRef.current.z = tz;
          walkRef.current.moving = false;
          return;
        }
        moveAnimRef.current = {
          active: true,
          startTime: performance.now(),
          duration: durationMs,
          fromX: positionRef.current.x,
          fromZ: positionRef.current.z,
          toX: tx, toZ: tz,
          style,
        };
        walkRef.current.moving = true;
        walkStepRef.current = 0;
      },
      setPosition: (x, z) => {
        console.log(`[VrmStage.setPosition] (${x}, ${z})`);
        positionRef.current.prevX = positionRef.current.x;
        positionRef.current.prevZ = positionRef.current.z;
        positionRef.current.x = Math.max(-6, Math.min(6, x));
        positionRef.current.z = Math.max(-6, Math.min(6, z));
        walkRef.current.moving = false;
      },
      getPosition: () => ({ x: positionRef.current.x, z: positionRef.current.z }),
      getScreenshot: () => {
        const r = (rendererStateRef.current as any)?.renderer;
        if (!r) return null;
        try { return r.domElement.toDataURL('image/png'); } catch { return null; }
      },
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 同步给内部 ref（让 forwardRef 的 ref 也能拿到 —— 即使父组件没传 ref）
  handleInternalRef.current = handle;
  if (ref) (ref as React.MutableRefObject<VrmStageHandle | null>).current = handle;

  // useEffect: handle 构造后通知父组件（onReady 是 useState 的 setter，引用稳定）
  useEffect(() => {
    if (!onReady) { console.warn('[VrmStage.onReady] onReady prop 未传'); return; }
    if (!handle) { console.warn('[VrmStage.onReady] handle 还没构造'); return; }
    console.log('[VrmStage] onReady 触发');
    onReady(handle);
  }, [onReady, handle]);

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
