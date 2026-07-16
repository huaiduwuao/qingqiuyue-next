'use client';

/**
 * BlenderAvatar —— 浏览器内的 3D 数字人角色
 *
 * 加载策略:
 *   - 优先:public/avatars/character.vrm(VRM 0.0 格式,用 @pixiv/three-vrm 加载)
 *   - Fallback:public/avatars/model.glb(写实风格女性,build_avatar_v2 产物)
 *
 * VRM 来源:用户去 https://hub.vroid.com 下载 license 友好的角色
 * (VRoid Hub 角色 license 标注每个角色 license,选择 CC0 / CC-BY 商用 OK 的),
 * 改名为 character.vrm 放到 public/avatars/。
 *
 * VRM 表情/口型标准:
 *   - 表情:neutral / joy / angry / sorrow / fun
 *   - 口型:aa / ih / ou / E / O / U / closed / etc.
 *   - 自动 blink(VRM 自带)
 *
 * 我们 LLM/Mock 用的 12 个 morph 名字:
 *   - 表情:smile / angry / sad / surprised / blink
 *   - 口型:aa / ih / ou / E / O / U / closed
 *
 * VRM 名字映射(BlenderAvatar 内部):
 *   - smile      → joy
 *   - sad        → sorrow
 *   - surprised  → fun
 *   - angry      → angry
 *   - blink      → blink(VRM 自动处理)
 *   - aa/ih/ou/E/O/U/closed → 直接同名
 *
 * 动作:VRM humanoid bones(VRMHumanBoneName 枚举)
 *   10 个动作通过直接控制 bone rotation/position 实现:
 *   idle / wave / walk / run / dance / sit / point / think / talk / bow
 */

import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
// ⚠️ 静态导入 @pixiv/three-vrm — 不能用动态 import()
// 动态 import 在 React 组件里每帧调用会触发 turbopack HMR 报错:
//   "Unexpected import of module ... which was deleted by an HMR update"
// 导致整个 BlenderAvatar 组件挂掉, VRM 不动 → T-pose
import * as THREE_VRM from '@pixiv/three-vrm';
const { VRMLoaderPlugin, VRMHumanBoneName } = THREE_VRM;

// 注: three.js / VRM 对象在运行时动态加载, 很多内部类型无法静态精确表达;
// 本文件里保留的 `any` 仅用于胶水代码, 不影响业务行为。
// VRMHumanBoneName 仍在这里用(用于把 bone 名转成 VRM 标准名,见 line 439)

// VRM 表情名字映射(我们 LLM/Mock 用的 12 个 → VRM 表情管理器的标准名字)
// VRM 0.0 标准表情名 = ARKit Blendshape 1:1 映射
// 52 个表情全部直通, 没在表里的 key 直接当 VRM 名用
const EXPRESSION_MAP: Record<string, string> = {
  // 兼容旧 short 名
  smile: 'joy',
  angry: 'angry',
  sad: 'sorrow',
  surprised: 'fun',
  blink: 'blink',
  // 52 维 ARKit (直通)
  // 眉毛 (5)
  browInnerUp: 'browInnerUp',
  browDownLeft: 'browDownLeft', browDownRight: 'browDownRight',
  browOuterUpLeft: 'browOuterUpLeft', browOuterUpRight: 'browOuterUpRight',
  // 脸颊 (3)
  cheekPuff: 'cheekPuff',
  cheekSquintLeft: 'cheekSquintLeft', cheekSquintRight: 'cheekSquintRight',
  // 眼睛 (14)
  eyeBlinkLeft: 'eyeBlinkLeft', eyeBlinkRight: 'eyeBlinkRight',
  eyeLookDownLeft: 'eyeLookDownLeft', eyeLookDownRight: 'eyeLookDownRight',
  eyeLookInLeft: 'eyeLookInLeft', eyeLookInRight: 'eyeLookInRight',
  eyeLookOutLeft: 'eyeLookOutLeft', eyeLookOutRight: 'eyeLookOutRight',
  eyeLookUpLeft: 'eyeLookUpLeft', eyeLookUpRight: 'eyeLookUpRight',
  eyeSquintLeft: 'eyeSquintLeft', eyeSquintRight: 'eyeSquintRight',
  eyeWideLeft: 'eyeWideLeft', eyeWideRight: 'eyeWideRight',
  // 下颚 (4)
  jawForward: 'jawForward', jawLeft: 'jawLeft',
  jawOpen: 'jawOpen', jawRight: 'jawRight',
  // 嘴 (22)
  mouthClose: 'mouthClose',
  mouthDimpleLeft: 'mouthDimpleLeft', mouthDimpleRight: 'mouthDimpleRight',
  mouthFrownLeft: 'mouthFrownLeft', mouthFrownRight: 'mouthFrownRight',
  mouthFunnel: 'mouthFunnel',
  mouthLeft: 'mouthLeft',
  mouthLowerDownLeft: 'mouthLowerDownLeft', mouthLowerDownRight: 'mouthLowerDownRight',
  mouthPressLeft: 'mouthPressLeft', mouthPressRight: 'mouthPressRight',
  mouthPucker: 'mouthPucker',
  mouthRight: 'mouthRight',
  mouthRollLower: 'mouthRollLower', mouthRollUpper: 'mouthRollUpper',
  mouthShrugLower: 'mouthShrugLower', mouthShrugUpper: 'mouthShrugUpper',
  mouthSmileLeft: 'mouthSmileLeft', mouthSmileRight: 'mouthSmileRight',
  mouthStretchLeft: 'mouthStretchLeft', mouthStretchRight: 'mouthStretchRight',
  mouthUpperUpLeft: 'mouthUpperUpLeft', mouthUpperUpRight: 'mouthUpperUpRight',
  // 鼻子 (2)
  noseSneerLeft: 'noseSneerLeft', noseSneerRight: 'noseSneerRight',
  // 舌头 (1)
  tongueOut: 'tongueOut',
  // viseme (OVRLipSync 标准, VRM 0.0 用 "viseme_" 前缀)
  // 数字人 chat 返回短名 (sil/aa/E/I/O/U/PP/FF/DD/kk/CH/SS/nn/RR), 自动加前缀
  sil: 'viseme_sil', aa: 'viseme_aa', E: 'viseme_E', I: 'viseme_I',
  O: 'viseme_O', U: 'viseme_U', ou: 'viseme_ou', ih: 'viseme_ih',
  PP: 'viseme_PP', FF: 'viseme_FF', TH: 'viseme_TH', DD: 'viseme_DD',
  kk: 'viseme_kk', CH: 'viseme_CH', SS: 'viseme_SS', nn: 'viseme_nn',
  RR: 'viseme_RR', closed: 'viseme_sil',
};

