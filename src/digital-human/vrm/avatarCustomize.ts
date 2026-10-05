/**
 * vrm/avatarCustomize.ts — 捏人 / 捏脸:把 AvatarParams 实时套到已加载的 VRM 上,不重新烘模型
 *
 *   身材  —— 改原始骨骼(raw bone)的缩放:沿骨头方向拉长时,给子骨头反向缩回去,只变长不变粗,
 *            脚、手、头的大小不跟着变;整体身高直接缩放模型根节点。
 *   眼睛  —— 眼骨(leftEye / rightEye)等比缩放(眼球网格绑在眼骨上的模型才有效,VRoid 和写实底模都是)。
 *   脸型  —— 写实底模(scripts/blender/make_avatar.py 烘的)带一组 qq_face_<名>_incr / _decr 形变,
 *            滑杆 -1..1:正值拉 incr,负值拉 decr。别的模型没有这组形变,面板里就不显示。
 *            这组形变不绑进 VRM 表情,表情管理器不会把它们清零。
 *   颜色  —— 按材质名归类(皮肤 / 头发 / 眼睛 / 衣服),颜色乘上去(贴图细节还在)。
 *
 * 原始值第一次套参数前记在 userData.qqBase 里,之后每次都从原始值算,可以反复调、可以还原。
 */

import type * as THREE from 'three';
import type { AvatarParams } from '@/apis/world';

export type ColorSlot = 'skin' | 'hair' | 'eyes' | 'outfit';

export interface AvatarInfo {
  /** qq_face_* 形变的滑杆名(去掉前缀和 _incr/_decr),写实底模才有 */
  faceSliders: string[];
  /** 有眼骨(能调眼睛大小) */
  eyeBones: boolean;
  /** 各颜色分类下有几个材质(0 = 这个模型分不出来,面板不显示) */
  colorSlots: Record<ColorSlot, number>;
  /** 模型高度(米,未缩放) */
  height: number;
}

type BoneName =
  | 'hips' | 'spine' | 'chest' | 'upperChest' | 'neck' | 'head' | 'leftEye' | 'rightEye'
  | 'leftShoulder' | 'rightShoulder' | 'leftUpperArm' | 'rightUpperArm' | 'leftLowerArm' | 'rightLowerArm' | 'leftHand' | 'rightHand'
  | 'leftUpperLeg' | 'rightUpperLeg' | 'leftLowerLeg' | 'rightLowerLeg' | 'leftFoot' | 'rightFoot';

interface Base {
  scales: Map<THREE.Object3D, THREE.Vector3>;
  colors: Map<THREE.Material, { color?: THREE.Color; shade?: THREE.Color }>;
  sceneScale: number;
  /** 刚加载时(还没动起来)每根骨头的本地姿势:量脚底要在这个站姿下量,不然量到的是当下的动作 */
  rest: Map<THREE.Object3D, { q: THREE.Quaternion; p: THREE.Vector3 }>;
}

const FACE_PREFIX = 'qq_face_';

/** 只用到 VRM 的 scene 和 humanoid 取原始骨骼的方法(测试里传的是简化替身) */
type AvatarVrm = {
  scene?: THREE.Object3D;
  humanoid?: { getRawBoneNode?(name: BoneName): THREE.Object3D | null; getBoneNode?(name: BoneName): THREE.Object3D | null } | null;
};

function raw(vrm: AvatarVrm | null | undefined, name: BoneName): THREE.Object3D | null {
  const h = vrm?.humanoid;
  if (!h) return null;
  return (h.getRawBoneNode?.(name) ?? h.getBoneNode?.(name) ?? null) as THREE.Object3D | null;
}

/** 材质归类:按材质名 + 网格名猜 */
export function colorSlotOf(matName: string, meshName: string): ColorSlot | null {
  const n = `${matName} ${meshName}`.toLowerCase();
  // 睫毛眉毛不调;鞋袜不跟衣服一起染
  if (/eyelash|eyebrow|lash|brow|まつ|眉|shoe|boots|sock|靴|鞋/.test(n)) return null;
  if (/hair|髪|kami|long0|short0|ponytail|bob0|braid/.test(n)) return 'hair';
  if (/iris|eye|瞳|hitomi|highlight/.test(n) && !/eyeline|eyewhite|white/.test(n)) return 'eyes';
  if (/cloth|tops|bottoms|shoe|onepiece|dress|shirt|skirt|pants|hanfu|ruqun|robe|coat|jacket|服|衣/.test(n)) return 'outfit';
  if (/skin|body|face|basemesh|肌|hada|head|_skin/.test(n)) return 'skin';
  return null;
}

