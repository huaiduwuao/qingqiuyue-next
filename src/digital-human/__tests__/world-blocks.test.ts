import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { act, renderHook } from '@testing-library/react';
import { BLOCK_SIZE, BlockGrid, decodeBlocks, fillOps, flowAt, glowLights, rampDir, slowAt, topAt, type BlockData } from '../vrm/world/blocks';
import { createBlockLayer } from '../vrm/world/blockLayer';
import { matColor, matPhysics, materialsVersion, pickableMaterials, setMaterials, setRoomMaterials, type BlockMaterial } from '../vrm/world/materials';

// 和服务端 materials_seed.json 同样的几种
const MATERIALS: BlockMaterial[] = [
  { id: 0, key: 'plaster', name: '灰墙', color: '#e8e2d6', look: { pattern: 'speckle' }, props: { solid: true, walkable: true } },
  { id: 1, key: 'wood', name: '木', color: '#a0703c', look: { pattern: 'wood' }, props: { solid: true, walkable: true } },
  { id: 4, key: 'glass', name: '玻璃', color: '#bfe6ff', look: { opacity: 0.35 }, props: { solid: true, walkable: true } },
  { id: 10, key: 'water', name: '水', color: '#3a8fd0', look: { opacity: 0.55 }, props: { solid: false, walkable: false, liquid: { slow: 0.5, float: true } } },
  { id: 20, key: 'hedge', name: '树篱', color: '#2e7d5b', props: { solid: true, walkable: false } },
];

const api = vi.hoisted(() => ({
  getBlocks: vi.fn(async () => ({ blocks: '', n: 0, version: 1, canBuild: true })),
  listMaterials: vi.fn(async () => MATERIALS),
  getTerrain: vi.fn(async () => ({ x0: 0, z0: 0, cell: 0.5, w: 1, h: 1, data: '' })),
  editTerrain: vi.fn(async () => ({ changed: false })),
  clearTerrain: vi.fn(async () => undefined),
  editBlocks: vi.fn(async () => ({ applied: 1 })),
}));
vi.mock('@/apis/world', () => api);
import { useBlocks } from '../scene-ui/useBlocks';
import type { VrmStageHandle } from '../VrmStage';
import type { WorldDef } from '../vrm/world/worldLayout';

const blk = (x: number, y: number, z: number, s = 0, r = 0): BlockData => ({ x, y, z, s, m: 1, c: 0x8b5a2b, r });

function pack(list: BlockData[]): string {
  const buf = new Uint8Array(12 * list.length);
  const dv = new DataView(buf.buffer);
  list.forEach((b, i) => {
    dv.setInt16(i * 12, b.x, true); dv.setInt16(i * 12 + 2, b.y, true); dv.setInt16(i * 12 + 4, b.z, true);
    buf[i * 12 + 6] = b.s; buf[i * 12 + 7] = b.m; buf[i * 12 + 8] = (b.c >> 16) & 255; buf[i * 12 + 9] = (b.c >> 8) & 255; buf[i * 12 + 10] = b.c & 255; buf[i * 12 + 11] = b.r;
  });
  let bin = '';
  buf.forEach((v) => { bin += String.fromCharCode(v); });
  return btoa(bin);
}

