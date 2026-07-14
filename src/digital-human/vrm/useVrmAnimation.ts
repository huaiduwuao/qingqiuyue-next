/**
 * vrm/useVrmAnimation.ts — 统一动画状态机
 *
 * Phase 4.1：真正替换 useVrmDance，把 dance / pose / walk / action 的 bone rotation
 * 全部收敛到本 hook，按优先级合成：
 *   action > dance > walk > pose > idle
 *
 * 所有动态骨骼数据来自 ConfigBundle 的 formula（不再 hardcode）。
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { getBone } from './vrmCompat';
import { buildLookups, safeEvalFormula } from './config/loader';
import type {
  ActionConfig,
  ConfigBundle,
  DanceStyleConfig,
  PoseConfig,
} from './config/types';
import type { AudioHandle } from './audio';
import type { DanceStyle, PoseName } from './types';

// ---------- 状态机类型 ----------

export type AnimState =
  | { kind: 'idle' }
  | { kind: 'action'; name: string; startedAtMs: number; speed: number; repeat: number }
  | { kind: 'pose'; name: string; blend: number }
  | { kind: 'dance'; style: string; bpm: number; amp: number; startedAtMs: number }
  | { kind: 'walk'; phase: number; style: 'walk' | 'run' | 'idle' };

export type AnimPriority = 'action' | 'dance' | 'walk' | 'pose' | 'idle';

const PRIORITY_RANK: Record<string, number> = {
  action: 5, dance: 4, walk: 3, pose: 2, idle: 1,
};

// ---------- 状态机实例 ----------

export class AnimationStateMachine {
  active: AnimState = { kind: 'idle' };
  stack: AnimState[] = [{ kind: 'idle' }];

  set(state: AnimState) {
    this.stack = this.stack.filter((s) => s.kind !== state.kind);
    this.stack.push(state);
    this.stack.sort((a, b) => (PRIORITY_RANK[b.kind] ?? 0) - (PRIORITY_RANK[a.kind] ?? 0));
    this.active = this.stack[0];
  }

  remove(kind: AnimState['kind']) {
    this.stack = this.stack.filter((s) => s.kind !== kind);
    if (this.stack.length === 0) this.stack.push({ kind: 'idle' });
    this.active = this.stack[0];
  }

  activeByPriority(): AnimState[] {
    return [...this.stack].sort((a, b) => (PRIORITY_RANK[b.kind] ?? 0) - (PRIORITY_RANK[a.kind] ?? 0));
  }
}

// ---------- React hook ----------

export interface UseVrmAnimationOptions {
  configBundle: ConfigBundle;
  vrmRef: React.MutableRefObject<any>;
  audio: AudioHandle;
  walkRef: React.MutableRefObject<{ moving: boolean; phase: number; style: 'walk' | 'run' | 'idle' | 'teleport' }>;
  /** 物理世界（用于 Foot IK 射线检测） */
  physics?: { ready: boolean; raycastGround: (origin: { x: number; y: number; z: number }, maxDistance?: number) => number | null };
}

