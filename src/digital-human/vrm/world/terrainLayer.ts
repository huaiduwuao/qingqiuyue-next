/**
 * vrm/world/terrainLayer.ts — 把地形画出来
 *
 * 一张网格(w × h 段),每个点的高度就是顶点的高,颜色按那个点的物质(物质登记表的颜色)。
 * 改地形只更新改到的那一块顶点再重算法线。比房间地板(0.02 米)再高 1 厘米,盖住地板;没有地形时整个藏起来。
 * 四周一圈土边从地形边一直垂到地板下 2 米(挖下去的坑从房间外面看不穿);液面:每一格有水的画一块
 * 半透明的平面(那片水的高度、按那种液体的物质画,同种液体并成一个网格),地形高过液面的地方自然把它挡住。
 * 点选:射线打到地形上的哪一点(改地形用);笔刷预览是一个贴着地形的圈。
 */

import type * as THREE from 'three';
import { matColor } from './materials';
import { makeMaterial } from './blockLayer';
import { WATER_DRY, type TerrainData, type TerrainPatch } from './terrain';

/** 平的地方画在多高:房间地板在 0.02 米,再高一点盖住它 */
const FLOOR_LIFT = 0.03;

export interface TerrainLayer {
  load: (t: TerrainData | null) => void;
  /** 液面换了(服务端打包的一整张;null / 空 = 没水) */
  setWater: (b64: string | null) => void;
  applyPatch: (p: TerrainPatch) => void;
  pick: (raycaster: THREE.Raycaster) => { x: number; y: number; z: number } | null;
  /** 笔刷预览圈:null = 不显示 */
  setBrush: (b: { x: number; z: number; r: number; color?: number } | null) => void;
  dispose: () => void;
}

