'use client';

import { devLog } from '@/lib/dev-log';
import { safeErrorLog } from '@/lib/error-handler';

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

import { loadConfigBundle, loadConfigBundleAsync } from './vrm/config/loader';
import type { ConfigBundle } from './vrm/config/types';
import { useVrmPhysics } from './vrm/useVrmPhysics';
import { useExpressionLerp } from './vrm/useExpressionLerp';
import { loadAvatar, type Cached } from './vrm/loadAvatar';
import { useVrmRenderer } from './vrm/useVrmRenderer';
import { useVrmScene } from './vrm/useVrmScene';
import { useVrmLipSync } from './vrm/useVrmLipSync';
import { useVrmAnimation } from './vrm/useVrmAnimation';
import { useVrmCamera } from './vrm/useVrmCamera';
import { makeConfetti, updateConfetti } from './vrm/particles';
import { createAudioHandle, type AudioHandle } from './vrm/audio';
import { detectVrmVersion, setExpression, setExpressionDict, listAvailableExpressions, getBone } from './vrm/vrmCompat';
import { lookupAutoExpression } from './vrm/config/types';
import type { ScenePresetName, CameraPresetName, DanceStyle, PoseName } from './vrm/types';

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
  speak: (text: string, audioUrl?: string, visemes?: { t: number; shape: string; weight: number }[]) => void;
  /** 设置口型时间线数据（由 chat hook 调用） */
  setVisemeTimeline: (timeline: { t: number; shape: string; weight: number }[]) => void;
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
  /** 调整 Y 偏移（手动调） */
  setYOffset: (y: number) => void;
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
  /**
   * ConfigBundle（可选）
   * - 不传：模块加载时自动从 src/data/seed/*.json 加载（Phase 1 行为）
   * - 传：父组件可以注入从 API 拉来的 config（Phase 2 用）
   */
  config?: ConfigBundle;
}

const EXPRESSION_PASSTHROUGH = new Set([
  // VRM 1.0 / ARKit 52 维表情
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'eyeLookDownLeft', 'eyeLookDownRight', 'eyeLookInLeft', 'eyeLookInRight',
  'eyeLookOutLeft', 'eyeLookOutRight', 'eyeLookUpLeft', 'eyeLookUpRight',
  'eyeBlinkLeft', 'eyeBlinkRight', 'eyeSquintLeft', 'eyeSquintRight',
  'eyeWideLeft', 'eyeWideRight',
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight',
  'jawOpen', 'jawForward', 'jawLeft', 'jawRight',
  'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight',
  'mouthDimpleLeft', 'mouthDimpleRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
  'mouthPressLeft', 'mouthPressRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight', 'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthOpen',
  'noseSneerLeft', 'noseSneerRight',
  // VRM 1.0 预设表情
  'happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral',
  // VRM 0.0 表情（兼容）
  'joy', 'sorrow', 'fun', 'aa', 'ih', 'ou', 'ee', 'oh',
  'blink', 'blinkLeft', 'blinkRight',
  'viseme_sil', 'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U', 'viseme_ou', 'viseme_ih',
  'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR',
]);

/**
 * 设置自然姿态：让 VRM 模型从 T-pose 变为自然站立姿势
 * VRM 模型默认是 T-pose，手臂水平外伸
 * 大臂 rotation.z ≈ ±1.4 rad 让手臂垂到身体两侧
 */
