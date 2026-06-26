'use client';

/**
 * BlenderAvatar —— 浏览器内的真人数字人(完全开源、零 GPU 服务器)。
 *
 * 资产路径(一次性,Blender 离线):
 *   1. Blender 建模写实人物(MakeHuman 模板 / 自己雕刻)
 *   2. Rigify 自动绑骨架 + 自定义 BlendShape:
 *      - 表情:smile / angry / sad / surprised / blink / brow-up
 *      - 口型:aa / ih / ou / E / O / closed
 *   3. 导出 .glb(包含 mesh + skeleton + morph targets + animations)
 *   4. 放到 public/avatars/model.glb
 *
 * 浏览器驱动:
 *   - three.js + WebGPURenderer 加载 .glb
 *   - AnimationMixer 播动作(idle / walk / wave / think)
 *   - morphTargetInfluences 设表情/口型 BlendShape
 *   - JS 直接驱动,无网络 / 无服务器
 *
 * 完全开源链路(无 SMPL / 无 FLAME / 无任何注册):
 *   - 资产:Blender 建模(GPL)→ 用户拥有模型
 *   - 渲染:three.js(MIT)+ WebGPU(W3C 标准)
 *   - 后端:开源 LLM(Qwen / ChatGLM)+ 开源 TTS(CosyVoice / Edge-TTS)
 *   - 部署:0 GPU 服务器,客户端本地驱动
 */

import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

// three 用动态 import + 弱类型,避免 @types/three 与 three/webgpu 类型冲突
// 运行时由 webpack/turbopack 处理真实模块
type LoadedAvatar = {
  url: string;
  scene: any;
  animations: any[];
  morphs: Record<string, { mesh: any; indices: Record<string, number> }>;
};
// 按 URL 缓存已加载的 GLB;inflight 记录当前正在加载的 (url, promise),
// 防止快速切 outfit 时两个不同的 URL 共用同一个 loadPromise 的竞态。
const cache = new Map<string, LoadedAvatar>();
let inflight: { url: string; promise: Promise<LoadedAvatar> } | null = null;

async function loadGlb(url: string): Promise<LoadedAvatar> {
  // 命中缓存
  const hit = cache.get(url);
  if (hit) return hit;
  // 正在加载且 URL 一致(并发同 URL 调用复用同一 promise)
  if (inflight && inflight.url === url) return inflight.promise;
  // URL 不一致 → 开新加载,覆盖 inflight(旧的 promise 仍会跑完,但结果只更新自己的 URL 缓存)
  const promise = (async () => {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader');
    const loader = new GLTFLoader();
    const gltf: any = await loader.loadAsync(url);

    // 收集所有 morph target
    const morphs: LoadedAvatar['morphs'] = {};
    gltf.scene.traverse((obj: any) => {
      const mesh = obj as any;
      if (!mesh.isMesh) return;
      const dict = mesh.morphTargetDictionary;
      const influences = mesh.morphTargetInfluences;
      if (!dict || !influences) return;
      morphs[mesh.name] = { mesh, indices: { ...dict } };
    });

    const result: LoadedAvatar = {
      url,
      scene: gltf.scene,
      animations: gltf.animations,
      morphs,
    };
    cache.set(url, result);
    return result;
  })();
  inflight = { url, promise };
  return promise;
}

export interface BlenderAvatarProps {
  /** Blender 导出的 .glb 资源路径 */
  modelUrl?: string;
  /** 当前动作(由后端 LLM 决策: idle / walk / wave / think / sit) */
  currentAction?: string;
  /** 当前表情 BlendShape 字典(表情名 → 0~1) */
  emotion?: Record<string, number>;
  /** 当前口型 BlendShape 字典(音素名 → 0~1) */
  viseme?: Record<string, number>;
  /** 是否自动旋转相机 */
  autoRotate?: boolean;
  /** 全屏背景颜色(纯色或品牌色) */
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
  const containerRef = React.useRef<HTMLDivElement>(null);
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
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    (async () => {
      try {
        const THREE = await import('three');
        const { WebGPURenderer } = await import('three/webgpu');

        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        canvas.style.outline = 'none';
        container.innerHTML = '';
        container.appendChild(canvas);

        const renderer = new WebGPURenderer({ canvas, antialias: true, alpha: true } as any);
        await renderer.init();
        if (cancelled) return;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(container.clientWidth, container.clientHeight, false);
        rendererRef.current = renderer;

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(
          35,
          container.clientWidth / container.clientHeight,
          0.1,
          100,
        );
        camera.position.set(0, 1.55, 3);
        camera.lookAt(0, 1.4, 0);
        cameraRef.current = camera;

        // 灯光
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambient);
        const key = new THREE.DirectionalLight(0xffffff, 1.2);
        key.position.set(2, 4, 3);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xa0a0ff, 0.5);
        rim.position.set(-2, 2, -2);
        scene.add(rim);

        // 加载 GLB
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
          const first = data.animations[0];
          mixer.clipAction(first).play();
        }