// 缓存:url -> 加载好的 VRM 数据(单一格式,不再支持 GLB)
// 加载层已抽离到 ./vrm/loadAvatar.ts,这里只 re-export 类型,行为完全不变
import { loadAvatar, type Cached } from './vrm/loadAvatar';


export interface BlenderAvatarProps {
  /** 角色 URL(必须 .vrm 后缀) */
  modelUrl?: string;
  /** 渲染模式: vrm(默认) | 3dgs(Gaussian Splatting) */
  avatarMode?: 'vrm' | '3dgs';
  /** 3DGS 模式: 资产目录 URL(含 gaussians.bin/skinning.bin/smplx.json) */
  assetBaseUrl?: string;
  /** 3DGS 模式: pose (J*3 axis-angle) */
  gsPose?: Float32Array;
  /** 3DGS 模式: FLAME expressions (D floats) */
  gsExpressions?: Float32Array;
  /** 当前动作 */
  currentAction?: string;
  /** 表情 BlendShape 字典(LLM/Mock 输出) */
  emotion?: Record<string, number>;
  /** 口型 BlendShape 字典 */
  viseme?: Record<string, number>;
  /** 是否自动旋转相机 */
  autoRotate?: boolean;
  /** 全屏背景颜色 */
  background?: string;
  /** 透传样式 */
  sx?: React.CSSProperties;
  /**
   * LLM/Hermes tool_call 通道 — 上层 chat hook 调用此 prop 把 tool_calls 喂给数字人。
   * 父组件要么用 useChatAvatarV2 (内置 dispatcher), 要么自己消费返回的 sink 集合。
   */
  onToolCall?: (call: { name: string; params: Record<string, any> }) => void;
}