describe('materials', () => {
  it('turns material data into walking rules', () => {
    setMaterials(MATERIALS);
    expect(matColor(1)).toBe(0xa0703c);
    expect(matPhysics(10)).toEqual({ solid: false, walkable: false, slow: 0.5, float: true, flow: 0, glow: null, climbable: false });
    expect(matPhysics(99)).toEqual({ solid: true, walkable: true, slow: 0, float: false, flow: 0, glow: null, climbable: false }); // 不认识的当普通方块
    const g = new BlockGrid();
    // 一格水铺在地上:穿得过、站不上去、在里面走得慢
    g.set({ x: 0, y: 0, z: 0, s: 0, m: 10, c: 0, r: 0 });
    expect(g.surfaceAt(0.25, 0.25, 0)).toBe(0);
    expect(g.obstaclesNear(0.25, 1, 0)).toEqual([]);
    expect(slowAt(g, 0.25, 0.25, 0)).toBe(0.5);
    expect(slowAt(g, 1.25, 0.25, 0)).toBe(0);
    // 一格矮树篱:站不上去,所以就算只有半米高也挡路
    g.set({ x: 2, y: 0, z: 0, s: 0, m: 20, c: 0, r: 0 });
    expect(g.surfaceAt(1.25, 0.25, 0)).toBe(0);
    expect(g.obstaclesNear(1.25, 0.25, 0)).toHaveLength(1);
  });
});

describe('liquids and room materials', () => {
  it('floats in deep water, wades in shallow water, and climbs out at the edge', () => {
    setMaterials(MATERIALS);
    const g = new BlockGrid();
    // 一个 4 格深(2 米)的水池:x 0..1,池底 y = 0..3 全是水;池边 x = 2 是 4 格高的石头(顶 2 米)
    for (let y = 0; y < 4; y++) { g.set({ x: 0, y, z: 0, s: 0, m: 10, c: 0, r: 0 }); g.set({ x: 1, y, z: 0, s: 0, m: 10, c: 0, r: 0 }); g.set({ x: 2, y, z: 0, s: 0, m: 0, c: 0, r: 0 }); }
    // 深水:浮在液面(2 米)下 1 米
    expect(g.surfaceAt(0.25, 0.25, 0)).toBeCloseTo(1.0);
    expect(g.inLiquid(0.25, 0.25, 1)).toBe(true);
    // 浮在 1 米时,岸边 2 米高也爬得上去(泡在水里一步能迈 1.15 米)
    expect(g.obstaclesNear(0.75, 0.25, 1.0, 1)).toHaveLength(0);
    expect(g.surfaceAt(1.25, 0.25, 1.0)).toBeCloseTo(2.0);
    // 不在水里时,同样 1 米的高差迈不上去
    const dry = new BlockGrid();
    for (let y = 0; y < 4; y++) dry.set({ x: 2, y, z: 0, s: 0, m: 0, c: 0, r: 0 });
    dry.set({ x: 1, y: 0, z: 0, s: 0, m: 0, c: 0, r: 0 }); dry.set({ x: 1, y: 1, z: 0, s: 0, m: 0, c: 0, r: 0 });
    expect(dry.obstaclesNear(0.75, 0.25, 1.0, 1).length).toBeGreaterThan(0);
    // 浅水(一格,0.5 米):踩着池底走
    const shallow = new BlockGrid();
    shallow.set({ x: 0, y: 0, z: 0, s: 0, m: 10, c: 0, r: 0 });
    expect(shallow.surfaceAt(0.25, 0.25, 0)).toBe(0);
  });

  it('overlays the room\'s own materials (200–255) on the platform ones', () => {
    setMaterials(MATERIALS);
    setRoomMaterials([{ id: 200, key: 'lava', name: '熔岩', color: '#ff5a1f', look: { unlit: true }, props: { solid: false, walkable: false } }, { id: 12, key: 'sneaky', name: '冒充平台', color: '#000000' }]);
    expect(matColor(200)).toBe(0xff5a1f);
    expect(matPhysics(200).solid).toBe(false);
    expect(matColor(12)).toBe(0xffffff); // 房间不能占平台的 id
    expect(pickableMaterials().map((m) => m.key)).toContain('lava');
    setRoomMaterials([]);
    expect(pickableMaterials().map((m) => m.key)).not.toContain('lava');
  });
});