        // Resize
        const onResize = () => {
          if (!container) return;
          renderer.setSize(container.clientWidth, container.clientHeight, false);
          camera.aspect = container.clientWidth / container.clientHeight;
          camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', onResize);

        setLoading(false);

        // 主循环
        const clock = new THREE.Clock();
        const frame = () => {
          if (cancelled) return;
          const dt = clock.getDelta();
          if (mixerRef.current) mixerRef.current.update(dt);

          // 自动旋转相机(绕模型转)
          if (autoRotate && modelRef.current) {
            rotationRef.current += dt * 0.15;
            const r = 3;
            const cx = Math.sin(rotationRef.current) * r;
            const cz = Math.cos(rotationRef.current) * r;
            camera.position.set(cx, 1.55, cz);
            camera.lookAt(0, 1.4, 0);
          }

          renderer.render(scene, camera);
          rafRef.current = requestAnimationFrame(frame);
        };
        rafRef.current = requestAnimationFrame(frame);
      } catch (err: any) {
        if (cancelled) return;
        console.error('[BlenderAvatar] init failed:', err);
        setError(err?.message || 'WebGPU 初始化失败');
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

  // 应用表情 + 口型 BlendShape(合并 effect,处理清零避免残留)
  const lastAppliedRef = React.useRef<Record<string, number>>({});
  React.useEffect(() => {
    const meshes = Object.values(morphsRef.current);
    if (meshes.length === 0) return;
    // 合并两个命名空间
    const next: Record<string, number> = {};
    Object.entries(emotion).forEach(([k, v]) => (next[k] = v));
    Object.entries(viseme).forEach(([k, v]) => (next[k] = v));
    // 把上一次的、不在新 dict 里的 key 清零(避免上一段 viseme 残留)
    Object.keys(lastAppliedRef.current).forEach((k) => {
      if (next[k] === undefined) next[k] = 0;
    });
    // 应用
    Object.entries(next).forEach(([name, value]) => {
      meshes.forEach(({ mesh, indices }) => {
        const idx = indices[name];
        if (idx !== undefined && mesh.morphTargetInfluences) {
          mesh.morphTargetInfluences[idx] = value;
        }
      });
    });
    lastAppliedRef.current = { ...next };
  }, [emotion, viseme]);

  // 切换动作
  React.useEffect(() => {
    if (!mixerRef.current || animationsRef.current.length === 0) return;
    const clip =
      animationsRef.current.find((a: any) => a.name === currentAction) ||
      animationsRef.current[0];
    if (!clip) return;
    mixerRef.current.stopAllAction();
    mixerRef.current.clipAction(clip).play();
  }, [currentAction]);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: '100%',
        background,
        position: 'relative',
        overflow: 'hidden',
        ...sx,
      }}
    >
      {loading && (
        <Box sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.6)',
          gap: 1.5,
        }}>
          <CircularProgress size={28} />
          <Typography sx={{ fontSize: 13 }}>加载 Blender 数字人…</Typography>
        </Box>
      )}
      {error && (
        <Box sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,80,80,0.85)',
          fontSize: 13,
          textAlign: 'center',
          p: 3,
          flexDirection: 'column',
        }}>
          <Box>{error}</Box>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', mt: 1 }}>
            检查 public/avatars/model.glb 是否存在 + 浏览器是否支持 WebGPU(Chrome 113+ / Edge 113+)
          </Typography>
        </Box>
      )}
    </Box>
  );
}