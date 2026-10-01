/**
 * vrm/world/blockLayer.ts — 创世十二期:把积木画出来
 *
 * 每种「形状 × 材质」一个 InstancedMesh(用到才建,不够了容量翻倍重建),每块一个实例:位置 = 格子中心、
 * 绕竖轴转 rot × 90°、颜色乘在材质纹理上。材质纹理是程序画的(木纹、石头、砖缝、地砖缝……),不用下载。
 * 玻璃半透明、发光是不受光照的纯色(配合后期泛光像灯)。两万块也只有几十次绘制。
 *
 * 点选:射线打到哪一块、哪一面(按打中的点离格子中心哪一轴最远算面);没打到积木就落在地面那一格。
 * 预览:一个线框盒子跟着鼠标(放 = 青色、拆 = 红色),框选铺满时是一个大框。
 */

import type * as THREE from 'three';
import { BLOCK_SIZE, MATS, blockKey, cellOf, type BlockData, type BlockGrid, type BlockOp } from './blocks';

export interface BlockHit {
  /** 打中的那块(打在地面上 = null) */
  block: BlockData | null;
  /** 打中那一面朝外的方向(地面 = 朝上) */
  normal: { x: number; y: number; z: number };
  /** 放的话放到哪一格(打中那块旁边那格 / 地面那格) */
  place: { x: number; y: number; z: number };
  point: { x: number; y: number; z: number };
}

export interface BlockLayer {
  /** 整个换成这份(进房间、重读) */
  load: (grid: BlockGrid) => void;
  /** 增量改(本地操作、别人改的推过来) */
  applyOps: (ops: readonly BlockOp[], grid: BlockGrid) => void;
  pick: (raycaster: THREE.Raycaster) => BlockHit | null;
  /** 预览框:cells 两个角(一格时两个一样);null = 不显示 */
  setGhost: (a: { x: number; y: number; z: number } | null, b?: { x: number; y: number; z: number }, remove?: boolean) => void;
  count: () => number;
  dispose: () => void;
}

const S = BLOCK_SIZE;

function makeTexture(THREE_NS: typeof THREE, mat: number): THREE.Texture | null {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return null;
  const rnd = (() => { let s = 1234 + mat * 97; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const fill = (v: number) => { g.fillStyle = `rgb(${v},${v},${v})`; };
  fill(235); g.fillRect(0, 0, 64, 64);
  const speckle = (n: number, lo: number, hi: number, size = 2) => {
    for (let i = 0; i < n; i++) { fill(lo + Math.floor(rnd() * (hi - lo))); g.fillRect(Math.floor(rnd() * 64), Math.floor(rnd() * 64), size, size); }
  };
  switch (mat) {
    case 0: speckle(500, 215, 250); break; // 灰墙
    case 1: // 木纹
      for (let y = 0; y < 64; y++) { fill(200 + Math.floor(30 * Math.sin(y * 0.55 + Math.sin(y * 0.13) * 3) + rnd() * 10)); g.fillRect(0, y, 64, 1); }
      break;
    case 2: speckle(900, 150, 245, 3); break; // 石
    case 3: // 砖
      fill(190); g.fillRect(0, 0, 64, 64);
      for (let row = 0; row < 4; row++) for (let col = -1; col < 3; col++) {
        const x = col * 32 + (row % 2) * 16;
        fill(215 + Math.floor(rnd() * 35)); g.fillRect(x + 1, row * 16 + 1, 30, 14);
      }
      break;
    case 6: for (let y = 0; y < 64; y++) { fill(205 + Math.floor(rnd() * 40)); g.fillRect(0, y, 64, 1); } break; // 拉丝金属
    case 7: speckle(1400, 170, 255, 2); break; // 草
    case 8: fill(245); g.fillRect(0, 0, 64, 64); fill(175); g.fillRect(0, 0, 64, 2); g.fillRect(0, 0, 2, 64); g.fillRect(0, 31, 64, 2); g.fillRect(31, 0, 2, 64); break; // 地砖
    case 9: for (let y = 0; y < 64; y += 2) for (let x = 0; x < 64; x += 2) { fill(((x + y) / 2) % 2 ? 215 : 245); g.fillRect(x, y, 2, 2); } break; // 布
    default: return null; // 玻璃、发光:纯色
  }
  const t = new THREE_NS.CanvasTexture(c);
  t.colorSpace = THREE_NS.SRGBColorSpace;
  t.magFilter = THREE_NS.NearestFilter; // 方块味儿
  return t;
}

function makeMaterial(THREE_NS: typeof THREE, mat: number): THREE.Material {
  if (mat === 5) return new THREE_NS.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  if (mat === 4) return new THREE_NS.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false });
  const map = makeTexture(THREE_NS, mat);
  return new THREE_NS.MeshStandardMaterial({ color: 0xffffff, map, roughness: mat === 6 ? 0.35 : 0.85, metalness: mat === 6 ? 0.7 : 0 });
}

