/**
 * vrm/useVrmRenderer.ts — three.js 渲染器 + 相机 + OrbitControls + rAF + resize
 *
 * 注意：项目里所有 three.js 都在 useEffect 里动态 import（BlenderAvatar.tsx:38-41 警告
 * "静态 import 在组件里每帧调用会触发 turbopack HMR 报错"），本 hook 同样遵守。
 *
 * 用法：
 *   const { state, start, stop, tick, dispose, resize } = useVrmRenderer({ fov: 30, ... });
 *   start({ onFrame: (dt, t) => { ... } });
 *   // 卸载时自动 dispose
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type * as THREE from 'three';
import type { OrbitControls as OrbitControlsT } from 'three/examples/jsm/controls/OrbitControls.js';

export interface UseVrmRendererOptions {
  /** canvas 元素（由父组件 ref 传入） */
  canvas: HTMLCanvasElement | null;
  /** 初始 FOV（默认 30） */
  fov?: number;
  /** 是否启用 OrbitControls（默认 true） */
  enableControls?: boolean;
}

export interface RendererState {
  THREE_NS: typeof THREE;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControlsT | null;
}

export function useVrmRenderer(opts: UseVrmRendererOptions) {
  const { canvas, fov = 30, enableControls = true } = opts;
  const [state, setState] = useState<RendererState | null>(null);
  const stateRef = useRef<RendererState | null>(null);
  const rafRef = useRef<number | null>(null);
  const onFrameRef = useRef<((dt: number, t: number) => void) | null>(null);
  const runningRef = useRef(false);
  const clockRef = useRef<{ last: number; elapsed: number }>({ last: 0, elapsed: 0 });

  // 初始化
  useEffect(() => {
    if (!canvas) return;
    let cancelled = false;
    let resizeHandler: (() => void) | null = null;

    (async () => {
      const THREE_NS = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      if (cancelled) return;

      canvas.style.display = 'block';
      canvas.style.outline = 'none';
      const renderer = new THREE_NS.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      renderer.outputColorSpace = THREE_NS.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE_NS.PCFSoftShadowMap;
      renderer.toneMapping = THREE_NS.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      const scene = new THREE_NS.Scene();
      // 雾很轻（0.015）—— 主要靠 sky dome 控背景，雾只是让远处物体淡一点
      scene.fog = new THREE_NS.FogExp2(0x0a0612, 0.015);

      const camera = new THREE_NS.PerspectiveCamera(fov, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
      camera.position.set(0, 1.1, 4.5);

      let controls: OrbitControlsT | null = null;
      if (enableControls) {
        controls = new OrbitControls(camera, canvas);
        controls.target.set(0, 0.95, 0);
        controls.enableDamping = true;
        controls.maxDistance = 12;
        controls.minDistance = 1.0;
        controls.maxPolarAngle = Math.PI * 0.95;
        controls.minPolarAngle = 0.05;
      }

      resizeHandler = () => {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (w === 0 || h === 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      window.addEventListener('resize', resizeHandler);

      const s: RendererState = { THREE_NS, renderer, scene, camera, controls };
      stateRef.current = s;
      setState(s);
    })();

    return () => {
      cancelled = true;
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
      stopInternal();
      const s = stateRef.current;
      if (s) {
        s.controls?.dispose?.();
        s.renderer.dispose();
        s.renderer.forceContextLoss?.();
      }
      stateRef.current = null;
      setState(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, enableControls]);

  // 单独的 resize 触发：父组件改变 FOV 时
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    s.camera.fov = fov;
    s.camera.updateProjectionMatrix();
  }, [fov]);

  function tickFn(dt: number) {
    const s = stateRef.current;
    if (!s) return;
    if (s.controls) s.controls.update();
    s.renderer.render(s.scene, s.camera);
  }
  function startInternal() {
    if (runningRef.current) return;
    runningRef.current = true;
    clockRef.current = { last: performance.now(), elapsed: 0 };
    const loop = () => {
      if (!runningRef.current) return;
      const now = performance.now();
      const dt = Math.min((now - clockRef.current.last) / 1000, 0.05);
      clockRef.current.last = now;
      clockRef.current.elapsed += dt;
      onFrameRef.current?.(dt, clockRef.current.elapsed);
      tickFn(dt);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }
  function stopInternal() {
    runningRef.current = false;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }

  return useMemo(() => ({
    state,
    /** 注册每帧回调（覆盖前一个） */
    setOnFrame: (fn: (dt: number, t: number) => void) => { onFrameRef.current = fn; },
    start: startInternal,
    stop: stopInternal,
    /** 触发 resize（用于 canvas 容器尺寸变化时） */
    resize: () => {
      const s = stateRef.current;
      if (!s) return;
      const c = s.renderer.domElement;
      if (c.clientWidth === 0 || c.clientHeight === 0) return;
      s.camera.aspect = c.clientWidth / c.clientHeight;
      s.camera.updateProjectionMatrix();
      s.renderer.setSize(c.clientWidth, c.clientHeight, false);
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state]);
}
