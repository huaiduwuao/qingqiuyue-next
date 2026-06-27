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

// VRM 表情名字映射(我们 LLM/Mock 用的 12 个 → VRM 表情管理器的标准名字)
const EXPRESSION_MAP: Record<string, string> = {
  smile: 'joy',          // VRM 0.0 标准的 happy
  angry: 'angry',
  sad: 'sorrow',
  surprised: 'fun',
  blink: 'blink',         // VRM 自带
  // viseme 同名
  aa: 'aa', ih: 'ih', ou: 'ou', E: 'E', O: 'O', U: 'U', closed: 'closed',
};

// 缓存:url -> 加载好的 scene + vrm(或 null 表示 GLB fallback)
type Cached = {
  url: string;
  scene: any;
  vrm: any | null;  // null 表示 GLB 模式
  morphs: Record<string, { mesh: any; indices: Record<string, number> }>;
  expressionManager: any | null;  // VRM 模式
  humanoid: any | null;  // VRM 模式
  animations: any[];
};
const cache = new Map<string, Cached>();
let inflight: { url: string; promise: Promise<Cached> } | null = null;

async function loadAvatar(url: string): Promise<Cached> {
  const hit = cache.get(url);
  if (hit) return hit;
  if (inflight && inflight.url === url) return inflight.promise;
  const promise = (async () => {
    const THREE = await import('three');
    const cache_url = url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now();
    const res = await fetch(cache_url);
    if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader');

    // 尝试当 VRM 加载(.vrm 后缀 或 用 VRM 解析器)
    if (url.endsWith('.vrm')) {
      const { VRMLoaderPlugin, VRMUtils } = await import('@pixiv/three-vrm');
      const loader = new GLTFLoader();
      loader.register((parser: any) => new VRMLoaderPlugin(parser));
      const gltf = await loader.parseAsync(buf.buffer, '');
      const vrm = gltf.userData.vrm;
      // VRM 0.0 → humanoid bones + expressionManager
      const morphs: Record<string, { mesh: any; indices: Record<string, number> }> = {};
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
    }

    // GLB fallback
    const loader = new GLTFLoader();
    const gltf: any = await loader.parseAsync(buf.buffer, '');
    const morphs: Record<string, { mesh: any; indices: Record<string, number> }> = {};
    gltf.scene.traverse((obj: any) => {
      if (!obj.isMesh && !obj.isSkinnedMesh) return;
      const dict = obj.morphTargetDictionary;
      if (dict) morphs[obj.name] = { mesh: obj, indices: { ...dict } };
    });
    const result: Cached = {
      url,
      scene: gltf.scene,
      vrm: null,
      morphs,
      expressionManager: null,
      humanoid: null,
      animations: gltf.animations || [],
    };
    cache.set(url, result);
    return result;
  })();
  inflight = { url, promise };
  return promise;
}


export interface BlenderAvatarProps {
  /** 角色 URL(优先 .vrm,fallback .glb) */
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
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [useFallback, setUseFallback] = React.useState(false);

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

        // 尝试加载 .vrm,失败 fallback 到 .glb
        let loaded: Cached | null = null;
        try {
          console.log('[BlenderAvatar] 开始加载 VRM/GLB...');
          loaded = await loadAvatar(modelUrl);
          console.log('[BlenderAvatar] 加载成功,isVRM=', !!loaded.vrm, 'animations=', loaded.animations.length);
        } catch (e1: any) {
          console.warn('[BlenderAvatar] 加载失败,fallback .glb:', e1?.message);
          const fallback = modelUrl.replace(/\.vrm$/, '.glb');
          if (fallback !== modelUrl) {
            try {
              loaded = await loadAvatar(fallback);
              setUseFallback(true);
              console.log('[BlenderAvatar] GLB fallback 成功');
            } catch (e2: any) {
              throw new Error(`VRM 失败 (${e1?.message}) + GLB fallback 失败 (${e2?.message})`);
            }
          } else {
            throw e1;
          }
        }
        if (cancelled) return;
        if (!loaded) throw new Error('no avatar loaded');
        loadedRef.current = loaded;
        scene.add(loaded.scene);
        console.log('[BlenderAvatar] 角色已加入 scene,scene children=', scene.children.length);

        // mixer
        if (loaded.animations.length > 0) {
          const { AnimationMixer } = THREE as any;
          const mixer = new AnimationMixer(loaded.scene);
          mixerRef.current = mixer;
          const clip = loaded.animations.find((a: any) => a.name === currentAction) || loaded.animations[0];
          if (clip) mixer.clipAction(clip).play();
        }

