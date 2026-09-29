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
    // Only log when pose name changes (debug mode only)
    if (lastPoseName !== cfg.name) {
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

  /**
   * 程序化步态(规范化骨骼,VRM0/1 一致):
   *   - 腿:大腿前后摆,摆动相膝盖弯、支撑相伸直;脚掌跟着翻;
   *   - 手臂:大臂绕 X 前后摆(和对侧腿同相),肘微屈、跑步时屈得多;
   *   - 躯干:胯和胸反向扭转、胯左右落差、跑步前倾;头反向稳住,视线不晃。
   * weight 是淡入淡出的混合量(在 idle / pose 已经写进骨骼之后叠上去)。
   */
  const gaitRef = useRef({ blend: 0, run: 0 });
  const gaitBase = useRef(new Map<string, { bx: number; by: number; bz: number; wx: number; wy: number; wz: number }>()).current;
  function applyGait(phase: number, weight: number, run: number, t: number, H: (n: string) => any) {
    // 叠加偏移:有的骨骼每帧会被 idle / pose 重写,有的不会(比如小臂、脖子)。
    // 记下上一帧写进去的值:没被别人改过就从上一帧的底子上叠,改过就以新值为底子 —— 不会越叠越歪。
    const add = (bone: string, x: number, y: number, z: number) => {
      const o = H(bone);
      if (!o?.rotation) return;
      let rec = gaitBase.get(bone);
      const r = o.rotation;
      if (!rec || Math.abs(r.x - rec.wx) > 1e-6 || Math.abs(r.y - rec.wy) > 1e-6 || Math.abs(r.z - rec.wz) > 1e-6) {
        rec = { bx: r.x, by: r.y, bz: r.z, wx: 0, wy: 0, wz: 0 };
        gaitBase.set(bone, rec);
      }
      r.x = rec.bx + x * weight; r.y = rec.by + y * weight; r.z = rec.bz + z * weight;
      rec.wx = r.x; rec.wy = r.y; rec.wz = r.z;
    };
    const s = Math.sin(phase), c = Math.cos(phase);
    const legAmp = 0.5 + run * 0.35;
    // 腿(左腿 = +s 向前)
    const lSwing = s * legAmp, rSwing = -s * legAmp;
    // 摆动相(腿往前走的那半个周期)膝盖弯
    const lKnee = Math.max(0, c) * (0.55 + run * 0.55) + 0.08;
    const rKnee = Math.max(0, -c) * (0.55 + run * 0.55) + 0.08;
    add('leftUpperLeg', -lSwing, 0, 0);
    add('rightUpperLeg', -rSwing, 0, 0);
    add('leftLowerLeg', lKnee, 0, 0);
    add('rightLowerLeg', rKnee, 0, 0);
    add('leftFoot', -lKnee * 0.35 + lSwing * 0.2, 0, 0);
    add('rightFoot', -rKnee * 0.35 + rSwing * 0.2, 0, 0);
    // 手臂:和对侧腿同相;垂下的角度保持原来的(z 用 idle 写好的值),只加前后摆
    const armAmp = 0.35 + run * 0.35;
    add('leftUpperArm', s * armAmp * -1, 0, 0);
    add('rightUpperArm', -s * armAmp * -1, 0, 0);
    add('leftLowerArm', 0, -(0.25 + run * 0.9) - Math.max(0, -s) * 0.2, 0);
    add('rightLowerArm', 0, (0.25 + run * 0.9) + Math.max(0, s) * 0.2, 0);
    // 躯干:胯扭 + 胸反扭 + 左右落差 + 跑步前倾;头稳住
    add('hips', 0, s * 0.12, c * 0.035);
    add('spine', 0.04 + run * 0.14, -s * 0.07, 0);
    add('chest', 0, -s * 0.08, -c * 0.02);
    add('neck', 0, s * 0.06, 0);
    add('head', -(0.02 + run * 0.06), s * 0.04, 0);
    void t;
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
      applyPose(poseCfg, poseBlendRef.current, H);
    }

    // 4. walk 步态:程序化的走 / 跑,淡入淡出(以前按配置公式硬切,手臂左右扇、身子不动,很僵)
    const w = walkRef.current;
    const moving = w.moving && w.style !== 'teleport' && w.style !== 'idle';
    gaitRef.current.blend = Math.min(1, Math.max(0, gaitRef.current.blend + (moving ? dt * 6 : -dt * 4)));
    if (moving) gaitRef.current.run = w.style === 'run' ? Math.min(1, gaitRef.current.run + dt * 3) : Math.max(0, gaitRef.current.run - dt * 3);
    if (gaitRef.current.blend > 0.001) {
      applyGait(w.phase, gaitRef.current.blend, gaitRef.current.run, elapsed, H);
    }
    if (moving) smRef.current.set({ kind: 'walk', phase: w.phase, style: w.style === 'run' ? 'run' : 'walk' });
    else smRef.current.remove('walk');

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
