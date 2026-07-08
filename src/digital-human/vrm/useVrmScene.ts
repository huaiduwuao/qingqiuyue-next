/**
 * vrm/useVrmScene.ts — 场景切换 + 灯光/粒子跟着时间呼吸
 *
 * 用法：
 *   const sceneApi = useVrmScene({ rendererState, vrmScene, initialPreset: 'concert' });
 *   sceneApi.setPreset('neon');
 *   sceneApi.tick(t, dt, bassEnergy);
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE_NS from 'three';
import { buildScene, type SceneHandle, type ScenePresetName } from './sceneBuilders';

export interface UseVrmSceneOptions {
  rendererState: { THREE_NS: typeof THREE_NS; scene: THREE_NS.Scene } | null;
  vrmScene: THREE_NS.Object3D | null;
  initialPreset?: ScenePresetName;
}

export function useVrmScene(opts: UseVrmSceneOptions) {
  const { rendererState, vrmScene, initialPreset = 'concert' } = opts;
  const [preset, setPresetState] = useState<ScenePresetName>(initialPreset);
  const presetRef = useRef<ScenePresetName>(initialPreset);
  const sceneGroupRef = useRef<THREE_NS.Group | null>(null);
  const handleRef = useRef<SceneHandle | null>(null);

  // 跟 VRM scene 保持同步（用 ref 避免 useEffect 重跑）
  const vrmSceneRef = useRef<THREE_NS.Object3D | null>(vrmScene);
  useEffect(() => { vrmSceneRef.current = vrmScene; }, [vrmScene]);

  // 初始化
  useEffect(() => {
    if (!rendererState) return;
    const { THREE_NS, scene } = rendererState;
    if (!sceneGroupRef.current) {
      const g = new THREE_NS.Group();
      scene.add(g);
      sceneGroupRef.current = g;
    }
    function applyPreset(p: ScenePresetName) {
      const grp = sceneGroupRef.current!;
      if (handleRef.current) { handleRef.current.dispose(); handleRef.current = null; }
      while (grp.children.length > 0) grp.remove(grp.children[0]);
      const vrmSceneLocal = vrmSceneRef.current;
      if (vrmSceneLocal && vrmSceneLocal.parent) vrmSceneLocal.parent.remove(vrmSceneLocal);
      handleRef.current = buildScene(THREE_NS, grp, p);
      if (vrmSceneLocal) scene.add(vrmSceneLocal);
    }
    applyPreset(preset);
    presetRef.current = preset;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendererState]);

  // 切换 preset（同时更新 state 和重建场景）
  const setPreset = useCallback((p: ScenePresetName) => {
    if (!rendererState) return;
    if (p === presetRef.current) return;
    setPresetState(p);
    presetRef.current = p;
    const grp = sceneGroupRef.current;
    if (!grp) return;
    const { THREE_NS, scene } = rendererState;
    if (handleRef.current) { handleRef.current.dispose(); handleRef.current = null; }
    while (grp.children.length > 0) grp.remove(grp.children[0]);
    const vrmSceneLocal = vrmSceneRef.current;
    if (vrmSceneLocal && vrmSceneLocal.parent) vrmSceneLocal.parent.remove(vrmSceneLocal);
    handleRef.current = buildScene(THREE_NS, grp, p);
    if (vrmSceneLocal) scene.add(vrmSceneLocal);
  }, [rendererState]);

  // 跟随节拍呼吸（每帧调用）
  function tick(t: number, dt: number, bass: number, dancing: boolean, spotPowerMul: number) {
    const h = handleRef.current;
    if (!h) return;
    const dance = dancing ? (0.5 + 0.5 * Math.abs(Math.sin(t * Math.PI))) + bass * 1.5 : 0.4;
    for (const l of h.lights) {
      if ((l as any).isSpotLight) (l as any).intensity = 1.2 * dance * spotPowerMul;
    }
    for (let i = 0; i < h.beams.length; i++) {
      const beam = h.beams[i];
      const m = beam as any;
      if (m.material && 'opacity' in m.material) {
        m.material.opacity = 0.08 + 0.22 * dance * (0.7 + 0.3 * Math.sin(t * 2 + i));
        if ('scale' in m) { m.scale.x = m.scale.z = 0.85 + 0.3 * dance; }
      }
    }
    if (h.ledRing) {
      const m = h.ledRing as any;
      if (m.material && 'opacity' in m.material) {
        m.material.opacity = 0.4 + 0.5 * Math.min(1, dance);
        if ('rotation' in m) m.rotation.z += dt * (dancing ? 1.5 : 0.4);
      }
    }
    if (h.ledRing2) {
      const m = h.ledRing2 as any;
      if (m.material && 'opacity' in m.material) {
        m.material.opacity = 0.3 + 0.4 * Math.min(1, 1 - dance);
        if ('rotation' in m) m.rotation.z -= dt * (dancing ? 1.0 : 0.2);
      }
    }
    if (h.backdrop) {
      const m = h.backdrop as any;
      if (m.material?.uniforms?.uTime) m.material.uniforms.uTime.value = t;
    }
    if (h.particles) {
      const m = h.particles as any;
      if (m.material?.uniforms?.uTime) m.material.uniforms.uTime.value = t;
    }
  }

  function dispose() {
    handleRef.current?.dispose();
    handleRef.current = null;
  }

  return { preset, setPreset, tick, dispose };
}