describe('ground under the blocks', () => {
  it('stands on the terrain (base) where there is no block, and on blocks above it', () => {
    setMaterials(MATERIALS);
    const g = new BlockGrid();
    expect(g.surfaceAt(0.25, 0.25, -1, 0, -1.2)).toBeCloseTo(-1.2); // 坑底
    g.set({ x: 0, y: 0, z: 0, s: 0, m: 1, c: 0, r: 0 });
    expect(g.surfaceAt(0.25, 0.25, 0, 0, -1.2)).toBeCloseTo(0.5); // 坑上搭了一块木头
    expect(g.surfaceAt(0.25, 0.25, 0, 0, 0.8)).toBeCloseTo(0.8); // 地形比积木高
  });
});

describe('diving and climbing', () => {
  it('dives below the float height down to the bottom', () => {
    setMaterials(MATERIALS);
    const g = new BlockGrid();
    for (let y = 0; y < 6; y++) g.set({ x: 0, y, z: 0, s: 0, m: 10, c: 0, r: 0 }); // 3 米深
    expect(g.surfaceAt(0.25, 0.25, 2, 0)).toBeCloseTo(2); // 浮着:液面 3 米下 1 米
    expect(g.surfaceAt(0.25, 0.25, 2, 1.5)).toBeCloseTo(0.5); // 潜下去 1.5 米
    expect(g.surfaceAt(0.25, 0.25, 2, 10)).toBe(0); // 潜到底就停
  });

  it('climbs a ladder up to its top, then onto the ledge', () => {
    setMaterials([...MATERIALS, { id: 15, key: 'ladder', name: '梯子', color: '#8a5a2b', props: { solid: true, walkable: false, climbable: true } }]);
    const g = new BlockGrid();
    // 一面 2 米高的墙(x = 2 那一列 y 0..3)前面贴一架梯子(x = 1,薄墙)
    for (let y = 0; y < 4; y++) { g.set({ x: 2, y, z: 0, s: 0, m: 0, c: 0, r: 0 }); g.set({ x: 1, y, z: 0, s: 3, m: 15, c: 0, r: 1 }); }
    // 站在梯子跟前(x = 0 那格):能爬到 2 米
    expect(g.climbTop(0.25, 0.25, 0)).toBeCloseTo(2);
    expect(g.surfaceAt(0.25, 0.25, 0)).toBeCloseTo(2);
    // 爬到 2 米时,墙顶(2 米)不挡,能走上去,站在墙顶
    expect(g.obstaclesNear(0.25, 0.25, 2, 1).filter((o) => o.x > 0.9)).toHaveLength(0);
    expect(g.surfaceAt(1.25, 0.25, 2)).toBeCloseTo(2);
    // 离梯子远了就爬不了
    expect(g.climbTop(-1.25, 0.25, 0)).toBeNull();
    expect(g.surfaceAt(-1.25, 0.25, 0)).toBe(0);
  });
});

describe('flowing water and glowing blocks', () => {
  it('pushes along the block\'s direction', () => {
    setMaterials([...MATERIALS, { id: 13, key: 'flowing-water', name: '流水', color: '#4fa6e0', props: { solid: false, walkable: false, liquid: { slow: 0.4, flow: 1.5 } } }]);
    const g = new BlockGrid();
    g.set({ x: 0, y: 0, z: 0, s: 0, m: 13, c: 0, r: 3 }); // rot 3 = 往 +x
    g.set({ x: 2, y: 0, z: 0, s: 0, m: 10, c: 0, r: 3 }); // 静水不推
    expect(flowAt(g, 0.25, 0.25, 0)).toEqual({ x: 1.5, z: 0 });
    expect(flowAt(g, 1.25, 0.25, 0)).toBeNull();
    expect(flowAt(g, 0.25, 0.25, 3)).toBeNull(); // 人在高处,没泡着
  });

  it('groups glowing blocks into a few lights', () => {
    setMaterials([...MATERIALS, { id: 5, key: 'glow', name: '发光', color: '#ffd98a', look: { unlit: true }, props: { emits: { intensity: 3, radius: 3 } } }]);
    const g = new BlockGrid();
    for (let x = 0; x < 4; x++) g.set({ x, y: 0, z: 0, s: 0, m: 5, c: 0xff0000, r: 0 }); // 一簇 4 块红的
    g.set({ x: 20, y: 0, z: 0, s: 0, m: 5, c: 0x0000ff, r: 0 }); // 远处一块蓝的
    g.set({ x: 10, y: 0, z: 0, s: 0, m: 1, c: 0xffffff, r: 0 }); // 木头不发光
    const lights = glowLights(g);
    expect(lights).toHaveLength(2);
    expect(lights[0].count).toBe(4);
    expect(lights[0].color).toBe(0xff0000);
    expect(lights[0].x).toBeCloseTo(1); // 4 块中心的平均
    expect(lights[0].intensity).toBeGreaterThan(lights[1].intensity); // 块多更亮
    expect(lights[1].color).toBe(0x0000ff);
  });
});