export default function BlenderAvatar({
  modelUrl = '/avatars/character.vrm',
  avatarMode = 'vrm',
  assetBaseUrl,
  gsPose,
  gsExpressions,
  currentAction = 'idle',
  emotion = {},
  viseme = {},
  autoRotate = true,
  background = 'radial-gradient(ellipse at 50% 30%, rgba(124,58,237,0.18) 0%, transparent 55%), #05060B',
  /**
   * LLM/Hermes tool_call 通道 — 当外部 (例如 chat hook) 想直接 dispatch 一个工具调用
   * (例如 face.setExpression / body.playAction) 时, 直接调这个 callback。
   * — 默认空 noop, 让 BlenderAvatar 保持纯展示层
   */
  onToolCall,
  sx,
}: BlenderAvatarProps) {
  // ── 3DGS 模式: 用 GaussianSplatRenderer ──
  if (avatarMode === '3dgs' && assetBaseUrl) {
    const GS = React.lazy(() => import('./gs/GaussianSplatRenderer'));
    return (
      <React.Suspense fallback={
        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>加载 3DGS 渲染器...</Typography>
        </Box>
      }>
        <GS
          assetUrl={`${assetBaseUrl}/gaussians.bin`}
          skinningUrl={`${assetBaseUrl}/skinning.bin`}
          smplxUrl={`${assetBaseUrl}/smplx.json`}
          metaUrl={`${assetBaseUrl}/meta.json`}
          pose={gsPose}
          expressions={gsExpressions}
          background={background}
          sx={sx as React.CSSProperties}
        />
      </React.Suspense>
    );
  }

  // ── VRM 模式(默认) ──
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rendererRef = React.useRef<any>(null);
  const sceneRef = React.useRef<any>(null);
  const cameraRef = React.useRef<any>(null);
  const loadedRef = React.useRef<Cached | null>(null);
  const mixerRef = React.useRef<any>(null);
  const rafRef = React.useRef<number | null>(null);
  // 用 ref 跟踪 currentAction, 避免 frame 闭包过期
  const currentActionRef = React.useRef(currentAction);
  React.useEffect(() => {
    currentActionRef.current = currentAction;
  }, [currentAction]);
  // 鼠标位置(让数字人头部跟随, 看着用户)
  const mouseRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  // 初始化场景 + 加载角色
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // 调试：按 1 键可跳过 Three.js，用于排查 runtime.lastError 来源
    const debug = (typeof window !== 'undefined' && (window as any).__DIGITAL_HUMAN_DEBUG) as { noThree?: boolean } | undefined;
    if (debug?.noThree) {
      console.log('[BlenderAvatar] SKIP: noThree debug flag set');
      setLoading(false);
      return;
    }
    let cancelled = false;
    let onMouseMove: ((e: MouseEvent) => void) | null = null;

    (async () => {
      try {
        const THREE = await import('three');
        canvas.style.display = 'block';
        canvas.style.outline = 'none';

        console.log('[BlenderAvatar] 初始化,modelUrl=', modelUrl);

        const renderer = new THREE.WebGLRenderer({
          canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
        });
        if (cancelled) return;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        rendererRef.current = renderer;

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(35, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
        camera.position.set(0, 1.4, 2.0);
        camera.lookAt(0, 1.3, 0);
        cameraRef.current = camera;

        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const key = new THREE.DirectionalLight(0xffffff, 0.8);
        key.position.set(2, 4, 3);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xa0a0ff, 0.4);
        rim.position.set(-2, 2, -2);
        scene.add(rim);

        // 加载 VRM(只支持 .vrm)
        let loaded: Cached | null = null;
        try {
          console.log('[BlenderAvatar] 开始加载 VRM:', modelUrl);
          loaded = await loadAvatar(modelUrl);
          console.log('[BlenderAvatar] 加载成功,animations=', loaded.animations.length);
        } catch (e1: unknown) {
          throw e1;
        }
        if (cancelled) return;
        if (!loaded) throw new Error('no avatar loaded');
        loadedRef.current = loaded;
        scene.add(loaded.scene);
        console.log('[BlenderAvatar] 角色已加入 scene,scene children=', scene.children.length);

        // VRM 调整(默认 1.0 scale 即可,VRoid Hub 角色标准化高度)
        loaded.scene.scale.setScalar(1.0);

        // 动画 mixer(VRM 通常没内置动画,这里只是 placeholder)
        if (loaded.animations.length > 0) {
          const { AnimationMixer } = THREE as any;
          const mixer = new AnimationMixer(loaded.scene);
          mixerRef.current = mixer;
          const clip = loaded.animations[0];
          if (clip) mixer.clipAction(clip).play();
        }

        const onResize = () => {
          if (!canvas) return;
          renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
          camera.aspect = canvas.clientWidth / canvas.clientHeight;
          camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', onResize);

        setLoading(false);

        const clock = new THREE.Clock();
        const frame = () => {
          if (cancelled) return;
          const dt = clock.getDelta();
          if (mixerRef.current) mixerRef.current.update(dt);
          // 每帧调用 applyVRMAction, 让 idle (呼吸) 等时间相关动画持续动
          if (loadedRef.current?.vrm) {
            const vrm = loadedRef.current.vrm
            // 1) 推 bone rotation 到顶点
            if (vrm.humanoid && typeof vrm.humanoid.update === 'function') {
              vrm.humanoid.update(dt)
            }
            // 2) VRM 1.x spring bone 物理 (衣服/头发跟随)
            if (typeof vrm.update === 'function') {
              vrm.update(dt)
            } else if ((vrm as any).springBoneManager?.update) {
              ;(vrm as any).springBoneManager.update(dt)
            }
            // 3) 设下帧 bone rotation (time-dependent idle 动画)
            applyVRMAction(vrm, currentActionRef.current).catch(() => {})
            // 4) 鼠标跟随头部 + 眼球 (让数字人"看着你")
            applyMouseFollow(vrm, mouseRef.current)
            // 5) 随机微表情 + 长眨眼 (自然感)
            applyMicroExpressions(vrm, tSec())
          }
          // 6) 可选: 整体缓慢旋转 (由 prop 控制)
          if (autoRotate && loadedRef.current?.scene) {
            loadedRef.current.scene.rotation.y += dt * 0.3;
          }
          renderer.render(scene, camera);
          rafRef.current = requestAnimationFrame(frame);
        };
        rafRef.current = requestAnimationFrame(frame);

        // 鼠标位置跟踪(让数字人头部跟着鼠标转, 像在"看"用户)
        onMouseMove = (e: MouseEvent) => {
          // 归一化到 [-1, 1] (屏幕中心 = 0,0)
          const x = (e.clientX / window.innerWidth) * 2 - 1
          const y = (e.clientY / window.innerHeight) * 2 - 1
          mouseRef.current = { x, y }
        }
        window.addEventListener('mousemove', onMouseMove)
      } catch (err: unknown) {
        if (cancelled) return;
        console.error('[BlenderAvatar] init failed:', err);
        setError((err as Error)?.message || 'init failed');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (onMouseMove) window.removeEventListener('mousemove', onMouseMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rendererRef.current?.dispose?.();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      loadedRef.current = null;
      mixerRef.current = null;
    };
  }, [modelUrl, autoRotate]);

  // 切换动作(GLB mixer / VRM bones)
  React.useEffect(() => {
    const loaded = loadedRef.current;
    if (!loaded) return;
    if (loaded.vrm) {
      applyVRMAction(loaded.vrm, currentAction);
    } else if (mixerRef.current && loaded.animations.length > 0) {
      const clip = loaded.animations.find((a: any) => a.name === currentAction) || loaded.animations[0];
      if (clip) {
        mixerRef.current.stopAllAction();
        mixerRef.current.clipAction(clip).play();
      }
    }
  }, [currentAction]);

  // 应用 morph/emotion
  const lastAppliedRef = React.useRef<Record<string, number>>({});
  React.useEffect(() => {
    const loaded = loadedRef.current;
    if (!loaded) return;
    applyExpressions(loaded, emotion, viseme, lastAppliedRef);
  }, [emotion, viseme]);

  return (
    <Box sx={{
      width: '100%', height: '100%', background, position: 'relative', overflow: 'hidden', ...sx,
    }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', outline: 'none' }} />
      {loading && (
        <Box sx={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.6)', gap: 1.5, pointerEvents: 'none',
        }}>
          <CircularProgress size={28} />
          <Typography sx={{ fontSize: 13 }}>加载数字人...</Typography>
        </Box>
      )}
      {error && (
        <Box sx={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,80,80,0.85)', fontSize: 12, textAlign: 'center', p: 3, flexDirection: 'column', pointerEvents: 'none',
        }}>
          <Box>{error}</Box>
          <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', mt: 1 }}>
            提示:把 .vrm 文件放到 public/avatars/character.vrm
            <br />
            (从 <a href="https://hub.vroid.com" target="_blank" style={{ color: 'inherit' }}>hub.vroid.com</a> 下载开源角色)
          </Typography>
        </Box>
      )}
      {false && !error && !loading && (
        <Typography sx={{
          position: 'absolute', bottom: 8, right: 8, fontSize: 10,
          color: 'rgba(255,255,255,0.4)', pointerEvents: 'none',
        }}>
          (.vrm 加载失败,fallback 到 .glb 写实版)
        </Typography>
      )}
    </Box>
  );
}


