/**
 * vrm/world/npcRig.ts — 广场人物的「活」的身体
 *
 * 不是贴一个锥子:一个有关节的小人 —— 胯、腰、胸、脖子、头,左右大臂 / 小臂 / 手,宽袖和长衫下摆。
 * 衣料用带 sheen 的物理材质(布料的柔光),长衫是车床旋出来的喇叭形,交领、腰带、发髻 / 幞头、胡须按身份配。
 *
 * 动作全是程序化的,每帧算:
 *   - 呼吸(胸口起伏)、重心左右换、偶尔低头 / 抬头;
 *   - 玩家走近:转身、目光跟着玩家,到跟前作一个揖;
 *   - 说话:抬手吟诵(右手掌心向上缓缓划过),说完放下;
 *   - 闲时的小习惯:诗人捋须、仰头望天、负手而立;引路人提灯、合手;
 *   - 袖子和下摆随动作和风轻摆。
 */

import type * as THREE from 'three';

export type NpcStyle = 'poet' | 'guide';

export interface NpcRig {
  root: THREE.Group;
  /** 点击拾取用的网格 */
  pickables: THREE.Object3D[];
  /** 每帧:target = 玩家位置(null = 没人在附近) */
  tick: (t: number, dt: number, target: { x: number; z: number } | null) => void;
  /** 开口说话:接下来几秒做吟诵手势 */
  speak: (seconds?: number) => void;
  dispose: () => void;
}

