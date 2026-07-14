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
import { buildScene, buildSceneByName, type SceneHandle, type ScenePresetName } from './sceneBuilders';

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
      handleRef.current = buildSceneByName(THREE_NS, grp, p);
      if (handleRef.current.backgroundColor !== undefined) {
        scene.background = new THREE_NS.Color(handleRef.current.backgroundColor);
        scene.fog = new THREE_NS.FogExp2(handleRef.current.backgroundColor, 0.008);
      } else {
        scene.background = null;
        scene.fog = new THREE_NS.FogExp2(0x0a0612, 0.015);
      }
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
    handleRef.current = buildSceneByName(THREE_NS, grp, p);
    if (handleRef.current.backgroundColor !== undefined) {
      scene.background = new THREE_NS.Color(handleRef.current.backgroundColor);
      scene.fog = new THREE_NS.FogExp2(handleRef.current.backgroundColor, 0.008);
    } else {
      scene.background = null;
      scene.fog = new THREE_NS.FogExp2(0x0a0612, 0.015);
    }
    if (vrmSceneLocal) scene.add(vrmSceneLocal);
  }, [rendererState]);

  // 跟随节拍呼吸（每帧调用）—— 仅在 dancing=true 时才让聚光跟着节拍脉冲，
  // 不跳舞时保持原 intensity（避免整体压暗）
  function tick(t: number, dt: number, bass: number, dancing: boolean, spotPowerMul: number) {
    const h = handleRef.current;
    if (!h) return;
    const dance = dancing ? (0.5 + 0.5 * Math.abs(Math.sin(t * Math.PI))) + bass * 1.5 : 0.4;
    if (dancing) {
      // 跳舞时聚光跟节拍呼吸（强度围绕 spotPowerMul 上下浮动）
      for (const l of h.lights) {
        if ((l as any).isSpotLight) {
          const base = (l as any).userData?.baseIntensity ?? 1;
          // 以配置强度为基准做 ±60% 脉冲，不再绝对覆盖
          (l as any).intensity = base * spotPowerMul * (0.7 + 0.6 * dance);
        }
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
          if ('rotation' in m) m.rotation.z += dt * 1.5;
        }
      }
      if (h.ledRing2) {
        const m = h.ledRing2 as any;
        if (m.material && 'opacity' in m.material) {
          m.material.opacity = 0.3 + 0.4 * Math.min(1, 1 - dance);
          if ('rotation' in m) m.rotation.z -= dt * 1.0;
        }
      }
    } else {
      // 停舞后把聚光还原到配置强度（否则亮度会卡在最后一帧的脉冲值）
      for (const l of h.lights) {
        if ((l as any).isSpotLight) {
          const base = (l as any).userData?.baseIntensity ?? 1;
          (l as any).intensity = base * spotPowerMul;
        }
      }
      // 不跳舞时让 LED 环慢速转 + 半透（保活，不压暗）
      if (h.ledRing) {
        const m = h.ledRing as any;
        if (m.material && 'opacity' in m.material) m.material.opacity = 0.55;
        if ('rotation' in m) m.rotation.z += dt * 0.3;
      }
      if (h.ledRing2) {
        const m = h.ledRing2 as any;
        if (m.material && 'opacity' in m.material) m.material.opacity = 0.45;
        if ('rotation' in m) m.rotation.z -= dt * 0.2;
      }
    }
    // backdrop / particles 时间相关动画始终在跑
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