// ── VRM 动作:10 个通过 humanoid bones 实现 ─────────────────

async function applyVRMAction(vrm: any, action: string) {
  if (!vrm.humanoid) {
    if (!(globalThis as any).__vrm_warn) {
      console.warn('[BlenderAvatar] applyVRMAction: vrm.humanoid 不存在! bones 无法控制')
      ;(globalThis as any).__vrm_warn = true
    }
    return
  }
  const t = performance.now() / 1000

  // ⚠️ VRM 版本适配:
  //   VRM 0.x: bone 名 PascalCase (Hips, Spine, LeftUpperArm)
  //   VRM 1.x: bone 名 camelCase  (hips, spine, leftUpperArm)
  // getBoneNode() 接受字符串, 大小写敏感 — 必须按 VRM 版本走
  const vrmVer = (vrm.meta?.metaVersion || '').toString()
  const isVRM1 = vrmVer.startsWith('1') || vrmVer.startsWith('2')
  const bone = (vrm0: string, vrm1: string) => isVRM1 ? vrm1 : vrm0

  // 1) 复位所有 bone (用当前 VRM 版本的 bone 名)
  //    不能用 Object.values(VRMHumanBoneName) 因为 0.x 用 PascalCase 跟我们 VRM 1.x 模型不匹配
  const ALL_BONE_NAMES = isVRM1 ? [
    'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
    'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
    'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
    'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
    'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
    'leftEye', 'rightEye', 'jaw',
  ] : Object.values(VRMHumanBoneName) as string[]
  for (const name of ALL_BONE_NAMES) {
    const b = vrm.humanoid.getNormalizedBoneNode(name)
    if (b) {
      b.rotation.set(0, 0, 0)
      b.position.set(0, b.position.y, 0)
    }
  }

  // 2) 应用"自然姿态"基线 — 让数字人不是 T-pose
  //    T-pose 手臂水平外伸, 要让其自然下垂, 大臂 rotation.z 要转 ~1.4 rad (80°)
  //    之前 0.35 rad (20°) 太小, 看着还是 T-pose
  const setNaturalPose = () => {
    const lUpper = vrm.humanoid.getNormalizedBoneNode(bone('LeftUpperArm', 'leftUpperArm'))
    const rUpper = vrm.humanoid.getNormalizedBoneNode(bone('RightUpperArm', 'rightUpperArm'))
    const lLower = vrm.humanoid.getNormalizedBoneNode(bone('LeftLowerArm', 'leftLowerArm'))
    const rLower = vrm.humanoid.getNormalizedBoneNode(bone('RightLowerArm', 'rightLowerArm'))
    const lHand = vrm.humanoid.getNormalizedBoneNode(bone('LeftHand', 'leftHand'))
    const rHand = vrm.humanoid.getNormalizedBoneNode(bone('RightHand', 'rightHand'))
    // 大臂往下垂 (rotation.z = -1.4 rad ≈ -80° 让手臂从水平外伸 → 垂到身体两侧)
    // ⚠️ 方向: 实测 +z 让手臂上扬 (过头), -z 才是下垂
    if (lUpper) lUpper.rotation.z = -1.4
    if (rUpper) rUpper.rotation.z = 1.4
    // 小臂微弯 (手肘往前, x 正向)
    if (lLower) lLower.rotation.x = 0.3
    if (rLower) rLower.rotation.x = 0.3
    // 手自然下垂 (x 正向)
    if (lHand) lHand.rotation.x = 0.3
    if (rHand) rHand.rotation.x = 0.3
    // 腿直立微张
    const lUpperLeg = vrm.humanoid.getNormalizedBoneNode(bone('LeftUpperLeg', 'leftUpperLeg'))
    const rUpperLeg = vrm.humanoid.getNormalizedBoneNode(bone('RightUpperLeg', 'rightUpperLeg'))
    if (lUpperLeg) lUpperLeg.rotation.x = -0.1
    if (rUpperLeg) rUpperLeg.rotation.x = -0.1
  }
  setNaturalPose()

  // 周期相位
  const phase = Math.sin(t * 2)

  switch (action) {
    case 'wave': {
      const r = vrm.humanoid.getNormalizedBoneNode(bone('RightUpperArm', 'rightUpperArm'))
      const f = vrm.humanoid.getNormalizedBoneNode(bone('RightLowerArm', 'rightLowerArm'))
      if (r) r.rotation.z = -2.5 + phase * 0.3
      if (f) f.rotation.z = -0.3
      vrm.scene.position.y = Math.abs(phase) * 0.02
      break
    }
    case 'walk': {
      // 行走: 腿部交替 + 手臂摆动
      const l1 = vrm.humanoid.getNormalizedBoneNode(bone('LeftUpperLeg', 'leftUpperLeg'))
      const r1 = vrm.humanoid.getNormalizedBoneNode(bone('RightUpperLeg', 'rightUpperLeg'))
      const lUL = vrm.humanoid.getNormalizedBoneNode(bone('LeftUpperLeg', 'leftUpperLeg'))
      const rUL = vrm.humanoid.getNormalizedBoneNode(bone('RightUpperLeg', 'rightUpperLeg'))
      const lLL = vrm.humanoid.getNormalizedBoneNode(bone('LeftLowerLeg', 'leftLowerLeg'))
      const rLL = vrm.humanoid.getNormalizedBoneNode(bone('RightLowerLeg', 'rightLowerLeg'))
      const lUA = vrm.humanoid.getNormalizedBoneNode(bone('LeftUpperArm', 'leftUpperArm'))
      const rUA = vrm.humanoid.getNormalizedBoneNode(bone('RightUpperArm', 'rightUpperArm'))
      // 腿部交替
      if (l1) l1.rotation.x = phase * 0.4
      if (r1) r1.rotation.x = -phase * 0.4
      // 小腿自然弯曲
      if (lUL) lUL.rotation.x = phase * 0.4
      if (rUL) rUL.rotation.x = -phase * 0.4
      if (lLL) lLL.rotation.x = Math.max(0, -phase * 0.3)
      if (rLL) rLL.rotation.x = Math.max(0, phase * 0.3)
      // 手臂自然摆动(与腿反向)
      if (lUA) lUA.rotation.x = -phase * 0.3
      if (rUA) rUA.rotation.x = phase * 0.3
      // 身体上下颠 + 轻微横移(模拟走路)
      vrm.scene.position.y = Math.abs(Math.sin(t * 4)) * 0.02
      vrm.scene.position.x = Math.sin(t * 2) * 0.03
      break
    }
    case 'run': {
      const l1 = vrm.humanoid.getNormalizedBoneNode(bone('LeftUpperLeg', 'leftUpperLeg'))
      const r1 = vrm.humanoid.getNormalizedBoneNode(bone('RightUpperLeg', 'rightUpperLeg'))
      if (l1) l1.rotation.x = phase * 0.7
      if (r1) r1.rotation.x = -phase * 0.7
      vrm.scene.position.y = Math.abs(phase) * 0.04
      break
    }
    case 'dance': {
      // 跳舞: hips 转 + 手臂摆 + 上下颠
      const hips = vrm.humanoid.getNormalizedBoneNode(bone('Hips', 'hips'))
      if (hips) {
        hips.rotation.y = t * 1.2  // 加速旋转
        hips.rotation.z = phase * 0.15
      }
      const chest = vrm.humanoid.getNormalizedBoneNode(bone('Chest', 'chest'))
      if (chest) chest.rotation.z = phase * 0.25
      // 双臂交替举
      const lU = vrm.humanoid.getNormalizedBoneNode(bone('LeftUpperArm', 'leftUpperArm'))
      const rU = vrm.humanoid.getNormalizedBoneNode(bone('RightUpperArm', 'rightUpperArm'))
      if (lU) lU.rotation.z = -2.5 + Math.sin(t * 2.5) * 0.6  // 举过头
      if (rU) rU.rotation.z = 2.5 + Math.sin(t * 2.5 + Math.PI) * 0.6
      // 膝微屈弹跳
      vrm.scene.position.y = Math.abs(Math.sin(t * 4)) * 0.05
      vrm.scene.position.x = Math.sin(t * 2) * 0.04
      break
    }
    case 'sing': {
      // 唱歌: 胸腔打开, 头微仰, 身体微摆(像有节奏)
      const neck = vrm.humanoid.getNormalizedBoneNode(bone('Neck', 'neck'))
      if (neck) neck.rotation.x = -0.15 + Math.sin(t * 3) * 0.05  // 微仰
      const chest = vrm.humanoid.getNormalizedBoneNode(bone('Chest', 'chest'))
      if (chest) {
        chest.rotation.x = -0.05  // 胸腔打开
        chest.rotation.y = Math.sin(t * 1.5) * 0.15  // 摆动
      }
      // 手放胸口位置(像握话筒)
      const rU2 = vrm.humanoid.getNormalizedBoneNode(bone('RightUpperArm', 'rightUpperArm'))
      if (rU2) rU2.rotation.z = 1.0  // 手到胸前
      vrm.scene.position.y = Math.abs(Math.sin(t * 2.5)) * 0.025
      break
    }
    case 'sit': {
      vrm.scene.position.y = -0.35
      const l1 = vrm.humanoid.getNormalizedBoneNode(bone('LeftUpperLeg', 'leftUpperLeg'))
      const r1 = vrm.humanoid.getNormalizedBoneNode(bone('RightUpperLeg', 'rightUpperLeg'))
      if (l1) l1.rotation.x = -1.5
      if (r1) r1.rotation.x = -1.5
      break
    }
    case 'point': {
      const r = vrm.humanoid.getNormalizedBoneNode(bone('RightUpperArm', 'rightUpperArm'))
      if (r) r.rotation.z = -1.5
      const neck = vrm.humanoid.getNormalizedBoneNode(bone('Neck', 'neck'))
      if (neck) neck.rotation.x = -0.1
      break
    }
    case 'think': {
      const neck = vrm.humanoid.getNormalizedBoneNode(bone('Neck', 'neck'))
      if (neck) neck.rotation.z = 0.2
      const r = vrm.humanoid.getNormalizedBoneNode(bone('RightUpperArm', 'rightUpperArm'))
      if (r) r.rotation.z = -1.8
      break
    }
    case 'talk': {
      const chest = vrm.humanoid.getNormalizedBoneNode(bone('Chest', 'chest'))
      if (chest) chest.rotation.x = Math.sin(t * 3) * 0.05
      vrm.scene.position.y = Math.abs(Math.sin(t * 3)) * 0.02
      break
    }
    case 'bow': {
      const chest = vrm.humanoid.getNormalizedBoneNode(bone('Chest', 'chest'))
      if (chest) chest.rotation.x = 0.4
      const neck = vrm.humanoid.getNormalizedBoneNode(bone('Neck', 'neck'))
      if (neck) neck.rotation.x = 0.3
      break
    }
    case 'idle':
    default: {
      // 活泼 idle: 头部摆动 + 点头 + 歪头 + 呼吸 + 重心转移 + 眨眼
      const head = vrm.humanoid.getNormalizedBoneNode(bone('Head', 'head'))
      if (head) {
        head.rotation.y = Math.sin(t * 0.4) * 0.18
        head.rotation.x = Math.sin(t * 0.7) * 0.08 - 0.02
        head.rotation.z = Math.sin(t * 0.3) * 0.06
      }
      const chest = vrm.humanoid.getNormalizedBoneNode(bone('Chest', 'chest'))
      if (chest) {
        chest.rotation.x = Math.sin(t * 0.9) * 0.05
        chest.rotation.y = Math.sin(t * 0.25) * 0.08
      }
      const spine = vrm.humanoid.getNormalizedBoneNode(bone('Spine', 'spine'))
      if (spine) {
        spine.rotation.z = Math.sin(t * 0.4) * 0.04
        spine.rotation.x = Math.sin(t * 0.5) * 0.02
      }
      const hips = vrm.humanoid.getNormalizedBoneNode(bone('Hips', 'hips'))
      if (hips) hips.rotation.z = Math.sin(t * 0.3) * 0.03
      vrm.scene.position.y = Math.abs(Math.sin(t * 0.9)) * 0.02
      vrm.scene.position.x = Math.sin(t * 0.4) * 0.01
      // 眨眼: 4s 一轮, 最后 0.1s 闭眼
      const blinkCycle = t % 4
      const em = vrm.expressionManager
      if (em?.setValue) {
        if (blinkCycle > 3.9) {
          em.setValue(bone('Blink', 'blink'), 1.0)
          em.setValue(bone('blinkLeft', 'eyeBlinkLeft'), 1.0)
          em.setValue(bone('blinkRight', 'eyeBlinkRight'), 1.0)
        } else {
          em.setValue(bone('Blink', 'blink'), 0)
          em.setValue(bone('blinkLeft', 'eyeBlinkLeft'), 0)
          em.setValue(bone('blinkRight', 'eyeBlinkRight'), 0)
        }
      }
      break
    }
  }
}


