/**
 * vrm/useVrmPhysics.ts — Rapier 集成 hook
 *
 * Phase 3：每帧 step 物理，同步 body → scene.position
 * 异步初始化（Rapier WASM 加载）
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { VrmModelConfig, SceneConfig } from './config/types';
import { createPhysicsWorld, type PhysicsWorld } from './physics/world';

export interface UseVrmPhysicsOptions {
  model: VrmModelConfig;
  sceneConfig: SceneConfig;
  /** vrm scene root（要写 position 到这里） */
  vrmScene: THREE.Object3D | null;
  /** 每帧调用 step 时传入的目标位置（来自 VrmStage 的 move/setPosition） */
  targetPositionRef: React.MutableRefObject<{ x: number; y: number; z: number }>;
  /** 当前速度/步进 */
  onStep?: (pos: { x: number; y: number; z: number }) => void;
}

export function useVrmPhysics(opts: UseVrmPhysicsOptions) {
  const { model, sceneConfig, vrmScene, targetPositionRef, onStep } = opts;
  const [ready, setReady] = useState(false);
  const worldRef = useRef<PhysicsWorld | null>(null);

  useEffect(() => {
    if (!vrmScene) return;
    let alive = true;

    (async () => {
      try {
        const THREE_NS = await import('three');
        const w = await createPhysicsWorld(THREE_NS, model, sceneConfig);
        if (!alive) {
          w.dispose();
          return;
        }
        worldRef.current = w;
        setReady(true);
        console.log('[useVrmPhysics] Rapier world ready');
      } catch (e) {
        console.warn('[useVrmPhysics] init failed:', e);
      }
    })();

    return () => {
      alive = false;
      if (worldRef.current) {
        worldRef.current.dispose();
        worldRef.current = null;
      }
    };
  }, [model, sceneConfig, vrmScene]);

  /** step 物理：调用方在 frame loop 里调 */
  function step(dt: number) {
    const w = worldRef.current;
    if (!w || !vrmScene) return;
    const t = w.step(dt, targetPositionRef.current, vrmScene);
    onStep?.(t);
  }

  /** 向下射线检测地面高度（Foot IK） */
  function raycastGround(origin: { x: number; y: number; z: number }, maxDistance = 2): number | null {
    return worldRef.current?.raycastGround(origin, maxDistance) ?? null;
  }

  /** 按实际加载模型动态更新物理胶囊尺寸与贴地偏移 */
  function setModelMetrics(metrics: { height: number; radius: number; footOffsetY: number }) {
    worldRef.current?.setModelMetrics?.(metrics);
  }

  return { ready, step, raycastGround, setModelMetrics, world: worldRef };
}
