import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TerrainData } from '../vrm/world/terrain';
import { createTerrainLayer } from '../vrm/world/terrainLayer';
import { setMaterials } from '../vrm/world/materials';

/** 和服务端一样的打包:每点 3 字节(高度 uint16 小端,厘米 + 物质) */
function pack(points: { h: number; m: number }[]): string {
  let s = '';
  for (const p of points) s += String.fromCharCode(p.h & 255, (p.h >> 8) & 255, p.m);
  return btoa(s);
}

describe('terrain data', () => {
  // 2 × 2 格(3 × 3 个点),左下角 (-0.5, -0.5);中间那个点 1 米高
  const pts = Array.from({ length: 9 }, (_, k) => ({ h: k === 4 ? 100 : 0, m: 7 }));
  const view = { x0: -0.5, z0: -0.5, cell: 0.5, w: 2, h: 2, data: pack(pts) };

  it('decodes and interpolates heights', () => {
    const t = TerrainData.decode(view)!;
    expect(t.heightAt(0, 0)).toBeCloseTo(1);
    expect(t.heightAt(0.25, 0)).toBeCloseTo(0.5);
    expect(t.heightAt(-0.5, -0.5)).toBe(0);
    expect(t.heightAt(5, 5)).toBe(0); // 出界
    expect(TerrainData.decode({ ...view, data: '' })).toBeNull();
    expect(TerrainData.decode({ ...view, w: 3 })).toBeNull(); // 大小对不上
  });

  it('reads signed heights (offset) and per-point water surfaces', () => {
    // offset 200:存的 50 = −1.5 米(挖到地板下)。液面:左边一列是 −0.5 米的水,右边一列是 −1 米的熔岩,中间干
    const wl = Array.from({ length: 9 }, (_, k) => (k % 3 === 0 ? { h: 150, m: 10 } : k % 3 === 2 ? { h: 100, m: 11 } : { h: 0xffff, m: 0 }));
    const dug = TerrainData.decode({ ...view, offset: 200, data: pack(Array.from({ length: 9 }, () => ({ h: 50, m: 7 }))), water: pack(wl) })!;
    expect(dug.heightAt(0, 0)).toBeCloseTo(-1.5);
    expect(dug.hasWater).toBe(true);
    expect(dug.surfaceAt(-0.25, 0)).toEqual({ level: -0.5, mat: 10 }); // 左边那格
    expect(dug.surfaceAt(0.25, 0)).toEqual({ level: -1, mat: 11 }); // 右边那格
    expect(dug.waterAt(-0.25, -0.8, 0)).toBe(10);
    expect(dug.waterAt(0.25, -0.8, 0)).toBeNull(); // 熔岩面只到 −1 米
    expect(dug.waterAt(0.25, -1.2, 0)).toBe(11);
    expect(dug.waterAt(9, -1, 9)).toBeNull(); // 网格外
    dug.applyPatch({ i0: 0, j0: 1, w: 1, h: 1, offset: 200, data: pack([{ h: 300, m: 7 }]) });
    expect(dug.waterAt(-0.5, -0.4, 0)).toBeNull(); // 那里鼓起来了,高过液面
    dug.setWater('');
    expect(dug.hasWater).toBe(false);
    expect(dug.surfaceAt(-0.25, 0)).toBeNull();
  });

  it('applies a patch', () => {
    const t = TerrainData.decode(view)!;
    t.applyPatch({ i0: 2, j0: 2, w: 1, h: 1, data: pack([{ h: 200, m: 12 }]) });
    expect(t.heightAt(0.5, 0.5)).toBeCloseTo(2);
    expect(t.mat[t.idx(2, 2)]).toBe(12);
  });

  it('draws a mesh, follows patches, and picks points on it', () => {
    setMaterials([{ id: 7, key: 'grass', name: '草', color: '#6aa84f' }]);
    const parent = new THREE.Group();
    const layer = createTerrainLayer(THREE, parent);
    layer.load(TerrainData.decode(view));
    let mesh: THREE.Mesh | null = null;
    parent.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.name === 'dh-terrain') mesh = o as THREE.Mesh; });
    expect(mesh).not.toBeNull();
    const pos = mesh!.geometry.getAttribute('position');
    expect(pos.count).toBe(9);
    expect(pos.getY(4)).toBeCloseTo(1.03);
    layer.applyPatch({ i0: 1, j0: 1, w: 1, h: 1, data: pack([{ h: 50, m: 7 }]) });
    expect(pos.getY(4)).toBeCloseTo(0.53);
    // 从上往下打一条射线
    const rc = new THREE.Raycaster(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, -1, 0));
    parent.updateMatrixWorld(true);
    const hit = layer.pick(rc);
    expect(hit?.y).toBeCloseTo(0.53);
    layer.load(null);
    expect(layer.pick(rc)).toBeNull();
    layer.dispose();
  });

  it('draws one water mesh per liquid at each pond\'s own level', () => {
    setMaterials([{ id: 7, key: 'grass', name: '草', color: '#6aa84f' }, { id: 10, key: 'water', name: '水', color: '#3a8fd0' }, { id: 11, key: 'lava', name: '熔岩', color: '#ff5a1f' }]);
    const parent = new THREE.Group();
    const layer = createTerrainLayer(THREE, parent);
    const wl = Array.from({ length: 9 }, (_, k) => (k % 3 === 0 ? { h: 150, m: 10 } : k % 3 === 2 ? { h: 100, m: 11 } : { h: 0xffff, m: 0 }));
    layer.load(TerrainData.decode({ ...view, offset: 200, data: pack(Array.from({ length: 9 }, () => ({ h: 50, m: 7 }))), water: pack(wl) }));
    const waters = () => { const out: THREE.Mesh[] = []; parent.traverse((o) => { if (o.name === 'dh-terrain-water') out.push(o as THREE.Mesh); }); return out; };
    const ys = waters().map((m) => m.geometry.getAttribute('position').getY(0)).sort((a, b) => a - b);
    expect(ys.length).toBe(2);
    expect(ys[0]).toBeCloseTo(-0.97); // 熔岩 −1 米(+ 地形抬的 3 厘米)
    expect(ys[1]).toBeCloseTo(-0.47); // 水 −0.5 米
    layer.setWater(pack(wl.map((p, k) => (k % 3 === 2 ? { h: 0xffff, m: 0 } : p)))); // 熔岩抽掉了
    expect(waters().length).toBe(1);
    layer.setWater(null);
    expect(waters().length).toBe(0);
    layer.dispose();
  });
});