/** 斜坡:三棱柱,rot 0 时往 -z 方向升高 */
function wedgeGeometry(THREE_NS: typeof THREE): THREE.BufferGeometry {
  const h = S / 2;
  // 六个顶点:底面四个 + 高边两个(z = -h 那边)
  const A = [-h, -h, h], B = [h, -h, h], C = [h, -h, -h], D = [-h, -h, -h], E = [-h, h, -h], F = [h, h, -h];
  const tri = (p: number[], q: number[], r: number[]) => [...p, ...q, ...r];
  const pos = [
    ...tri(A, C, B), ...tri(A, D, C), // 底
    ...tri(D, E, F), ...tri(D, F, C), // 高的那面(背面)
    ...tri(A, B, F), ...tri(A, F, E), // 斜面
    ...tri(A, E, D), // 左三角
    ...tri(B, C, F), // 右三角
  ];
  const g = new THREE_NS.BufferGeometry();
  g.setAttribute('position', new THREE_NS.Float32BufferAttribute(pos, 3));
  // UV 简单按 x / y 摊开
  const uv: number[] = [];
  for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] / S + 0.5, pos[i + 1] / S + 0.5 + pos[i + 2] / S);
  g.setAttribute('uv', new THREE_NS.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

function shapeGeometry(THREE_NS: typeof THREE, shape: number): THREE.BufferGeometry {
  switch (shape) {
    case 1: { const g = new THREE_NS.BoxGeometry(S, S / 2, S); g.translate(0, -S / 4, 0); return g; }
    case 2: return wedgeGeometry(THREE_NS);
    case 3: return new THREE_NS.BoxGeometry(S, S, 0.1);
    case 4: return new THREE_NS.CylinderGeometry(0.2, 0.2, S, 14);
    default: return new THREE_NS.BoxGeometry(S, S, S);
  }
}

interface Bucket { mesh: THREE.InstancedMesh; keys: string[]; cap: number }

export function createBlockLayer(THREE_NS: typeof THREE, parent: THREE.Object3D): BlockLayer {
  const root = new THREE_NS.Group();
  root.name = 'dh-world-blocks';
  parent.add(root);
  const geos = new Map<number, THREE.BufferGeometry>();
  const mats = new Map<number, THREE.Material>();
  const buckets = new Map<string, Bucket>();
  const where = new Map<string, { bucket: string; index: number }>(); // 格子 → 在哪个桶的第几个
  const m4 = new THREE_NS.Matrix4();
  const q = new THREE_NS.Quaternion();
  const up = new THREE_NS.Vector3(0, 1, 0);
  const pos = new THREE_NS.Vector3();
  const one = new THREE_NS.Vector3(1, 1, 1);
  const col = new THREE_NS.Color();

  const geo = (s: number) => { let g = geos.get(s); if (!g) { g = shapeGeometry(THREE_NS, s); geos.set(s, g); } return g; };
  const mat = (m: number) => { let x = mats.get(m); if (!x) { x = makeMaterial(THREE_NS, m); mats.set(m, x); } return x; };

  function bucketFor(s: number, m: number, need: number): Bucket {
    const key = `${s}_${m}`;
    let b = buckets.get(key);
    if (b && b.cap >= need) return b;
    const cap = Math.max(64, b ? b.cap * 2 : 64, need);
    const mesh = new THREE_NS.InstancedMesh(geo(s), mat(m), cap);
    mesh.frustumCulled = false;
    mesh.castShadow = m !== 4 && m !== 5;
    mesh.receiveShadow = true;
    mesh.userData.blockBucket = key;
    mesh.instanceMatrix.setUsage(THREE_NS.DynamicDrawUsage);
    if (b) {
      // 扩容:旧的实例拷过去
      for (let i = 0; i < b.mesh.count; i++) {
        b.mesh.getMatrixAt(i, m4); mesh.setMatrixAt(i, m4);
        b.mesh.getColorAt(i, col); mesh.setColorAt(i, col);
      }
      mesh.count = b.mesh.count;
      root.remove(b.mesh);
      b.mesh.dispose();
      b = { mesh, keys: b.keys, cap };
    } else {
      mesh.count = 0;
      b = { mesh, keys: [], cap };
    }
    if (!mesh.instanceColor) mesh.setColorAt(0, col.set(0xffffff));
    root.add(mesh);
    buckets.set(key, b);
    return b;
  }

  function writeInstance(b: Bucket, i: number, d: BlockData) {
    pos.set((d.x + 0.5) * S, (d.y + 0.5) * S, (d.z + 0.5) * S);
    q.setFromAxisAngle(up, (d.r & 3) * Math.PI / 2);
    m4.compose(pos, q, one);
    b.mesh.setMatrixAt(i, m4);
    b.mesh.setColorAt(i, col.setHex(d.c).convertSRGBToLinear());
  }

  function add(d: BlockData) {
    const k = blockKey(d.x, d.y, d.z);
    if (where.has(k)) remove(k);
    const b = bucketFor(d.s, d.m, (buckets.get(`${d.s}_${d.m}`)?.mesh.count ?? 0) + 1);
    const i = b.mesh.count;
    b.mesh.count = i + 1;
    b.keys[i] = k;
    writeInstance(b, i, d);
    where.set(k, { bucket: `${d.s}_${d.m}`, index: i });
    b.mesh.instanceMatrix.needsUpdate = true;
    if (b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true;
  }

  function remove(k: string) {
    const w = where.get(k);
    if (!w) return;
    const b = buckets.get(w.bucket)!;
    const last = b.mesh.count - 1;
    if (w.index !== last) {
      // 末尾那个挪到空位上
      b.mesh.getMatrixAt(last, m4); b.mesh.setMatrixAt(w.index, m4);
      b.mesh.getColorAt(last, col); b.mesh.setColorAt(w.index, col);
      const movedKey = b.keys[last];
      b.keys[w.index] = movedKey;
      where.set(movedKey, { bucket: w.bucket, index: w.index });
    }
    b.keys.length = last;
    b.mesh.count = last;
    where.delete(k);
    b.mesh.instanceMatrix.needsUpdate = true;
    if (b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true;
  }

  function load(grid: BlockGrid) {
    for (const b of buckets.values()) { b.mesh.count = 0; b.keys.length = 0; }
    where.clear();
    for (const d of grid.all()) add(d);
  }

  function applyOps(ops: readonly BlockOp[], grid: BlockGrid) {
    for (const op of ops) {
      const k = blockKey(op[1], op[2], op[3]);
      const d = grid.get(op[1], op[2], op[3]);
      if (d) add(d); else remove(k);
    }
  }

  const ground = new THREE_NS.Plane(new THREE_NS.Vector3(0, 1, 0), 0);
  const gp = new THREE_NS.Vector3();
  function pick(raycaster: THREE.Raycaster): BlockHit | null {
    const meshes = Array.from(buckets.values()).filter((b) => b.mesh.count > 0).map((b) => b.mesh);
    const hit = meshes.length ? raycaster.intersectObjects(meshes, false)[0] : undefined;
    if (hit && hit.instanceId !== undefined) {
      const b = buckets.get(hit.object.userData.blockBucket as string)!;
      const k = b.keys[hit.instanceId];
      const [x, y, z] = k.split(',').map(Number);
      // 哪一面:打中的点离格子中心哪一轴最远
      const dx = hit.point.x / S - (x + 0.5), dy = hit.point.y / S - (y + 0.5), dz = hit.point.z / S - (z + 0.5);
      const ax = Math.abs(dx), ay = Math.abs(dy), az = Math.abs(dz);
      const n = ax >= ay && ax >= az ? { x: Math.sign(dx), y: 0, z: 0 } : ay >= az ? { x: 0, y: Math.sign(dy), z: 0 } : { x: 0, y: 0, z: Math.sign(dz) };
      const block: BlockData = { x, y, z, s: 0, m: 0, c: 0, r: 0 };
      return { block, normal: n, place: { x: x + n.x, y: y + n.y, z: z + n.z }, point: { x: hit.point.x, y: hit.point.y, z: hit.point.z } };
    }
    if (!raycaster.ray.intersectPlane(ground, gp)) return null;
    return { block: null, normal: { x: 0, y: 1, z: 0 }, place: { x: cellOf(gp.x), y: 0, z: cellOf(gp.z) }, point: { x: gp.x, y: 0, z: gp.z } };
  }

  // 预览框
  const ghostGeo = new THREE_NS.BoxGeometry(1, 1, 1);
  const ghostEdges = new THREE_NS.EdgesGeometry(ghostGeo);
  const ghostMat = new THREE_NS.LineBasicMaterial({ color: 0x25f4ee, transparent: true, opacity: 0.9, depthTest: false });
  const ghost = new THREE_NS.LineSegments(ghostEdges, ghostMat);
  ghost.renderOrder = 5;
  ghost.visible = false;
  ghost.userData.noCapture = true;
  root.add(ghost);
  function setGhost(a: { x: number; y: number; z: number } | null, b?: { x: number; y: number; z: number }, removeMode = false) {
    if (!a) { ghost.visible = false; return; }
    const c = b ?? a;
    const x0 = Math.min(a.x, c.x), x1 = Math.max(a.x, c.x), y0 = Math.min(a.y, c.y), y1 = Math.max(a.y, c.y), z0 = Math.min(a.z, c.z), z1 = Math.max(a.z, c.z);
    ghost.scale.set((x1 - x0 + 1) * S + 0.01, (y1 - y0 + 1) * S + 0.01, (z1 - z0 + 1) * S + 0.01);
    ghost.position.set((x0 + x1 + 1) * S / 2, (y0 + y1 + 1) * S / 2, (z0 + z1 + 1) * S / 2);
    ghostMat.color.setHex(removeMode ? 0xff6b6b : 0x25f4ee);
    ghost.visible = true;
  }

  return {
    load,
    applyOps,
    pick,
    setGhost,
    count: () => where.size,
    dispose: () => {
      parent.remove(root);
      for (const b of buckets.values()) b.mesh.dispose();
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => { (m as THREE.MeshStandardMaterial).map?.dispose(); m.dispose(); });
      ghostGeo.dispose(); ghostEdges.dispose(); ghostMat.dispose();
    },
  };
}

/** 材质的默认颜色(调色板没选颜色时用) */
export const matColor = (m: number) => MATS.find((x) => x.id === m)?.color ?? 0xffffff;