function forEachMaterial(root: THREE.Object3D, cb: (m: THREE.Material, mesh: THREE.Mesh) => void) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) if (m) cb(m, mesh);
  });
}

const orderOf = (k: string) => { const i = Object.keys(FACE_SLIDER_LABELS).indexOf(k); return i < 0 ? 999 : i; };

export function inspectAvatar(vrm: AvatarVrm | null | undefined): AvatarInfo {
  const root = vrm?.scene as THREE.Object3D | undefined;
  const faceSliders = new Set<string>();
  const colorSlots: Record<ColorSlot, number> = { skin: 0, hair: 0, eyes: 0, outfit: 0 };
  if (!root) return { faceSliders: [], eyeBones: false, colorSlots, height: 1.6 };
  root.traverse((o) => {
    const dict = (o as THREE.Mesh).morphTargetDictionary;
    if (!dict) return;
    for (const k of Object.keys(dict)) {
      if (!k.startsWith(FACE_PREFIX)) continue;
      faceSliders.add(k.slice(FACE_PREFIX.length).replace(/_(incr|decr)$/, ''));
    }
  });
  const seen = new Set<THREE.Material>();
  forEachMaterial(root, (m, mesh) => {
    if (seen.has(m)) return;
    seen.add(m);
    const slot = colorSlotOf(m.name || '', mesh.name || '');
    if (slot && (m as THREE.MeshStandardMaterial).color) colorSlots[slot]++;
  });
  const base = (root.userData.qqBase as Base | undefined);
  const h = (root.userData.qqHeight as number | undefined) ?? 1.6;
  return {
    // 按面板顺序(FACE_SLIDER_LABELS 的顺序),没列到的排最后
    faceSliders: Array.from(faceSliders).sort((x, y) => orderOf(x) - orderOf(y) || x.localeCompare(y)),
    eyeBones: !!raw(vrm, 'leftEye') && !!raw(vrm, 'rightEye'),
    colorSlots,
    height: base ? h : h,
  };
}

function ensureBase(THREE_NS: typeof THREE, vrm: AvatarVrm): Base {
  const root = vrm.scene as THREE.Object3D;
  let base = root.userData.qqBase as Base | undefined;
  if (base) return base;
  base = { scales: new Map(), colors: new Map(), sceneScale: root.scale.x || 1, rest: new Map() };
  root.traverse((o) => {
    if (!(o as THREE.Bone).isBone && o.type !== 'Object3D') return;
    base!.scales.set(o, o.scale.clone());
    base!.rest.set(o, { q: o.quaternion.clone(), p: o.position.clone() });
  });
  forEachMaterial(root, (m) => {
    if (base!.colors.has(m)) return;
    const sm = m as THREE.MeshStandardMaterial & { shadeColorFactor?: THREE.Color };
    base!.colors.set(m, { color: sm.color?.clone(), shade: sm.shadeColorFactor?.clone?.() });
  });
  // 未缩放时的身高
  root.updateMatrixWorld(true);
  const box = new THREE_NS.Box3().setFromObject(root);
  root.userData.qqHeight = Math.max(0.3, box.max.y - box.min.y);
  root.userData.qqBase = base;
  return base;
}

/** 子骨头在父骨头本地坐标里的方向,取绝对值最大的轴:0=x 1=y 2=z */
function boneAxis(bone: THREE.Object3D, child: THREE.Object3D | null): 0 | 1 | 2 {
  const p = child?.position;
  if (!p || p.lengthSq() < 1e-10) return 1;
  const a = [Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)];
  return (a[0] >= a[1] && a[0] >= a[2] ? 0 : a[1] >= a[2] ? 1 : 2) as 0 | 1 | 2;
}

/**
 * 沿骨头方向把 bone 拉长 k 倍,并对它所有子节点在同一轴上缩回 1/k(只变长、不改变下面部件的大小)。
 * 已经被别的参数缩放过的轴会乘起来。
 */
function stretch(bone: THREE.Object3D | null, child: THREE.Object3D | null, k: number, axes?: (0 | 1 | 2)[]) {
  if (!bone || Math.abs(k - 1) < 1e-4) return;
  const ax = axes ?? [boneAxis(bone, child)];
  const s = bone.scale;
  for (const a of ax) s.setComponent(a, s.getComponent(a) * k);
  for (const c of bone.children) {
    for (const a of ax) c.scale.setComponent(a, c.scale.getComponent(a) / k);
  }
}