function setNaturalPose(vrm: any) {
  if (!vrm?.humanoid) return;
  const lUpper = getBone(vrm.humanoid, 'leftUpperArm');
  const rUpper = getBone(vrm.humanoid, 'rightUpperArm');
  const lLower = getBone(vrm.humanoid, 'leftLowerArm');
  const rLower = getBone(vrm.humanoid, 'rightLowerArm');
  const lHand = getBone(vrm.humanoid, 'leftHand');
  const rHand = getBone(vrm.humanoid, 'rightHand');
  const lUpperLeg = getBone(vrm.humanoid, 'leftUpperLeg');
  const rUpperLeg = getBone(vrm.humanoid, 'rightUpperLeg');

  // 大臂往下垂 (rotation.z = -1.4 ≈ -80° 让手臂从水平外伸 → 垂到身体两侧)
  if (lUpper) lUpper.rotation.z = -1.4;
  if (rUpper) rUpper.rotation.z = 1.4;
  // 小臂微弯 (手肘往前)
  if (lLower) lLower.rotation.x = 0.3;
  if (rLower) rLower.rotation.x = 0.3;
  // 手自然下垂
  if (lHand) lHand.rotation.x = 0.3;
  if (rHand) rHand.rotation.x = 0.3;
  // 腿直立微张
  if (lUpperLeg) lUpperLeg.rotation.x = -0.1;
  if (rUpperLeg) rUpperLeg.rotation.x = -0.1;
}

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
    config: configProp,
  } = props;
  // Phase 1：模块加载时已 loadConfigBundle()，所有子模块（expressions/visemes/actions）已用
  // Phase 2：父组件可以传 config prop 覆盖
  // 用 useState 保持引用稳定，async loader 完成后一次性更新，避免每次 render 产生新对象
  const [configBundle, setConfigBundle] = useState(() => configProp ?? loadConfigBundle());
  const [currentScene, setCurrentScene] = useState<string>('concert');  // 默认场景
  useEffect(() => {
    if (configProp) {
      setConfigBundle(configProp);
      return;
    }
    loadConfigBundleAsync().then((b) => {
      setConfigBundle(b);
      devLog.debug(`[VrmStage] async config updated: ${b.actions.length} actions, ${b.scenes.length} scenes`);
    });
  }, [configProp]);

  // 当前激活的 scene config（从 bundle.scenes 找 name === 当前 scene）
  // 通过 setCurrentScene(name) 从外部切换场景，或内部默认使用 'concert'
  const currentSceneConfig = useMemo(() => {
    return configBundle.scenes.find((s) => s.name === currentScene) || configBundle.scenes[0];
  }, [configBundle, currentScene]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vrmSceneRef = useRef<any>(null);  // THREE.Object3D of the loaded VRM
  const vrmDataRef = useRef<Cached | null>(null);
  const expressionManagerRef = useRef<any>(null);
  const vrmRef = useRef<any>(null);
  const handleInternalRef = useRef<VrmStageHandle | null>(null);  // useImperativeHandle 工厂里同步存 handle
  const vrmVersionRef = useRef<0 | 1>(1);  // VRM 0.0/1.0 — 0 用 joy/sorrow/fun/viseme_aa，1 用 happy/aa

  // Phase 3.2: 表情/口型/动作的 lerp 平滑过渡
  // emotionLerp / visemeLerp 用 ref 拿 em（vrm 异步加载后才就绪）
  // 注意：vrmVersionRef 必须在 emotionLerp 之前定义
  const emotionLerp = useExpressionLerp({ emRef: expressionManagerRef, vrmVersionRef, speed: 6 });
  const visemeLerp = useExpressionLerp({ emRef: expressionManagerRef, vrmVersionRef, speed: 10 });

  // Phase 4: 统一动画状态机（auto-emotion/viseme 适配）
  const animStateRef = useRef<{ currentAction: string; currentPose: string }>({
    currentAction: 'idle', currentPose: 'idle',
  });

  // 关键：把 hook 返回值（每次 render 都是新对象）存到 ref，handle 内部读 ref
  // 这样 useImperativeHandle 的 factory 用空 deps 只跑一次，handle 引用稳定
  const sceneApiRef = useRef<any>(null);
  const animApiRef = useRef<any>(null);
  const camApiRef = useRef<any>(null);
  const rendererStateRef = useRef<any>(null);
  const lipApiRef = useRef<any>(null);
  const rendererApiRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confettiOn, setConfettiOn] = useState(false);
  const confettiRef = useRef<any>(null);
  // 角色位置（x, z，y 由 yOffset 控制）
  const positionRef = useRef({ x: 0, z: 0, prevX: 0, prevZ: 0 });
  const yOffsetRef = useRef(0);  // 手动 Y 偏移
  // 由模型包围盒推导的物理胶囊尺寸（setYOffset 时同步给物理世界）
  const modelMetricsRef = useRef<{ height: number; radius: number; footOffsetY: number } | null>(null);
  // 行走状态（useVrmDance 通过 walkRef 读这个来播放行走动画）
  // 移动动画状态
  const moveAnimRef = useRef<{ active: boolean; startTime: number; duration: number; fromX: number; fromZ: number; toX: number; toZ: number; style: 'walk' | 'run' | 'teleport' }>({
    active: false, startTime: 0, duration: 0, fromX: 0, fromZ: 0, toX: 0, toZ: 0, style: 'walk',
  });
  // 行走状态（useVrmDance 通过 walkRef 读这个来播放行走动画）
  const walkRef = useRef<{ moving: boolean; phase: number; style: 'walk' | 'run' | 'idle' | 'teleport' }>({ moving: false, phase: 0, style: 'idle' });
  // 行走步进（每帧 dt 累积）
  const walkStepRef = useRef(0);

  // Phase 3: 物理（vrmDataRef 之后才能访问 scene）
  const vrmSceneForPhysics = vrmDataRef.current?.scene ?? null;
  const targetPositionRef = useRef({ x: 0, y: 0, z: 0 });
  const physics = useVrmPhysics({
    model: configBundle.model,
    sceneConfig: currentSceneConfig,
    vrmScene: vrmSceneForPhysics,
    targetPositionRef,
    onStep: (pos) => {
      // 物理 step 后实际位置写回 positionRef（让 useEffects/session 看到）
      positionRef.current.x = pos.x;
      positionRef.current.z = pos.z;
    },
  });

  const userLipOverrideRef = useRef(false);
  const userBlinkOverrideRef = useRef(false);
  const blinkTRef = useRef(1.5);
  const blinkVRef = useRef(0);

  // 口型时间线状态（speak 方法设置，tick 循环消费）
  const visemeTimelineRef = useRef<{ t: number; shape: string; weight: number }[]>([]);
  const visemeStartTimeRef = useRef<number>(0);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

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

  // 3. 统一动画状态机（替代 useVrmDance）
  const animApi = useVrmAnimation({ vrmRef, audio, walkRef, configBundle, physics });
  animApiRef.current = animApi;

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
        devLog.debug(`[VrmStage] VRM 版本: ${ver}, 可用 expressions (${available.length}):`, available.slice(0, 30));
        cached.scene.traverse((o: any) => { o.castShadow = true; o.frustumCulled = false; });
        rendererState.scene.add(cached.scene);
        // 贴地：信任模型自然原点（VRM 标准：feet 在 y=0），用 yOffset 手动微调
        const THREE_NS = (rendererState as any).THREE_NS as typeof import('three');
        const box = new THREE_NS.Box3().setFromObject(cached.scene);
        const autoYOffset = -box.min.y;
        yOffsetRef.current = autoYOffset;
        devLog.debug(`[VrmStage] Box3 minY=${box.min.y.toFixed(3)} maxY=${box.max.y.toFixed(3)} => auto yOffset=${autoYOffset.toFixed(3)}`);
        cached.scene.position.y = yOffsetRef.current;
        const height = box.max.y - box.min.y;
        const radius = Math.max(0.15, (box.max.x - box.min.x) * 0.5, (box.max.z - box.min.z) * 0.5) * 0.35;
        modelMetricsRef.current = { height, radius, footOffsetY: autoYOffset };
        physics.setModelMetrics(modelMetricsRef.current);
        // 视线
        if (cached.vrm.lookAt) {
          cached.vrm.lookAt.target = lookAtCamera ? rendererState.camera : null;
        }
        // 设置自然姿态：让手臂从 T-pose 自然下垂
        // VRM 模型默认是 T-pose，手臂水平外伸
        // 大臂 rotation.z ≈ ±1.4 rad 让手臂垂到身体两侧
        setNaturalPose(cached.vrm);
        setLoading(false);
      } catch (e: any) {
        devLog.error('[VrmStage] load failed', e);
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
      // 2. 自动眨眼（直接 setValue，因为它是一闪即过的脉冲，不走 lerp）
      if (autoBlink && vrmDataRef.current?.expressionManager && !userBlinkOverrideRef.current) {
        blinkTRef.current -= dt;
        if (blinkTRef.current <= 0) blinkTRef.current = 1.2 + Math.random() * 3.5;
        blinkVRef.current = blinkTRef.current > 0.12 ? 0 : Math.sin((0.12 - blinkTRef.current) / 0.12 * Math.PI);
        vrmDataRef.current.expressionManager.setValue('blink', blinkVRef.current);
      }
      // 3. 把 chat 推过来的 emotion / viseme 喂给 lerp
      //    （不是直接 setValue —— 走 emotionLerp / visemeLerp 平滑）
      //    注意：只有当 props.emotion 非空时才覆盖用户通过 handle.setEmotion 设置的值
      if (vrmDataRef.current?.expressionManager) {
        // 合并 emotion: chat emotion + 适配规则（autoEmotion）
        // 适配规则在 Phase 4.1 落地；目前先只用 chat
        const emotionTarget: Record<string, number> = {};
        for (const [k, v] of Object.entries(emotion)) {
          if (EXPRESSION_PASSTHROUGH.has(k)) emotionTarget[k] = v;
        }
        // 只有当 chat emotion 有值时才更新 lerp target（避免覆盖用户手动设置的值）
        if (Object.keys(emotionTarget).length > 0) {
          emotionLerp.setTarget(emotionTarget);
        }
        // 视口（viseme）直接走 chat
        const visemeTarget: Record<string, number> = {};
        for (const [k, v] of Object.entries(viseme)) {
          if (EXPRESSION_PASSTHROUGH.has(k)) visemeTarget[k] = v;
        }
        // 口型时间线处理（覆盖静态 viseme）
        const timeline = visemeTimelineRef.current;
        if (timeline.length > 0 && !userLipOverrideRef.current) {
          const elapsedSec = (performance.now() - visemeStartTimeRef.current) / 1000;
          // 找到当前时间对应的 viseme 帧
          let currentFrame = timeline[timeline.length - 1];
          for (const frame of timeline) {
            if (frame.t <= elapsedSec) {
              currentFrame = frame;
            } else {
              break;
            }
          }
          // 将 viseme 帧应用到 lerp target
          if (currentFrame) {
            const shape = currentFrame.shape;
            const weight = currentFrame.weight;
            // 映射到对应的 VRM blendshape
            const vrmVersion = vrmVersionRef.current;
            if (vrmVersion === 0) {
              // VRM 0.0: 使用 viseme_ 前缀
              visemeTarget[`viseme_${shape.toLowerCase()}`] = weight;
            } else {
              // VRM 1.0: 直接用形状名
              // 常见的 viseme 映射
              const visemeMap: Record<string, string[]> = {
                'aa': ['aa', 'jawOpen'],
                'ih': ['ih', 'mouthFunnel'],
                'ou': ['ou', 'mouthPucker'],
                'oh': ['oh'],
                'ee': ['ih'],
                'O': ['oh', 'jawOpen'],
                'U': ['ou', 'mouthPucker'],
                'closed': ['jawOpen'],
              };
              const shapes = visemeMap[shape.toLowerCase()] || [shape];
              for (const s of shapes) {
                if (EXPRESSION_PASSTHROUGH.has(s)) {
                  visemeTarget[s] = weight;
                }
              }
            }
          }
        }
        if (Object.keys(visemeTarget).length > 0) {
          visemeLerp.setTarget(visemeTarget);
        }
        // 注意：emotionManager 是在 vrm 加载后才就绪的；
        // useExpressionLerp 用的是 ref 拿到的 em — 加载后会即时生效
        emotionLerp.tick(dt);
        visemeLerp.tick(dt);
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

      // Phase 3: 同步给物理 + 物理 step（撞墙会修正 pos）
      targetPositionRef.current.x = pos.x;
      targetPositionRef.current.y = yOffsetRef.current;
      targetPositionRef.current.z = pos.z;
      if (physics.ready) {
        physics.step(dt);
        // physics 写入 vrmScene.position 后，同步回 pos
        pos.x = vrmDataRef.current?.scene.position.x ?? pos.x;
        pos.z = vrmDataRef.current?.scene.position.z ?? pos.z;
      } else {
        // 没物理：直接写 scene.position（旧路径）
        if (vrmDataRef.current?.scene) {
          vrmDataRef.current.scene.position.x = pos.x;
          vrmDataRef.current.scene.position.y = yOffsetRef.current;
          vrmDataRef.current.scene.position.z = pos.z;
        }
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
      // 5. 统一动画状态机
      animApi.tick(t, dt);
      // 6. scene breath
      const bass = lipApi.audio.poll().bass;
      sceneApi.tick(t, dt, bass, animApiRef.current?.dancing ?? false, 1);
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

  // 暴露位置给 UI 显示（每 250ms 更新一次，避免频繁 re-render）
  const [, forceUpdatePos] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceUpdatePos((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  // Phase 2.5: 加载/保存 session
  // mount 时拉服务端 session → 恢复；每 5s 自动 flush；unmount 立即 flush
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let mounted = true;
    (async () => {
      try {
        const { getMySession } = await import('./api/digitalHumanConfig');
        const { useSessionStore } = await import('./store/session');
        const sess = await getMySession(useSessionStore.getState().session.userId);
        if (mounted && sess) {
          useSessionStore.getState().setSession(sess);
          devLog.debug('[VrmStage] session restored:', sess);
          // 恢复位置
          handleInternalRef.current?.setPosition(sess.positionX, sess.positionZ);
          handleInternalRef.current?.setYOffset(sess.yOffset);
        }
      } catch (e) { devLog.warn('[VrmStage] session restore failed:', e); }
    })();
    const flushId = setInterval(() => {
      import('./store/session').then(m => m.useSessionStore.getState().flush()).catch((e) => safeErrorLog('session flush', e));
    }, 5000);
    const onUnload = () => {
      import('./store/session').then(m => m.useSessionStore.getState().flush()).catch((e) => safeErrorLog('session flush', e));
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      mounted = false;
      clearInterval(flushId);
      window.removeEventListener('beforeunload', onUnload);
      import('./store/session').then(m => m.useSessionStore.getState().flush()).catch((e) => safeErrorLog('session flush', e));
    };
   
  }, []);

  // 暴露 handle — 用 useMemo 直接构造（不用 useImperativeHandle，React 19 行为不稳）
  // handle 引用稳定（deps=[] 只跑一次），方法内部用 ref 读最新值
  const handle: VrmStageHandle = useMemo(() => {
    devLog.debug('[VrmStage] handle 已构造（useMemo, 只跑一次）');
    return {
      setEmotion: (dict) => {
        if (!vrmDataRef.current?.expressionManager) { devLog.warn('[VrmStage.setEmotion] expressionManager 未就绪'); return; }
        // Phase 3.2: 走 lerp，不再直接 setValue
        // （chat / 适配规则也走同一个 lerp 通道）
        const filtered: Record<string, number> = {};
        for (const [k, v] of Object.entries(dict)) {
          if (EXPRESSION_PASSTHROUGH.has(k)) filtered[k] = v;
        }
        emotionLerp.setTarget(filtered);
      },
      setViseme: (dict) => {
        if (!vrmDataRef.current?.expressionManager) { devLog.warn('[VrmStage.setViseme] expressionManager 未就绪'); return; }
        devLog.debug('[VrmStage.setViseme] ver=' + vrmVersionRef.current, dict);
        const filtered: Record<string, number> = {};
        for (const [k, v] of Object.entries(dict)) {
          if (EXPRESSION_PASSTHROUGH.has(k)) filtered[k] = v;
        }
        visemeLerp.setTarget(filtered);
      },
      setAction: (name) => {
        devLog.debug('[VrmStage.setAction]', name);
        animStateRef.current.currentAction = name;
        animApiRef.current?.playAction(name);
        // Phase 5: auto-emotion/viseme 适配
        const auto = lookupAutoExpression(name);
        if (auto.expression || auto.viseme) {
          const emotionDict: Record<string, number> = {};
          if (auto.expression) {
            const expCfg = configBundle.expressions.find((e) => e.name === auto.expression);
            if (expCfg) {
              const intensity = auto.intensity ?? 1;
              for (const [k, v] of Object.entries(expCfg.blendshapes)) {
                emotionDict[k] = v * intensity;
              }
            }
          }
          emotionLerp.setTarget(emotionDict);
          if (auto.viseme) {
            visemeLerp.setTarget({ [auto.viseme]: 0.8 });
          }
        }
      },
      setScene: (name) => {
        devLog.debug('[VrmStage.setScene]', name);
        sceneApiRef.current?.setPreset(name);
        rebuildConfetti(name);
      },
      setCameraPreset: (name) => { devLog.debug('[VrmStage.setCameraPreset]', name); camApiRef.current?.switchTo(name); },
      setDanceStyle: (s) => { devLog.debug('[VrmStage.setDanceStyle]', s); animApiRef.current?.setStyle(s); },
      setDanceAmp: (v) => { devLog.debug('[VrmStage.setDanceAmp]', v); animApiRef.current?.setAmp(v); },
      setBpm: (v) => { devLog.debug('[VrmStage.setBpm]', v); animApiRef.current?.setBpm(v); },
      setDancing: (on) => { devLog.debug('[VrmStage.setDancing]', on); animApiRef.current?.setDancing(on); },
      setPose: (name) => { devLog.debug('[VrmStage.setPose]', name); animApiRef.current?.setPose(name); },
      speak: (text, audioUrl, visemes) => {
        devLog.debug('[VrmStage.speak]', text, audioUrl, visemes?.length ? `${visemes.length} frames` : '');
        // 设置口型时间线
        if (visemes && visemes.length > 0) {
          visemeTimelineRef.current = visemes;
          visemeStartTimeRef.current = performance.now();
        }
        // 播放音频
        if (audioUrl) {
          // 确保 audio element 存在
          if (!audioElRef.current) {
            audioElRef.current = document.createElement('audio');
            audioElRef.current.crossOrigin = 'anonymous';
          }
          const el = audioElRef.current;
          // 连接 audio element 到 WebAudio 分析器（用于口型同步）
          lipApiRef.current?.connectElement(el);
          el.onended = () => {
            // 播放结束后清空口型
            visemeTimelineRef.current = [];
          };
          el.src = audioUrl;
          el.play().catch((e) => {
            devLog.warn('[VrmStage.speak] audio play failed:', e);
          });
        }
      },
      setVisemeTimeline: (timeline) => {
        devLog.debug('[VrmStage.setVisemeTimeline]', timeline.length, 'frames');
        visemeTimelineRef.current = timeline;
        visemeStartTimeRef.current = performance.now();
      },
      setUserLipOverride: (on) => { devLog.debug('[VrmStage.setUserLipOverride]', on); userLipOverrideRef.current = on; },
      setUserBlinkOverride: (on) => { devLog.debug('[VrmStage.setUserBlinkOverride]', on); userBlinkOverrideRef.current = on; },
      setConfetti: (on) => {
        devLog.debug('[VrmStage.setConfetti]', on);
        setConfettiOn(on);
        if (on) rebuildConfetti(sceneApiRef.current?.preset ?? 'concert');
        else removeConfetti();
      },
      startSong: () => { devLog.debug('[VrmStage.startSong]'); lipApiRef.current?.startSong(); },
      stopSong: () => { devLog.debug('[VrmStage.stopSong]'); lipApiRef.current?.stopSong(); },
      startMic: async () => { devLog.debug('[VrmStage.startMic]'); const ok = await lipApiRef.current?.startMic() ?? false; devLog.debug('[VrmStage.startMic] result=', ok); return ok; },
      stopMic: () => { devLog.debug('[VrmStage.stopMic]'); lipApiRef.current?.stopMic(); },
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
        devLog.debug(`[VrmStage.move] style=${style} duration=${durationMs}ms from=(${positionRef.current.x.toFixed(2)}, ${positionRef.current.z.toFixed(2)}) to=(${tx.toFixed(2)}, ${tz.toFixed(2)})`);
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
        devLog.debug(`[VrmStage.setPosition] (${x}, ${z})`);
        positionRef.current.prevX = positionRef.current.x;
        positionRef.current.prevZ = positionRef.current.z;
        positionRef.current.x = Math.max(-6, Math.min(6, x));
        positionRef.current.z = Math.max(-6, Math.min(6, z));
        walkRef.current.moving = false;
      },
      setYOffset: (y) => {
        devLog.debug(`[VrmStage.setYOffset] y=${y}`);
        yOffsetRef.current = y;
        // 同步给物理世界：否则下一帧 step 会用旧的 footOffsetY 覆盖回来
        if (modelMetricsRef.current) {
          modelMetricsRef.current.footOffsetY = y;
          physics.setModelMetrics(modelMetricsRef.current);
        }
        if (vrmDataRef.current?.scene) vrmDataRef.current.scene.position.y = y;
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

  // useEffect: handle 构造后通知父组件（只触发一次）
  const onReadyCalledRef = useRef(false);
  useEffect(() => {
    if (!onReady) return;
    if (!handle) return;
    if (onReadyCalledRef.current) return;
    onReadyCalledRef.current = true;
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