// ── morph / expression 应用(VRM 用 expressionManager,GLB 用 morphTargetInfluences) ──

// ── viseme → ARKit 兜底 ──────────────────────────────────────────────
//
// 多数 VRM 0.0 模型(VRoid Hub 自制角色)只有 ARKit 52 维 blendshape
// (mouthOpen / jawOpen / mouthClose 等),不带 viseme_* ovrlipsync 名字。
// 我们的 LLM/TTS 链路返回的是 OVRLipSync 短名(sil/aa/E/I/O/U/PP/FF/...)。
//
// 优先按 EXPRESSION_MAP 设 viseme_*;就算设不上,再设 ARKit 兜底,
// 让无 viseme 通道的 VRM 也能嘴动。
const VISEME_TO_ARKIT: Record<string, string[]> = {
  sil:   ['mouthClose', 'jawOpen'],                  // 闭唇
  closed: ['mouthClose', 'jawOpen'],
  aa:    ['mouthOpen', 'jawOpen'],                   // 张嘴元音
  E:     ['mouthStretchLeft', 'mouthStretchRight'], // 咧嘴角
  I:     ['mouthStretchLeft', 'mouthStretchRight'],
  O:     ['mouthPucker', 'mouthFunnel', 'jawOpen'],  // 圆唇
  U:     ['mouthPucker', 'mouthFunnel', 'jawOpen'],
  ou:    ['mouthPucker', 'mouthFunnel', 'jawOpen'],
  ih:    ['mouthStretchLeft', 'mouthStretchRight'],
  PP:    ['mouthPressLeft', 'mouthPressRight', 'mouthClose'],  // 双唇紧闭(辅音)
  FF:    ['mouthLowerDownLeft', 'mouthLowerDownRight'],
  TH:    ['tongueOut'],
  DD:    ['tongueOut', 'mouthOpen'],
  kk:    ['mouthOpen'],
  CH:    ['mouthFunnel', 'mouthOpen'],
  SS:    ['mouthStretchLeft', 'mouthStretchRight'],
  nn:    ['mouthOpen'],
  RR:    ['mouthRollLower', 'mouthOpen'],
};

