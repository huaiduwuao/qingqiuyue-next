/**
 * vrm/world/npcRig.ts — 广场人物的「活」的身体
 *
 * 一个有关节的小人:胯、腰、胸、脖子、头,左右大臂 / 小臂(宽袖)/ 手。
 * 衣服分层:外袍(交领右衽、下摆镶边)压着里面的白色中衣,中衣下摆再露一截,底下是一双云头履;
 * 腰带打结垂两条带子,诗人再挂一块玉。脸上有鼻子、耳朵、眼白和瞳仁,会眨眼。
 *
 * 动作全是程序化的,每帧算:
 *   - 呼吸(胸口起伏)、重心左右换、偶尔低头 / 抬头;
 *   - 站姿:手臂贴着身子自然垂下,不往外张;闲时轮换:袖手(双手拢进袖子里)、负手(背在身后)、
 *     望天、捋须(诗人);引路人左手提灯,灯始终竖直垂着;
 *   - 玩家走近:转身、目光跟着玩家,到跟前作一个揖;
 *   - 说话:右手抬到胸前,掌心朝上缓缓往外送,幅度很小;
 *   - 宽袖朝下垂(小臂抬起来袖子也是往下坠的),下摆随风。
 *
 * 关节约定(关节组在父空间里):
 *   - 肩:绕 X 正 = 手臂往后,负 = 往前;绕 Z 乘 side 为正 = 往外张。
 *   - 肘:旋转顺序 YXZ —— 先绕 X 屈肘(负 = 小臂往前抬),再绕 Y 把抬起的小臂往里 / 往外甩
 *     (-side × 正值 = 往身体中线收)。顺序是 XYZ 的话绕 Y 只是在拧小臂,看不出来。
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

interface Joint { g: THREE.Group }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const damp = (cur: number, target: number, k: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-k * dt));
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const smooth = (x: number) => { const k = clamp(x, 0, 1); return k * k * (3 - 2 * k); };

/** 闲时小习惯 */
const enum Habit { Rest, Tuck, SkyGaze, Stroke, Behind }

