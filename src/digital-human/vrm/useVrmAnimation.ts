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
   * 程序化步态。three-vrm 的规范化骨骼里各轴的正方向(模型面朝 +Z,左手在 +X),逐项推过:
   *   - 大腿 / 大臂(垂下之后)绕 X 转正值 → 往后摆;负值 → 往前;
   *   - 小腿绕 X 正值 → 屈膝;脚绕 X 正值 → 脚尖往下;
   *   - 小臂:左臂绕 Y 负值、右臂绕 Y 正值 → 屈肘向前(绕 X 是拧小臂,不是弯);
   *   - 胯绕 Y 负值 → 左胯往前;胸绕 Y 正值 → 右肩往前;脊柱绕 X 正值 → 前倾。
   * 左腿往前时:左臂往后、右臂往前(对侧同相),胯跟着左腿扭、胸往反方向扭,头再往回收一点让视线稳住;
   * 双腿分开最大时身体最低、两腿交错时最高;摆动腿那侧胯微微下沉。
   * weight 是淡入淡出的混合量(在 idle / pose 已经写进骨骼之后叠上去)。
   */
  const gaitRef = useRef({ blend: 0, run: 0 });
  const gaitBase = useRef(new Map<string, { bx: number; by: number; bz: number; wx: number; wy: number; wz: number }>()).current;
  function applyGait(phase: number, weight: number, run: number, t: number, H: (n: string) => any) {
    // 叠加偏移:有的骨骼每帧会被 idle / pose 重写,有的不会(比如小臂、脖子)。
    // 记下上一帧写进去的值:没被别人改过就从上一帧的底子上叠,改过就以新值为底子 —— 不会越叠越歪。
    const layer = (key: string, v: { x: number; y: number; z: number } | undefined, x: number, y: number, z: number) => {
      if (!v) return;
      let rec = gaitBase.get(key);
      if (!rec || Math.abs(v.x - rec.wx) > 1e-6 || Math.abs(v.y - rec.wy) > 1e-6 || Math.abs(v.z - rec.wz) > 1e-6) {
        rec = { bx: v.x, by: v.y, bz: v.z, wx: 0, wy: 0, wz: 0 };
        gaitBase.set(key, rec);
      }
      v.x = rec.bx + x * weight; v.y = rec.by + y * weight; v.z = rec.bz + z * weight;
      rec.wx = v.x; rec.wy = v.y; rec.wz = v.z;
    };
    const add = (bone: string, x: number, y: number, z: number) => layer(bone, H(bone)?.rotation, x, y, z);
    const s = Math.sin(phase), c = Math.cos(phase);
    const walk = 1 - run;

    // ── 腿:左腿 = -s 往前(s>0 时左腿在前) ──
    const legAmp = 0.42 * walk + 0.72 * run;
    const lLeg = -s * legAmp, rLeg = s * legAmp; // 绕 X,负 = 往前
    // 摆动相(腿正往前送的半个周期)才屈膝;支撑相几乎伸直,只留一点缓冲
    const lSwingPhase = Math.max(0, c), rSwingPhase = Math.max(0, -c);
    const kneeAmp = 0.7 * walk + 1.35 * run;
    const lKnee = lSwingPhase * kneeAmp + 0.06 + Math.max(0, s) * 0.05;
    const rKnee = rSwingPhase * kneeAmp + 0.06 + Math.max(0, -s) * 0.05;
    add('leftUpperLeg', lLeg - lSwingPhase * 0.12 * run, 0, 0);
    add('rightUpperLeg', rLeg - rSwingPhase * 0.12 * run, 0, 0);
    add('leftLowerLeg', lKnee, 0, 0);
    add('rightLowerLeg', rKnee, 0, 0);
    // 脚:在前的脚跟着地(脚尖抬),在后的脚尖蹬地(脚尖朝下)
    add('leftFoot', -Math.max(0, s) * 0.25 + Math.max(0, -s) * 0.35 * (0.6 + run) - lSwingPhase * 0.1, 0, 0);
    add('rightFoot', -Math.max(0, -s) * 0.25 + Math.max(0, s) * 0.35 * (0.6 + run) - rSwingPhase * 0.1, 0, 0);

    // ── 手臂:对侧同相,贴着身体前后摆;往前摆时肘弯得多一点 ──
    const armAmp = 0.28 * walk + 0.55 * run;
    add('leftUpperArm', s * armAmp, 0, -0.04 - run * 0.05);   // 左腿在前(s>0)→ 左臂往后
    add('rightUpperArm', -s * armAmp, 0, 0.04 + run * 0.05);
    const elbow = 0.22 * walk + 1.25 * run;
    add('leftLowerArm', 0, -(elbow + Math.max(0, -s) * 0.3), 0);
    add('rightLowerArm', 0, elbow + Math.max(0, s) * 0.3, 0);

    // ── 躯干 ──
    add('hips', 0, -s * (0.09 + run * 0.05), -c * 0.035);         // 胯跟腿扭 + 摆动侧下沉
    add('spine', 0.04 + run * 0.16, s * 0.04, c * 0.02);
    add('chest', 0.02 * run, s * (0.07 + run * 0.05), c * 0.015);  // 胸反向扭
    add('neck', 0, -s * 0.04, 0);
    add('head', -(0.02 + run * 0.08), -s * 0.03, -c * 0.015);      // 头往回收,视线稳住

    // ── 起伏:双腿分开最大时最低,交错时最高(跑步反过来,腾空时最高) ──
    const hips = H('hips');
    if (hips?.position) {
      const bob = walk * (-Math.abs(s) * 0.022 + 0.008) + run * (Math.abs(c) * 0.035 - 0.012);
      layer('hips.pos', hips.position, 0, bob, 0);
    }
    void t;
  }


  function applyRestFix(t: number, H: (n: string) => any) {
    const breath = Math.sin(t * 1.3);
    // 同步态一样按「上一帧写的值」判断底子,不被每帧重置的骨骼(手)也不会越叠越歪
    const set = (bone: string, x: number, y: number, z: number) => {
      const v = H(bone)?.rotation;
      if (!v) return;
      const key = 'rest:' + bone;
      let rec = gaitBase.get(key);
      if (!rec || Math.abs(v.x - rec.wx) > 1e-6 || Math.abs(v.y - rec.wy) > 1e-6 || Math.abs(v.z - rec.wz) > 1e-6) {
        rec = { bx: v.x, by: v.y, bz: v.z, wx: 0, wy: 0, wz: 0 };
        gaitBase.set(key, rec);
      }
      v.x = rec.bx + x; v.y = rec.by + y; v.z = rec.bz + z;
      rec.wx = v.x; rec.wy = v.y; rec.wz = v.z;
    };
    // 大臂:再往身体收一点(左 z 更负、右 z 更正),呼吸时肩臂微微前后
    set('leftUpperArm', breath * 0.015, 0, -0.1);
    set('rightUpperArm', breath * 0.015, 0, 0.1);
    // 小臂:把配置里的拧(x=0.3)抵掉,改成向前微屈
    set('leftLowerArm', -0.3, -0.22, 0);
    set('rightLowerArm', -0.3, 0.22, 0);
    // 手:同样抵掉拧,手指略朝内收
    set('leftHand', -0.3, 0, 0.12);
    set('rightHand', -0.3, 0, -0.12);
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

    // 3.5 站姿修正:配置里的 idle 姿势手臂微微张开、笔直,小臂和手腕是「拧」(绕 X)不是「弯」,
    //     看着像提线木偶。只在默认站姿下叠一层:手臂收回贴身、取消拧、手肘自然微屈、随呼吸轻晃。
    if (currentPose === 'idle') applyRestFix(elapsed, H);

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