function uniform(bone: THREE.Object3D | null, k: number) {
  if (!bone || Math.abs(k - 1) < 1e-4) return;
  bone.scale.multiplyScalar(k);
}

const clamp = (v: unknown, lo: number, hi: number, d = 1) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};

/** 套参数。返回套完以后脚底该抬多高(让模型脚踩在 y=0)和身高 */
export function applyAvatarParams(THREE_NS: typeof THREE, vrm: AvatarVrm | null | undefined, params: AvatarParams | null | undefined): { footOffset: number; height: number } {
  const root = vrm?.scene as THREE.Object3D | undefined;
  if (!root) return { footOffset: 0, height: 1.6 };
  const base = ensureBase(THREE_NS, vrm!);
  // 1. 全部还原
  for (const [o, s] of base.scales) o.scale.copy(s);
  root.scale.setScalar(base.sceneScale);
  for (const [m, c] of base.colors) {
    const sm = m as THREE.MeshStandardMaterial & { shadeColorFactor?: THREE.Color };
    if (c.color && sm.color) sm.color.copy(c.color);
    if (c.shade && sm.shadeColorFactor) sm.shadeColorFactor.copy(c.shade);
  }
  const p = params ?? {};
  const b = p.body ?? {};

  // 2. 身材
  const chestBone = raw(vrm, 'upperChest') ?? raw(vrm, 'chest');
  const legs = clamp(b.legs, 0.85, 1.15);
  for (const side of ['left', 'right'] as const) {
    const up = raw(vrm, `${side}UpperLeg` as BoneName), low = raw(vrm, `${side}LowerLeg` as BoneName), foot = raw(vrm, `${side}Foot` as BoneName);
    stretch(up, low, legs);
    stretch(low, foot, legs);
    const arms = clamp(b.arms, 0.85, 1.15);
    const ua = raw(vrm, `${side}UpperArm` as BoneName), la = raw(vrm, `${side}LowerArm` as BoneName), hand = raw(vrm, `${side}Hand` as BoneName);
    stretch(ua, la, arms);
    stretch(la, hand, arms);
  }
  const torso = clamp(b.torso, 0.88, 1.12);
  stretch(raw(vrm, 'spine'), raw(vrm, 'chest'), torso);
  const neck = clamp(b.neck, 0.8, 1.3);
  stretch(raw(vrm, 'neck'), raw(vrm, 'head'), neck);
  // 肩宽:胸骨横向放宽(子骨头横向缩回,脖子和手臂不变粗,但肩点会往外)
  const shoulders = clamp(b.shoulders, 0.85, 1.18);
  if (chestBone) {
    const lsh = raw(vrm, 'leftShoulder');
    const across = boneAxis(chestBone, lsh);
    stretch(chestBone, null, shoulders, [across]);
  }
  // 胖瘦:腰、胸、胯在水平两个方向放宽
  const build = clamp(b.build, 0.85, 1.2);
  if (Math.abs(build - 1) > 1e-4) {
    for (const name of ['hips', 'spine', 'chest'] as BoneName[]) {
      const bone = raw(vrm, name);
      if (!bone) continue;
      const along = boneAxis(bone, bone.children[0] ?? null);
      stretch(bone, null, build, ([0, 1, 2] as (0 | 1 | 2)[]).filter((a) => a !== along));
    }
  }
  uniform(raw(vrm, 'head'), clamp(b.head, 0.85, 1.2));
  // 整体身高最后乘在根上
  root.scale.setScalar(base.sceneScale * clamp(b.height, 0.85, 1.15));

  // 3. 眼睛大小
  const f = p.face ?? {};
  const eyes = clamp(f.eyes, 0.8, 1.25);
  uniform(raw(vrm, 'leftEye'), eyes);
  uniform(raw(vrm, 'rightEye'), eyes);

  // 4. 脸型形变
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const dict = mesh.morphTargetDictionary;
    const inf = mesh.morphTargetInfluences;
    if (!dict || !inf) return;
    for (const [k, idx] of Object.entries(dict)) {
      if (!k.startsWith(FACE_PREFIX)) continue;
      const name = k.slice(FACE_PREFIX.length);
      const m = name.match(/^(.*)_(incr|decr)$/);
      if (!m) continue;
      const v = clamp(f[m[1]], -1, 1, 0);
      inf[idx] = m[2] === 'incr' ? Math.max(0, v) : Math.max(0, -v);
    }
  });

  // 5. 颜色
  const colors = p.colors ?? {};
  const tint = new THREE_NS.Color();
  forEachMaterial(root, (m, mesh) => {
    const slot = colorSlotOf(m.name || '', mesh.name || '');
    const hex = slot ? colors[slot] : undefined;
    if (!slot || !hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    const c = base.colors.get(m);
    const sm = m as THREE.MeshStandardMaterial & { shadeColorFactor?: THREE.Color };
    tint.set(hex);
    // 有贴图的:颜色乘在贴图上(乘白色 = 原样);纯色材质直接换成选的颜色
    if (sm.color) {
      if (sm.map) sm.color.copy(c?.color ?? sm.color).multiply(tint);
      else sm.color.copy(tint);
    }
    if (sm.shadeColorFactor && c?.shade) sm.shadeColorFactor.copy(c.shade).multiply(tint);
  });

  // 6. 量新的脚底:蒙皮网格的包围盒是缓存的,要重算。参数常常是角色已经在走、在坐、在做动作时才到的,
  //    按当下的姿势量,胯一沉(走路的起伏、坐下)脚底就「更低」,整个人被抬离地面 —— 所以先摆回刚加载时的站姿再量,量完放回去
  const savedY = root.position.y;
  const now = new Map<THREE.Object3D, { q: THREE.Quaternion; p: THREE.Vector3 }>();
  for (const [o, r] of base.rest) {
    now.set(o, { q: o.quaternion.clone(), p: o.position.clone() });
    o.quaternion.copy(r.q);
    o.position.copy(r.p);
  }
  root.position.y = 0;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const sk = o as THREE.SkinnedMesh;
    if (sk.isSkinnedMesh) sk.computeBoundingBox();
  });
  const box = new THREE_NS.Box3().setFromObject(root);
  for (const [o, r] of now) {
    o.quaternion.copy(r.q);
    o.position.copy(r.p);
  }
  root.position.y = savedY;
  root.updateMatrixWorld(true);
  return { footOffset: -box.min.y, height: Math.max(0.3, box.max.y - box.min.y) };
}