function applyExpressions(
  loaded: Cached,
  emotion: Record<string, number>,
  viseme: Record<string, number>,
  lastAppliedRef: React.MutableRefObject<Record<string, number>>,
) {
  const next: Record<string, number> = {};

  if (loaded.vrm && loaded.expressionManager) {
    // VRM 路径:用 expressionManager.setValue()
    const em = loaded.expressionManager;
    // 表情(表情映射)
    for (const k of Object.keys(emotion)) {
      const vrmName = EXPRESSION_MAP[k] || k;
      em.setValue(vrmName, emotion[k] || 0);
      next[vrmName] = emotion[k] || 0;
    }
    // 口型(同名)
    for (const k of Object.keys(viseme)) {
      const vrmName = EXPRESSION_MAP[k] || k;
      em.setValue(vrmName, viseme[k] || 0);
      next[vrmName] = viseme[k] || 0;
      // ARKit 兜底 (VRoid 模型通常没 viseme_* 通道,只走这条才动嘴)
      const arkitChannels = VISEME_TO_ARKIT[k];
      if (arkitChannels) {
        for (const ch of arkitChannels) {
          em.setValue(ch, viseme[k]);
          next[ch] = viseme[k];
        }
      }
    }
    em.update();
  } else {
    // GLB 路径:用 morphTargetInfluences
    const meshes = Object.values(loaded.morphs);
    if (meshes.length === 0) return;
    Object.entries(emotion).forEach(([k, v]) => (next[k] = v || 0));
    Object.entries(viseme).forEach(([k, v]) => (next[k] = v || 0));
    Object.keys(lastAppliedRef.current).forEach((k) => {
      if (next[k] === undefined) next[k] = 0;
    });
    Object.entries(next).forEach(([name, value]) => {
      meshes.forEach(({ mesh, indices }) => {
        if (!mesh || !mesh.morphTargetInfluences) return;
        const idx = indices[name];
        if (typeof idx !== 'number') return;
        if (idx < 0 || idx >= mesh.morphTargetInfluences.length) return;
        try { mesh.morphTargetInfluences[idx] = value; } catch { /* skip */ }
      });
    });
    lastAppliedRef.current = { ...next };
  }
}


