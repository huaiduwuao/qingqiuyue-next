/**
 * vrm/world/realNpc.ts — 写实画风的广场人物:Blender 流水线生成的 MakeHuman 人体 + 汉服(avatars/*.vrm)
 *
 * 接口和 npcRig 一样(root / pickables / tick / speak / dispose),buildWorld 按画风二选一。
 * 模型是 Mixamo 骨骼,静止姿态是 T 字(VRM 1.0 导出时插件会摆成 T 字);动作全是在静止姿态上叠「模型空间里的转动」:
 *   - 手臂放下来:加载时量出大臂的静止朝向,算一个转到「自然下垂略往前」的旋转(T 字 / A 字都对);小臂微屈;呼吸、重心轻换;
 *   - 玩家走近:整个人转过去,头跟着看;走到跟前作一个揖(弯腰 + 双手抬到胸前);
 *   - 说话:右手抬到胸前,掌心朝上缓缓往外送;
 *   - 眨眼(eyeBlinkLeft / eyeBlinkRight 形变)。
 * 模型还没下载完时先放一个看不见的拾取柱,点击照样能打开人物面板。
 */

import type * as THREE from 'three';
import type { NpcRig } from './npcRig';
import type { RealKit } from './realKit';

/** 诗人三种(老 / 中 / 青),引路人一种;同一个人物永远是同一个模型 */
export function realNpcModel(kind: 'poet' | 'guide', seed: number): string {
  if (kind === 'guide') return 'guide';
  return ['poet_old', 'poet_mid', 'poet_young'][seed % 3];
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const damp = (cur: number, target: number, k: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-k * dt));
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const smooth = (x: number) => { const k = clamp(x, 0, 1); return k * k * (3 - 2 * k); };

const BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand'] as const;
type BoneName = typeof BONES[number];