/** 脸型滑杆的中文名(写实底模烘进去的那组;没列到的显示原名) */
export const FACE_SLIDER_LABELS: Record<string, string> = {
  eyes: '眼睛大小',
  head_width: '脸宽',
  head_length: '脸长',
  head_shape: '圆脸 ↔ 方脸',
  chin_width: '下巴宽窄',
  chin_height: '下巴长短',
  chin_prominent: '下巴翘',
  jaw: '下颌角',
  cheek_bones: '颧骨',
  cheek_volume: '脸颊肉',
  eye_size: '眼型大小',
  eye_distance: '眼距',
  eye_height: '眼睛高低',
  eye_corner: '眼角上挑',
  eye_fold: '双眼皮',
  brow_height: '眉毛高低',
  brow_angle: '眉尾上扬',
  nose_width: '鼻翼宽窄',
  nose_length: '鼻子长短',
  nose_height: '鼻梁高低',
  nose_tip: '鼻尖上翘',
  nose_nostrils: '鼻孔大小',
  mouth_width: '嘴巴宽窄',
  mouth_height: '嘴巴高低',
  lip_upper: '上唇厚薄',
  lip_lower: '下唇厚薄',
  mouth_corners: '嘴角上扬',
  ears_size: '耳朵大小',
  ears_angle: '招风耳',
  forehead: '额头高低',
  neck_width: '脖子粗细',
};

export const BODY_SLIDERS: { key: keyof NonNullable<AvatarParams['body']>; label: string; min: number; max: number }[] = [
  { key: 'height', label: '身高', min: 0.85, max: 1.15 },
  { key: 'head', label: '头部大小', min: 0.85, max: 1.2 },
  { key: 'neck', label: '脖子长短', min: 0.8, max: 1.3 },
  { key: 'shoulders', label: '肩宽', min: 0.85, max: 1.18 },
  { key: 'torso', label: '上身长短', min: 0.88, max: 1.12 },
  { key: 'arms', label: '手臂长短', min: 0.85, max: 1.15 },
  { key: 'legs', label: '腿长', min: 0.85, max: 1.15 },
  { key: 'build', label: '胖瘦', min: 0.85, max: 1.2 },
];