        // VRM 模式:scale + 居中
        if (loaded.vrm) {
          loaded.scene.scale.setScalar(1.0);
          console.log('[BlenderAvatar] VRM 加载,scene 已加');
        } else {
          const { Box3, Vector3 } = THREE as any;
          const box = new Box3().setFromObject(loaded.scene);
          const center = new Vector3();
          const size = new Vector3();
          box.getCenter(center);
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 1.6 / maxDim;
          loaded.scene.scale.setScalar(scale);
          loaded.scene.position.set(-center.x * scale, -center.y * scale + 0.9, -center.z * scale);
          console.log('[BlenderAvatar] GLB fallback,scale=', scale);
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
          if (autoRotate && loadedRef.current?.scene) {
            loadedRef.current.scene.rotation.y += dt * 0.3;
          }
          renderer.render(scene, camera);
          rafRef.current = requestAnimationFrame(frame);
        };
        rafRef.current = requestAnimationFrame(frame);
        console.log('[BlenderAvatar] 主循环启动,渲染中...');
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
      {useFallback && !error && !loading && (
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
  if (!vrm.humanoid) return;
  // VRMHumanBoneName: Hips / Spine / Chest / Neck / Head / LeftShoulder / RightShoulder 等
  const { VRMHumanBoneName } = await import('@pixiv/three-vrm');
  const t = performance.now() / 1000;

  // 复位所有 bone
  const allBones = Object.values(VRMHumanBoneName) as string[];
  for (const name of allBones) {
    const bone = vrm.humanoid.getNormalizedBoneNode(name);
    if (bone) {
      bone.rotation.set(0, 0, 0);
      bone.position.set(0, bone.position.y, 0);  // 保留 y(让脚贴地)
    }
  }

  // 周期相位
  const phase = Math.sin(t * 2);

  switch (action) {
    case 'wave': {
      const r = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm);
      const f = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightLowerArm);
      if (r) r.rotation.z = -2.5 + phase * 0.3;
      if (f) f.rotation.z = -0.3;
      vrm.scene.position.y = Math.abs(phase) * 0.02;
      break;
    }
    case 'walk': {
      const l1 = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperLeg);
      const r1 = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperLeg);
      if (l1) l1.rotation.x = phase * 0.4;
      if (r1) r1.rotation.x = -phase * 0.4;
      vrm.scene.position.y = Math.abs(phase) * 0.02;
      break;
    }
    case 'run': {
      const l1 = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperLeg);
      const r1 = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperLeg);
      if (l1) l1.rotation.x = phase * 0.7;
      if (r1) r1.rotation.x = -phase * 0.7;
      vrm.scene.position.y = Math.abs(phase) * 0.04;
      break;
    }
    case 'dance': {
      const hips = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Hips);
      if (hips) hips.rotation.y = t * 0.4;
      const chest = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Chest);
      if (chest) chest.rotation.z = phase * 0.1;
      vrm.scene.position.y = Math.abs(Math.sin(t * 4)) * 0.03;
      break;
    }
    case 'sit': {
      vrm.scene.position.y = -0.35;
      const l1 = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperLeg);
      const r1 = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperLeg);
      if (l1) l1.rotation.x = -1.5;
      if (r1) r1.rotation.x = -1.5;
      break;
    }
    case 'point': {
      const r = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm);
      if (r) r.rotation.z = -1.5;
      const neck = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Neck);
      if (neck) neck.rotation.x = -0.1;
      break;
    }
    case 'think': {
      const neck = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Neck);
      if (neck) neck.rotation.z = 0.2;
      const r = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm);
      if (r) r.rotation.z = -1.8;
      break;
    }
    case 'talk': {
      const chest = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Chest);
      if (chest) chest.rotation.x = Math.sin(t * 3) * 0.05;
      vrm.scene.position.y = Math.abs(Math.sin(t * 3)) * 0.02;
      break;
    }
    case 'bow': {
      const chest = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Chest);
      if (chest) chest.rotation.x = 0.4;
      const neck = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Neck);
      if (neck) neck.rotation.x = 0.3;
      break;
    }
    case 'idle':
    default: {
      const chest = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Chest);
      if (chest) chest.rotation.x = Math.sin(t * 0.5) * 0.03;
      break;
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
