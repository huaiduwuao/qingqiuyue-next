// bvh2vrm.mjs — CMU 动捕 BVH → VRM 规范化人形骨骼的循环动作(JSON)
//
//   node bvh2vrm.mjs <in.bvh> <out.json> --kind walk|run|idle [--start s] [--len s]
//
// 重定向:按骨骼「方向」对齐,不照搬旋转 —— CMU 的静止姿态腿是撇开的,不是 VRM 的标准 T 字。
//   源骨骼 b 在 t 时刻的世界旋转 Ws(t),静止时 Ws0,静止朝向 ds0(指向它映射到的子骨骼);
//   VRM 规范化骨骼静止时世界旋转是单位阵,朝向 dt0(腿朝下、手臂水平…)。
//   取 A = 把 dt0 转到 ds0 的旋转,Wt(t) = Ws(t)·Ws0⁻¹·A,于是 Wt(t)·dt0 = Ws(t)·Ws0⁻¹·ds0 —— 朝向和源一致;
//   局部旋转 = 父骨骼 Wt⁻¹ · Wt。
// 走 / 跑:找一个完整步态(左大腿往前摆的两次过零之间),去掉朝向漂移和水平位移,只留上下起伏;
//   输出 stride = 一个循环走了多远(以腿长为单位),前端按移动速度调播放速度。
import fs from 'node:fs';
import * as THREE from 'three';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';

const args = process.argv.slice(2);
const [inFile, outFile] = args;
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const kind = opt('kind', 'walk');

// CMU → VRM 规范化骨骼;child = 用来量朝向的子骨骼
const MAP = {
  hips: { src: 'Hips' },
  spine: { src: 'Spine', child: 'Spine1', dir: [0, 1, 0] },
  chest: { src: 'Spine1', child: 'Neck', dir: [0, 1, 0] },
  neck: { src: 'Neck', child: 'Head', dir: [0, 1, 0] },
  head: { src: 'Head', dir: [0, 1, 0] },
  leftShoulder: { src: 'LeftShoulder', child: 'LeftArm', dir: [1, 0, 0] },
  leftUpperArm: { src: 'LeftArm', child: 'LeftForeArm', dir: [1, 0, 0] },
  leftLowerArm: { src: 'LeftForeArm', child: 'LeftHand', dir: [1, 0, 0] },
  leftHand: { src: 'LeftHand', child: 'LeftFingerBase', dir: [1, 0, 0] },
  rightShoulder: { src: 'RightShoulder', child: 'RightArm', dir: [-1, 0, 0] },
  rightUpperArm: { src: 'RightArm', child: 'RightForeArm', dir: [-1, 0, 0] },
  rightLowerArm: { src: 'RightForeArm', child: 'RightHand', dir: [-1, 0, 0] },
  rightHand: { src: 'RightHand', child: 'RightFingerBase', dir: [-1, 0, 0] },
  leftUpperLeg: { src: 'LeftUpLeg', child: 'LeftLeg', dir: [0, -1, 0] },
  leftLowerLeg: { src: 'LeftLeg', child: 'LeftFoot', dir: [0, -1, 0] },
  leftFoot: { src: 'LeftFoot', child: 'LeftToeBase', dir: [0, -0.35, 1] },
  rightUpperLeg: { src: 'RightUpLeg', child: 'RightLeg', dir: [0, -1, 0] },
  rightLowerLeg: { src: 'RightLeg', child: 'RightFoot', dir: [0, -1, 0] },
  rightFoot: { src: 'RightFoot', child: 'RightToeBase', dir: [0, -0.35, 1] },
};
// 规范化骨骼的父子关系(算局部旋转用)
const PARENT = {
  spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck',
  leftShoulder: 'chest', leftUpperArm: 'leftShoulder', leftLowerArm: 'leftUpperArm', leftHand: 'leftLowerArm',
  rightShoulder: 'chest', rightUpperArm: 'rightShoulder', rightLowerArm: 'rightUpperArm', rightHand: 'rightLowerArm',
  leftUpperLeg: 'hips', leftLowerLeg: 'leftUpperLeg', leftFoot: 'leftLowerLeg',
  rightUpperLeg: 'hips', rightLowerLeg: 'rightUpperLeg', rightFoot: 'rightLowerLeg',
};

const text = fs.readFileSync(inFile, 'utf8');
const { skeleton, clip } = new BVHLoader().parse(text);
const byName = Object.fromEntries(skeleton.bones.map((b) => [b.name, b]));
const root = new THREE.Object3D();
root.add(skeleton.bones[0]);
const mixer = new THREE.AnimationMixer(root);
const action = mixer.clipAction(clip);
action.play();

// 静止姿态:所有旋转清零(BVH 的 rest 就是 OFFSET 链、零旋转)
function sampleRest() {
  for (const b of skeleton.bones) b.quaternion.identity();
  skeleton.bones[0].position.set(0, 0, 0);
  root.updateMatrixWorld(true);
}
sampleRest();
const V = (a) => new THREE.Vector3(...a);
const wpos = (b) => b.getWorldPosition(new THREE.Vector3());
const wquat = (b) => b.getWorldQuaternion(new THREE.Quaternion());
const rest = {};
for (const [vb, m] of Object.entries(MAP)) {
  const b = byName[m.src];
  if (!b) throw new Error('BVH 里没有 ' + m.src);
  const Ws0 = wquat(b);
  let A = new THREE.Quaternion();
  if (m.child && byName[m.child]) {
    const ds0 = wpos(byName[m.child]).sub(wpos(b)).normalize();
    const dt0 = V(m.dir).normalize();
    A = new THREE.Quaternion().setFromUnitVectors(dt0, ds0);
  }
  rest[vb] = { b, Ws0inv: Ws0.clone().invert(), A };
}
const legLen = wpos(byName.LeftUpLeg).distanceTo(wpos(byName.LeftLeg)) + wpos(byName.LeftLeg).distanceTo(wpos(byName.LeftFoot));
const hipsRestY = 0; // BVH 里 Hips 的 rest 在原点,高度在动作通道里