export function createTerrainLayer(THREE_NS: typeof THREE, parent: THREE.Object3D): TerrainLayer {
  const root = new THREE_NS.Group();
  root.name = 'dh-world-terrain';
  parent.add(root);
  let data: TerrainData | null = null;
  let mesh: THREE.Mesh | null = null;
  const mat = new THREE_NS.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  const col = new THREE_NS.Color();

  function writeVertex(pos: THREE.BufferAttribute, colors: THREE.BufferAttribute, i: number, j: number) {
    const t = data!;
    const k = t.idx(i, j);
    pos.setXYZ(k, t.x0 + i * t.cell, t.height[k] / 100 + FLOOR_LIFT, t.z0 + j * t.cell);
    col.setHex(matColor(t.mat[k])).convertSRGBToLinear();
    colors.setXYZ(k, col.r, col.g, col.b);
  }

  function load(t: TerrainData | null) {
    data = t;
    if (mesh) { root.remove(mesh); mesh.geometry.dispose(); mesh = null; }
    if (!t) return;
    const n = (t.w + 1) * (t.h + 1);
    const geo = new THREE_NS.BufferGeometry();
    const pos = new THREE_NS.BufferAttribute(new Float32Array(n * 3), 3);
    const colors = new THREE_NS.BufferAttribute(new Float32Array(n * 3), 3);
    pos.setUsage(THREE_NS.DynamicDrawUsage);
    colors.setUsage(THREE_NS.DynamicDrawUsage);
    const index: number[] = [];
    for (let j = 0; j < t.h; j++) for (let i = 0; i < t.w; i++) {
      const a = t.idx(i, j), b = t.idx(i + 1, j), c = t.idx(i, j + 1), d = t.idx(i + 1, j + 1);
      index.push(a, c, b, b, c, d);
    }
    for (let j = 0; j <= t.h; j++) for (let i = 0; i <= t.w; i++) writeVertex(pos, colors, i, j);
    geo.setAttribute('position', pos);
    geo.setAttribute('color', colors);
    geo.setIndex(index);
    geo.computeVertexNormals();
    mesh = new THREE_NS.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.name = 'dh-terrain';
    root.add(mesh);
    buildSkirt();
    buildWater();
  }

  // 四周的土边:每条边上的点往下垂到 SKIRT_Y
  const SKIRT_Y = -2.05;
  const skirtMat = new THREE_NS.MeshStandardMaterial({ color: 0x5a4632, roughness: 1, side: THREE_NS.DoubleSide });
  let skirt: THREE.Mesh | null = null;
  function buildSkirt() {
    if (skirt) { root.remove(skirt); skirt.geometry.dispose(); skirt = null; }
    const t = data;
    if (!t) return;
    const ring: [number, number][] = [];
    for (let i = 0; i <= t.w; i++) ring.push([i, 0]);
    for (let j = 1; j <= t.h; j++) ring.push([t.w, j]);
    for (let i = t.w - 1; i >= 0; i--) ring.push([i, t.h]);
    for (let j = t.h - 1; j >= 1; j--) ring.push([0, j]);
    ring.push(ring[0]);
    const pos: number[] = [];
    for (let k = 0; k < ring.length - 1; k++) {
      const [a, b] = ring[k], [c, d] = ring[k + 1];
      const x1 = t.x0 + a * t.cell, z1 = t.z0 + b * t.cell, y1 = t.height[t.idx(a, b)] / 100 + FLOOR_LIFT;
      const x2 = t.x0 + c * t.cell, z2 = t.z0 + d * t.cell, y2 = t.height[t.idx(c, d)] / 100 + FLOOR_LIFT;
      pos.push(x1, y1, z1, x1, SKIRT_Y, z1, x2, y2, z2, x2, y2, z2, x1, SKIRT_Y, z1, x2, SKIRT_Y, z2);
    }
    const geo = new THREE_NS.BufferGeometry();
    geo.setAttribute('position', new THREE_NS.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    skirt = new THREE_NS.Mesh(geo, skirtMat);
    skirt.name = 'dh-terrain-skirt';
    root.add(skirt);
  }

  // 液面:每种液体一个网格
  const waterMeshes: THREE.Mesh[] = [];
  function setWater(b64: string | null) {
    data?.setWater(b64);
    buildWater();
  }
  function buildWater() {
    for (const m of waterMeshes.splice(0)) { root.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    const t = data;
    const lv = t?.waterLevel, mt = t?.waterMat;
    if (!t || !lv || !mt) return;
    const byMat = new Map<number, number[]>();
    for (let j = 0; j < t.h; j++) for (let i = 0; i < t.w; i++) {
      let best = WATER_DRY, mat = -1;
      for (const k of [t.idx(i, j), t.idx(i + 1, j), t.idx(i, j + 1), t.idx(i + 1, j + 1)]) {
        if (lv[k] !== WATER_DRY && lv[k] > best) { best = lv[k]; mat = mt[k]; }
      }
      if (best === WATER_DRY) continue;
      const y = best / 100 + FLOOR_LIFT;
      const xa = t.x0 + i * t.cell, xb = xa + t.cell, za = t.z0 + j * t.cell, zb = za + t.cell;
      let arr = byMat.get(mat);
      if (!arr) byMat.set(mat, (arr = []));
      arr.push(xa, y, za, xa, y, zb, xb, y, za, xb, y, za, xa, y, zb, xb, y, zb);
    }
    for (const [mat, pos] of byMat) {
      const geo = new THREE_NS.BufferGeometry();
      geo.setAttribute('position', new THREE_NS.Float32BufferAttribute(pos, 3));
      geo.computeVertexNormals();
      waterMeshes.push(makeWaterMesh(geo, mat));
    }
  }
  function makeWaterMesh(geo: THREE.BufferGeometry, mat: number) {
    const m = makeMaterial(THREE_NS, mat);
    (m as THREE.MeshStandardMaterial).color?.set(`#${matColor(mat).toString(16).padStart(6, '0')}`);
    // 大片水面太光滑会把房间的墙全反射出来(看着像泥),压一压反射,让水自己的颜色出来
    const std = m as THREE.MeshStandardMaterial;
    // 房间的暖光会把蓝色压成土色:给水一点自己的光
    if (std.isMeshStandardMaterial) { std.roughness = Math.max(std.roughness, 0.35); std.envMapIntensity = 0.25; std.emissive.copy(std.color).multiplyScalar(0.45); }
    if (!(m as THREE.MeshStandardMaterial).transparent && !(m as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
      m.transparent = true;
      m.opacity = 0.6;
      m.depthWrite = false;
    }
    const mesh = new THREE_NS.Mesh(geo, m);
    mesh.name = 'dh-terrain-water';
    mesh.renderOrder = 2;
    root.add(mesh);
    return mesh;
  }

  function applyPatch(p: TerrainPatch) {
    if (!data || !mesh) return;
    data.applyPatch(p);
    const geo = mesh.geometry;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const colors = geo.getAttribute('color') as THREE.BufferAttribute;
    for (let j = p.j0; j < p.j0 + p.h; j++) for (let i = p.i0; i < p.i0 + p.w; i++) {
      if (i >= 0 && j >= 0 && i <= data.w && j <= data.h) writeVertex(pos, colors, i, j);
    }
    pos.needsUpdate = true;
    colors.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    if (p.i0 === 0 || p.j0 === 0 || p.i0 + p.w > data.w || p.j0 + p.h > data.h) buildSkirt(); // 改到边了:土边跟着
  }

  function pick(raycaster: THREE.Raycaster) {
    if (!mesh) return null;
    const hit = raycaster.intersectObject(mesh, false)[0];
    if (!hit) return null;
    const p = root.worldToLocal(hit.point.clone());
    return { x: p.x, y: p.y, z: p.z };
  }

  // 笔刷圈:一圈线,每帧不动,设的时候按地形高度贴上去
  const ringGeo = new THREE_NS.BufferGeometry();
  const ringPts = new Float32Array(65 * 3);
  ringGeo.setAttribute('position', new THREE_NS.BufferAttribute(ringPts, 3));
  const ringMat = new THREE_NS.LineBasicMaterial({ color: 0x25f4ee, transparent: true, opacity: 0.9, depthTest: false });
  const ring = new THREE_NS.Line(ringGeo, ringMat);
  ring.visible = false;
  ring.renderOrder = 5;
  ring.userData.noCapture = true;
  root.add(ring);
  function setBrush(b: { x: number; z: number; r: number; color?: number } | null) {
    if (!b) { ring.visible = false; return; }
    for (let k = 0; k <= 64; k++) {
      const a = (k / 64) * Math.PI * 2;
      const x = b.x + Math.cos(a) * b.r, z = b.z + Math.sin(a) * b.r;
      ringPts[k * 3] = x;
      ringPts[k * 3 + 1] = (data ? data.heightAt(x, z) : 0) + 0.04;
      ringPts[k * 3 + 2] = z;
    }
    (ringGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    ringMat.color.setHex(b.color ?? 0x25f4ee);
    ring.visible = true;
  }

  return {
    load,
    setWater,
    applyPatch,
    pick,
    setBrush,
    dispose: () => {
      parent.remove(root);
      mesh?.geometry.dispose();
      mat.dispose();
      skirt?.geometry.dispose();
      skirtMat.dispose();
      for (const m of waterMeshes) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
      ringGeo.dispose();
      ringMat.dispose();
    },
  };
}