export function useVrmAnimation(opts: UseVrmAnimationOptions) {
  const { configBundle, vrmRef, audio, walkRef, physics } = opts;
  const smRef = useRef<AnimationStateMachine>(new AnimationStateMachine());
  const lookups = useMemo(() => buildLookups(configBundle), [configBundle]);

  const [dancing, setDancingState] = useState(false);
  const [style, setStyleState] = useState<DanceStyle>('groove');
  const [bpm, setBpmState] = useState(120);
  const [amp, setAmpState] = useState(1);
  const [pose, setPoseState] = useState<PoseName>('idle');

  const dancingRef = useRef(dancing);
  const styleRef = useRef(style);
  const bpmRef = useRef(bpm);
  const ampRef = useRef(amp);
  const poseRef = useRef(pose);
  const poseBlendRef = useRef(1);
  const freeBeatRef = useRef(0);

  dancingRef.current = dancing;
  styleRef.current = style;
  bpmRef.current = bpm;
  ampRef.current = amp;
  poseRef.current = pose;

  const setDancing = useCallback((on: boolean) => {
    setDancingState(on);
    dancingRef.current = on;
    if (on) {
      smRef.current.set({ kind: 'dance', style: styleRef.current, bpm: bpmRef.current, amp: ampRef.current, startedAtMs: performance.now() });
    } else {
      smRef.current.remove('dance');
    }
  }, []);

  const setStyle = useCallback((s: DanceStyle) => {
    setStyleState(s);
    styleRef.current = s;
    if (dancingRef.current) {
      smRef.current.set({ kind: 'dance', style: s, bpm: bpmRef.current, amp: ampRef.current, startedAtMs: performance.now() });
    }
  }, []);

  const setBpm = useCallback((v: number) => {
    setBpmState(v);
    bpmRef.current = v;
    if (dancingRef.current) {
      smRef.current.set({ kind: 'dance', style: styleRef.current, bpm: v, amp: ampRef.current, startedAtMs: performance.now() });
    }
  }, []);

  const setAmp = useCallback((v: number) => {
    setAmpState(v);
    ampRef.current = v;
    if (dancingRef.current) {
      smRef.current.set({ kind: 'dance', style: styleRef.current, bpm: bpmRef.current, amp: v, startedAtMs: performance.now() });
    }
  }, []);

  const setPose = useCallback((name: PoseName, instant = false) => {
    setPoseState(name);
    poseRef.current = name;
    poseBlendRef.current = instant ? 1 : 0;
    smRef.current.set({ kind: 'pose', name, blend: instant ? 1 : 0 });
  }, []);

  const playAction = useCallback((name: string) => {
    const actionCfg = lookups.actionByName.get(name);
    if (!actionCfg) {
      console.warn('[useVrmAnimation.playAction] unknown action:', name);
      return;
    }
    smRef.current.set({ kind: 'action', name, startedAtMs: performance.now(), speed: 1, repeat: 1 });
  }, [lookups.actionByName]);

  function beatNow(dt: number): number {
    const ctx: AudioContext | null = (audio as any).audioCtx;
    if (audio.isSongOn() && ctx) {
      return (ctx.currentTime - audio.getSongStartTime()) * bpmRef.current / 60;
    }
    freeBeatRef.current += dt * bpmRef.current / 60;
    return freeBeatRef.current;
  }

  function applyBoneRotations(bones: Record<string, [number, number, number]>, H: (n: string) => any) {
    for (const [boneName, rot] of Object.entries(bones)) {
      if (!Array.isArray(rot) || rot.length < 3) continue;
      const o = H(boneName);
      if (o && o.rotation) {
        o.rotation.set(rot[0], rot[1], rot[2]);
      }
    }
  }

  function applyActionFormula(cfg: ActionConfig, t: number, H: (n: string) => any, sceneObj: any) {
    if (!cfg.formula) return;
    const result = safeEvalFormula(cfg.formula, { t, blend: 1 });
    if (result.bones) applyBoneRotations(result.bones, H);
    // Ignore scenePosY/scenePosX/hipsPosY: world position is driven by the physics capsule;
    // action formulas only drive bone rotations to avoid clipping through the floor.
  }

  function applyDanceFormula(cfg: DanceStyleConfig, danceT: number, b: number, A: number, bass: number, phase: number, H: (n: string) => any) {
    const result = safeEvalFormula(cfg.formula, { t: danceT, b, blend: 1, A, bass, phase });
    if (result.bones) applyBoneRotations(result.bones, H);
    // Ignore hipsPosY: world height is owned by the physics capsule to keep feet grounded.
  }

  // Track last pose name for logging
  let lastPoseName = '';
  function applyPose(cfg: PoseConfig, blend: number, H: (n: string) => any) {
    if (blend <= 0) return;
    // Only log when pose name changes
    if (lastPoseName !== cfg.name) {
      console.log('[applyPose]', cfg.name, 'blend=' + blend.toFixed(2));
      lastPoseName = cfg.name;
    }
    for (const [boneName, rot] of Object.entries(cfg.boneRotations)) {
      const o = H(boneName);
      if (!o || !o.rotation) continue;
      o.rotation.x = o.rotation.x * (1 - blend) + rot[0] * blend;
      o.rotation.y = o.rotation.y * (1 - blend) + rot[1] * blend;
      o.rotation.z = o.rotation.z * (1 - blend) + rot[2] * blend;
    }
  }

  function resetBonesToNatural(H: (n: string) => any) {
    // Use the configured idle pose as the natural baseline instead of hardcoded angles.
    const idle = lookups.poseByName.get('idle');
    if (idle) {
      for (const [boneName, rot] of Object.entries(idle.boneRotations)) {
        const o = H(boneName);
        if (o && o.rotation) o.rotation.set(rot[0], rot[1], rot[2]);
      }
    }
  }

  function applyFootIK(dt: number, H: (n: string) => any) {
    if (!physics?.ready) return;
    const footOffset = 0.05;
    const speed = 8;
    for (const side of ['left', 'right'] as const) {
      const foot = H(`${side}Foot`);
      if (!foot) continue;
      const pos = new THREE.Vector3();
      foot.getWorldPosition(pos);
      const groundY = physics.raycastGround({ x: pos.x, y: pos.y + 1, z: pos.z }, 2);
      if (groundY == null || !Number.isFinite(groundY)) continue;
      const desiredY = groundY + footOffset;
      const diff = desiredY - pos.y;
      if (Math.abs(diff) > 0.005) {
        // 限制单帧调整量，避免抖动
        foot.position.y += Math.max(-0.08, Math.min(0.08, diff * dt * speed));
      }
    }
  }

  function tick(elapsed: number, dt: number) {
    const vrm = vrmRef.current;
    if (!vrm?.humanoid) return;
    const H = (n: string) => getBone(vrm.humanoid, n);
    const sceneObj = vrm.scene;

    // 注意：不再每帧调用 resetBonesToNatural，否则会覆盖 pose 的骨骼值

    // 2. idle 基准（呼吸 + 微动）
    const idleCfg = lookups.actionByName.get('idle');
    if (idleCfg) applyActionFormula(idleCfg, elapsed, H, sceneObj);

    // 3. pose 平滑混合
    poseBlendRef.current = Math.min(1, poseBlendRef.current + dt * 3);
    const currentPose = poseRef.current;
    const poseCfg = lookups.poseByName.get(currentPose);
    if (poseCfg) {
      console.log('[tick] blend=', poseBlendRef.current.toFixed(3), 'pose=', currentPose);
      applyPose(poseCfg, poseBlendRef.current, H);
    }

    // 4. walk 步态
    const w = walkRef.current;
    if (w.moving && w.style !== 'teleport' && w.style !== 'idle') {
      const walkStyle = w.style === 'run' ? 'run' : 'walk';
      const walkCfg = lookups.danceByName.get(walkStyle);
      if (walkCfg) {
        applyDanceFormula(walkCfg, 0, 0, ampRef.current, audio.poll().bass, w.phase, H);
      }
      smRef.current.set({ kind: 'walk', phase: w.phase, style: walkStyle });
    } else {
      smRef.current.remove('walk');
    }

    // 5. dance
    if (dancingRef.current) {
      const danceCfg = lookups.danceByName.get(styleRef.current);
      if (danceCfg) {
        const b = beatNow(dt);
        const danceState = smRef.current.stack.find((s): s is Extract<AnimState, { kind: 'dance' }> => s.kind === 'dance');
        const danceT = danceState ? (performance.now() - danceState.startedAtMs) / 1000 : 0;
        applyDanceFormula(danceCfg, danceT, b, ampRef.current, audio.poll().bass, 0, H);
      }
    }

    // 6. action（最高优先级）+ 自动过期
    const actionState = smRef.current.stack.find((s): s is Extract<AnimState, { kind: 'action' }> => s.kind === 'action');
    if (actionState) {
      const actionCfg = lookups.actionByName.get(actionState.name);
      if (actionCfg) {
        const t = (performance.now() - actionState.startedAtMs) / 1000;
        if (!actionCfg.loopable && actionCfg.duration > 0 && t > actionCfg.duration) {
          smRef.current.remove('action');
        } else {
          applyActionFormula(actionCfg, t, H, sceneObj);
        }
      }
    }

    // 7. Foot IK：脚贴地
    applyFootIK(dt, H);
  }

  return {
    state: smRef.current,
    activeState: () => smRef.current.active,
    dancing, setDancing,
    style, setStyle,
    bpm, setBpm,
    amp, setAmp,
    pose, setPose,
    playAction,
    tick,
  };
}