describe('blocks data', () => {
  it('decodes the server packing, including negative coords', () => {
    const list = [blk(-9, 0, 6, 2, 3), { ...blk(8, 31, -7), c: 0xffffff, m: 9 }];
    expect(decodeBlocks(pack(list))).toEqual(list);
    expect(decodeBlocks('')).toEqual([]);
  });

  it('applies ops and returns the inverse', () => {
    const g = new BlockGrid();
    g.set(blk(0, 0, 0));
    const inv = g.apply([[1, 0, 1, 0, 1, 2, 0x999999, 0], [0, 0, 0, 0], [1, 0, 0, 0, 4, 6, 0x112233, 1]]);
    expect(g.size).toBe(2);
    expect(g.get(0, 0, 0)?.s).toBe(4);
    g.apply(inv);
    expect(g.size).toBe(1);
    expect(g.get(0, 0, 0)).toMatchObject({ s: 0, m: 1, c: 0x8b5a2b });
  });

  it('stands on cubes, slabs and ramps one step at a time', () => {
    const g = new BlockGrid();
    g.set(blk(0, 0, 0)); // 0.5 高
    g.set(blk(1, 0, 0)); g.set(blk(1, 1, 0)); // 两格摞起来 1.0 高
    g.set(blk(2, 0, 0, 1)); // 半砖 0.25
    const mid = (i: number) => (i + 0.5) * BLOCK_SIZE;
    expect(g.surfaceAt(mid(0), mid(0), 0)).toBeCloseTo(0.5); // 一步迈上去
    expect(g.surfaceAt(mid(1), mid(0), 0)).toBeCloseTo(0.5); // 1.0 太高:只算底下那格(钻进去是挡路判断的事)
    expect(g.surfaceAt(mid(1), mid(0), 0.5)).toBeCloseTo(1.0); // 站在 0.5 上能再上一格
    expect(g.surfaceAt(mid(2), mid(0), 0)).toBeCloseTo(0.25);
    expect(g.surfaceAt(mid(5), mid(5), 0)).toBe(0); // 空地
    // 斜坡 rot 0 往 -z 升:格子靠 +z 那边矮,靠 -z 那边高
    g.set(blk(4, 0, 0, 2, 0));
    expect(rampDir(0)).toEqual({ dx: 0, dz: -1 });
    expect(g.surfaceAt(mid(4), 0.49, 0)).toBeLessThan(0.05);
    expect(g.surfaceAt(mid(4), 0.01, 0)).toBeGreaterThan(0.45);
    expect(topAt(blk(0, 0, 0, 3), 0.5, 0.5)).toBeNull(); // 薄墙不能站
  });

  it('blocks what is too tall to step on, but not ramps', () => {
    const g = new BlockGrid();
    g.set(blk(0, 0, 0)); g.set(blk(0, 1, 0)); // 1 米高的墙
    g.set(blk(2, 0, 0)); // 0.5 一步能上
    g.set(blk(4, 0, 0, 2)); g.set(blk(4, 1, 0, 2)); // 斜坡不挡
    g.set(blk(6, 0, 0, 3, 1)); // 薄墙(沿 z)
    g.set(blk(0, 6, 0)); // 头顶 3 米处:不挡
    const obs = g.obstaclesNear(1, 0.25, 0, 4);
    const xs = obs.map((o) => +(o.x / BLOCK_SIZE - 0.5).toFixed(2)).sort((a, b) => a - b);
    expect(xs).toEqual([0, 6]);
    const pane = obs.find((o) => o.x > 3)!;
    expect(pane.hx).toBeCloseTo(0.05);
    expect(pane.hz).toBeCloseTo(BLOCK_SIZE / 2);
    // 站到 0.5 高处:原来那堵 1 米的墙一步能上了
    expect(g.obstaclesNear(1, 0.25, 0.5, 4).some((o) => Math.abs(o.x - 0.25) < 1e-6)).toBe(false);
  });

  it('fills and clears boxes with a size limit', () => {
    const g = new BlockGrid();
    const put = { s: 0, m: 2, c: 0x999999, r: 0 };
    const ops = fillOps({ x: 0, y: 0, z: 0 }, { x: 3, y: 1, z: -2 }, put, g)!;
    expect(ops).toHaveLength(4 * 2 * 3);
    g.apply(ops);
    expect(fillOps({ x: 0, y: 0, z: -9 }, { x: 9, y: 0, z: 9 }, null, g)).toHaveLength(4 * 3); // 只拆有的(y=0 那一层)
    expect(fillOps({ x: 0, y: 0, z: 0 }, { x: 20, y: 20, z: 20 }, put, g)).toBeNull();
  });
});

