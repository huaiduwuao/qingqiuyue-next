/**
 * vrm/sceneDisplays.ts — 3D 场景里的显示器道具
 *
 * 舞台上固定摆着几块屏幕:数字人推荐的作品、用户想浏览的页面都在这些屏幕上打开,
 * 而不是把整个页面跳走 —— 对话、语音、场景全都不断。
 *
 * 每块屏幕由两部分组成:
 *   - WebGL 里的道具(边框、立柱、底座),让它看起来是场景里的一件东西;
 *   - CSS3D 里的一块真 DOM(见 useVrmScenePanel),内容是 iframe,能点能滚能打字。
 *
 * 位置都避开角色站的中线:CSS3D 层整体盖在 WebGL 之上,屏幕摆在角色身后会把角色盖住。
 */

import type * as THREE from 'three';

export type DisplaySlot = 'wall' | 'desk' | 'kiosk';

export interface DisplaySpec {
  slot: DisplaySlot;
  /** 给用户和模型看的名字 */
  label: string;
  /** 屏幕 DOM 的像素尺寸;世界尺寸 = 像素 × scale */
  widthPx: number;
  heightPx: number;
  scale: number;
  /** 屏幕中心的世界坐标 */
  position: [number, number, number];
  /** 绕 Y 轴的朝向(弧度),0 = 正对 +Z(默认机位) */
  rotationY: number;
}

export const DISPLAY_SPECS: Record<DisplaySlot, DisplaySpec> = {
  // 左后方的大屏:影视、视频、直播
  wall: { slot: 'wall', label: '大屏', widthPx: 1280, heightPx: 720, scale: 0.0016, position: [-1.45, 1.5, -1.6], rotationY: 0.36 },
  // 右后方的副屏:网页、搜索、其它页面
  desk: { slot: 'desk', label: '副屏', widthPx: 1024, heightPx: 640, scale: 0.0015, position: [2.15, 1.5, -2.3], rotationY: -0.5 },
  // 右前方的竖屏:宽度按手机算,站内页面会走移动端排版,字大、好读 —— 小说/文章/资讯
  kiosk: { slot: 'kiosk', label: '竖屏', widthPx: 480, heightPx: 800, scale: 0.0014, position: [0.95, 1.45, -0.5], rotationY: -0.25 },
};

export const DISPLAY_SLOTS = Object.keys(DISPLAY_SPECS) as DisplaySlot[];

export function isDisplaySlot(v: unknown): v is DisplaySlot {
  return typeof v === 'string' && v in DISPLAY_SPECS;
}

/** 屏幕的边框 + 立柱 + 底座。原点在屏幕中心,朝向由调用方设置。 */
export function buildDisplayProp(THREE_NS: typeof THREE, spec: DisplaySpec): THREE.Group {
  const w = spec.widthPx * spec.scale;
  const h = spec.heightPx * spec.scale;
  const group = new THREE_NS.Group();
  group.name = `display-${spec.slot}`;

  const body = new THREE_NS.MeshStandardMaterial({ color: 0x0b0e18, roughness: 0.45, metalness: 0.6 });
  const glow = new THREE_NS.MeshBasicMaterial({ color: 0x25f4ee, transparent: true, opacity: 0.55 });

  // 机身:比画面大一圈,放在画面后面一点,正面露出来的就是边框
  const bezel = 0.045;
  const back = new THREE_NS.Mesh(new THREE_NS.BoxGeometry(w + bezel * 2, h + bezel * 2, 0.05), body);
  back.position.z = -0.03;
  back.castShadow = true;
  group.add(back);

  // 底边一条灯带:没开页面时也能看出这是块屏幕
  const strip = new THREE_NS.Mesh(new THREE_NS.BoxGeometry(w * 0.5, 0.012, 0.012), glow);
  strip.position.set(0, -h / 2 - bezel - 0.012, 0);
  group.add(strip);

  // 立柱 + 底座(落到地面 y=0)
  const bottom = spec.position[1] - h / 2 - bezel;
  if (bottom > 0.05) {
    const pole = new THREE_NS.Mesh(new THREE_NS.CylinderGeometry(0.03, 0.03, bottom, 12), body);
    pole.position.set(0, -h / 2 - bezel - bottom / 2, -0.04);
    pole.castShadow = true;
    group.add(pole);
    const base = new THREE_NS.Mesh(new THREE_NS.CylinderGeometry(Math.min(0.32, w * 0.3), Math.min(0.36, w * 0.34), 0.03, 24), body);
    base.position.set(0, -h / 2 - bezel - bottom + 0.015, -0.04);
    base.receiveShadow = true;
    group.add(base);
  }

  group.position.set(...spec.position);
  group.rotation.y = spec.rotationY;
  return group;
}

export function disposeDisplayProp(group: THREE.Group) {
  const materials = new Set<THREE.Material>();
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose?.();
    if (m.material) materials.add(m.material as THREE.Material);
  });
  materials.forEach((m) => m.dispose());
}

/**
 * 「凑近看」的机位:相机正对屏幕,距离刚好让屏幕占满画面上半部分。
 *
 * 画面下方 hudBottom 比例被聊天区占着,所以屏幕要落在剩下的区域里:
 * 先按可用区域算出距离,再把视线中心往下挪,让屏幕中心对到可用区域的中心。
 */
export function displayFocusPose(
  spec: DisplaySpec,
  fovDeg: number,
  aspect: number,
  hudBottom = 0.34,
): { pos: [number, number, number]; target: [number, number, number] } {
  const w = spec.widthPx * spec.scale;
  const h = spec.heightPx * spec.scale;
  const tan = Math.tan((fovDeg * Math.PI) / 360);
  const free = Math.max(0.3, 1 - hudBottom) * 0.9; // 可用高度占比,留一点边
  const distForHeight = h / free / (2 * tan);
  const distForWidth = w / 0.92 / (2 * tan * Math.max(0.4, aspect));
  const dist = Math.min(11, Math.max(1.05, distForHeight, distForWidth));
  // 可用区域中心在画面中心上方 hudBottom/2 处 → 视线中心要比屏幕中心低这么多
  const drop = (hudBottom / 2) * 2 * tan * dist;
  const nx = Math.sin(spec.rotationY);
  const nz = Math.cos(spec.rotationY);
  const [x, y, z] = spec.position;
  return {
    pos: [x + nx * dist, y - drop, z + nz * dist],
    target: [x, y - drop, z],
  };
}
