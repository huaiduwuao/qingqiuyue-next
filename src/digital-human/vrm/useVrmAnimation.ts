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
import { applySitPose, sitDrop } from './world/interact';
import { loadActionClip, loadMocap, MOCAP_ACTIONS, MOCAP_BONES, MOCAP_UPPER, sampleBone, sampleHipsY, type MocapClip, type MocapSet } from './mocap';
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
  walkRef: React.MutableRefObject<{ moving: boolean; phase: number; style: 'walk' | 'run' | 'idle' | 'teleport'; dist?: number }>;
  /** 十期:坐着的座位(y = 座面离地多高);null = 站着 */
  sitRef?: React.MutableRefObject<{ y: number } | null>;
  /** 物理世界（用于 Foot IK 射线检测） */
  physics?: { ready: boolean; raycastGround: (origin: { x: number; y: number; z: number }, maxDistance?: number) => number | null };
}

export function useVrmAnimation(opts: UseVrmAnimationOptions) {
  const { configBundle, vrmRef, audio, walkRef, physics, sitRef } = opts;
  // 十期:坐姿的权重(0 站着 → 1 坐下),半秒过渡
  const sitWRef = useRef(0);
  const sitYRef = useRef(0.45);
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

  // ── 真人动捕(走 / 跑 / 待机):第一次用到时下载,没下到就一直用程序步态 ──
  const mocapRef = useRef<MocapSet | null>(null);
  const mocapReqRef = useRef(false);
  const legLenRef = useRef(new WeakMap<object, number>());
  const idleMocapRef = useRef({ w: 0 });
  // 动作的真人动捕(鞠躬 / 说话比划…):已下载的片段 + 正在播 / 淡出的那一段
  const actionClipsRef = useRef(new Map<string, MocapClip | null>());
  const actionMocapRef = useRef<{ name: string; clip: MocapClip; loop: boolean; u: number; w: number } | null>(null);
  const qA = useRef(new THREE.Quaternion()).current;
  const qB = useRef(new THREE.Quaternion()).current;
  const qT = useRef(new THREE.Quaternion()).current;
  const qT2 = useRef(new THREE.Quaternion()).current;
  /** 这个模型的腿长(大腿根 → 脚踝,米):动捕的步幅 / 起伏都以腿长为单位 */
  function legLen(vrm: any, H: (n: string) => any): number {
    const v = legLenRef.current.get(vrm);
    if (v) return v;
    const a = H('leftUpperLeg'), b = H('leftLowerLeg'), c = H('leftFoot');
    if (!a || !b || !c) return 0.8;
    const pa = a.getWorldPosition(new THREE.Vector3()), pb = b.getWorldPosition(new THREE.Vector3()), pc = c.getWorldPosition(new THREE.Vector3());
    let len = pa.distanceTo(pb) + pb.distanceTo(pc);
    if (!(len > 0.3 && len < 2)) len = 0.8;
    legLenRef.current.set(vrm, len);
    return len;
  }
  /** 取一段动捕在进度 u 处的四元数;wrap = 循环衔接处要交叉淡化的秒数 */
  function sampleLoop(clip: MocapClip, bone: string, u: number, out: THREE.Quaternion, wrap = 0): boolean {
    if (!sampleBone(THREE, clip, bone, u, out, qT)) return false;
    if (wrap > 0) {
      const tc = (((u % 1) + 1) % 1) * clip.duration;
      const k = (tc - (clip.duration - wrap)) / wrap;
      if (k > 0) {
        // 快到结尾:往开头那几帧淡过去,接缝处不跳
        sampleBone(THREE, clip, bone, (tc - (clip.duration - wrap)) / clip.duration, qT2, qT);
        out.slerp(qT2, k);
      }
    }
    return true;
  }
  /** 髋的上下起伏:按「上一帧写进去的值」判断底子,不越叠越高 */
  function layerHipsY(H: (n: string) => any, dy: number) {
    const hips = H('hips');
    if (!hips?.position) return;
    let rec = gaitBase.get('mocap:hips.y');
    if (!rec || Math.abs(hips.position.y - rec.wy) > 1e-6) {
      rec = { bx: 0, by: hips.position.y, bz: 0, wx: 0, wy: 0, wz: 0 };
      gaitBase.set('mocap:hips.y', rec);
    }
    hips.position.y = rec.by + dy;
    rec.wy = hips.position.y;
  }

  function tick(elapsed: number, dt: number) {
    const vrm = vrmRef.current;
    if (!vrm?.humanoid) return;
    if (!mocapReqRef.current) {
      mocapReqRef.current = true;
      loadMocap().then((m) => { mocapRef.current = m; });
      for (const n of Object.keys(MOCAP_ACTIONS)) loadActionClip(n).then((c) => { actionClipsRef.current.set(n, c); });
    }
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
    if (currentPose === 'idle' && !mocapRef.current) applyRestFix(elapsed, H);

    // 4. walk 步态:有真人动捕就用动捕(按走过的距离推进,脚不打滑),没有就用程序步态
    const w = walkRef.current;
    const moving = w.moving && w.style !== 'teleport' && w.style !== 'idle';
    gaitRef.current.blend = Math.min(1, Math.max(0, gaitRef.current.blend + (moving ? dt * 6 : -dt * 4)));
    if (moving) gaitRef.current.run = w.style === 'run' ? Math.min(1, gaitRef.current.run + dt * 3) : Math.max(0, gaitRef.current.run - dt * 3);
    const mocap = mocapRef.current;

    // 4a. 真人待机:站着(默认站姿、没在走、没跳舞)时,真人等人时的重心转换、呼吸、小动作
    const idleOk = !!mocap && currentPose === 'idle' && !dancingRef.current && gaitRef.current.blend < 0.999;
    const im = idleMocapRef.current;
    im.w = Math.min(1, Math.max(0, im.w + (idleOk ? dt * 2 : -dt * 4)));
    if (mocap && im.w > 0.001) {
      const u = elapsed / mocap.idle.duration;
      const k = im.w * (1 - gaitRef.current.blend);
      for (const b of MOCAP_BONES) {
        const node = H(b);
        if (node && sampleLoop(mocap.idle, b, u, qA, 0.6)) node.quaternion.slerp(qA, k);
      }
    }

    if (gaitRef.current.blend > 0.001) {
      if (mocap) {
        const run = gaitRef.current.run;
        const L = legLen(vrm, H);
        const stride = (mocap.walk.stride * (1 - run) + mocap.run.stride * run) * L;
        const u = (w.dist ?? 0) / Math.max(0.2, stride);
        for (const b of MOCAP_BONES) {
          const node = H(b);
          if (!node) continue;
          if (!sampleLoop(mocap.walk, b, u, qA)) continue;
          if (run > 0.001 && sampleLoop(mocap.run, b, u, qB)) qA.slerp(qB, run);
          node.quaternion.slerp(qA, gaitRef.current.blend);
        }
        const bob = (sampleHipsY(mocap.walk, u) * (1 - run) + sampleHipsY(mocap.run, u) * run) * L;
        layerHipsY(H, bob * gaitRef.current.blend);
      } else {
        applyGait(w.phase, gaitRef.current.blend, gaitRef.current.run, elapsed, H);
      }
    } else if (mocap) {
      layerHipsY(H, 0);
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
    // 6a. 有真人动捕的动作(鞠躬、说话比划)用动捕:淡入,单次的播完就收,换了别的动作从最后一帧淡出
    const am = actionMocapRef.current;
    const clipFor = actionState ? actionClipsRef.current.get(actionState.name) : null;
    if (actionState && clipFor) {
      const t = (performance.now() - actionState.startedAtMs) / 1000;
      const loop = MOCAP_ACTIONS[actionState.name]?.loop ?? false;
      if (!am || am.name !== actionState.name || am.clip !== clipFor) {
        actionMocapRef.current = { name: actionState.name, clip: clipFor, loop, u: 0, w: am?.w ?? 0 };
      }
      const cur = actionMocapRef.current!;
      cur.u = loop ? t / clipFor.duration : Math.min(0.999, t / clipFor.duration);
      const tail = loop ? 1 : Math.min(1, (clipFor.duration - t) / 0.35);
      cur.w = Math.min(1, cur.w + dt * 4, Math.max(0, tail));
      if (!loop && t > clipFor.duration) smRef.current.remove('action');
    } else if (am) {
      am.w = Math.max(0, am.w - dt * 3);
      if (am.w <= 0) actionMocapRef.current = null;
    }
    const amNow = actionMocapRef.current;
    if (amNow && amNow.w > 0.001) {
      const spec = MOCAP_ACTIONS[amNow.name];
      const strength = amNow.w * (spec?.strength ?? 1);
      for (const b of MOCAP_BONES) {
        if (spec?.upper && !MOCAP_UPPER.has(b)) continue;
        const node = H(b);
        if (!node) continue;
        if (amNow.loop ? sampleLoop(amNow.clip, b, amNow.u, qA, 0.5) : sampleBone(THREE, amNow.clip, b, amNow.u, qA, qT)) node.quaternion.slerp(qA, strength);
      }
    }
    if (actionState && !clipFor) {
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

    // 6.9 十期:坐下 —— 腿和手臂摆成坐姿,髋沉到座面上(脚不再贴地)
    const sit = sitRef?.current ?? null;
    if (sit) sitYRef.current = sit.y;
    sitWRef.current = Math.min(1, Math.max(0, sitWRef.current + (sit ? dt * 2.5 : -dt * 3)));
    if (sitWRef.current > 0.001) {
      const sw = sitWRef.current * sitWRef.current * (3 - 2 * sitWRef.current);
      applySitPose(THREE, H, sw);
      const scale = vrm.scene?.scale?.y || 1;
      layerHipsY(H, (-sitDrop(legLen(vrm, H) + 0.07, sitYRef.current) * sw) / scale);
      return;
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