// 按时间采样:返回各规范化骨骼的世界旋转 Wt + 髋部位置
function sample(t) {
  mixer.setTime(t);
  root.updateMatrixWorld(true);
  const W = {};
  for (const [vb, r] of Object.entries(rest)) W[vb] = wquat(r.b).multiply(r.Ws0inv).multiply(r.A);
  return { W, hips: wpos(byName.Hips) };
}

const FPS = 30;
const total = clip.duration;
// 片尾那一刻会被当成循环回到开头(setTime(duration) = 0),留一点余量
let t0 = Number(opt('start', 0)), t1 = Math.min(total - 0.01, t0 + Number(opt('len', total)));

// 走 / 跑:找一个完整步态 —— 左大腿「往前摆」的角(相对髋)两次向上过零
if (kind === 'walk' || kind === 'run') {
  const step = 1 / 120;
  const swing = [];
  for (let t = t0; t < t1; t += step) {
    const { W } = sample(t);
    const legDir = new THREE.Vector3(0, -1, 0).applyQuaternion(W.leftUpperLeg);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(W.hips);
    swing.push([t, legDir.dot(fwd)]);
  }
  const ups = [];
  for (let i = 1; i < swing.length; i++) if (swing[i - 1][1] < 0 && swing[i][1] >= 0) ups.push(swing[i][0]);
  // 跳过开头起步的那一下,取中间一段
  // 跳过开头起步的那一下(够多的话),取中间一段
  if (ups.length >= 2) {
    const k = ups.length >= 3 ? Math.min(ups.length - 2, Math.max(1, Math.floor(ups.length / 2) - 1)) : 0;
    t0 = ups[k]; t1 = ups[k + 1];
  }
  console.error(`cycle ${t0.toFixed(3)} → ${t1.toFixed(3)} (${(t1 - t0).toFixed(3)}s), zero-ups=${ups.length}`);
}

// 待机:在整段里找 len 秒(默认 8)髋部水平移动最少的一段 —— 人站着没走的时候
if (kind === 'idle' && !args.includes('--start')) {
  const win = Number(opt('len', 8));
  const pts = [];
  for (let t = 0; t < total - 0.01; t += 0.1) { const h = sample(t).hips; pts.push([t, h.x, h.z]); }
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const j = pts.findIndex((p) => p[0] >= pts[i][0] + win);
    if (j < 0) break;
    let move = 0;
    for (let k = i + 1; k <= j; k++) move += Math.hypot(pts[k][1] - pts[k - 1][1], pts[k][2] - pts[k - 1][2]);
    if (move < best) { best = move; t0 = pts[i][0]; t1 = pts[j][0]; }
  }
  console.error(`idle window ${t0.toFixed(1)} → ${t1.toFixed(1)}s, hips moved ${(best / legLen).toFixed(3)} leg`);
}

const frames = Math.max(2, Math.round((t1 - t0) * FPS));
// 朝向:走的方向(或 idle 时髋的平均朝向)转到 +Z
const a0 = sample(t0), a1 = sample(t1);
let heading;
const travel = new THREE.Vector3().subVectors(a1.hips, a0.hips).setY(0);
if ((kind === 'walk' || kind === 'run') && travel.length() > 0.5) heading = Math.atan2(travel.x, travel.z);
else { const f = new THREE.Vector3(0, 0, 1).applyQuaternion(a0.W.hips); heading = Math.atan2(f.x, f.z); }
const unyaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -heading);

const out = { kind, fps: FPS, frames, duration: frames / FPS, stride: +(travel.length() / legLen).toFixed(4), bones: {}, hipsY: [] };
for (const vb of Object.keys(MAP)) out.bones[vb] = [];
const ys = [];
for (let i = 0; i < frames; i++) {
  const t = t0 + (i / frames) * (t1 - t0);
  const { W, hips } = sample(t);
  const Wu = {};
  for (const vb of Object.keys(W)) Wu[vb] = unyaw.clone().multiply(W[vb]);
  for (const vb of Object.keys(MAP)) {
    const p = PARENT[vb];
    const local = p ? Wu[p].clone().invert().multiply(Wu[vb]) : Wu[vb];
    out.bones[vb].push(...local.toArray().map((x) => +x.toFixed(4)));
  }
  ys.push(hips.y);
}
// 髋高:以腿长为单位的上下起伏(减掉平均值)
const my = ys.reduce((a, b) => a + b, 0) / ys.length;
out.hipsY = ys.map((y) => +((y - my) / legLen).toFixed(4));
out.hipsHeight = +(my / legLen).toFixed(4);
fs.writeFileSync(outFile, JSON.stringify(out));
console.error(`${outFile}: ${frames} frames, stride=${out.stride} leg, ${(fs.statSync(outFile).size / 1024).toFixed(0)} KB`);
