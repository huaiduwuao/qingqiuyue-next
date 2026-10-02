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

  it('reads signed heights (offset) and the water surface', () => {
    // offset 200:存的 50 = −1.5 米(挖到地板下)
    const dug = TerrainData.decode({ ...view, offset: 200, data: pack(Array.from({ length: 9 }, () => ({ h: 50, m: 7 }))), water: { level: -0.5, mat: 10 } })!;
    expect(dug.heightAt(0, 0)).toBeCloseTo(-1.5);
    expect(dug.waterAt(0, -1, 0)).toBe(10); // 坑里是水
    expect(dug.waterAt(0, 0, 0)).toBeNull(); // 高过水面
    expect(dug.waterAt(9, -1, 9)).toBeNull(); // 网格外
    dug.applyPatch({ i0: 1, j0: 1, w: 1, h: 1, offset: 200, data: pack([{ h: 300, m: 7 }]) });
    expect(dug.heightAt(0, 0)).toBeCloseTo(1);
    expect(dug.waterAt(0, -0.8, 0)).toBeNull(); // 那里鼓起来了,高过水面
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
});