// ── 数字人"活"细节: 鼠标跟随 + 微表情 + 呼吸 ────────────────

// 共享时间源(避免每个函数重新 Date.now())
let _tStart = 0
function tSec() {
  if (!_tStart) _tStart = performance.now() / 1000
  return performance.now() / 1000 - _tStart
}

// 鼠标位置 → 头部 + 眼球旋转(让数字人"看着你")
// mouse: {x, y} 都在 [-1, 1]
function applyMouseFollow(vrm: any, mouse: { x: number; y: number }) {
  if (!vrm.humanoid) return
  const vrmVer = (vrm.meta?.metaVersion || '').toString()
  const isVRM1 = vrmVer.startsWith('1') || vrmVer.startsWith('2')
  const bone = (vrm0: string, vrm1: string) => isVRM1 ? vrm1 : vrm0

  // 头部最大转 ±0.4 rad (~23°)
  const headX = -mouse.y * 0.25  // 鼠标 y 越大, 头越低
  const headY = mouse.x * 0.4
  const head = vrm.humanoid.getNormalizedBoneNode(bone('Head', 'head'))
  if (head) {
    // 叠在 idle 动画上(用 += 偏移, 不覆盖)
    head.rotation.x += headX * 0.3
    head.rotation.y += headY * 0.3
  }

  // 眼球更大幅度(让"眼神"跟着, 头可以不动, 眼动)
  const eyeX = -mouse.y * 0.15
  const eyeY = mouse.x * 0.2
  const em = vrm.expressionManager
  if (em?.setValue) {
    if (mouse.x > 0.3) {
      em.setValue(bone('eyeLookOutRight', 'eyeLookOutRight'), eyeY)
      em.setValue(bone('eyeLookInLeft', 'eyeLookInLeft'), eyeY)
    } else if (mouse.x < -0.3) {
      em.setValue(bone('eyeLookInRight', 'eyeLookInRight'), -eyeY)
      em.setValue(bone('eyeLookOutLeft', 'eyeLookOutLeft'), -eyeY)
    }
    if (mouse.y > 0.3) {
      em.setValue(bone('eyeLookUpLeft', 'eyeLookUpLeft'), eyeX)
      em.setValue(bone('eyeLookUpRight', 'eyeLookUpRight'), eyeX)
    } else if (mouse.y < -0.3) {
      em.setValue(bone('eyeLookDownLeft', 'eyeLookDownLeft'), -eyeX)
      em.setValue(bone('eyeLookDownRight', 'eyeLookDownRight'), -eyeX)
    }
  }
}

// 随机微表情 + 长眨眼(让数字人"活"得更像人, 不只眨眼一次)
// 周期 6-9s 随机闪烁 joy 0.15(若有若无的微笑)
// 周期 3-7s 随机长眨眼(0.15s 闭眼)
function applyMicroExpressions(vrm: any, t: number) {
  if (!vrm.expressionManager) return
  const em = vrm.expressionManager

  // 微表情: 周期性 joy 微闪(若有若无)
  const microJoyCycle = t % 7.3
  if (microJoyCycle > 6.9) {
    em.setValue('joy', 0.15)
  } else {
    em.setValue('joy', 0)
  }

  // 眨眼: 5-6s 一次, 持续 0.15s
  const blinkCycle = t % 5.7
  if (blinkCycle > 5.55) {
    em.setValue('blink', 1.0)
  } else {
    em.setValue('blink', 0)
  }

  // 偶尔微微皱眉(sad): 11s 周期, 1s 持续
  const sadCycle = t % 11
  if (sadCycle > 10.5) {
    em.setValue('sorrow', 0.2)
  } else {
    em.setValue('sorrow', 0)
  }
}
