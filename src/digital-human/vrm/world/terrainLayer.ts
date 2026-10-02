/**
 * vrm/world/terrainLayer.ts — 把地形画出来
 *
 * 一张网格(w × h 段),每个点的高度就是顶点的高,颜色按那个点的物质(物质登记表的颜色)。
 * 改地形只更新改到的那一块顶点再重算法线。比房间地板(0.02 米)再高 1 厘米,盖住地板;没有地形时整个藏起来。
 * 点选:射线打到地形上的哪一点(改地形用);笔刷预览是一个贴着地形的圈。
 */

import type * as THREE from 'three';
import { matColor } from './materials';
import type { TerrainData, TerrainPatch } from './terrain';

/** 平的地方画在多高:房间地板在 0.02 米,再高一点盖住它 */
const FLOOR_LIFT = 0.03;

export interface TerrainLayer {
  load: (t: TerrainData | null) => void;
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
    applyPatch,
    pick,
    setBrush,
    dispose: () => {
      parent.remove(root);
      mesh?.geometry.dispose();
      mat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
    },
  };
}