describe('block layer materials', () => {
  it('builds materials from data and rebuilds them when the data changes', () => {
    setMaterials(MATERIALS);
    const parent = new THREE.Group();
    const layer = createBlockLayer(THREE, parent);
    const g = new BlockGrid();
    g.set({ x: 0, y: 0, z: 0, s: 0, m: 4, c: 0xffffff, r: 0 });
    layer.load(g);
    const meshes: THREE.InstancedMesh[] = [];
    parent.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) meshes.push(o as THREE.InstancedMesh); });
    const mat = () => meshes[0].material as THREE.MeshStandardMaterial;
    expect(mat().transparent).toBe(true);
    expect(mat().opacity).toBeCloseTo(0.35);
    expect(meshes[0].castShadow).toBe(false);
    const v = materialsVersion();
    setMaterials(MATERIALS.map((m) => (m.id === 4 ? { ...m, look: { opacity: 1 } } : m)));
    expect(materialsVersion()).toBe(v + 1);
    layer.applyOps([], g);
    expect(mat().transparent).toBe(false);
    layer.dispose();
  });
});

describe('block layer', () => {
  it('draws instances per shape × material and picks faces', () => {
    const parent = new THREE.Group();
    const layer = createBlockLayer(THREE, parent);
    const g = new BlockGrid();
    g.set(blk(0, 0, 0)); g.set(blk(1, 0, 0)); g.set({ ...blk(0, 1, 0), m: 4 });
    layer.load(g);
    expect(layer.count()).toBe(3);
    const meshes: THREE.InstancedMesh[] = [];
    parent.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) meshes.push(o as THREE.InstancedMesh); });
    expect(meshes.map((m) => m.count).sort()).toEqual([1, 2]);
    parent.updateMatrixWorld(true);
    // 从正上方往下打到 (0,1,0) 那块的顶面:放在它上面一格
    const rc = new THREE.Raycaster(new THREE.Vector3(0.25, 5, 0.25), new THREE.Vector3(0, -1, 0));
    const hit = layer.pick(rc)!;
    expect(hit.block).toMatchObject({ x: 0, y: 1, z: 0 });
    expect(hit.place).toEqual({ x: 0, y: 2, z: 0 });
    // 从侧面打 (1,0,0) 的 +x 面
    const side = layer.pick(new THREE.Raycaster(new THREE.Vector3(5, 0.25, 0.25), new THREE.Vector3(-1, 0, 0)))!;
    expect(side.place).toEqual({ x: 2, y: 0, z: 0 });
    // 打在空地上:地面那一格
    const floor = layer.pick(new THREE.Raycaster(new THREE.Vector3(3.1, 5, -1.2), new THREE.Vector3(0, -1, 0)))!;
    expect(floor.block).toBeNull();
    expect(floor.place).toEqual({ x: 6, y: 0, z: -3 });
    // 增量:拆一块、换一块
    g.apply([[0, 1, 0, 0], [1, 0, 0, 0, 2, 1, 0xffffff, 1]]);
    layer.applyOps([[0, 1, 0, 0], [1, 0, 0, 0, 2, 1, 0xffffff, 1]], g);
    expect(layer.count()).toBe(2);
    layer.dispose();
  });
});