export function createRealNpc(THREE_NS: typeof THREE, kit: RealKit, opts: { model: string; seed: number; faceYaw: number }): NpcRig {
  const root = new THREE_NS.Group();
  root.rotation.y = opts.faceYaw;
  const rnd = (k: number) => { const x = Math.sin(opts.seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };

  // 拾取柱:模型没到之前、以及蒙皮网格的包围盒不准时,都靠它点中人物
  const pickMat = new THREE_NS.MeshBasicMaterial({ visible: false });
  const pick = new THREE_NS.Mesh(new THREE_NS.CylinderGeometry(0.35, 0.35, 1.8, 8), pickMat);
  pick.position.y = 0.9;
  root.add(pick);

  let disposed = false;
  let bones: Partial<Record<BoneName, THREE.Bone>> = {};
  const rest = new Map<THREE.Object3D, THREE.Quaternion>();
  const blinkMeshes: { m: THREE.Mesh; l: number; r: number }[] = [];
  const lower = new Map<number, THREE.Quaternion>();
  kit.character(opts.model).then((model) => {
    if (disposed) return;
    model.traverse((o) => {
      const name = o.name.replace(/[^A-Za-z0-9]/g, '');
      for (const b of BONES) if (name === `mixamorig${b}`) bones[b] = o as THREE.Bone;
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.frustumCulled = false; // 蒙皮网格的包围盒是静止姿态的,会被误裁
        const dict = m.morphTargetDictionary;
        if (dict && ('eyeBlinkLeft' in dict || 'eyeBlinkRight' in dict)) blinkMeshes.push({ m, l: dict.eyeBlinkLeft ?? -1, r: dict.eyeBlinkRight ?? -1 });
      }
    });
    for (const b of Object.values(bones)) if (b) rest.set(b, b.quaternion.clone());
    root.add(model);
    // 量大臂的静止朝向(人物根节点空间),算放下来的旋转
    root.updateWorldMatrix(true, true);
    const inv = root.getWorldQuaternion(new THREE_NS.Quaternion()).invert();
    const wp = (o: THREE.Object3D) => o.getWorldPosition(new THREE_NS.Vector3()).sub(root.getWorldPosition(new THREE_NS.Vector3())).applyQuaternion(inv);
    for (const s of [1, -1] as const) {
      const up = s > 0 ? bones.LeftArm : bones.RightArm;
      const fore = s > 0 ? bones.LeftForeArm : bones.RightForeArm;
      if (!up || !fore) continue;
      const from = wp(fore).sub(wp(up)).normalize();
      const to = new THREE_NS.Vector3(s * 0.16, -0.98, 0.06).normalize();
      lower.set(s, new THREE_NS.Quaternion().setFromUnitVectors(from, to));
    }
  }).catch(() => { /* 模型没到:只剩拾取柱(看不见),名牌照常 */ });

  // ── 动作状态 ──
  let yaw = opts.faceYaw;
  let lookYaw = 0, lookPitch = 0;
  let speakT = 0, speakDur = 1;
  let bowT = -1;
  let wasNear = false;
  let blinkT = 1 + rnd(5) * 3;
  const phase = rnd(3) * 10;
  // 平滑后的姿态量
  const cur = { armDown: 0, elbow: 0, speak: 0, bow: 0, bowHands: 0 };

  const qA = new THREE_NS.Quaternion(), qB = new THREE_NS.Quaternion(), qRootInv = new THREE_NS.Quaternion();
  const axis = { x: new THREE_NS.Vector3(1, 0, 0), y: new THREE_NS.Vector3(0, 1, 0), z: new THREE_NS.Vector3(0, 0, 1) };
  /** 在「模型空间」里给骨骼叠一个转动:local = P⁻¹ · D · P · local,P 是父骨骼当前在模型空间里的朝向 */
  function turnQ(b: THREE.Object3D | undefined, q: THREE.Quaternion) {
    if (!b || !b.parent) return;
    b.parent.getWorldQuaternion(qA).premultiply(qRootInv);
    const d = qA.clone().invert().multiply(q).multiply(qA);
    b.quaternion.premultiply(d);
  }
  function turn(b: THREE.Object3D | undefined, ax: THREE.Vector3, angle: number) {
    if (Math.abs(angle) < 1e-5) return;
    turnQ(b, qB.setFromAxisAngle(ax, angle));
  }

  function tick(t: number, dt: number, target: { x: number; z: number } | null) {
    dt = Math.min(dt, 0.1);
    // 转身:6 米内朝着玩家,超过 50° 才整个转,小角度靠头
    let near = false;
    let targetYaw = opts.faceYaw;
    if (target) {
      const d = Math.hypot(target.x, target.z);
      if (d < 6) { near = true; targetYaw = Math.atan2(target.x, target.z); }
      if (d < 2.4 && !wasNear) bowT = 0;
      wasNear = d < 2.4;
    } else wasNear = false;
    const bodyDiff = angleDiff(yaw, targetYaw);
    if (Math.abs(bodyDiff) > 0.85 || !near) yaw += bodyDiff * (1 - Math.exp(-2.2 * dt));
    root.rotation.y = yaw;
    const headWant = near ? clamp(angleDiff(yaw, targetYaw), -0.8, 0.8) : Math.sin(t * 0.21 + phase) * 0.3;
    lookYaw = damp(lookYaw, headWant, 4, dt);
    lookPitch = damp(lookPitch, near ? 0.05 : Math.sin(t * 0.3 + phase) * 0.06 + 0.05, 3, dt);

    if (speakT > 0) speakT -= dt;
    const speaking = speakT > 0 ? smooth(Math.min(speakT, speakDur - speakT) / 0.6) : 0;
    let bow = 0, bowHands = 0;
    if (bowT >= 0) {
      bowT += dt;
      bowHands = smooth(bowT / 0.4) * smooth((1.9 - bowT) / 0.4);
      bow = Math.sin(clamp((bowT - 0.3) / 1.3, 0, 1) * Math.PI);
      if (bowT > 1.9) bowT = -1;
    }
    cur.speak = damp(cur.speak, speaking, 6, dt);
    cur.bow = damp(cur.bow, bow, 8, dt);
    cur.bowHands = damp(cur.bowHands, bowHands, 8, dt);

    if (!rest.size) return;
    // 每帧从静止姿态重来
    for (const [b, q] of rest) b.quaternion.copy(q);
    root.updateWorldMatrix(true, false);
    root.getWorldQuaternion(qRootInv).invert();

    const breath = Math.sin(t * 1.4 + phase);
    const sway = Math.sin(t * 0.45 + phase);
    // 躯干:重心左右换、呼吸、作揖弯腰
    turn(bones.Hips, axis.z, sway * 0.02);
    turn(bones.Spine, axis.x, cur.bow * 0.35 + 0.02);
    turn(bones.Spine1, axis.x, cur.bow * 0.15);
    turn(bones.Spine2, axis.x, breath * 0.015);
    turn(bones.Spine, axis.z, -sway * 0.015);
    // 头:看人 / 四下看看,作揖时低头
    turn(bones.Neck, axis.y, lookYaw * 0.4);
    turn(bones.Head, axis.y, lookYaw * 0.6);
    turn(bones.Head, axis.x, lookPitch + cur.bow * 0.2);

    // 手臂:A 字站姿放下来(左臂在 +x,绕前后轴往里转),大臂稍往前,小臂微屈
    for (const s of [1, -1] as const) {
      const up = s > 0 ? bones.LeftArm : bones.RightArm;
      const fore = s > 0 ? bones.LeftForeArm : bones.RightForeArm;
      const lq = lower.get(s);
      if (lq) turnQ(up, lq);
      // 说话(右手)/ 作揖(双手):大臂往前抬
      const lift = (s < 0 ? cur.speak * 0.55 : 0) + cur.bowHands * 0.75;
      turn(up, axis.x, -0.06 - lift + breath * 0.01);
      // 作揖:双手往中间收
      turn(up, axis.y, -s * cur.bowHands * 0.35);
      turn(fore, axis.x, -0.2 - (s < 0 ? cur.speak * 0.9 : 0) - cur.bowHands * 1.1);
      if (s < 0 && cur.speak > 0.01) turn(fore, axis.y, s * cur.speak * (0.15 + Math.sin(t * 0.8 + phase) * 0.15));
    }

    // 眨眼
    blinkT -= dt;
    let lid = 0;
    if (blinkT < 0.13) lid = 1 - Math.abs(blinkT - 0.065) / 0.065;
    if (blinkT <= 0) blinkT = rnd(t) < 0.2 ? 0.25 : 2 + rnd(t + 3) * 4;
    for (const b of blinkMeshes) {
      const inf = b.m.morphTargetInfluences;
      if (!inf) continue;
      if (b.l >= 0) inf[b.l] = lid;
      if (b.r >= 0) inf[b.r] = lid;
    }
  }

  return {
    root,
    pickables: [pick],
    tick,
    speak: (seconds = 3.4) => { speakT = seconds; speakDur = seconds; },
    dispose: () => {
      disposed = true;
      pick.geometry.dispose();
      pickMat.dispose();
      root.clear(); // 几何和材质是 kit 里共用的,由 kit.dispose 统一释放
      bones = {};
    },
  };
}
