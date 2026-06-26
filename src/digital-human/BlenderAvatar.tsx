'use client';

/**
 * BlenderAvatar —— 浏览器内的 3D 数字人角色
 *
 * 资产路径(一次性,Blender 离线):
 *   1. Blender 程序化生成写实风格女性(build_avatar_v2.py)
 *      头/长头发/胸/腰/髋/手/脚/脸/眼/嘴
 *   2. KNN 手动算 vertex group weights(background mode 下 ARMATURE_AUTO 不工作)
 *   3. Armature modifier 引用 17 骨头标准骨架
 *   4. 12 morph targets(5 表情 + 7 口型)
 *   5. 10 baked actions(idle / walk / wave / run / dance / sit / point / think / talk / bow)
 *   6. export_apply=False:保留 skin weight,让 WebGL 一次 skin 矩阵计算
 *   7. 导出 public/avatars/model.glb(~4-5 MB)
 *
 * 浏览器驱动:
 *   - three.js + WebGLRenderer 加载 .glb
 *   - AnimationMixer 播 10 个动作
 *   - morphTargetInfluences 设 12 个表情/口型
 *   - JS 直接驱动,无网络 / 无服务器
 *
 * 注意:
 *   - headless Chrome 用 swiftshader 软渲染 SkinnedMesh 失败(显示堆原点)
 *   - 真 GPU 浏览器(ANGLE/D3D)正确渲染
 *   - 用户必须在真浏览器看,不要相信 headless 截图
 */

import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

type LoadedAvatar = {
  url: string;
  scene: any;
  animations: any[];
  morphs: Record<string, { mesh: any; indices: Record<string, number> }>;
};
const cache = new Map<string, LoadedAvatar>();
let inflight: { url: string; promise: Promise<LoadedAvatar> } | null = null;

async function loadGlb(url: string): Promise<LoadedAvatar> {
  const hit = cache.get(url);
  if (hit) return hit;
  if (inflight && inflight.url === url) return inflight.promise;
  const promise = (async () => {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader');
    const loader = new GLTFLoader();
    const gltf: any = await loader.loadAsync(url);
    const morphs: LoadedAvatar['morphs'] = {};
    gltf.scene.traverse((obj: any) => {
      const mesh = obj as any;
      if (!mesh.isMesh) return;
      const dict = mesh.morphTargetDictionary;
      const influences = mesh.morphTargetInfluences;
      if (!dict || !influences) return;
      morphs[mesh.name] = { mesh, indices: { ...dict } };
    });
    const result: LoadedAvatar = { url, scene: gltf.scene, animations: gltf.animations, morphs };
    cache.set(url, result);
    return result;
  })();
  inflight = { url, promise };
  return promise;
}

export interface BlenderAvatarProps {
  /** Blender 导出的 .glb 资源路径 */
  modelUrl?: string;
  /** 当前动作(idle / walk / wave / think / sit / run / dance / point / talk / bow) */
  currentAction?: string;
  /** 表情 BlendShape 字典 */
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
  modelUrl = '/avatars/model.glb',
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
  const modelRef = React.useRef<any>(null);
  const mixerRef = React.useRef<any>(null);
  const morphsRef = React.useRef<LoadedAvatar['morphs']>({});
  const animationsRef = React.useRef<any[]>([]);
  const rafRef = React.useRef<number | null>(null);
  const rotationRef = React.useRef(0);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    (async () => {
      try {
        const THREE = await import('three');
        canvas.style.display = 'block';
        canvas.style.outline = 'none';

        const renderer = new THREE.WebGLRenderer({
          canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
        });
        if (cancelled) return;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        rendererRef.current = renderer;

        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.background = null;

        const camera = new THREE.PerspectiveCamera(35, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
        camera.position.set(0, 0.9, 2.8);
        camera.lookAt(0, 0.85, 0);
        cameraRef.current = camera;

        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const key = new THREE.DirectionalLight(0xffffff, 0.8);
        key.position.set(2, 4, 3);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xa0a0ff, 0.4);
        rim.position.set(-2, 2, -2);
        scene.add(rim);

        // 加载 GLB(写实风格女性 build_avatar_v2.py 生成的)
        const data = await loadGlb(modelUrl);
        if (cancelled) return;
        modelRef.current = data.scene;
        morphsRef.current = data.morphs;
        animationsRef.current = data.animations;
        scene.add(data.scene);

        // 动画 mixer
        if (data.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(data.scene);
          mixerRef.current = mixer;
          const clip = data.animations.find((a: any) => a.name === currentAction) || data.animations[0];
          if (clip) mixer.clipAction(clip).play();
        }

        // 居中 + 缩放:让 GLB 在视野中央
        const box = new (THREE as any).Box3().setFromObject(data.scene);
        const center = new (THREE as any).Vector3();
        const size = new (THREE as any).Vector3();
        box.getCenter(center);
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.8 / maxDim;
        data.scene.scale.setScalar(scale);
        data.scene.position.set(-center.x * scale, -center.y * scale + 0.9, -center.z * scale);

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
          if (autoRotate && data.scene) {
            data.scene.rotation.y += dt * 0.3;
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
      modelRef.current = null;
      mixerRef.current = null;
    };
  }, [modelUrl, autoRotate]);

  // 切换动作
  React.useEffect(() => {
    if (!mixerRef.current || animationsRef.current.length === 0) return;
    const clip = animationsRef.current.find((a: any) => a.name === currentAction) || animationsRef.current[0];
    if (!clip) return;
    mixerRef.current.stopAllAction();
    mixerRef.current.clipAction(clip).play();
  }, [currentAction]);

  // 应用 morph
  const lastAppliedRef = React.useRef<Record<string, number>>({});
  React.useEffect(() => {
    const meshes = Object.values(morphsRef.current);
    if (meshes.length === 0) return;
    const next: Record<string, number> = {};
    Object.entries(emotion).forEach(([k, v]) => (next[k] = v));
    Object.entries(viseme).forEach(([k, v]) => (next[k] = v));
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
          color: 'rgba(255,80,80,0.85)', fontSize: 13, textAlign: 'center', p: 3, flexDirection: 'column', pointerEvents: 'none',
        }}>
          <Box>{error}</Box>
        </Box>
      )}
    </Box>
  );
}