export function createNpcRig(THREE_NS: typeof THREE, opts: { style: NpcStyle; robe: number; seed: number; faceYaw: number }): NpcRig {
  const { style, seed } = opts;
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T) => { disposables.push(x); return x; };
  const rnd = (k: number) => { const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };

  const robeColor = new THREE_NS.Color(opts.robe);
  const cloth = (c: THREE.Color | number, sheen = 0.6, rough = 0.78) => track(new THREE_NS.MeshPhysicalMaterial({
    // 一点点自发光:黄昏 / 夜里人物不至于糊成一团剪影
    color: c, emissive: new THREE_NS.Color(c).multiplyScalar(0.06), roughness: rough, metalness: 0, sheen, sheenRoughness: 0.55, sheenColor: new THREE_NS.Color(c).lerp(new THREE_NS.Color(0xffffff), 0.35),
    side: THREE_NS.DoubleSide,
  }));
  const robeMat = cloth(robeColor);
  const innerMat = cloth(new THREE_NS.Color(0xf1ead8), 0.3);
  const trimMat = cloth(robeColor.clone().multiplyScalar(0.42), 0.45);
  const sashMat = cloth(style === 'poet' ? new THREE_NS.Color(0x3a2f28) : robeColor.clone().lerp(new THREE_NS.Color(0xc9a15a), 0.55), 0.5, 0.6);
  const skinMat = track(new THREE_NS.MeshPhysicalMaterial({ color: 0xe9ccb0, emissive: new THREE_NS.Color(0x3a1c10).multiplyScalar(0.25), roughness: 0.6, sheen: 0.35, sheenColor: new THREE_NS.Color(0xffc8a8), sheenRoughness: 0.6 }));
  const lipMat = track(new THREE_NS.MeshStandardMaterial({ color: 0xb4665a, roughness: 0.55 }));
  const grey = style === 'poet' && rnd(1) > 0.55;
  const hairMat = track(new THREE_NS.MeshStandardMaterial({ color: grey ? 0x8d8781 : 0x17130f, roughness: 0.5 }));
  const hatMat = track(new THREE_NS.MeshStandardMaterial({ color: 0x14161c, roughness: 0.42, metalness: 0.1 }));
  const shoeMat = track(new THREE_NS.MeshStandardMaterial({ color: 0x1b1a1d, roughness: 0.5 }));
  const scleraMat = track(new THREE_NS.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.3 }));
  const irisMat = track(new THREE_NS.MeshBasicMaterial({ color: 0x1e140c }));
  const jadeMat = track(new THREE_NS.MeshPhysicalMaterial({ color: 0x7fb89a, roughness: 0.2, transmission: 0.2, thickness: 0.02, sheen: 0.5 }));
  const goldMat = track(new THREE_NS.MeshStandardMaterial({ color: 0xd4b06a, metalness: 0.8, roughness: 0.3 }));

  const root = new THREE_NS.Group();
  root.rotation.y = opts.faceYaw;
  const pickables: THREE.Object3D[] = [];
  /** shadow=false:眼睛、眉毛这些小零件不投影,省一点阴影开销 */
  const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, shadow = true) => {
    const m = new THREE_NS.Mesh(track(geo), mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    return m;
  };
  const joint = (parent: THREE.Object3D, x: number, y: number, z: number): Joint => {
    const g = new THREE_NS.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return { g };
  };

  // ── 衣摆:几层车床旋出来的喇叭形,风吹时一起摆 ──
  interface Sway { pos: THREE.BufferAttribute; base: Float32Array; top: number }
  const sways: Sway[] = [];
  const lathe = (pts: THREE.Vector2[], mat: THREE.Material, seg = 32, phiStart = 0, phiLen = Math.PI * 2) => {
    const geo = new THREE_NS.LatheGeometry(pts, seg, phiStart, phiLen);
    const m = mk(geo, mat);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    sways.push({ pos, base: Float32Array.from(pos.array as Float32Array), top: 0.95 });
    return m;
  };
  // 外袍下摆:腰(y=0.95, r=0.17)→ 离地 8cm(r=0.37),底边微微外翻
  const robeProfile = (k: number, dr = 0) => new THREE_NS.Vector2(0.168 + Math.pow(k, 1.5) * 0.2 + (k > 0.9 ? (k - 0.9) * 0.25 : 0) + dr, 0.95 - k * 0.87);
  const outerPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 14; i++) outerPts.push(robeProfile(i / 14));
  const hem = lathe(outerPts, robeMat);
  root.add(hem);
  pickables.push(hem);
  // 下摆镶边:外袍最底下一圈深色
  const bandPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 3; i++) bandPts.push(robeProfile(0.92 + i * 0.08 / 3, 0.003));
  root.add(lathe(bandPts, trimMat, 32));
  // 交领右衽:外袍前襟那条斜下来的深色边(从左肩斜到右侧腰下,这里只画腰以下的竖边)
  const lapelPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 14; i++) lapelPts.push(robeProfile(i / 14, 0.004));
  root.add(lathe(lapelPts, trimMat, 3, 0.28, 0.07));
  // 中衣:白色,比外袍长出一截,盖住脚面
  const innerPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) { const k = i / 8; innerPts.push(new THREE_NS.Vector2(0.2 + k * 0.15, 0.5 - k * 0.455)); }
  root.add(lathe(innerPts, innerMat, 28));

  // 云头履:从下摆里露出两个鞋尖,鞋头微微翘起
  for (const s of [-1, 1]) {
    const shoe = mk(new THREE_NS.CapsuleGeometry(0.038, 0.13, 4, 10), shoeMat, s * 0.085, 0.03, 0.26);
    shoe.rotation.x = Math.PI / 2;
    shoe.scale.set(1, 1, 0.62);
    const toe = mk(new THREE_NS.SphereGeometry(0.03, 10, 8), shoeMat, s * 0.085, 0.055, 0.33, false);
    toe.scale.set(1.1, 0.7, 0.8);
    root.add(shoe, toe);
  }

  // ── 胯 → 腰 → 胸 → 颈 → 头 ──
  const hips = joint(root, 0, 0.95, 0);
  const spine = joint(hips.g, 0, 0.05, 0);
  // 上身:腰细、胸宽,用车床旋出一个有腰身的筒
  const torsoPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const k = i / 10; // 0 = 腰, 1 = 肩下
    torsoPts.push(new THREE_NS.Vector2(0.158 + Math.sin(k * Math.PI * 0.8) * 0.03 - k * k * 0.03, -0.04 + k * 0.46));
  }
  const torso = mk(new THREE_NS.LatheGeometry(torsoPts, 24), robeMat);
  torso.scale.set(1.05, 1, 0.82);
  spine.g.add(torso);
  pickables.push(torso);
  // 腰带 + 结 + 两条垂带(诗人再挂一块玉)
  const belt = mk(new THREE_NS.CylinderGeometry(0.168, 0.17, 0.065, 24, 1, true), sashMat, 0, 0.0, 0);
  belt.scale.set(1.05, 1, 0.84);
  spine.g.add(belt);
  const knot = mk(new THREE_NS.SphereGeometry(0.028, 10, 8), sashMat, 0.04, 0.0, 0.142, false);
  knot.scale.set(1.3, 0.9, 0.6);
  spine.g.add(knot);
  const tails: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const tail = mk(new THREE_NS.PlaneGeometry(0.035, 0.34), sashMat, 0.04 + s * 0.018, -0.18, 0.15, false);
    tail.geometry.translate(0, -0.14, 0);
    tail.position.y = -0.02;
    tail.rotation.z = s * 0.06;
    spine.g.add(tail);
    tails.push(tail);
  }
  if (style === 'poet') {
    const cord = mk(new THREE_NS.CylinderGeometry(0.003, 0.003, 0.14, 4), sashMat, -0.07, -0.08, 0.135, false);
    const jade = mk(new THREE_NS.TorusGeometry(0.022, 0.009, 8, 16), jadeMat, -0.07, -0.165, 0.137, false);
    const tassel = mk(new THREE_NS.ConeGeometry(0.012, 0.07, 6), track(new THREE_NS.MeshStandardMaterial({ color: 0x9e2b25, roughness: 0.7 })), -0.07, -0.225, 0.137, false);
    tassel.rotation.x = Math.PI;
    spine.g.add(cord, jade, tassel);
  }

  const chest = joint(spine.g, 0, 0.3, 0);
  // 交领:贴着肩胸表面的两条斜带,左襟(白中衣领)在下,右襟(深色镶边)压在上面,交成一个 y 字;
  // 脖子根再一圈白领口。端点是按肩部椭球和上身车床的表面算的,只抬起 6mm。
  const strip = (from: [number, number, number], to: [number, number, number], width: number, mat: THREE.Material) => {
    const a = new THREE_NS.Vector3(...from), b = new THREE_NS.Vector3(...to);
    const dir = b.clone().sub(a);
    const len = dir.length();
    dir.normalize();
    const out = new THREE_NS.Vector3((a.x + b.x) / 2, 0.25, 1).normalize(); // 大致朝外朝上
    const zAxis = out.sub(dir.clone().multiplyScalar(out.dot(dir))).normalize();
    const xAxis = dir.clone().cross(zAxis);
    const m = mk(new THREE_NS.BoxGeometry(width, len + 0.004, 0.006), mat, 0, 0, 0, false);
    m.quaternion.setFromRotationMatrix(new THREE_NS.Matrix4().makeBasis(xAxis, dir, zAxis));
    m.position.copy(a).add(b).multiplyScalar(0.5);
    chest.g.add(m);
  };
  // 胸前表面(胸关节空间):肩部椭球和上身车床取靠外的那个
  const chestSurfaceZ = (x: number, y: number) => {
    const e = 1 - (x / 0.207) ** 2 - ((y - 0.08) / 0.0925) ** 2;
    const ez = e > 0 ? 0.144 * Math.sqrt(e) : 0;
    const k = (y + 0.34) / 0.46;
    let tz = 0;
    if (k >= 0 && k <= 1) {
      const r = 0.158 + Math.sin(k * Math.PI * 0.8) * 0.03 - k * k * 0.03;
      const q = 1 - (x / (r * 1.05)) ** 2;
      tz = q > 0 ? r * 0.82 * Math.sqrt(q) : 0;
    }
    return Math.max(ez, tz);
  };
  // 一条襟分成几段,每段两端都贴着表面,弯过胸口
  const lapel = (x0: number, y0: number, x1: number, y1: number, width: number, lift: number, mat: THREE.Material) => {
    const n = 5;
    const pt = (i: number): [number, number, number] => {
      const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
      return [x, y, chestSurfaceZ(x, y) + lift];
    };
    for (let i = 0; i < n; i++) strip(pt(i), pt(i + 1), width, mat);
  };
  lapel(-0.062, 0.162, 0.03, 0.0, 0.036, 0.005, innerMat);
  lapel(0.062, 0.162, -0.04, -0.04, 0.04, 0.009, trimMat);
  const neckBand = mk(new THREE_NS.TorusGeometry(0.052, 0.012, 8, 22), innerMat, 0, 0.168, 0.008, false);
  neckBand.rotation.x = Math.PI / 2 + 0.35;
  chest.g.add(neckBand);
  const shoulders = mk(new THREE_NS.SphereGeometry(0.185, 20, 12), robeMat, 0, 0.08, 0);
  shoulders.scale.set(1.12, 0.5, 0.78);
  chest.g.add(shoulders);

  const neck = joint(chest.g, 0, 0.17, 0);
  neck.g.add(mk(new THREE_NS.CylinderGeometry(0.043, 0.05, 0.11, 12), skinMat, 0, 0.03, 0));
  const head = joint(neck.g, 0, 0.075, 0);
  head.g.scale.setScalar(1.1); // 头略大一点,比例更讨喜
  // 头:后脑勺圆、下巴收窄
  const skull = mk(new THREE_NS.SphereGeometry(0.1, 26, 20), skinMat, 0, 0.11, 0);
  skull.scale.set(0.9, 1.02, 0.98);
  const jaw = mk(new THREE_NS.SphereGeometry(0.075, 20, 14), skinMat, 0, 0.065, 0.025);
  jaw.scale.set(0.95, 0.9, 0.95);
  head.g.add(skull, jaw);
  pickables.push(skull);
  // 鼻子、嘴
  const nose = mk(new THREE_NS.ConeGeometry(0.012, 0.035, 8), skinMat, 0, 0.098, 0.1, false);
  nose.rotation.x = 0.35;
  nose.scale.set(1, 1, 0.8);
  const mouth = mk(new THREE_NS.CapsuleGeometry(0.004, 0.018, 3, 6), lipMat, 0, 0.066, 0.092, false);
  mouth.rotation.z = Math.PI / 2;
  head.g.add(nose, mouth);
  // 耳朵
  for (const s of [-1, 1]) {
    const ear = mk(new THREE_NS.SphereGeometry(0.022, 10, 8), skinMat, s * 0.09, 0.105, -0.005, false);
    ear.scale.set(0.45, 1, 0.75);
    head.g.add(ear);
  }
  // 眼睛:眼白 + 瞳仁,整组可以缩成一条缝来眨眼;上面一道眉
  const eyes: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const eye = new THREE_NS.Group();
    eye.position.set(s * 0.034, 0.118, 0.083);
    const white = mk(new THREE_NS.SphereGeometry(0.014, 12, 8), scleraMat, 0, 0, 0, false);
    white.scale.set(1.25, 0.72, 0.5);
    const iris = mk(new THREE_NS.SphereGeometry(0.0085, 10, 8), irisMat, 0, 0, 0.0055, false);
    iris.scale.set(1, 1, 0.5);
    eye.add(white, iris);
    head.g.add(eye);
    eyes.push(eye);
    const brow = mk(new THREE_NS.CapsuleGeometry(0.0035, 0.028, 3, 6), hairMat, s * 0.036, 0.14, 0.088, false);
    brow.rotation.z = Math.PI / 2 - s * 0.14;
    head.g.add(brow);
  }

  // 头发 / 帽
  if (style === 'poet') {
    // 鬓角的头发从帽檐下露出来
    const hairBack = mk(new THREE_NS.SphereGeometry(0.104, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat, 0, 0.112, -0.006);
    hairBack.scale.set(0.95, 1, 1.02);
    hairBack.rotation.x = -0.75; // 往后倒:前沿退到额头上,后沿盖住后颈
    head.g.add(hairBack);
    // 幞头:包住头顶的黑帽 + 高出一截的帽屋 + 两根软脚垂在脑后
    const cap = mk(new THREE_NS.SphereGeometry(0.108, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.46), hatMat, 0, 0.125, -0.006);
    cap.scale.set(0.97, 1.05, 1.04);
    cap.rotation.x = -0.4;
    const crown = mk(new THREE_NS.CapsuleGeometry(0.05, 0.035, 4, 12), hatMat, 0, 0.235, -0.03);
    crown.scale.set(1, 1, 0.9);
    head.g.add(cap, crown);
    for (const s of [-1, 1]) {
      const foot = mk(new THREE_NS.PlaneGeometry(0.026, 0.22), hatMat, s * 0.03, 0.16, -0.095, false);
      foot.geometry.translate(0, -0.11, 0);
      foot.rotation.set(0.28, 0, s * 0.08);
      head.g.add(foot);
    }
    // 胡须:下巴一绺长须,两腮短髯,唇上两撇
    const beard = mk(new THREE_NS.ConeGeometry(0.03, 0.13, 10), hairMat, 0, 0.0, 0.07, false);
    beard.rotation.x = Math.PI + 0.3;
    head.g.add(beard);
    for (const s of [-1, 1]) {
      const whisker = mk(new THREE_NS.ConeGeometry(0.011, 0.045, 6), hairMat, s * 0.04, 0.05, 0.066, false);
      whisker.rotation.set(Math.PI + 0.25, 0, -s * 0.12);
      const mus = mk(new THREE_NS.CapsuleGeometry(0.0035, 0.03, 3, 6), hairMat, s * 0.018, 0.075, 0.094, false);
      mus.rotation.z = Math.PI / 2 + s * 0.55;
      head.g.add(whisker, mus);
    }
  } else {
    // 引路人:发髻 + 簪 + 两鬓垂下的发丝
    const hair = mk(new THREE_NS.SphereGeometry(0.107, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMat, 0, 0.113, -0.008);
    hair.scale.set(0.96, 1.02, 1.03);
    hair.rotation.x = -0.72;
    const bun = mk(new THREE_NS.TorusGeometry(0.035, 0.022, 10, 18), hairMat, 0, 0.225, -0.05);
    bun.rotation.x = -0.6;
    const pin = mk(new THREE_NS.CylinderGeometry(0.004, 0.004, 0.17, 6), goldMat, 0, 0.235, -0.05, false);
    pin.rotation.z = Math.PI / 2 - 0.2;
    const bead = mk(new THREE_NS.SphereGeometry(0.01, 8, 6), jadeMat, 0.085, 0.253, -0.05, false);
    head.g.add(hair, bun, pin, bead);
    for (const s of [-1, 1]) {
      const lock = mk(new THREE_NS.CapsuleGeometry(0.008, 0.09, 3, 6), hairMat, s * 0.082, 0.08, 0.04, false);
      lock.rotation.z = s * 0.08;
      head.g.add(lock);
    }
  }

  // ── 手臂:肩 → 大臂 → 肘 → 小臂 + 垂下来的宽袖 → 手 ──
  interface Arm { side: number; shoulder: Joint; elbow: Joint; drape: THREE.Group; wrist: Joint }
  const arms: Arm[] = [];
  for (const side of [-1, 1]) {
    const shoulder = joint(chest.g, side * 0.172, 0.085, -0.005);
    const upper = mk(new THREE_NS.CylinderGeometry(0.056, 0.066, 0.29, 12), robeMat, 0, -0.14, 0);
    const cap = mk(new THREE_NS.SphereGeometry(0.058, 12, 8), robeMat, 0, 0, 0, false);
    shoulder.g.add(upper, cap);
    const elbow = joint(shoulder.g, 0, -0.28, 0);
    elbow.g.rotation.order = 'YXZ';
    // 宽袖:肘部往下鼓出来、袖口收一点,开口。挂在单独的组上,每帧往重力方向回摆一部分
    const drape = new THREE_NS.Group();
    elbow.g.add(drape);
    const sleevePts: THREE.Vector2[] = [];
    for (let i = 0; i <= 8; i++) {
      const k = i / 8;
      sleevePts.push(new THREE_NS.Vector2(0.064 + Math.sin(k * Math.PI * 0.75) * 0.048, -k * 0.3));
    }
    const sleeve = mk(new THREE_NS.LatheGeometry(sleevePts, 18), robeMat, 0, 0.02, 0);
    sleeve.scale.set(0.85, 1, 1.15); // 前后方向更宽,像垂下来的袖兜
    const cuff = mk(new THREE_NS.TorusGeometry(0.1, 0.011, 6, 22), trimMat, 0, -0.28, 0, false);
    cuff.rotation.x = Math.PI / 2;
    cuff.scale.set(0.85, 1.15, 1);
    drape.add(sleeve, cuff);
    // 手:掌 + 并拢的四指 + 拇指,掌心朝身体
    const wrist = joint(elbow.g, 0, -0.27, 0.01);
    const palm = mk(new THREE_NS.CapsuleGeometry(0.021, 0.035, 4, 10), skinMat, 0, -0.03, 0, false);
    palm.scale.set(0.55, 1, 1.05);
    const fingers = mk(new THREE_NS.CapsuleGeometry(0.018, 0.03, 4, 10), skinMat, 0, -0.072, 0.004, false);
    fingers.scale.set(0.5, 1, 1);
    fingers.rotation.x = -0.25;
    const thumb = mk(new THREE_NS.CapsuleGeometry(0.008, 0.028, 3, 6), skinMat, -side * 0.006, -0.035, 0.024, false);
    thumb.rotation.set(-0.5, 0, side * 0.3);
    wrist.g.add(palm, fingers, thumb);
    arms.push({ side, shoulder, elbow, drape, wrist });
  }

  // 引路人左手提一盏灯:挂在一个每帧回正到竖直的组上,灯不会跟着小臂歪
  let lanternGlow: THREE.MeshBasicMaterial | null = null;
  let lanternHang: THREE.Group | null = null;
  if (style === 'guide') {
    lanternGlow = track(new THREE_NS.MeshBasicMaterial({ color: new THREE_NS.Color(2.4, 1.3, 0.5) }));
    lanternHang = new THREE_NS.Group();
    lanternHang.position.set(0, -0.06, 0.02);
    const handle = mk(new THREE_NS.CylinderGeometry(0.004, 0.004, 0.14, 6), hatMat, 0, -0.07, 0, false);
    const lidTop = mk(new THREE_NS.ConeGeometry(0.062, 0.035, 12), hatMat, 0, -0.155, 0, false);
    const lamp = mk(new THREE_NS.SphereGeometry(0.058, 16, 12), lanternGlow, 0, -0.22, 0, false);
    lamp.scale.set(1, 1.15, 1);
    const bottom = mk(new THREE_NS.CylinderGeometry(0.03, 0.04, 0.02, 12), hatMat, 0, -0.29, 0, false);
    const fringe = mk(new THREE_NS.ConeGeometry(0.012, 0.06, 6), track(new THREE_NS.MeshStandardMaterial({ color: 0xb2322a, roughness: 0.7 })), 0, -0.33, 0, false);
    fringe.rotation.x = Math.PI;
    lanternHang.add(handle, lidTop, lamp, bottom, fringe);
    arms[0].wrist.g.add(lanternHang);
  }

  // ── 动作状态 ──
  let yaw = opts.faceYaw;
  let lookYaw = 0, lookPitch = 0;
  let speakT = 0; // 剩余吟诵时间
  let speakDur = 1;
  let bowT = -1;  // 作揖进度(-1 = 没在揖)
  let wasNear = false;
  // 诗人一开场多半是袖手或负手站着,不是两手空垂
  let habit: Habit = style === 'poet' ? (rnd(4) > 0.5 ? Habit.Tuck : Habit.Behind) : Habit.Rest;
  let habitT = 4 + rnd(2) * 6;
  let blinkT = 1 + rnd(5) * 3;
  const phase = rnd(3) * 10;
  const tmpV = new THREE_NS.Vector3();
  const tmpQ = new THREE_NS.Quaternion();
  const tmpQ2 = new THREE_NS.Quaternion();

  function pickHabit(t: number): Habit {
    const r = rnd(t * 1.7);
    if (style === 'poet') return r < 0.3 ? Habit.Tuck : r < 0.55 ? Habit.Behind : r < 0.7 ? Habit.SkyGaze : r < 0.85 ? Habit.Stroke : Habit.Rest;
    return r < 0.45 ? Habit.Rest : r < 0.8 ? Habit.Tuck : Habit.SkyGaze;
  }

  function tick(t: number, dt: number, target: { x: number; z: number } | null) {
    dt = Math.min(dt, 0.1);
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
    const headWant = near ? clamp(angleDiff(yaw, targetYaw), -0.9, 0.9) : Math.sin(t * 0.21 + phase) * 0.3;
    lookYaw = damp(lookYaw, headWant, 4, dt);

    habitT -= dt;
    if (habitT <= 0) { habit = pickHabit(t); habitT = 5 + rnd(t + 1) * 7; }
    if (speakT > 0) speakT -= dt;
    // 吟诵手势:开头 0.6 秒抬起、结尾 0.6 秒放下
    const speaking = speakT > 0 ? smooth(Math.min(speakT, speakDur - speakT) / 0.6) : 0;

    // 呼吸 + 重心
    const breath = Math.sin(t * 1.4 + phase);
    const sway = Math.sin(t * 0.45 + phase);
    hips.g.rotation.z = sway * 0.03;
    hips.g.position.x = sway * 0.012;
    chest.g.scale.set(1 + breath * 0.01, 1 + breath * 0.014, 1 + breath * 0.018);
    spine.g.rotation.z = -sway * 0.022;

    // 作揖:上身前倾再起来(0.35 秒抬手,再弯腰,1.8 秒收)
    let bow = 0, bowHands = 0;
    if (bowT >= 0) {
      bowT += dt;
      bowHands = smooth(bowT / 0.35) * smooth((1.8 - bowT) / 0.4);
      bow = Math.sin(clamp((bowT - 0.25) / 1.3, 0, 1) * Math.PI);
      if (bowT > 1.8) bowT = -1;
    }
    const gaze = habit === Habit.SkyGaze && !near;
    spine.g.rotation.x = bow * 0.42 + (gaze ? -0.05 : 0.025);
    // 头:看人 / 望天 / 低头沉思
    const pitchWant = near ? -0.04 : gaze ? -0.42 : habit === Habit.Stroke ? 0.12 : 0.04 + Math.sin(t * 0.3 + phase) * 0.05;
    lookPitch = damp(lookPitch, pitchWant - bow * 0.25, 3, dt);
    neck.g.rotation.set(lookPitch * 0.4, lookYaw * 0.4, 0);
    head.g.rotation.set(lookPitch * 0.6, lookYaw * 0.6, Math.sin(t * 0.37 + phase) * 0.025);

    // 眨眼:几秒一次,偶尔连眨两下
    blinkT -= dt;
    let lid = 1;
    if (blinkT < 0.13) lid = Math.abs(blinkT - 0.065) / 0.065;
    if (blinkT <= 0) blinkT = rnd(t) < 0.2 ? 0.25 : 2 + rnd(t + 3) * 4;
    for (const e of eyes) e.scale.y = Math.max(0.08, lid);

    // 手臂:算出每只手的目标姿势(肩 X/Z,肘 X/Y,腕 X),再平滑过去
    for (const a of arms) {
      const s = a.side; // -1 左 1 右
      // 默认:贴着身子垂下,大臂稍稍在前,肘微屈
      let shX = -0.05, shZ = s * 0.07, elX = -0.2, elY = 0, wrX = 0.1;
      const holdsLantern = style === 'guide' && s < 0;
      const want = holdsLantern ? Habit.Rest : habit;
      if (holdsLantern) {
        // 提灯:小臂往前抬一点,手在腰侧
        shX = -0.12; shZ = s * 0.06; elX = -0.75; elY = -s * 0.1;
      } else if (want === Habit.Tuck || (style === 'guide' && habit !== Habit.Rest)) {
        // 袖手:双手在腹前拢进袖子里(引路人一只手提灯,另一只手搭在腹前)
        shX = 0.02; shZ = s * 0.02; elX = -1.3; elY = -s * (style === 'guide' ? 0.85 : 0.72); wrX = -0.1;
      } else if (want === Habit.Behind || (want === Habit.SkyGaze && style === 'poet')) {
        // 负手:小臂抬起后甩到身后,双手在后腰相叠
        shX = 0.22; shZ = s * 0.1; elX = -1.25; elY = -s * 2.3; wrX = 0.2;
      } else if (want === Habit.Stroke && s > 0) {
        // 捋须:右手抬到下巴下面,顺着胡子慢慢往下捋
        const k = 0.5 + 0.5 * Math.sin(t * 1.6);
        shX = -0.5; shZ = s * 0.02; elX = -2.3 + k * 0.25; elY = -s * 0.45; wrX = -0.3;
      } else if (want === Habit.Stroke && s < 0) {
        // 捋须时左手袖在腹前托着
        shX = 0.02; shZ = s * 0.02; elX = -1.3; elY = -s * 0.7;
      }
      if (s > 0 && speaking > 0.001 && bowHands < 0.01) {
        // 吟诵:右手抬到胸前,掌心朝上缓缓往外送,幅度很小
        const k = speaking;
        const sweep = Math.sin(t * 0.8 + phase) * 0.2;
        shX = shX * (1 - k) + -0.35 * k; shZ = shZ * (1 - k) + s * 0.1 * k;
        elX = elX * (1 - k) + -1.15 * k; elY = elY * (1 - k) + -s * (0.05 + sweep) * k; wrX = wrX * (1 - k) + 0.35 * k;
      }
      if (bowHands > 0.001 && !holdsLantern) {
        // 作揖:双手抱拳合在胸前
        const k = bowHands;
        shX = shX * (1 - k) + -0.75 * k; shZ = shZ * (1 - k) + s * 0.05 * k;
        elX = elX * (1 - k) + -1.35 * k; elY = elY * (1 - k) + -s * 0.95 * k; wrX = wrX * (1 - k) + -0.2 * k;
      }
      const k = 6;
      a.shoulder.g.rotation.x = damp(a.shoulder.g.rotation.x, shX + breath * 0.012, k, dt);
      a.shoulder.g.rotation.z = damp(a.shoulder.g.rotation.z, shZ, k, dt);
      a.elbow.g.rotation.x = damp(a.elbow.g.rotation.x, elX, k, dt);
      a.elbow.g.rotation.y = damp(a.elbow.g.rotation.y, elY, k * 0.8, dt);
      a.wrist.g.rotation.x = damp(a.wrist.g.rotation.x, wrX, k, dt);
      // 宽袖往下坠:小臂抬得越高,袖兜越往回摆向竖直(只回一部分,袖口还罩着手)
      const lift = -(a.shoulder.g.rotation.x + a.elbow.g.rotation.x);
      a.drape.rotation.x = clamp(lift, 0, 2.6) * 0.42 + Math.sin(t * 1.2 + s + phase) * 0.03;
    }

    // 提灯回正:让灯组的世界朝向只保留绕 Y 的转动
    if (lanternHang) {
      lanternHang.parent!.getWorldQuaternion(tmpQ);
      root.getWorldQuaternion(tmpQ2);
      lanternHang.quaternion.copy(tmpQ.invert().multiply(tmpQ2));
      lanternHang.rotation.z += Math.sin(t * 1.9 + phase) * 0.06;
    }

    // 衣摆随风:越往下摆幅越大;垂带跟着飘
    for (const sw of sways) {
      const arr = sw.pos.array as Float32Array;
      const base = sw.base;
      for (let i = 0; i < arr.length; i += 3) {
        const y = base[i + 1];
        const kk = Math.pow(clamp(1 - y / sw.top, 0, 1), 2);
        tmpV.set(base[i], y, base[i + 2]);
        const ang = Math.atan2(tmpV.z, tmpV.x);
        const wave = Math.sin(t * 1.7 + ang * 2 + phase) * 0.011 + Math.sin(t * 0.8 + phase) * 0.016 + sway * 0.012;
        arr[i] = base[i] + wave * kk;
        arr[i + 2] = base[i + 2] + Math.cos(t * 1.1 + ang + phase) * 0.009 * kk;
      }
      sw.pos.needsUpdate = true;
    }
    tails.forEach((tl, i) => { tl.rotation.x = 0.08 + bow * 0.5 + Math.sin(t * 1.5 + i + phase) * 0.06; });
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
