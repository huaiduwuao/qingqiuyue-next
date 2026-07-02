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
const { VRMLoaderPlugin, VRMUtils, VRMHumanBoneName } = THREE_VRM;

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
type MorphEntry = { mesh: any; indices: Record<string, number> };
type Cached = {
  url: string;
  scene: any;
  vrm: any;
  morphs: Record<string, MorphEntry>;
  expressionManager: any;
  humanoid: any;
  animations: any[];
};
const cache = new Map<string, Cached>();
let inflight: { url: string; promise: Promise<Cached> } | null = null;

async function loadAvatar(url: string): Promise<Cached> {
  const hit = cache.get(url);
  if (hit) return hit;
  if (inflight && inflight.url === url) return inflight.promise;
  const promise = (async () => {
    if (!url.endsWith('.vrm')) {
      throw new Error(`BlenderAvatar 现在只支持 .vrm 格式(${url} 不是)。请把角色放到 public/avatars/character.vrm`);
    }
    const THREE = await import('three');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader');
    const loader = new GLTFLoader();
    loader.register((parser: any) => new VRMLoaderPlugin(parser));
    const gltf = await loader.parseAsync(buf.buffer, '');
    const vrm = gltf.userData.vrm;
    if (!vrm) throw new Error(`VRM 解析失败: ${url}`);
    // VRM 0.0 → humanoid bones + expressionManager
    const morphs: Record<string, MorphEntry> = {};
    vrm.scene.traverse((obj: any) => {
      if (obj.isMesh || obj.isSkinnedMesh) {
        const dict = obj.morphTargetDictionary;
        if (dict) morphs[obj.name] = { mesh: obj, indices: { ...dict } };
      }
    });
    const result: Cached = {
      url,
      scene: vrm.scene,
      vrm,
      morphs,
      expressionManager: vrm.expressionManager,
      humanoid: vrm.humanoid,
      animations: gltf.animations || [],
    };
    cache.set(url, result);
    return result;
  })();
  inflight = { url, promise };
  return promise;
}


export interface BlenderAvatarProps {
  /** 角色 URL(必须 .vrm 后缀) */
  modelUrl?: string;
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
}

export default function BlenderAvatar({
  modelUrl = '/avatars/character.vrm',
  currentAction = 'idle',
  emotion = {},
  viseme = {},
  autoRotate = true,
  background = 'radial-gradient(ellipse at 50% 30%, rgba(124,58,237,0.18) 0%, transparent 55%), #05060B',
  sx,
}: BlenderAvatarProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rendererRef = React.useRef<any>(null);
  const sceneRef = React.useRef<any>(null);
  const cameraRef = React.useRef<any>(null);
  const loadedRef = React.useRef<Cached | null>(null);
  const mixerRef = React.useRef<any>(null);
  const rafRef = React.useRef<number | null>(null);
  const rotationRef = React.useRef(0);
  // 用 ref 跟踪 currentAction, 避免 frame 闭包过期
  const currentActionRef = React.useRef(currentAction);
  currentActionRef.current = currentAction;
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  // 初始化场景 + 加载角色
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

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
        } catch (e1: any) {
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
          const mixer = new THREE.AnimationMixer(loaded.scene);
          mixerRef.current = mixer;
          const clip = loaded.animations.find((a: any) => a.name === currentAction) || loaded.animations[0];
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
          }
          // 4) 可选: 整体缓慢旋转 (由 prop 控制)
          if (autoRotate && loadedRef.current?.scene) {
            loadedRef.current.scene.rotation.y += dt * 0.3;
          }
          renderer.render(scene, camera);
          rafRef.current = requestAnimationFrame(frame);
        };
        rafRef.current = requestAnimationFrame(frame);
      } catch (err: any) {
        if (cancelled) return;
        console.error('[BlenderAvatar] init failed:', err);
        setError(err?.message || 'init failed');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
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
      const l1 = vrm.humanoid.getNormalizedBoneNode(bone('LeftUpperLeg', 'leftUpperLeg'))
      const r1 = vrm.humanoid.getNormalizedBoneNode(bone('RightUpperLeg', 'rightUpperLeg'))
      if (l1) l1.rotation.x = phase * 0.4
      if (r1) r1.rotation.x = -phase * 0.4
      vrm.scene.position.y = Math.abs(phase) * 0.02
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
    case 'walk': {
      // 原地踏步(不是真的在走路,但看着在动)
      const lUL = vrm.humanoid.getNormalizedBoneNode(bone('LeftUpperLeg', 'leftUpperLeg'))
      const rUL = vrm.humanoid.getNormalizedBoneNode(bone('RightUpperLeg', 'rightUpperLeg'))
      const lLL = vrm.humanoid.getNormalizedBoneNode(bone('LeftLowerLeg', 'leftLowerLeg'))
      const rLL = vrm.humanoid.getNormalizedBoneNode(bone('RightLowerLeg', 'rightLowerLeg'))
      if (lUL) lUL.rotation.x = phase * 0.5
      if (rUL) rUL.rotation.x = -phase * 0.5
      if (lLL) lLL.rotation.x = Math.max(0, -phase * 0.3)
      if (rLL) rLL.rotation.x = Math.max(0, phase * 0.3)
      // 双臂自然摆
      const lUA = vrm.humanoid.getNormalizedBoneNode(bone('LeftUpperArm', 'leftUpperArm'))
      const rUA = vrm.humanoid.getNormalizedBoneNode(bone('RightUpperArm', 'rightUpperArm'))
      if (lUA) lUA.rotation.x = -phase * 0.3
      if (rUA) rUA.rotation.x = phase * 0.3
      vrm.scene.position.y = Math.abs(Math.sin(t * 4)) * 0.04
      vrm.scene.position.x = Math.sin(t * 2) * 0.06  // 看似在挪动
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