describe('useBlocks', () => {
  const def = { key: 'room:1', name: 'x', kind: 'room', stage: 'studio', zones: [], room: { ownerId: '1', ownerName: '', mine: true, template: 'study' } } as unknown as WorldDef;
  const fakeHandle = () => ({ setBlockGrid: vi.fn(), applyBlockOps: vi.fn(), setTerrain: vi.fn(), applyTerrainPatch: vi.fn() }) as unknown as VrmStageHandle & { setBlockGrid: ReturnType<typeof vi.fn>; applyBlockOps: ReturnType<typeof vi.fn> };

  it('loads, commits in batches, undoes, and skips its own echoes', async () => {
    vi.useFakeTimers();
    api.getBlocks.mockResolvedValueOnce({ blocks: pack([blk(0, 0, 0)]), n: 1, version: 3, canBuild: true });
    const handle = fakeHandle();
    const { result } = renderHook(() => useBlocks({ handle, def, enabled: true, me: '1', toast: vi.fn() }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.count).toBe(1);
    expect(result.current.canBuild).toBe(true);
    act(() => { result.current.commit([[1, 1, 0, 0, 0, 1, 0, 0]]); result.current.commit([[1, 2, 0, 0, 0, 1, 0, 0]]); });
    expect(result.current.count).toBe(3);
    expect(api.editBlocks).not.toHaveBeenCalled(); // 攒着
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(api.editBlocks).toHaveBeenCalledTimes(1);
    expect((api.editBlocks.mock.calls[0] as unknown as [string, number[][]])[1]).toHaveLength(2);
    act(() => { result.current.undo(); });
    expect(result.current.count).toBe(2);
    expect(result.current.canRedo).toBe(true);
    // 自己发的推回来:跳过;别人的:照改
    act(() => { result.current.applyRemote({ ops: [[0, 0, 0, 0]], by: '1' }); });
    expect(result.current.count).toBe(2);
    act(() => { result.current.applyRemote({ ops: [[0, 0, 0, 0]], by: '7' }); });
    expect(result.current.count).toBe(1);
    expect(handle.applyBlockOps).toHaveBeenLastCalledWith([[0, 0, 0, 0]]);
    vi.useRealTimers();
  });

  it('reloads when the server refuses', async () => {
    vi.useFakeTimers();
    api.getBlocks.mockClear();
    api.editBlocks.mockRejectedValueOnce(new Error('房主没让大家一起搭'));
    const toast = vi.fn();
    const h2 = fakeHandle();
    const { result } = renderHook(() => useBlocks({ handle: h2, def, enabled: true, me: '7', toast }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    act(() => { result.current.commit([[1, 0, 0, 0, 0, 0, 0, 0]]); });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(toast).toHaveBeenCalledWith('🧱', '房主没让大家一起搭');
    expect(api.getBlocks).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
