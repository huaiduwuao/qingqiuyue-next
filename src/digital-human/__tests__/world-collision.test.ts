import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { clampToWorld, pushOutOfBoxes, type Obstacle, type WorldDef } from '../vrm/world/worldLayout';
import { blocksWalking, createObjectLayer, type PlacedObject } from '../vrm/world/worldObjects';
import { SNAP_MOVE, SNAP_TURN } from '../scene-ui/RoomEditor';

// 模型「加载」:按素材 key 给一个盒子(宽 x 深 z 高 y,脚底在 0;off = 盒子在模型里偏开的 x)
const SHAPES: Record<string, { w: number; h: number; d: number; off?: number }> = {
  table: { w: 2, h: 0.8, d: 1 },
  side: { w: 1, h: 0.8, d: 1, off: 0.5 },
  rug: { w: 2, h: 0.02, d: 2 },
};
vi.mock('../vrm/world/realKit', () => ({
  createRealKit: () => {
    const make = async (key: string) => {
      const s = SHAPES[key];
      const g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), new THREE.MeshBasicMaterial());
      m.position.set(s.off ?? 0, s.h / 2, 0);
      g.add(m);
      return g;
    };
    return { canKtx2: false, model: make, modelFile: make, dispose: () => undefined };
  },
}));

const room: WorldDef = { key: 'room:7', name: '小屋', kind: 'room', room: { template: 'study' } as WorldDef['room'], stage: 'studio', zones: [] } as unknown as WorldDef;

describe('pushOutOfBoxes', () => {
  const desk: Obstacle = { x: 0, z: 0, hx: 1, hz: 0.5, rot: 0 };
  it('leaves points outside alone', () => {
    expect(pushOutOfBoxes(3, 0, 0.35, [desk])).toEqual({ x: 3, z: 0 });
    expect(pushOutOfBoxes(0, 0.9, 0.35, [desk])).toEqual({ x: 0, z: 0.9 });
  });
  it('pushes out through the shallow side', () => {
    // 从前面贴上来:往 +z 推到 0.5 + 0.35
    const p = pushOutOfBoxes(0.2, 0.6, 0.35, [desk]);
    expect(p.x).toBeCloseTo(0.2);
    expect(p.z).toBeCloseTo(0.85);
    // 从右边:往 +x
    const q = pushOutOfBoxes(1.2, 0.1, 0.35, [desk]);
    expect(q.x).toBeCloseTo(1.35);
    expect(q.z).toBeCloseTo(0.1);
  });
  it('respects rotation', () => {
    // 转 90°:长边沿 z
    const turned: Obstacle = { ...desk, rot: Math.PI / 2 };
    const out = pushOutOfBoxes(0.9, 0, 0.35, [turned]); // 横着已经在外面(0.5 + 0.35 < 0.9)
    expect(out.x).toBeCloseTo(0.9);
    expect(out.z).toBeCloseTo(0);
    const end = pushOutOfBoxes(0, 1.2, 0.35, [turned]); // 长边那头:往 +z 推到 1 + 0.35
    expect(end.z).toBeCloseTo(1.35);
    const p = pushOutOfBoxes(0.6, 0.9, 0.35, [turned]);
    expect(p.x).toBeCloseTo(0.85);
    expect(p.z).toBeCloseTo(0.9);
  });
  it('does not shove into a neighbour', () => {
    const a: Obstacle = { x: 0, z: 0, hx: 0.5, hz: 0.5, rot: 0 };
    const b: Obstacle = { x: 1.7, z: 0, hx: 0.5, hz: 0.5, rot: 0 };
    const p = pushOutOfBoxes(0.7, 0.05, 0.35, [a, b]);
    for (const o of [a, b]) expect(Math.abs(p.x - o.x) >= o.hx + 0.35 - 1e-6 || Math.abs(p.z - o.z) >= o.hz + 0.35 - 1e-6).toBe(true);
  });
});

describe('clampToWorld with obstacles', () => {
  it('pushes out of furniture and keeps inside the walls', () => {
    const wardrobe: Obstacle = { x: 4.3, z: 0, hx: 0.4, hz: 1, rot: 0 }; // 贴着右墙(书斋 hx = 5)
    const p = clampToWorld(4.2, 0.9, room, [wardrobe]);
    expect(p.x).toBeLessThanOrEqual(5 - 0.35 - 0.15 + 1e-9);
    expect(Math.abs(p.z - 0) >= 1 + 0.35 - 1e-6 || p.x <= 4.3 - 0.4 - 0.35 + 1e-6).toBe(true);
    // 没有摆设时和以前一样
    expect(clampToWorld(1, 1, room)).toEqual({ x: 1, z: 1 });
    expect(clampToWorld(1, 1, room, [])).toEqual({ x: 1, z: 1 });
  });
});

describe('blocksWalking', () => {
  it('skips rugs, hanging lamps, poles and walk-on structures', () => {
    expect(blocksWalking({ hx: 0.5, hz: 0.5, bottom: 0, top: 0.8 })).toBe(true);
    expect(blocksWalking({ hx: 1, hz: 1, bottom: 0, top: 0.02 })).toBe(false);
    expect(blocksWalking({ hx: 0.3, hz: 0.3, bottom: 1.8, top: 2.4 })).toBe(false);
    expect(blocksWalking({ hx: 0.04, hz: 0.04, bottom: 0, top: 1.8 })).toBe(false);
    expect(blocksWalking({ hx: 3, hz: 1, bottom: 0, top: 0.6 })).toBe(false);
  });
});

describe('object layer obstacles', () => {
  const placed = (over: Partial<PlacedObject>): PlacedObject => ({ id: 'p', assetKey: 'table', x: 0, y: 0, z: 0, rotY: 0, scale: 1, status: 'ready', ...over });
  it('measures loaded models in their own frame, then places / turns / scales them', async () => {
    const parent = new THREE.Group();
    const layer = createObjectLayer(THREE, parent, { quality: 'high' });
    layer.set([
      placed({ id: 'a', assetKey: 'table', x: 1, z: 2, rotY: Math.PI / 2, scale: 1.5 }),
      placed({ id: 'b', assetKey: 'side', x: -2, z: 0, rotY: Math.PI / 2 }),
      placed({ id: 'c', assetKey: 'rug', x: 0, z: -2 }),
      placed({ id: 'd', assetKey: 'table', x: 3, z: 3, ghost: true }),
    ]);
    await new Promise((r) => setTimeout(r, 0));
    expect(layer.obstacles()).toEqual([]); // 还在长出来
    layer.tick(0, 1);
    await new Promise((r) => setTimeout(r, 210)); // 过了缓存
    const obs = layer.obstacles();
    expect(obs).toHaveLength(2);
    const a = obs[0];
    expect(a.x).toBeCloseTo(1);
    expect(a.z).toBeCloseTo(2);
    expect(a.hx).toBeCloseTo(1.5);
    expect(a.hz).toBeCloseTo(0.75);
    expect(a.rot).toBeCloseTo(Math.PI / 2);
    // 偏开 0.5 的盒子转 90°:局部 +x 朝世界 -z
    const b = obs[1];
    expect(b.x).toBeCloseTo(-2);
    expect(b.z).toBeCloseTo(-0.5);
    layer.dispose();
  });
});

describe('editor snapping', () => {
  it('snaps to a quarter metre and 15 degrees', () => {
    expect(SNAP_MOVE).toBe(0.25);
    expect((SNAP_TURN * 180) / Math.PI).toBeCloseTo(15);
  });
});