interface Joint { g: THREE.Group; rest: THREE.Euler }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const damp = (cur: number, target: number, k: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-k * dt));
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export function createNpcRig(THREE_NS: typeof THREE, opts: { style: NpcStyle; robe: number; seed: number; faceYaw: number }): NpcRig {
  const { style, seed } = opts;
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T) => { disposables.push(x); return x; };
  const rnd = (k: number) => { const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };

  const robeColor = new THREE_NS.Color(opts.robe);
  const cloth = (c: THREE.Color | number, sheen = 0.6) => track(new THREE_NS.MeshPhysicalMaterial({
    // 一点点自发光:黄昏 / 夜里人物不至于糊成一团剪影
    color: c, emissive: new THREE_NS.Color(c).multiplyScalar(0.06), roughness: 0.78, metalness: 0, sheen, sheenRoughness: 0.55, sheenColor: new THREE_NS.Color(c).lerp(new THREE_NS.Color(0xffffff), 0.35),
    side: THREE_NS.DoubleSide,
  }));
  const robeMat = cloth(robeColor);
  const innerMat = cloth(new THREE_NS.Color(0xf1ead8), 0.3);
  const trimMat = cloth(robeColor.clone().multiplyScalar(0.45), 0.4);
  const skinMat = track(new THREE_NS.MeshStandardMaterial({ color: 0xe8cdb2, roughness: 0.62 }));
  const hairMat = track(new THREE_NS.MeshStandardMaterial({ color: style === 'poet' && rnd(1) > 0.5 ? 0x6a6560 : 0x17130f, roughness: 0.55 }));
  const hatMat = track(new THREE_NS.MeshStandardMaterial({ color: 0x14161c, roughness: 0.45, metalness: 0.1 }));
  const eyeMat = track(new THREE_NS.MeshBasicMaterial({ color: 0x1a120c }));

  const root = new THREE_NS.Group();
  root.rotation.y = opts.faceYaw;
  const pickables: THREE.Object3D[] = [];
  const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const m = new THREE_NS.Mesh(track(geo), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  };
  const joint = (parent: THREE.Object3D, x: number, y: number, z: number): Joint => {
    const g = new THREE_NS.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return { g, rest: g.rotation.clone() };
  };

  // ── 长衫下摆:车床旋出的喇叭形,底边微微起伏 ──
  const hemPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    // 从腰(y=0.95, r=0.17)到地(y=0.02, r=0.36)
    hemPts.push(new THREE_NS.Vector2(0.17 + Math.pow(k, 1.6) * 0.21, 0.95 - k * 0.93));
  }
  const hemGeo = new THREE_NS.LatheGeometry(hemPts, 28);
  const hem = mk(hemGeo, robeMat);
  root.add(hem);
  pickables.push(hem);
  // 下摆的风:记下原始顶点,每帧按高度加一点位移
  const hemPos = hemGeo.attributes.position as THREE.BufferAttribute;
  const hemBase = Float32Array.from(hemPos.array as Float32Array);

  // ── 胯 → 腰 → 胸 → 颈 → 头 ──
  const hips = joint(root, 0, 0.95, 0);
  const spine = joint(hips.g, 0, 0.05, 0);
  const torso = mk(new THREE_NS.CylinderGeometry(0.16, 0.175, 0.42, 16), robeMat, 0, 0.2, 0);
  spine.g.add(torso);
  pickables.push(torso);
  // 腰带
  spine.g.add(mk(new THREE_NS.CylinderGeometry(0.182, 0.182, 0.07, 16), trimMat, 0, 0.02, 0));
  const chest = joint(spine.g, 0, 0.3, 0);
  // 胸口:交领(两片斜着的衬里)
  const collarL = mk(new THREE_NS.BoxGeometry(0.03, 0.2, 0.012), innerMat, -0.035, 0.03, 0.158);
  collarL.rotation.z = -0.55;
  const collarR = mk(new THREE_NS.BoxGeometry(0.03, 0.2, 0.012), trimMat, 0.035, 0.03, 0.162);
  collarR.rotation.z = 0.55;
  const shoulders = mk(new THREE_NS.SphereGeometry(0.19, 18, 12), robeMat, 0, 0.1, 0);
  shoulders.scale.set(1.18, 0.55, 0.85);
  chest.g.add(collarL, collarR, shoulders);
  const neck = joint(chest.g, 0, 0.17, 0);
  neck.g.add(mk(new THREE_NS.CylinderGeometry(0.045, 0.05, 0.1, 10), skinMat, 0, 0.04, 0));
  const head = joint(neck.g, 0, 0.1, 0);
  const skull = mk(new THREE_NS.SphereGeometry(0.105, 22, 16), skinMat, 0, 0.1, 0.005);
  skull.scale.set(0.92, 1.08, 0.98);
  head.g.add(skull);
  pickables.push(skull);
  // 眼睛(两粒)和眉
  for (const s of [-1, 1]) {
    head.g.add(mk(new THREE_NS.SphereGeometry(0.011, 8, 6), eyeMat, s * 0.036, 0.115, 0.095));
    const brow = mk(new THREE_NS.BoxGeometry(0.03, 0.006, 0.006), hairMat, s * 0.037, 0.14, 0.094);
    brow.rotation.z = -s * 0.12;
    head.g.add(brow);
  }
  // 头发 / 帽
  if (style === 'poet') {
    // 幞头:后脑一顶黑帽 + 两根软脚垂在脑后
    const cap = mk(new THREE_NS.SphereGeometry(0.112, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hatMat, 0, 0.12, -0.005);
    cap.scale.set(1, 1.05, 1.05);
    const top = mk(new THREE_NS.BoxGeometry(0.1, 0.08, 0.1), hatMat, 0, 0.23, -0.02);
    head.g.add(cap, top);
    for (const s of [-1, 1]) {
      const tail = mk(new THREE_NS.BoxGeometry(0.025, 0.2, 0.008), hatMat, s * 0.035, 0.08, -0.11);
      tail.rotation.x = 0.25;
      head.g.add(tail);
    }
    // 胡须:下巴一撮、唇上两撇
    const beard = mk(new THREE_NS.ConeGeometry(0.035, 0.12, 8), hairMat, 0, 0.0, 0.07);
    beard.rotation.x = Math.PI + 0.25;
    head.g.add(beard);
    for (const s of [-1, 1]) {
      const mus = mk(new THREE_NS.BoxGeometry(0.04, 0.006, 0.006), hairMat, s * 0.022, 0.065, 0.098);
      mus.rotation.z = s * 0.4;
      head.g.add(mus);
    }
  } else {
    // 引路人:发髻 + 一根簪
    const hair = mk(new THREE_NS.SphereGeometry(0.11, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMat, 0, 0.11, -0.01);
    const bun = mk(new THREE_NS.SphereGeometry(0.05, 12, 10), hairMat, 0, 0.23, -0.04);
    const pin = mk(new THREE_NS.CylinderGeometry(0.005, 0.005, 0.16, 6), track(new THREE_NS.MeshStandardMaterial({ color: 0xd4b06a, metalness: 0.8, roughness: 0.3 })), 0, 0.24, -0.04);
    pin.rotation.z = Math.PI / 2;
    head.g.add(hair, bun, pin);
  }

  // ── 手臂:肩 → 大臂 → 肘 → 小臂(宽袖)→ 手 ──
  interface Arm { shoulder: Joint; elbow: Joint; sleeve: THREE.Mesh; side: number }
  const arms: Arm[] = [];
  for (const side of [-1, 1]) {
    const shoulder = joint(chest.g, side * 0.19, 0.1, 0);
    const upper = mk(new THREE_NS.CylinderGeometry(0.055, 0.06, 0.28, 10), robeMat, 0, -0.14, 0);
    shoulder.g.add(upper);
    const elbow = joint(shoulder.g, 0, -0.28, 0);
    // 宽袖:往下张开的开口圆台
    const sleeve = mk(new THREE_NS.CylinderGeometry(0.065, 0.13, 0.3, 14, 1, true), robeMat, 0, -0.14, 0.01);
    const cuff = mk(new THREE_NS.TorusGeometry(0.125, 0.012, 6, 18), trimMat, 0, -0.29, 0.01);
    cuff.rotation.x = Math.PI / 2;
    const hand = mk(new THREE_NS.SphereGeometry(0.035, 10, 8), skinMat, 0, -0.27, 0.02);
    hand.scale.set(0.8, 1.2, 0.6);
    elbow.g.add(sleeve, cuff, hand);
    arms.push({ shoulder, elbow, sleeve, side });
  }

  // 引路人手里提一盏灯
  let lanternGlow: THREE.MeshBasicMaterial | null = null;
  if (style === 'guide') {
    lanternGlow = track(new THREE_NS.MeshBasicMaterial({ color: new THREE_NS.Color(2.4, 1.3, 0.5) }));
    const handle = mk(new THREE_NS.CylinderGeometry(0.006, 0.006, 0.18, 6), hatMat, 0, -0.38, 0.03);
    const lamp = mk(new THREE_NS.CylinderGeometry(0.05, 0.05, 0.11, 10), lanternGlow, 0, -0.5, 0.03);
    lamp.castShadow = false;
    arms[0].elbow.g.add(handle, lamp);
  }

  // ── 动作状态 ──
  let yaw = opts.faceYaw;
  let lookYaw = 0, lookPitch = 0;
  let speakT = 0; // 剩余吟诵时间
  let speakDur = 1;
  let bowT = -1;  // 作揖进度(-1 = 没在揖)
  let wasNear = false;
  let habit = 0, habitT = 3 + rnd(2) * 5; // 闲时小习惯
  const phase = rnd(3) * 10;
  const tmpV = new THREE_NS.Vector3();

  function tick(t: number, dt: number, target: { x: number; z: number } | null) {
    const p = root.position;
    let near = false;
    let targetYaw = opts.faceYaw;
    if (target) {
      const dx = target.x - p.x, dz = target.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 6) {
        near = true;
        targetYaw = Math.atan2(dx, dz);
      }
      if (d < 2.4 && !wasNear) bowT = 0; // 走到跟前:作揖
      wasNear = d < 2.4;
    } else {
      wasNear = false;
    }
    // 身体慢慢转过去,超过 50° 才整个转身,小角度用头和眼
    const bodyDiff = angleDiff(yaw, targetYaw);
    if (Math.abs(bodyDiff) > 0.85 || !near) yaw += bodyDiff * (1 - Math.exp(-2.2 * dt));
    root.rotation.y = yaw;
    const headWant = near ? clamp(angleDiff(yaw, targetYaw), -0.9, 0.9) : Math.sin(t * 0.21 + phase) * 0.35;
    lookYaw = damp(lookYaw, headWant, 4, dt);

    // 闲时小习惯轮换:0 站定 1 捋须/合手 2 望天 3 负手
    habitT -= dt;
    if (habitT <= 0) { habit = Math.floor(rnd(t) * 4); habitT = 4 + rnd(t + 1) * 6; }
    if (speakT > 0) speakT -= dt;
    // 吟诵手势:开头 0.5 秒抬起、结尾 0.5 秒放下
    const speaking = speakT > 0 ? clamp(Math.min(speakT, speakDur - speakT) * 2, 0, 1) : 0;
    const w = (x: number) => clamp(x, 0, 1);

    // 呼吸 + 重心
    const breath = Math.sin(t * 1.4 + phase);
    const sway = Math.sin(t * 0.45 + phase);
    hips.g.rotation.z = sway * 0.035;
    hips.g.position.x = sway * 0.012;
    chest.g.scale.set(1 + breath * 0.012, 1 + breath * 0.018, 1 + breath * 0.02);
    spine.g.rotation.z = -sway * 0.025;

    // 作揖:上身前倾再起来
    let bow = 0;
    if (bowT >= 0) {
      bowT += dt;
      bow = Math.sin(Math.min(1, bowT / 1.3) * Math.PI);
      if (bowT > 1.3) bowT = -1;
    }
    spine.g.rotation.x = bow * 0.45 + (habit === 2 ? -0.06 : 0.03);
    // 头:看人 / 望天 / 低头沉思
    const pitchWant = near ? -0.05 : habit === 2 ? -0.45 : habit === 1 ? 0.18 : 0.05 + Math.sin(t * 0.3 + phase) * 0.06;
    lookPitch = damp(lookPitch, pitchWant - bow * 0.3, 3, dt);
    neck.g.rotation.set(lookPitch * 0.4, lookYaw * 0.4, 0);
    head.g.rotation.set(lookPitch * 0.6, lookYaw * 0.6, Math.sin(t * 0.37 + phase) * 0.03);

    // 手臂
    for (const a of arms) {
      const s = a.side; // -1 左 1 右
      // 默认:自然垂下,稍往前
      let shX = 0.12, shZ = s * 0.12, elX = -0.25, elY = 0;
      if (bow > 0.01) {
        // 作揖:双手在胸前合拢
        shX = -1.0 * bow + 0.12 * (1 - bow); shZ = -s * 0.35 * bow + s * 0.12 * (1 - bow); elX = -1.3 * bow - 0.25 * (1 - bow);
      } else if (s > 0 && speaking > 0.01) {
        // 右手吟诵:抬到胸前、掌心向上,缓缓往外划
        const k = w(speaking);
        const sweep = Math.sin(t * 0.9) * 0.35;
        shX = -0.9 * k + 0.12 * (1 - k); shZ = (0.35 + sweep) * k + 0.12 * (1 - k); elX = -0.9 * k - 0.25 * (1 - k); elY = 0.4 * k;
      } else if (habit === 3 || (style === 'poet' && habit === 0 && s < 0)) {
        // 负手:手背到身后
        shX = 0.55; shZ = s * 0.2; elX = -1.1; elY = -s * 0.5;
      } else if (habit === 1 && style === 'poet' && s > 0) {
        // 捋须:右手抬到下巴
        const k = 0.5 + 0.5 * Math.sin(t * 1.8);
        shX = -1.25; shZ = -0.1; elX = -1.9 + k * 0.15; elY = 0.2;
      } else if (habit === 1 && style === 'guide') {
        // 合手于腹前
        shX = -0.35; shZ = -s * 0.25; elX = -1.2;
      } else if (style === 'guide' && s < 0) {
        // 提灯的左手:微微抬起
        shX = -0.25; shZ = -0.18; elX = -0.4;
      }
      a.shoulder.g.rotation.x = damp(a.shoulder.g.rotation.x, shX + breath * 0.015, 5, dt);
      a.shoulder.g.rotation.z = damp(a.shoulder.g.rotation.z, shZ, 5, dt);
      a.elbow.g.rotation.x = damp(a.elbow.g.rotation.x, elX, 5, dt);
      a.elbow.g.rotation.y = damp(a.elbow.g.rotation.y, elY, 5, dt);
      // 袖子跟着手臂晃一点
      a.sleeve.rotation.z = Math.sin(t * 1.3 + s + phase) * 0.06;
    }

    // 下摆随风:越往下摆幅越大
    const arr = hemPos.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const y = hemBase[i + 1];
      const k = Math.pow(1 - y / 0.95, 2);
      tmpV.set(hemBase[i], y, hemBase[i + 2]);
      const ang = Math.atan2(tmpV.z, tmpV.x);
      const wave = Math.sin(t * 1.7 + ang * 2 + phase) * 0.012 + Math.sin(t * 0.8 + phase) * 0.018;
      arr[i] = hemBase[i] + wave * k;
      arr[i + 2] = hemBase[i + 2] + Math.cos(t * 1.1 + ang + phase) * 0.01 * k;
    }
    hemPos.needsUpdate = true;
    if (lanternGlow) {
      const f = 0.85 + 0.15 * Math.sin(t * 7 + phase) * Math.sin(t * 3.3);
      lanternGlow.color.setRGB(2.4 * f, 1.3 * f, 0.5 * f);
    }
  }

  return {
    root,
    pickables,
    tick,
    speak: (seconds = 3.4) => { speakT = seconds; speakDur = seconds; },
    dispose: () => { disposables.forEach((d) => d.dispose()); root.clear(); },
  };
}
