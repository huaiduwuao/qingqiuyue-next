/**
 * vrm/useVrmCamera.ts — 6 个相机预设 + 缓动过渡
 *
 * 用法：
 *   const camApi = useVrmCamera({ camera, controls });
 *   camApi.setPreset('low');   // 缓动切换
 *   camApi.tick(dt);           // 每帧
 */

import { useCallback, useRef, useState } from 'react';
import type * as THREE from 'three';
import type { OrbitControls as OrbitControlsT } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CameraPresetName } from './types';
import { CAMERA_PRESETS } from './types';

const PRESET_VALUES: Record<CameraPresetName, { pos: [number, number, number]; target: [number, number, number] }> = {
  front: { pos: [0, 1.1, 4.5], target: [0, 0.95, 0] },
  three: { pos: [2.4, 1.4, 3.6], target: [0, 0.95, 0] },
  side:  { pos: [4.0, 1.0, 0.0], target: [0, 0.95, 0] },
  low:   { pos: [0, 0.25, 3.8], target: [0, 1.3, 0] },
  top:   { pos: [0, 4.0, 2.5], target: [0, 0.6, 0] },
  back:  { pos: [0, 1.1, -3.8], target: [0, 0.95, 0] },
};

export interface UseVrmCameraOptions {
  camera: THREE.PerspectiveCamera | null;
  controls: OrbitControlsT | null;
}

export function useVrmCamera(opts: UseVrmCameraOptions) {
  const { camera, controls } = opts;
  const [preset, setPreset] = useState<CameraPresetName>('front');
  const presetRef = useRef<CameraPresetName>('front');
  const animRef = useRef<{ t: number; dur: number; fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTgt: THREE.Vector3; toTgt: THREE.Vector3 } | null>(null);

  const switchTo = useCallback((p: CameraPresetName) => {
    if (!camera) return;
    if (p === presetRef.current) return;
    const v = PRESET_VALUES[p];
    presetRef.current = p;
    setPreset(p);
    animRef.current = {
      t: 0, dur: 0.8,
      fromPos: camera.position.clone(),
      toPos: new (camera.position.constructor as any)(...v.pos),
      fromTgt: controls?.target.clone() ?? new (camera.position.constructor as any)(...v.target),
      toTgt: new (camera.position.constructor as any)(...v.target),
    };
  }, [camera, controls]);

  function tick(dt: number) {
    if (!animRef.current || !camera) return;
    animRef.current.t += dt;
    const k = Math.min(1, animRef.current.t / animRef.current.dur);
    const e = 1 - Math.pow(1 - k, 3);
    camera.position.lerpVectors(animRef.current.fromPos, animRef.current.toPos, e);
    if (controls) controls.target.lerpVectors(animRef.current.fromTgt, animRef.current.toTgt, e);
    if (k >= 1) animRef.current = null;
  }

  return { preset, presets: CAMERA_PRESETS, switchTo, tick };
}
